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
import time
import unicodedata
import urllib.parse
from datetime import datetime, timedelta
from html.parser import HTMLParser
from pathlib import Path

import requests

from db import ZaletoDB

# ---------------------------------------------------------------------------
# Konfigurace
# ---------------------------------------------------------------------------

BASE_URL = "https://www.fischer.cz"
AGENCY   = "Fischer"

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

    # Stáhni sitemap-hotel-0.xml, sitemap-hotel-1.xml, ... dokud HTTP 200
    for idx in range(20):  # max 20 souborů
        sitemap_url = f"{BASE_URL}/sitemap-hotel-{idx}.xml"
        try:
            r = session.get(sitemap_url, headers=hdrs, timeout=20)
            if r.status_code == 404:
                break  # žádné další sitemap soubory
            if r.status_code != 200:
                logger.debug(f"Fischer sitemap-hotel-{idx}.xml: HTTP {r.status_code}")
                break
            found = re.findall(
                r"<loc>(https://www\.fischer\.cz/(?!sitemap)[^<]+)</loc>", r.text
            )
            if not found:
                break  # prázdný soubor = konec
            urls.extend(found)
            logger.info(f"  sitemap-hotel-{idx}.xml: {len(found)} URL")
        except Exception as e:
            logger.debug(f"Fischer sitemap-hotel-{idx}.xml error: {e}")
            break

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

AIRPORT_NAMES: dict[int, str] = {
    4312: "Praha",
    4313: "Brno",
    4314: "Ostrava",
}


def _fetch_embedded(session: requests.Session, url: str, airport: int = DEFAULT_AIRPORT) -> dict | None:
    # Přidej letiště pokud URL nemá TO= parametr
    if "TO=" not in url:
        sep = "&" if "?" in url else "?"
        url = f"{url}{sep}TO={airport}"
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
        all_nights       = number_nights if number_nights else [7]
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
# API call
# ---------------------------------------------------------------------------

def _get_offer(session: requests.Session, p: dict,
               date_from: str, date_to: str,
               adults_count: int | None = None,
               nights_override: int | None = None) -> dict | None:
    mf_from = f"{p['main_filter_from']}T00:00:00"
    mf_to   = f"{p['main_filter_to']}T00:00:00"
    adults  = adults_count if adults_count is not None else p["adults"]
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

LAST_MINUTE_DAYS  = 21   # odjezd do 21 dní → last minute
FIRST_MINUTE_DAYS = 180  # odjezd za 180+ dní → first minute

def _detect_tour_type(d: dict, dep_dt: datetime) -> tuple[bool, bool]:
    """
    Vrátí (is_last_minute, is_first_minute).

    1) Zkusí Fischer-nativní pole (badges / labels / offerType / tags).
    2) Fallback: výpočet z dnů do odjezdu v momentu scrape.
    """
    today = datetime.today().replace(hour=0, minute=0, second=0, microsecond=0)
    days_until = (dep_dt - today).days

    # --- 1) Fischer API pole ---
    # Fischer občas vrací badges/labels jako seznam objektů nebo stringů
    raw_badges = (
        d.get("badges") or d.get("labels") or d.get("tags") or
        d.get("offerBadges") or d.get("specialOffers") or []
    )
    badge_texts: list[str] = []
    for b in raw_badges:
        if isinstance(b, dict):
            badge_texts.append(b.get("name", "") + " " + b.get("type", "") + " " + b.get("code", ""))
        elif isinstance(b, str):
            badge_texts.append(b)
    combined = " ".join(badge_texts).lower()

    offer_type = str(d.get("offerType", "") or "").lower()
    combined += " " + offer_type

    if "last" in combined or "lastminute" in combined:
        return True, False
    if "first" in combined or "early" in combined or "firstminute" in combined:
        return False, True

    # --- 2) Výpočet z data ---
    is_last_minute  = 0 <= days_until <= LAST_MINUTE_DAYS
    is_first_minute = days_until >= FIRST_MINUTE_DAYS
    return is_last_minute, is_first_minute


# ---------------------------------------------------------------------------
# Sestavení záznamů pro DB
# ---------------------------------------------------------------------------

def _build_hotel_and_tours(hotel_url: str, p: dict, api_data: dict, airport_name: str = "",
                           single_price_map: dict | None = None):
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

        is_lm, is_fm = _detect_tour_type(d, dep_dt)

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
# Hlavní scraper
# ---------------------------------------------------------------------------

