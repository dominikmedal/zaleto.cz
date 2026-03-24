"""
Exim Tours scraper — píše přímo do zaleto.db (normalizované schéma hotels + tours).

Stejná platforma jako Fischer (derTouristik / abnbHotelDetail), liší se BASE_URL,
AGENCY a tím, že embedded JSON má wrapper hotelDetailInfo.

Pipeline na hotel:
  1. GET hotel URL + ?TO={airport} → embedded JSON (server-side rendered)
  2. Extrakce: hotelDataKey, destinationIds, transportOrigin, sezóna, ...
  3. POST /api/SearchOffer/GetOfferWithOptions → všechny dostupné termíny
  4. Upsert hotel → zaleto.hotels, upsert termíny → zaleto.tours

Použití:
  python eximtours.py                  # stáhne všechny hotely ze sitemapy
  python eximtours.py --limit 20       # jen prvních 20 hotelů (test)
  python eximtours.py --delay 2.0      # pauza 2s mezi hotely
"""

import argparse
import json
import logging
import os
import re
import sqlite3
import time
import unicodedata
import urllib.parse
from datetime import datetime, timedelta
from html.parser import HTMLParser
from pathlib import Path

import requests

# ---------------------------------------------------------------------------
# Konfigurace
# ---------------------------------------------------------------------------

BASE_URL = "https://www.eximtours.cz"
AGENCY   = "Exim Tours"

DEFAULT_DB = str(Path(__file__).resolve().parent.parent / "data" / "zaleto.db")
DB_PATH    = os.environ.get("DATABASE_PATH", DEFAULT_DB)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("eximtours")


# ---------------------------------------------------------------------------
# Slugify
# ---------------------------------------------------------------------------

def slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    text = re.sub(r"[^\w\s-]", "", text).strip().lower()
    return re.sub(r"[\s_-]+", "-", text)


# ---------------------------------------------------------------------------
# DB helpers (stejné schéma jako Fischer)
# ---------------------------------------------------------------------------

