"""
Fischer.cz scraper — píše přímo do zaleto.db (normalizované schéma hotels + tours).

Pipeline na hotel:
  1. GET hotel URL → embedded JSON (server-side rendered)
  2. Extrakce: hotelDataKey, destinationIds, transportOrigin, sezóna, ...
  3. POST /api/SearchOffer/GetOfferWithOptions → všechny dostupné termíny
  4. Upsert hotel → zaleto.hotels, upsert termíny → zaleto.tours

Použití:
  python fischer.py                  # stáhne všechny hotely ze sitemapy
  python fischer.py --limit 20       # jen prvních 20 hotelů (test)
  python fischer.py --delay 2.0      # pauza 2s mezi hotely
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

BASE_URL = "https://www.fischer.cz"
AGENCY   = "Fischer"

DEFAULT_DB = str(Path(__file__).resolve().parent.parent / "data" / "zaleto.db")
DB_PATH    = os.environ.get("DATABASE_PATH", DEFAULT_DB)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("fischer")


# ---------------------------------------------------------------------------
# Slugify
# ---------------------------------------------------------------------------

def slugify(text: str) -> str:
    text = unicodedata.normalize("NFD", text.lower())
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    text = re.sub(r"[^a-z0-9\s-]", "", text)
    text = re.sub(r"[\s]+", "-", text.strip())
    text = re.sub(r"-+", "-", text)
    return text


# ---------------------------------------------------------------------------
# DB — přímá práce se zaleto.db
# ---------------------------------------------------------------------------

class ZaletoDB:
    def __init__(self, path: str = DB_PATH):
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(path, check_same_thread=False)
        self.conn.execute("PRAGMA journal_mode = WAL")
        self.conn.execute("PRAGMA foreign_keys = ON")
        self._ensure_schema()
        logger.info(f"DB: {path}")

    def _ensure_schema(self):
        self.conn.executescript("""
            CREATE TABLE IF NOT EXISTS hotels (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                slug TEXT UNIQUE NOT NULL,
                agency TEXT NOT NULL DEFAULT 'Fischer',
                name TEXT NOT NULL,
                country TEXT,
                destination TEXT,
                resort_town TEXT,
                stars INTEGER,
                description TEXT,
                thumbnail_url TEXT,
                photos TEXT,
                review_score REAL,
                amenities TEXT,
                tags TEXT,
                distances TEXT,
                food_options TEXT,
                price_includes TEXT,
                latitude REAL,
                longitude REAL,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            );


            CREATE TABLE IF NOT EXISTS tours (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                hotel_id INTEGER NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
                agency TEXT NOT NULL DEFAULT 'Fischer',
                departure_date TEXT,
                return_date TEXT,
                duration INTEGER,
                price REAL NOT NULL,
                transport TEXT,
                meal_plan TEXT,
                adults INTEGER DEFAULT 2,
                room_code TEXT,
                url TEXT UNIQUE NOT NULL,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            );

            CREATE INDEX IF NOT EXISTS idx_tours_hotel      ON tours(hotel_id);
            CREATE INDEX IF NOT EXISTS idx_tours_departure  ON tours(departure_date);
            CREATE INDEX IF NOT EXISTS idx_tours_price      ON tours(price);
            CREATE INDEX IF NOT EXISTS idx_hotels_slug      ON hotels(slug);
            CREATE INDEX IF NOT EXISTS idx_hotels_destination ON hotels(destination);
            CREATE INDEX IF NOT EXISTS idx_hotels_country   ON hotels(country);
        """)
        # Migration: přidej nové sloupce do existující DB
        for col, typ in [("photos", "TEXT"), ("review_score", "REAL"),
                         ("tags", "TEXT"), ("distances", "TEXT"),
                         ("api_config", "TEXT")]:
            try:
                self.conn.execute(f"ALTER TABLE hotels ADD COLUMN {col} {typ}")
                self.conn.commit()
            except Exception:
                pass  # sloupec už existuje

        self.conn.commit()

    def upsert_hotel(self, slug: str, data: dict) -> int:
        """Vloží nebo aktualizuje hotel. Vrací hotel_id."""
        self.conn.execute("""
            INSERT INTO hotels (slug, agency, name, country, destination, resort_town,
                                stars, review_score, description, thumbnail_url, photos,
                                amenities, tags, distances, food_options, price_includes,
                                latitude, longitude, api_config, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(slug) DO UPDATE SET
                agency        = excluded.agency,
                name          = excluded.name,
                country       = excluded.country,
                destination   = excluded.destination,
                resort_town   = excluded.resort_town,
                stars         = excluded.stars,
                review_score  = excluded.review_score,
                description   = excluded.description,
                thumbnail_url = excluded.thumbnail_url,
                photos        = excluded.photos,
                amenities     = excluded.amenities,
                tags          = excluded.tags,
                distances     = excluded.distances,
                food_options  = excluded.food_options,
                price_includes = excluded.price_includes,
                latitude      = excluded.latitude,
                longitude     = excluded.longitude,
                api_config    = excluded.api_config,
                updated_at    = datetime('now')
        """, (
            slug, AGENCY, data["name"], data["country"], data["destination"],
            data["resort_town"], data["stars"], data["review_score"],
            data["description"], data["thumbnail_url"], data["photos"],
            data["amenities"], data["tags"], data["distances"],
            data["food_options"], data["price_includes"],
            data["latitude"], data["longitude"], data["api_config"],
        ))
        row = self.conn.execute("SELECT id FROM hotels WHERE slug = ?", (slug,)).fetchone()
        return row[0]

    def upsert_tour(self, hotel_id: int, t: dict):
        self.conn.execute("""
            INSERT INTO tours (hotel_id, agency, departure_date, return_date, duration,
                               price, transport, meal_plan, adults, room_code, url, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(url) DO UPDATE SET
                price        = excluded.price,
                transport    = excluded.transport,
                meal_plan    = excluded.meal_plan,
                return_date  = excluded.return_date,
                updated_at   = datetime('now')
        """, (
            hotel_id, AGENCY,
            t["departure_date"], t["return_date"], t["duration"],
            t["price"], t["transport"], t["meal_plan"],
            t["adults"], t["room_code"], t["url"],
        ))

    def commit(self):
        self.conn.commit()

    def close(self):
        self.conn.close()


# ---------------------------------------------------------------------------
# HTTP session
# ---------------------------------------------------------------------------

def _make_session() -> requests.Session:
    s = requests.Session()
    s.headers.update({
        "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                           "(KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
        "Accept":          "text/html,application/xhtml+xml,*/*;q=0.8",
        "Accept-Language": "cs,en;q=0.9",
        "Referer":         "https://www.fischer.cz/",
    })
    try:
        s.get(BASE_URL, timeout=15)
    except Exception:
        pass
    return s


# ---------------------------------------------------------------------------
# Sitemap — seznam hotelů
# ---------------------------------------------------------------------------

def get_hotel_urls(session: requests.Session, limit: int = 0) -> list[str]:
    hdrs = {"Accept": "application/xml,text/xml,*/*", "Content-Type": ""}
    urls = []

    # Načti hlavní sitemap a najdi sitemap-hotel-*.xml subsitemapy
    try:
        r = session.get(f"{BASE_URL}/sitemap.xml", headers=hdrs, timeout=20)
        if r.status_code == 200:
            hotel_sitemaps = re.findall(
                r"<loc>(https://www\.fischer\.cz/sitemap-hotel[^<]+)</loc>", r.text
            )
            for sub in hotel_sitemaps:
                try:
                    r2 = session.get(sub, headers=hdrs, timeout=20)
                    if r2.status_code == 200:
                        # Hotelové URL: fischer.cz/<destinace>/.../<hotel-slug>
                        found = re.findall(
                            r"<loc>(https://www\.fischer\.cz/(?!sitemap)[^<]+)</loc>", r2.text
                        )
                        urls.extend(found)
                except Exception as e:
                    logger.debug(f"Sub-sitemap {sub}: {e}")
    except Exception as e:
        logger.debug(f"Sitemap error: {e}")

    # Deduplikace
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
# Embedded JSON parser
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


# Praha jako výchozí letiště — zajistí že offerFilter.transportOrigin bude vyplněný
DEFAULT_AIRPORT = 4312  # Praha Václav Havel


def _fetch_embedded(session: requests.Session, url: str) -> dict | None:
    # Přidej výchozí letiště pokud URL nemá TO= parametr
    if "TO=" not in url:
        sep = "&" if "?" in url else "?"
        url = f"{url}{sep}TO={DEFAULT_AIRPORT}"
    try:
        r = session.get(url, timeout=20)
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
        logger.error(f"Fetch error: {e}")
        return None


# ---------------------------------------------------------------------------
# Extrakce parametrů
# ---------------------------------------------------------------------------

def _parse_embedded(embedded: dict) -> dict | None:
    try:
        data_new     = embedded.get("dataNew", {})
        hotel        = data_new.get("hotel", {})
        identifiers  = hotel.get("identifiers", {})
        offer_filter = data_new.get("offerFilter", {})

        if not identifiers.get("hotelId"):
            return None

        # hotelDataKey — přednostně z offerFilter (nová struktura), fallback na identifiers
        hotel_data_key = offer_filter.get("hotelDataKey") or {
            "hotelId":    identifiers["hotelId"],
            "giata":      identifiers.get("giata"),
            "dataSource": identifiers.get("dataSource", 2),
            "bedBank":    identifiers.get("bedBank"),
            "bedBankID":  identifiers.get("bedBankID"),
        }

        # Parametry zájezdu z offerFilter (nová struktura)
        destination_ids  = offer_filter.get("destinationIds", [])
        transport_origin = offer_filter.get("transportOrigin", [])
        meal_code        = offer_filter.get("mealCode", "")
        rooms            = offer_filter.get("rooms", [])
        room_code        = rooms[0].get("roomCode", "") if rooms else ""
        number_nights    = offer_filter.get("numberNights", [7])
        nights           = number_nights[0] if number_nights else 7
        adults           = len([t for t in (rooms[0].get("travellers", []) if rooms else [])
                                if t.get("type") == 0]) or 2
        tour_filter_query = offer_filter.get("tourFilterQuery", "")

        # Fallback: destIDs a TO z tourFilterQuery
        if not destination_ids or not transport_origin:
            tip = dict(urllib.parse.parse_qsl(tour_filter_query))
            if not destination_ids:
                destination_ids = [int(d) for d in tip.get("D", "").split("|") if d.isdigit()]
            if not transport_origin and tip.get("TO", "").isdigit():
                transport_origin = [int(tip["TO"])]

        mfd = offer_filter.get("offerDate", {}).get("mainFilterDates", [])
        main_from = mfd[0][:10] if len(mfd) > 0 else ""
        main_to   = mfd[1][:10] if len(mfd) > 1 else ""

        package_id = offer_filter.get("packageId", "") or (
            f"{nights}-{main_from}" if main_from else ""
        )

        breadcrumbs = hotel.get("breadcrumbs", [])
        destination = " / ".join(b["name"] for b in breadcrumbs) if breadcrumbs else ""
        resort_town = breadcrumbs[-1]["name"] if breadcrumbs else ""
        country     = breadcrumbs[0]["name"] if breadcrumbs else ""

        desc_obj    = hotel.get("description", {})
        description = desc_obj.get("mainDescription", "") if desc_obj else ""
        images      = [img["large"] for img in hotel.get("availableImages", []) if img.get("large")]
        benefits    = [b["title"] for b in hotel.get("mainBenefits", []) if b.get("title")]

        # Geo coordinates — primárně z geoLocation, fallback do detailDescriptions[].map.pins
        geo      = hotel.get("geoLocation") or hotel.get("geolocation") or {}
        latitude  = geo.get("latitude") or geo.get("lat")
        longitude = geo.get("longitude") or geo.get("lng") or geo.get("lon")
        if not latitude or not longitude:
            for detail in (hotel.get("description") or {}).get("detailDescriptions", []):
                pins = (detail.get("map") or {}).get("pins", [])
                if pins:
                    latitude  = pins[0].get("latitude")
                    longitude = pins[0].get("longitude")
                    break

        # Rating score (Fischer může mít reviewScore nebo ratingValue)
        rating_obj   = hotel.get("hotelRating", {}) or {}
        stars        = rating_obj.get("count")
        review_score = rating_obj.get("ratingValue") or rating_obj.get("reviewScore")

        # Tagy / kategorie hotelu
        tags = [t.get("name", "") for t in hotel.get("tags", []) if t.get("name")]

        # Vzdálenost od pláže / centra
        distances = hotel.get("distances", []) or []
        dist_text = " | ".join(
            f"{d.get('name','')}: {d.get('value','')} {d.get('unit','')}".strip()
            for d in distances if d.get("value")
        )

        return {
            "hotel_data_key":    hotel_data_key,
            "hotel_id":          identifiers["hotelId"],
            "hotel_name":        hotel.get("name", ""),
            "stars":             stars,
            "review_score":      review_score,
            "description":       description,
            "images":            images,
            "amenities":         ", ".join(benefits),
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
# API call
# ---------------------------------------------------------------------------

def _get_offer(session: requests.Session, p: dict,
               date_from: str, date_to: str) -> dict | None:
    mf_from = f"{p['main_filter_from']}T00:00:00"
    mf_to   = f"{p['main_filter_to']}T00:00:00"

    payload = {
        "destinationIds": p["destination_ids"],
        "flight": {
            "inboundIdentifier":  {"flightClass": "", "flightCode": "", "flightNumber": ""},
            "outboundIdentifier": {"flightClass": "", "flightCode": "", "flightNumber": ""},
        },
        "hotelDataKey":  p["hotel_data_key"],
        "mealCode":      p["meal_code"],
        "numberNights":  [p["nights"]],
        "offerDate": {
            "dateFrom":        f"{date_from}T00:00:00",
            "dateTo":          f"{date_to}T00:00:00",
            "mainFilterDates": [mf_from, mf_to],
        },
        "packageId":       p["package_id"],
        "rooms": [{
            "groupId":    1,
            "roomCode":   p["room_code"],
            "travellers": [{"age": 30, "id": i + 1, "type": 0} for i in range(p["adults"])],
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
# Sestavení záznamů pro DB
# ---------------------------------------------------------------------------

def _build_hotel_and_tours(hotel_url: str, p: dict, api_data: dict):
    """Vrátí (hotel_dict, [tour_dict, ...])"""
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
        segs    = flight_opts[0].get("outbound", {}).get("flightSegments", [{}])
        seg     = segs[0] if segs else {}
        dep_code = seg.get("departureAirport", {}).get("code", "?")
        arr_code = seg.get("arrivalAirport", {}).get("code", "?")
        fn       = seg.get("flightNumber", "")
        transport = f"letecky {dep_code}→{arr_code} {fn}".strip()

    hotel = {
        "name":          p["hotel_name"],
        "country":       p["country"],
        "destination":   p["destination"],
        "resort_town":   p["resort_town"],
        "stars":         int(p["stars"]) if p["stars"] else None,
        "review_score":  float(p["review_score"]) if p.get("review_score") else None,
        "description":   p["description"],
        "thumbnail_url": p["images"][0] if p["images"] else "",
        "photos":        json.dumps(p["images"]) if p["images"] else "[]",
        "amenities":     p["amenities"],
        "tags":          p.get("tags", ""),
        "distances":     p.get("distances", ""),
        "food_options":  food_options,
        "price_includes": price_includes,
        "latitude":      p.get("latitude"),
        "longitude":     p.get("longitude"),
        "api_config":    json.dumps({                     # pro live redirect
            **p["_offer_filter"],
            "_hotelPath": "/" + hotel_url.split("fischer.cz/", 1)[-1].split("?")[0],
        }),
    }

    base_url = hotel_url.split("?")[0]
    tours = []
    for d in api_data.get("availableDates", []):
        raw_date = d.get("date", "")[:10]
        # pricePerPerson je cena za osobu — to co Fischer zobrazuje na webu
        price = d.get("pricePerPerson") or d.get("price", 0.0)
        if not raw_date or price <= 0:
            continue
        try:
            dep_dt = datetime.strptime(raw_date, "%Y-%m-%d")
            ret_dt = dep_dt + timedelta(days=nights + 1)
        except ValueError:
            continue

        # Začni od tourFilterQuery, který Fischer sám používá — má D=, TO=, HID=, RC=, MC=, ...
        params = dict(urllib.parse.parse_qsl(
            p.get("tour_filter_query", ""), keep_blank_values=False
        ))

        # Odstraň časově omezené cache kódy — PC/IFC/OFC kódují konkrétní cenu
        # platnou v moment scrape a po čase expirují; Fischer pak zobrazí jinou
        # cenu. Bez nich Fischer vždy spočítá aktuální cenu pro danou konfiguraci.
        for _ep in ("PC", "IFC", "OFC", "DPR", "PID", "GIATA", "ERM", "DS", "TrustYou"):
            params.pop(_ep, None)

        # Přidej / přepiš parametry specifické pro tento termín
        params["DD"]  = raw_date
        params["NN"]  = str(nights)
        params["AC1"] = str(p["adults"])
        params["KC1"] = "0"
        params["TT"]  = "1"

        # Zálohy — pokud tourFilterQuery parametr neměl
        if "D" not in params and p.get("destination_ids"):
            params["D"] = "|".join(str(d) for d in p["destination_ids"])
        if "TO" not in params and p.get("transport_origin"):
            params["TO"] = "|".join(str(t) for t in p["transport_origin"])
        if "HID" not in params and p.get("hotel_id"):
            params["HID"] = str(p["hotel_id"])
        # Meal code a room code — klíčové pro správnou cenu
        if p.get("meal_code"):
            params["MC"] = p["meal_code"]
        if p.get("room_code"):
            params["RC"] = p["room_code"]

        # Sestav query string — | a , zůstanou nekódované (Fischer to tak očekává)
        qs = "&".join(
            f"{k}={urllib.parse.quote(str(v), safe='|,')}"
            for k, v in params.items() if v
        )
        tour_url = f"{base_url}?{qs}"

        tours.append({
            "departure_date": raw_date,
            "return_date":    ret_dt.strftime("%Y-%m-%d"),
            "duration":       nights,
            "price":          price,
            "transport":      transport,
            "meal_plan":      meal_name,
            "adults":         p["adults"],
            "room_code":      p["room_code"],
            "url":            tour_url,
        })

    return hotel, tours


# ---------------------------------------------------------------------------
# Hlavní scraper
# ---------------------------------------------------------------------------

def scrape_hotel(session: requests.Session, db: ZaletoDB,
                 hotel_url: str, slug_counter: dict) -> int:
    """Scrapuje jeden hotel. Vrací počet uložených termínů."""
    embedded = _fetch_embedded(session, hotel_url)
    if not embedded:
        return 0

    p = _parse_embedded(embedded)
    if not p or not p.get("destination_ids") or not p.get("transport_origin"):
        logger.warning(f"Neúplná data: {hotel_url}")
        return 0

    # Full-season request
    api_data = _get_offer(session, p, p["main_filter_from"], p["main_filter_to"])

    # Fallback na konkrétní datum
    if (not api_data or not api_data.get("availableDates")) and p.get("departure_date"):
        api_data = _get_offer(session, p, p["departure_date"], p["departure_date"])

    if not api_data or not api_data.get("availableDates"):
        logger.warning(f"Žádné termíny: {p.get('hotel_name', hotel_url)}")
        return 0

    hotel_dict, tour_list = _build_hotel_and_tours(hotel_url, p, api_data)

    # Unikátní slug
    base_slug = slugify(hotel_dict["name"])
    slug = base_slug
    n = slug_counter.get(base_slug, 0)
    if n > 0:
        slug = f"{base_slug}-{n}"
    slug_counter[base_slug] = n + 1

    hotel_id = db.upsert_hotel(slug, hotel_dict)
    # Smaž staré termíny tohoto hotelu — při re-scrape chceme jen aktuálně dostupné
    db.conn.execute("DELETE FROM tours WHERE hotel_id = ?", (hotel_id,))
    for t in tour_list:
        db.upsert_tour(hotel_id, t)
    db.commit()

    logger.info(f"  {hotel_dict['name']} ⭐{hotel_dict['stars']} — {len(tour_list)} termínů uloženo")
    return len(tour_list)


def delete_all(db: ZaletoDB):
    """Smaže všechny hotely a termíny (kaskádově). Zachová schéma."""
    hotels_count = db.conn.execute("SELECT COUNT(*) FROM hotels").fetchone()[0]
    tours_count  = db.conn.execute("SELECT COUNT(*) FROM tours").fetchone()[0]
    db.conn.execute("DELETE FROM tours")
    db.conn.execute("DELETE FROM hotels")
    db.conn.execute("DELETE FROM reviews")
    db.conn.execute("DELETE FROM sqlite_sequence WHERE name IN ('hotels','tours','reviews')")
    db.conn.commit()
    logger.info(f"Smazáno: {hotels_count} hotelů, {tours_count} termínů, recenze.")


def run(limit: int = 0, delay: float = 1.5, delete: bool = False):
    session = _make_session()
    db      = ZaletoDB()

    if delete:
        logger.info("--delete: mažu všechna stávající data...")
        delete_all(db)

    hotel_urls  = get_hotel_urls(session, limit)
    total_saved = 0
    slug_counter: dict = {}

    for i, url in enumerate(hotel_urls, 1):
        logger.info(f"[{i}/{len(hotel_urls)}] {url.split('?')[0]}")
        try:
            saved = scrape_hotel(session, db, url, slug_counter)
            total_saved += saved
        except Exception as e:
            logger.error(f"Chyba u {url}: {e}")

        if i < len(hotel_urls):
            time.sleep(delay)

    db.close()
    logger.info(f"Hotovo. Celkem uloženo: {total_saved} termínů z {len(hotel_urls)} hotelů.")
    return total_saved


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fischer.cz scraper → zaleto.db")
    parser.add_argument("--limit", type=int, default=0,
                        help="Max počet hotelů (0 = všechny)")
    parser.add_argument("--delay", type=float, default=1.5,
                        help="Pauza mezi hotely v sekundách")
    parser.add_argument("--delete", action="store_true",
                        help="Před stažením smaže všechny stávající záznamy a začne od nuly")
    args = parser.parse_args()
    run(limit=args.limit, delay=args.delay, delete=args.delete)