def scrape_hotel(session: requests.Session, db: ZaletoDB,
                 hotel_url: str, slug_counter: dict,
                 airports: list[int] | None = None) -> int:
    """Scrapuje jeden hotel pro všechna zadaná letiště. Vrací počet uložených termínů."""
    if airports is None:
        airports = [DEFAULT_AIRPORT]

    all_tours: list = []
    hotel_dict = None

    for airport in airports:
        embedded = _fetch_embedded(session, hotel_url, airport)
        if not embedded:
            continue

        p = _parse_embedded(embedded)
        if not p or not p.get("destination_ids") or not p.get("transport_origin"):
            logger.debug(f"Neúplná data pro letiště {airport}: {hotel_url}")
            continue

        airport_name = AIRPORT_NAMES.get(airport, str(airport))
        airport_tours: list = []
        for nights_val in p.get("all_nights", [p["nights"]]):
            # Full-season request pro daný počet nocí
            api_data = _get_offer(session, p, p["main_filter_from"], p["main_filter_to"],
                                  nights_override=nights_val)

            # Fallback na konkrétní datum
            if (not api_data or not api_data.get("availableDates")) and p.get("departure_date"):
                api_data = _get_offer(session, p, p["departure_date"], p["departure_date"],
                                      nights_override=nights_val)

            if not api_data or not api_data.get("availableDates"):
                logger.debug(f"Žádné termíny pro letiště {airport} ({nights_val} nocí): {p.get('hotel_name', hotel_url)}")
                continue

            hd, tour_list = _build_hotel_and_tours(hotel_url, p, api_data, airport_name)
            if hotel_dict is None:
                hotel_dict = hd  # metadata z prvního letiště s daty
            airport_tours.extend(tour_list)

        if airport_tours:
            all_tours.extend(airport_tours)
            logger.debug(f"  Letiště {airport} ({airport_name}): {len(airport_tours)} termínů")

    if hotel_dict is None:
        logger.warning(f"Žádné termíny ani data: {hotel_url}")
        return 0

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
    for t in all_tours:
        db.upsert_tour(hotel_id, t)
    db.commit()

    logger.info(f"  {hotel_dict['name']} ⭐{hotel_dict['stars']} — {len(all_tours)} termínů uloženo ({len(airports)} letiště)")
    return len(all_tours)


def delete_all(db: ZaletoDB):
    """Smaže všechny hotely a termíny (kaskádově). Zachová schéma."""
    hotels_count = db.conn.execute("SELECT COUNT(*) FROM hotels").fetchone()[0]
    tours_count  = db.conn.execute("SELECT COUNT(*) FROM tours").fetchone()[0]
    db.conn.execute("DELETE FROM tours")
    db.conn.execute("DELETE FROM hotels")
    db.conn.execute("DELETE FROM reviews")
    db.conn.commit()
    logger.info(f"Smazáno: {hotels_count} hotelů, {tours_count} termínů, recenze.")


def run(limit: int = 0, delay: float = 1.5, delete: bool = False,
        airports: list[int] | None = None):
    if airports is None:
        airports = list(AIRPORT_NAMES.keys())

    session = _make_session()
    db      = ZaletoDB()

    if delete:
        logger.info("--delete: mažu všechna stávající data...")
        delete_all(db)

    hotel_urls  = get_hotel_urls(session, limit)
    total_saved = 0
    slug_counter: dict = {}

    # Pre-populate slug_counter z DB — zabrání kolizím slugů při resumování
    cur = db.conn.cursor()
    cur.execute("SELECT slug FROM hotels WHERE agency = %s", (AGENCY,))
    for (s,) in cur.fetchall():
        parts = s.rsplit("-", 1)
        if len(parts) == 2 and parts[1].isdigit():
            base, n = parts[0], int(parts[1]) + 1
        else:
            base, n = s, 1
        slug_counter[base] = max(slug_counter.get(base, 0), n)

    # Načti checkpoint — hotely zpracované dnes v předchozím běhu
    done_urls = db.get_done_keys(AGENCY)
    if done_urls:
        logger.info(f"Checkpoint: přeskakuji {len(done_urls)} již zpracovaných hotelů z dnešního cyklu")

    logger.info(f"Letiště: {airports}")

    for i, url in enumerate(hotel_urls, 1):
        if url in done_urls:
            logger.info(f"[{i}/{len(hotel_urls)}] ✓ checkpoint: {url.split('?')[0]}")
            continue
        logger.info(f"[{i}/{len(hotel_urls)}] {url.split('?')[0]}")
        try:
            saved = scrape_hotel(session, db, url, slug_counter, airports)
            total_saved += saved
            db.mark_done(AGENCY, url)
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
    parser.add_argument("--airports", type=str, default='',
                        help=f"ID letišť oddělená čárkou (default: všechna = {','.join(str(k) for k in AIRPORT_NAMES)}). Př: --airports 4312,4313")
    args = parser.parse_args()
    if args.airports:
        airports = [int(x.strip()) for x in args.airports.split(",") if x.strip()]
    else:
        airports = None  # použij výchozí = všechna letiště
    run(limit=args.limit, delay=args.delay, delete=args.delete, airports=airports)