class ZaletoDB:
    def __init__(self):
        Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(DB_PATH, timeout=30)
        self.conn.execute("PRAGMA journal_mode = WAL")
        self.conn.execute("PRAGMA foreign_keys = ON")
        self.conn.row_factory = sqlite3.Row
        self._migrate()

    def _migrate(self):
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS hotels (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                slug TEXT UNIQUE NOT NULL,
                agency TEXT NOT NULL,
                name TEXT NOT NULL,
                country TEXT,
                destination TEXT,
                resort_town TEXT,
                stars INTEGER,
                review_score REAL,
                description TEXT,
                thumbnail_url TEXT,
                photos TEXT,
                amenities TEXT,
                tags TEXT,
                distances TEXT,
                food_options TEXT,
                price_includes TEXT,
                latitude REAL,
                longitude REAL,
                api_config TEXT,
                canonical_slug TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            )
        """)
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS tours (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                hotel_id INTEGER NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
                agency TEXT NOT NULL,
                departure_date TEXT,
                return_date TEXT,
                duration INTEGER,
                price REAL NOT NULL,
                transport TEXT,
                meal_plan TEXT,
                adults INTEGER DEFAULT 2,
                room_code TEXT,
                url TEXT UNIQUE NOT NULL,
                is_last_minute INTEGER DEFAULT 0,
                is_first_minute INTEGER DEFAULT 0,
                departure_city TEXT,
                price_single REAL,
                url_single TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            )
        """)
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS hotel_stats (
                hotel_id INTEGER PRIMARY KEY REFERENCES hotels(id) ON DELETE CASCADE,
                min_price REAL,
                max_price REAL,
                available_dates INTEGER DEFAULT 0,
                next_departure TEXT,
                has_last_minute INTEGER DEFAULT 0,
                has_first_minute INTEGER DEFAULT 0,
                updated_at TEXT DEFAULT (datetime('now'))
            )
        """)
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS hotel_checkpoints (
                agency TEXT NOT NULL,
                hotel_url TEXT NOT NULL,
                cycle_date TEXT NOT NULL,
                PRIMARY KEY (agency, hotel_url)
            )
        """)
        for idx in [
            "CREATE INDEX IF NOT EXISTS idx_tours_hotel   ON tours(hotel_id)",
            "CREATE INDEX IF NOT EXISTS idx_tours_dep     ON tours(departure_date)",
            "CREATE INDEX IF NOT EXISTS idx_tours_price   ON tours(price)",
            "CREATE INDEX IF NOT EXISTS idx_hotels_slug   ON hotels(slug)",
            "CREATE INDEX IF NOT EXISTS idx_hotel_stats_p ON hotel_stats(min_price)",
        ]:
            try:
                self.conn.execute(idx)
            except Exception:
                pass

        # Runtime migrations pro starší DB
        existing = {r[1] for r in self.conn.execute("PRAGMA table_info(tours)")}
        for col, typ in [("price_single", "REAL"), ("url_single", "TEXT"),
                         ("departure_city", "TEXT"), ("is_last_minute", "INTEGER DEFAULT 0"),
                         ("is_first_minute", "INTEGER DEFAULT 0")]:
            if col not in existing:
                try:
                    self.conn.execute(f"ALTER TABLE tours ADD COLUMN {col} {typ}")
                except Exception:
                    pass
        self.conn.commit()

    def upsert_hotel(self, slug: str, h: dict) -> int:
        self.conn.execute("""
            INSERT INTO hotels (slug, agency, name, country, destination, resort_town,
                stars, review_score, description, thumbnail_url, photos, amenities, tags,
                distances, food_options, price_includes, latitude, longitude, api_config,
                canonical_slug, updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, datetime('now'))
            ON CONFLICT(slug) DO UPDATE SET
                agency=excluded.agency, name=excluded.name, country=excluded.country,
                destination=excluded.destination, resort_town=excluded.resort_town,
                stars=excluded.stars, review_score=excluded.review_score,
                description=excluded.description, thumbnail_url=excluded.thumbnail_url,
                photos=excluded.photos, amenities=excluded.amenities, tags=excluded.tags,
                distances=excluded.distances, food_options=excluded.food_options,
                price_includes=excluded.price_includes, latitude=excluded.latitude,
                longitude=excluded.longitude, api_config=excluded.api_config,
                updated_at=datetime('now')
        """, (
            slug, AGENCY,
            h["name"], h["country"], h["destination"], h["resort_town"],
            h["stars"], h["review_score"], h["description"],
            h["thumbnail_url"], h["photos"], h["amenities"], h.get("tags", ""),
            h.get("distances", ""), h.get("food_options", ""), h.get("price_includes", ""),
            h["latitude"], h["longitude"], h.get("api_config"),
            slug,
        ))
        return self.conn.execute("SELECT id FROM hotels WHERE slug = ?", (slug,)).fetchone()[0]

    def upsert_tour(self, hotel_id: int, t: dict):
        self.conn.execute("""
            INSERT INTO tours (hotel_id, agency, departure_date, return_date, duration,
                               price, transport, meal_plan, adults, room_code, url,
                               is_last_minute, is_first_minute, departure_city,
                               price_single, url_single, updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, datetime('now'))
            ON CONFLICT(url) DO UPDATE SET
                price           = excluded.price,
                meal_plan       = excluded.meal_plan,
                departure_city  = excluded.departure_city,
                is_last_minute  = excluded.is_last_minute,
                is_first_minute = excluded.is_first_minute,
                updated_at      = datetime('now')
        """, (
            hotel_id, AGENCY,
            t["departure_date"], t["return_date"], t["duration"],
            t["price"], t["transport"], t["meal_plan"],
            t.get("adults", 2), t.get("room_code"), t["url"],
            int(t.get("is_last_minute", False)),
            int(t.get("is_first_minute", False)),
            t.get("departure_city", ""),
            t.get("price_single"),
            t.get("url_single"),
        ))

    def mark_done(self, url: str):
        today = datetime.now().strftime("%Y-%m-%d")
        try:
            self.conn.execute(
                "INSERT OR IGNORE INTO hotel_checkpoints (agency, hotel_url, cycle_date) VALUES (?,?,?)",
                (AGENCY, url, today),
            )
        except Exception:
            pass

    def get_done_keys(self) -> set:
        today = datetime.now().strftime("%Y-%m-%d")
        try:
            rows = self.conn.execute(
                "SELECT hotel_url FROM hotel_checkpoints WHERE agency = ? AND cycle_date = ?",
                (AGENCY, today),
            ).fetchall()
            return {r[0] for r in rows}
        except Exception:
            return set()

    def commit(self):
        self.conn.commit()

    def close(self):
        self.conn.commit()
        self.conn.close()


# ---------------------------------------------------------------------------
# HTTP session
# ---------------------------------------------------------------------------

def _make_session() -> requests.Session:
    s = requests.Session()
    s.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                      "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept-Language": "cs-CZ,cs;q=0.9",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Referer": BASE_URL,
    })
    return s


# ---------------------------------------------------------------------------
# Sitemap
# ---------------------------------------------------------------------------

def get_hotel_urls(session: requests.Session, limit: int = 0) -> list[str]:
    hdrs = {"Accept": "application/xml,text/xml,*/*", "Content-Type": ""}
    urls = []

    for idx in range(20):
        sitemap_url = f"{BASE_URL}/sitemap-hotel-{idx}.xml"
        try:
            r = session.get(sitemap_url, headers=hdrs, timeout=20)
            if r.status_code == 404:
                break
            if r.status_code != 200:
                logger.debug(f"sitemap-hotel-{idx}.xml: HTTP {r.status_code}")
                break
            found = re.findall(
                r"<loc>(https://www\.eximtours\.cz/(?!sitemap)[^<]+)</loc>", r.text
            )
            if not found:
                break
            urls.extend(found)
            logger.info(f"  sitemap-hotel-{idx}.xml: {len(found)} URL")
        except Exception as e:
            logger.debug(f"sitemap-hotel-{idx}.xml error: {e}")
            break

    seen, result = set(), []
    for u in urls:
        if u not in seen:
            seen.add(u)
            result.append(u)

    if limit:
        result = result[:limit]

    logger.info(f"Sitemap: nalezeno {len(result)} hotelů")
    return result


# ---------------------------------------------------------------------------
# Embedded JSON parser — stejný div jako Fischer (abnbHotelDetail)
# ---------------------------------------------------------------------------

class _HotelJsonParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self._depth     = 0
        self._in_target = False
        self._in_script = False
        self.result     = None

    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        if tag == "div" and d.get("data-component-name") == "abnbHotelDetail":
            self._in_target = True
            self._depth     = 1
        elif self._in_target:
            if tag == "div":
                self._depth += 1
            if tag == "script" and d.get("type") == "application/json":
                self._in_script = True

    def handle_data(self, data):
        if self._in_script and self.result is None:
            self.result = data.strip()

    def handle_endtag(self, tag):
        if self._in_target and tag == "script":
            self._in_script = False
        if self._in_target and tag == "div":
            self._depth -= 1
            if self._depth <= 0:
                self._in_target = False


DEFAULT_AIRPORT = 4312  # Praha Václav Havel

AIRPORT_NAMES: dict[int, str] = {
    4312: "Praha",
    4313: "Brno",
    4314: "Ostrava",
}


def _fetch_embedded(session: requests.Session, url: str, airport: int = DEFAULT_AIRPORT) -> dict | None:
    if "TO=" not in url:
        sep = "&" if "?" in url else "?"
        url = f"{url}{sep}TO={airport}"
    try:
        r = session.get(url, timeout=25)
        if r.status_code != 200:
            logger.warning(f"HTTP {r.status_code}: {url}")
            return None
        parser = _HotelJsonParser()
        parser.feed(r.text)
        if parser.result:
            return json.loads(parser.result)
        logger.debug(f"Embedded JSON nenalezen: {url}")
        return None
    except Exception as e:
        logger.error(f"Fetch error {url}: {e}")
        return None


# ---------------------------------------------------------------------------
# Extrakce parametrů z embedded JSON
# ---------------------------------------------------------------------------

def _parse_embedded(embedded: dict) -> dict | None:
    try:
        # Exim obaluje data do hotelDetailInfo; Fischer nemá tento wrapper
        info     = embedded.get("hotelDetailInfo", embedded)
        data_new = info.get("dataNew") or embedded.get("dataNew") or {}
        hotel    = data_new.get("hotel", {})
        identifiers = hotel.get("identifiers", {})

        if not identifiers.get("hotelId"):
            return None

        hotel_data_key = {
            "hotelId":    identifiers["hotelId"],
            "giata":      identifiers.get("giata"),
            "dataSource": identifiers.get("dataSource", 8192),
            "bedBank":    identifiers.get("bedBank"),
            "bedBankID":  identifiers.get("bedBankID"),
        }

        # offerFilter může být na úrovni info nebo uvnitř dataNew
        offer_filter = info.get("offerFilter") or data_new.get("offerFilter") or {}
        if not offer_filter:
            offer_filter = {}

        destination_ids  = offer_filter.get("destinationIds", [])
        transport_origin = offer_filter.get("transportOrigin", [])
        meal_code        = offer_filter.get("mealCode", "")
        rooms            = offer_filter.get("rooms", [])
        room_code        = rooms[0].get("roomCode", "") if rooms else ""
        number_nights    = offer_filter.get("numberNights", [7])
        nights           = number_nights[0] if number_nights else 7
        all_nights       = number_nights if number_nights else [7]
        adults           = len([t for t in (rooms[0].get("travellers", []) if rooms else [])
                                if t.get("type") == 0]) or 2
        tour_filter_query = offer_filter.get("tourFilterQuery", "")

        # Fallback přes termsFilter / tourTip (Exim specifické)
        if not destination_ids or not transport_origin:
            terms = info.get("termsFilter") or info.get("tourTip") or tour_filter_query
            if terms:
                tip = dict(urllib.parse.parse_qsl(terms))
                if not destination_ids:
                    destination_ids = [int(d) for d in tip.get("D", "").split("|") if d.isdigit()]
                if not transport_origin and tip.get("TO", "").isdigit():
                    transport_origin = [int(tip["TO"])]

        mfd = (offer_filter.get("offerDate") or {}).get("mainFilterDates", [])
        main_from = mfd[0][:10] if len(mfd) > 0 else ""
        main_to   = mfd[1][:10] if len(mfd) > 1 else ""

        # Fallback dat z filterParametersDefault
        if not main_from or not main_to:
            fp = info.get("filterParametersDefault", "")
            if fp:
                fp_params = dict(urllib.parse.parse_qsl(fp))
                df = fp_params.get("DF", "")
                if "|" in df:
                    main_from, main_to = df.split("|", 1)
                    main_from = main_from[:10]
                    main_to   = main_to[:10]

        package_id = offer_filter.get("packageId", "")

        breadcrumbs = hotel.get("breadcrumbs", [])
        # Fallback: z hotelDetailInfo.destination pole
        if not breadcrumbs:
            dest_list = info.get("destination", [])
            breadcrumbs = [{"name": d["name"]} for d in dest_list if d.get("name")]

        destination = " / ".join(b["name"] for b in breadcrumbs) if breadcrumbs else ""
        resort_town = breadcrumbs[-1]["name"] if breadcrumbs else ""
        country     = breadcrumbs[0]["name"] if breadcrumbs else ""

        desc_obj    = hotel.get("description", {})
        description = desc_obj.get("mainDescription", "") if desc_obj else ""
        images      = [img["large"] for img in hotel.get("availableImages", []) if img.get("large")]

        # Fallback obrázky přes gallery + imageIds
        if not images:
            gallery   = hotel.get("gallery", {})
            image_ids = gallery.get("imageIds", [])
            hotel_slug = info.get("url", "").rstrip("/").split("/")[-1] if info.get("url") else ""
            for iid in image_ids[:10]:
                images.append(f"https://img.eximtours.cz/hotels/720/{hotel_slug}/{iid}.jpg")

        benefits = [b["title"] for b in hotel.get("mainBenefits", []) if b.get("title")]

        # Amenities z hotelEquipment (Exim struktura)
        hotel_equipment = hotel.get("hotelEquipment", {})
        if isinstance(hotel_equipment, dict):
            equip_items = hotel_equipment.get("items", []) or []
            amenities_list = [e.get("name", "") for e in equip_items if e.get("name")]
        elif isinstance(hotel_equipment, list):
            amenities_list = [e if isinstance(e, str) else e.get("name", "") for e in hotel_equipment]
        else:
            amenities_list = benefits

        geo       = hotel.get("geoLocation") or hotel.get("geolocation") or {}
        latitude  = geo.get("latitude") or geo.get("lat")
        longitude = geo.get("longitude") or geo.get("lng") or geo.get("lon")

        # Fallback GPS z hotelLocation
        if not latitude or not longitude:
            loc = hotel.get("hotelLocation", {}) or {}
            latitude  = loc.get("latitude") or loc.get("lat")
            longitude = loc.get("longitude") or loc.get("lng")

        rating_obj   = hotel.get("hotelRating", {}) or {}
        stars        = rating_obj.get("count") or info.get("star")
        review_score = rating_obj.get("ratingValue") or rating_obj.get("reviewScore")

        tags = [t.get("name", "") for t in hotel.get("tags", []) if t.get("name")]

        distances = hotel.get("distances", []) or []
        dist_text = " | ".join(
            f"{d.get('name','')}: {d.get('value','')} {d.get('unit','')}".strip()
            for d in distances if d.get("value")
        )

        return {
            "hotel_data_key":    hotel_data_key,
            "hotel_id":          identifiers["hotelId"],
            "hotel_name":        hotel.get("name", "") or info.get("identifier", ""),
            "stars":             stars,
            "review_score":      review_score,
            "description":       description,
            "images":            images,
            "amenities":         ", ".join(amenities_list),
            "tags":              ", ".join(tags),
            "distances":         dist_text,
            "latitude":          latitude,
            "longitude":         longitude,
            "destination":       destination,
            "resort_town":       resort_town,
            "country":           country,
            "destination_ids":   destination_ids,
            "transport_origin":  transport_origin,
            "meal_code":         meal_code,
            "room_code":         room_code,
            "nights":            nights,
            "all_nights":        all_nights,
            "adults":            adults,
            "departure_date":    "",
            "package_id":        package_id,
            "main_filter_from":  main_from,
            "main_filter_to":    main_to,
            "tour_filter_query": tour_filter_query,
            "_offer_filter":     offer_filter,
        }
    except Exception as e:
        logger.error(f"parse_embedded: {e}")
        return None


# ---------------------------------------------------------------------------
# API call — identický s Fischerem
# ---------------------------------------------------------------------------

def _get_offer(session: requests.Session, p: dict,
               date_from: str, date_to: str,
               nights_override: int | None = None) -> dict | None:
    mf_from = f"{p['main_filter_from']}T00:00:00" if p['main_filter_from'] else f"{date_from}T00:00:00"
    mf_to   = f"{p['main_filter_to']}T00:00:00"   if p['main_filter_to']   else f"{date_to}T00:00:00"
    adults  = p["adults"]
    nights  = nights_override if nights_override is not None else p["nights"]

    payload = {
        "destinationIds": p["destination_ids"],
        "flight": {
            "inboundIdentifier":  {"flightClass": "", "flightCode": "", "flightNumber": ""},
            "outboundIdentifier": {"flightClass": "", "flightCode": "", "flightNumber": ""},
        },
        "hotelDataKey":  p["hotel_data_key"],
        "mealCode":      p["meal_code"],
        "numberNights":  [nights],
        "offerDate": {
            "dateFrom":        f"{date_from}T00:00:00",
            "dateTo":          f"{date_to}T00:00:00",
            "mainFilterDates": [mf_from, mf_to],
        },
        "packageId":       p["package_id"],
        "rooms": [{
            "groupId":    1,
            "roomCode":   p["room_code"],
            "travellers": [{"age": 30, "id": i + 1, "type": 0} for i in range(adults)],
        }],
        "stopOver":        p["_offer_filter"].get("stopOver"),
        "transportOrigin": p["transport_origin"],
        "transportType":   1,
        "tourFilterQuery": p["tour_filter_query"],
    }

    try:
        r = session.post(
            f"{BASE_URL}/api/SearchOffer/GetOfferWithOptions",
            json=payload,
            headers={"Content-Type": "application/json", "Accept": "application/json"},
            timeout=30,
        )
        if r.status_code == 200 and r.text.strip():
            return r.json()
    except Exception as e:
        logger.error(f"API error: {e}")
    return None


# ---------------------------------------------------------------------------
# Detekce last minute / first minute
# ---------------------------------------------------------------------------

LAST_MINUTE_DAYS  = 21
FIRST_MINUTE_DAYS = 180


def _detect_tour_type(dep_dt: datetime) -> tuple[bool, bool]:
    today      = datetime.today().replace(hour=0, minute=0, second=0, microsecond=0)
    days_until = (dep_dt - today).days
    return 0 <= days_until <= LAST_MINUTE_DAYS, days_until >= FIRST_MINUTE_DAYS


# ---------------------------------------------------------------------------
# Sestavení záznamů
# ---------------------------------------------------------------------------

def _build_hotel_and_tours(hotel_url: str, p: dict, api_data: dict, airport_name: str = ""):
    offer     = api_data.get("offer", {})
    meal_name = offer.get("mealName", p["meal_code"])
    nights    = offer.get("nights", p["nights"])

    price_inc_obj  = offer.get("priceInclude", {})
    price_includes = " | ".join(price_inc_obj.get("texts", [])) if price_inc_obj else ""

    meal_options = api_data.get("mealOptions", [])
    food_options = " | ".join(
        f"{m.get('name')} {m.get('price',{}).get('price','')} Kč"
        for m in meal_options
    )

    flight_opts = api_data.get("flightOptions", [])
    transport   = "letecky"
    if flight_opts:
        segs     = flight_opts[0].get("outbound", {}).get("flightSegments", [{}])
        seg      = segs[0] if segs else {}
        dep_code = seg.get("departureAirport", {}).get("code", "?")
        arr_code = seg.get("arrivalAirport", {}).get("code", "?")
        fn       = seg.get("flightNumber", "")
        transport = f"letecky {dep_code}→{arr_code} {fn}".strip()

    hotel = {
        "name":           p["hotel_name"],
        "country":        p["country"],
        "destination":    p["destination"],
        "resort_town":    p["resort_town"],
        "stars":          int(p["stars"]) if p["stars"] else None,
        "review_score":   float(p["review_score"]) if p.get("review_score") else None,
        "description":    p["description"],
        "thumbnail_url":  p["images"][0] if p["images"] else "",
        "photos":         json.dumps(p["images"]) if p["images"] else "[]",
        "amenities":      p["amenities"],
        "tags":           p.get("tags", ""),
        "distances":      p.get("distances", ""),
        "food_options":   food_options,
        "price_includes": price_includes,
        "latitude":       p.get("latitude"),
        "longitude":      p.get("longitude"),
        "api_config":     json.dumps({
            **p["_offer_filter"],
            "_hotelPath": "/" + hotel_url.split("eximtours.cz/", 1)[-1].split("?")[0],
        }),
    }

    base_url = hotel_url.split("?")[0]
    tours = []
    for d in api_data.get("availableDates", []):
        raw_date = d.get("date", "")[:10]
        price    = d.get("pricePerPerson") or d.get("price", 0.0)
        if not raw_date or price <= 0:
            continue
        try:
            dep_dt = datetime.strptime(raw_date, "%Y-%m-%d")
            ret_dt = dep_dt + timedelta(days=nights + 1)
        except ValueError:
            continue

        params = dict(urllib.parse.parse_qsl(
            p.get("tour_filter_query", ""), keep_blank_values=False
        ))
        for _ep in ("PC", "IFC", "OFC", "DPR", "PID", "GIATA", "ERM", "DS", "TrustYou"):
            params.pop(_ep, None)

        params["DD"]  = raw_date
        params["NN"]  = str(nights)
        params["AC1"] = str(p["adults"])
        params["KC1"] = "0"
        params["TT"]  = "1"

        if "D" not in params and p.get("destination_ids"):
            params["D"] = "|".join(str(x) for x in p["destination_ids"])
        if "TO" not in params and p.get("transport_origin"):
            params["TO"] = "|".join(str(x) for x in p["transport_origin"])
        if "HID" not in params and p.get("hotel_id"):
            params["HID"] = str(p["hotel_id"])
        if p.get("meal_code"):
            params["MC"] = p["meal_code"]
        if p.get("room_code"):
            params["RC"] = p["room_code"]

        qs = "&".join(
            f"{k}={urllib.parse.quote(str(v), safe='|,')}"
            for k, v in params.items() if v
        )
        tour_url = f"{base_url}?{qs}"

        is_lm, is_fm = _detect_tour_type(dep_dt)

        tours.append({
            "departure_date":  raw_date,
            "return_date":     ret_dt.strftime("%Y-%m-%d"),
            "duration":        nights,
            "price":           price,
            "transport":       transport,
            "meal_plan":       meal_name,
            "adults":          p["adults"],
            "room_code":       p["room_code"],
            "url":             tour_url,
            "url_single":      None,
            "price_single":    None,
            "is_last_minute":  is_lm,
            "is_first_minute": is_fm,
            "departure_city":  airport_name,
        })

    return hotel, tours


# ---------------------------------------------------------------------------
# Scraping jednoho hotelu
# ---------------------------------------------------------------------------

def scrape_hotel(session: requests.Session, db: ZaletoDB,
                 hotel_url: str, slug_counter: dict,
                 airports: list[int] | None = None) -> int:
    if airports is None:
        airports = [DEFAULT_AIRPORT]

    all_tours:  list = []
    hotel_dict       = None

    for airport in airports:
        embedded = _fetch_embedded(session, hotel_url, airport)
        if not embedded:
            continue

        p = _parse_embedded(embedded)
        if not p or not p.get("destination_ids") or not p.get("transport_origin"):
            logger.debug(f"Neúplná data pro letiště {airport}: {hotel_url}")
            continue

        airport_name  = AIRPORT_NAMES.get(airport, str(airport))
        airport_tours: list = []

        for nights_val in p.get("all_nights", [p["nights"]]):
            api_data = _get_offer(session, p, p["main_filter_from"] or "", p["main_filter_to"] or "",
                                  nights_override=nights_val)

            if (not api_data or not api_data.get("availableDates")) and p.get("departure_date"):
                api_data = _get_offer(session, p, p["departure_date"], p["departure_date"],
                                      nights_override=nights_val)

            if not api_data or not api_data.get("availableDates"):
                logger.debug(f"Žádné termíny pro letiště {airport} ({nights_val} nocí): {hotel_url}")
                continue

            hd, tour_list = _build_hotel_and_tours(hotel_url, p, api_data, airport_name)
            if hotel_dict is None:
                hotel_dict = hd
            airport_tours.extend(tour_list)

        if airport_tours:
            all_tours.extend(airport_tours)
            logger.debug(f"  Letiště {airport}: {len(airport_tours)} termínů")

    if hotel_dict is None:
        logger.warning(f"Žádné termíny ani data: {hotel_url}")
        return 0

    base_slug = slugify(hotel_dict["name"])
    slug = base_slug
    n = slug_counter.get(base_slug, 0)
    if n > 0:
        slug = f"{base_slug}-{n}"
    slug_counter[base_slug] = n + 1

    hotel_id = db.upsert_hotel(slug, hotel_dict)
    db.conn.execute("DELETE FROM tours WHERE hotel_id = ?", (hotel_id,))
    for t in all_tours:
        db.upsert_tour(hotel_id, t)
    db.commit()

    logger.info(f"  {hotel_dict['name']} ⭐{hotel_dict['stars']} — {len(all_tours)} termínů")
    return len(all_tours)


# ---------------------------------------------------------------------------
# Smazání dat
# ---------------------------------------------------------------------------

def delete_all(db: ZaletoDB):
    h = db.conn.execute("SELECT COUNT(*) FROM hotels WHERE agency=?", (AGENCY,)).fetchone()[0]
    t = db.conn.execute("SELECT COUNT(*) FROM tours  WHERE agency=?", (AGENCY,)).fetchone()[0]
    db.conn.execute("DELETE FROM tours  WHERE agency=?", (AGENCY,))
    db.conn.execute("DELETE FROM hotels WHERE agency=?", (AGENCY,))
    db.commit()
    logger.info(f"Smazáno: {h} hotelů, {t} termínů (Exim Tours).")


# ---------------------------------------------------------------------------
# Hlavní run
# ---------------------------------------------------------------------------

def run(limit: int = 0, delay: float = 1.5, delete: bool = False,
        airports: list[int] | None = None):
    if airports is None:
        airports = list(AIRPORT_NAMES.keys())

    session = _make_session()
    db      = ZaletoDB()

    if delete:
        logger.info("--delete: mažu stávající Exim Tours data...")
        delete_all(db)

    hotel_urls   = get_hotel_urls(session, limit)
    total_saved  = 0
    slug_counter: dict = {}

    done_urls = db.get_done_keys()
    if done_urls:
        logger.info(f"Checkpoint: přeskakuji {len(done_urls)} hotely z dnešního cyklu")

    logger.info(f"Letiště: {airports}")

    SKIP_PATTERNS = ("vikend", "weekend", "letecky-vikend")

    for i, url in enumerate(hotel_urls, 1):
        if any(p in url.lower() for p in SKIP_PATTERNS):
            logger.debug(f"[{i}/{len(hotel_urls)}] přeskakuji (víkend): {url.split('?')[0]}")
            continue
        if url in done_urls:
            logger.info(f"[{i}/{len(hotel_urls)}] ✓ checkpoint: {url.split('?')[0]}")
            continue
        logger.info(f"[{i}/{len(hotel_urls)}] {url.split('?')[0]}")
        try:
            saved = scrape_hotel(session, db, url, slug_counter, airports)
            total_saved += saved
            db.mark_done(url)
        except Exception as e:
            logger.error(f"Chyba u {url}: {e}")

        if i < len(hotel_urls):
            time.sleep(delay)

    db.close()
    logger.info(f"Hotovo. Celkem: {total_saved} termínů z {len(hotel_urls)} hotelů.")
    return total_saved


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Exim Tours scraper")
    parser.add_argument("--limit",   type=int,   default=0,   help="Max počet hotelů (0 = vše)")
    parser.add_argument("--delay",   type=float, default=1.5, help="Pauza mezi hotely (s)")
    parser.add_argument("--delete",  action="store_true",     help="Smaž Exim data před startem")
    parser.add_argument("--airports", type=str,  default="",  help="Čárkou oddělená ID letišť")
    args = parser.parse_args()

    airports = [int(x) for x in args.airports.split(",") if x.strip().isdigit()] or None
    run(limit=args.limit, delay=args.delay, delete=args.delete, airports=airports)
