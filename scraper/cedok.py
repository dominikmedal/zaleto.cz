"""
Čedok scraper — stahuje hotely a termíny do zaleto.db.

Strategie (stejná jako Fischer/Bluestyle):
  1. /vysledky-vyhledavani/dovolena/ → stránky výsledků hledání s __NEXT_DATA__
  2. Z každé stránky výsledků: pole `rates` → hotel info + nejlepší termín
  3. Pagination přes ?skip=N (po 25)
  4. Upsert hotel + tour do zaleto.db (sdílená DB s Fischer a Blue Style)

Použití:
  python cedok.py                    # stáhne vše
  python cedok.py --limit 50         # jen prvních 50 hotelů (test)
  python cedok.py --delay 1.5        # pauza mezi stránkami
  python cedok.py --delete           # smaže Čedok data a stáhne znovu
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
from pathlib import Path

import requests

# ---------------------------------------------------------------------------
# Konfigurace
# ---------------------------------------------------------------------------

BASE_URL    = "https://www.cedok.cz"
SEARCH_BASE = f"{BASE_URL}/vysledky-vyhledavani/dovolena"
AGENCY      = "Čedok"
ADULTS      = 2

LAST_MINUTE_DAYS  = 21
FIRST_MINUTE_DAYS = 180

DEFAULT_DB = str(Path(__file__).resolve().parent.parent / "data" / "zaleto.db")
DB_PATH    = os.environ.get("DATABASE_PATH", DEFAULT_DB)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("cedok")

# Výchozí destinační slugy pro vyhledávání
DEFAULT_DEST_SLUGS = [
    # Egypt
    "egypt",
    # Turecko
    "turecko", "turecko-egejska-riviera", "turecko-stredozemni-riviera",
    "turecko-bodrum", "turecko-istanbul",
    # Španělsko + ostrovy
    "spanelsko", "mallorca", "ibiza", "menorca", "costa-brava", "costa-del-sol",
    # Řecko — ostrovy + pevnina
    "recko", "kreta", "rhodos", "korfu", "kos", "zakynthos", "thassos",
    "lesbos", "atheny", "mykonos", "santorini", "kefalonie",
    # Kypr
    "kypr",
    # Chorvatsko
    "chorvatsko",
    # Itálie
    "italie",
    # Kanárské ostrovy
    "kanarske-ostrovy", "fuerteventura", "tenerife", "gran-canaria", "lanzarote",
    # Ostatní oblíbené
    "thajsko", "bulharsko", "tunisko",
    "dominikanska-republika", "albanie", "kena", "maledivy", "zanzibar",
    "mexiko", "kuba", "mauricius", "kapverdske-ostrovy", "madeira",
    "maroko", "jordansko", "bali", "srilanka", "vietnam",
]

COUNTRY_MAP = {
    "egypt": "Egypt",
    "turecko": "Turecko",
    "turecko-egejska-riviera": "Turecko/Egejská riviéra",
    "turecko-stredozemni-riviera": "Turecko/Středomořská riviéra",
    "turecko-bodrum": "Turecko/Bodrum",
    "turecko-istanbul": "Turecko/Istanbul",
    "spanelsko": "Španělsko",
    "mallorca": "Španělsko/Mallorca",
    "ibiza": "Španělsko/Ibiza",
    "menorca": "Španělsko/Menorca",
    "costa-brava": "Španělsko/Costa Brava",
    "costa-del-sol": "Španělsko/Costa del Sol",
    "recko": "Řecko", "kreta": "Řecko/Kréta",
    "rhodos": "Řecko/Rhodos", "korfu": "Řecko/Korfu", "kos": "Řecko/Kos",
    "zakynthos": "Řecko/Zakynthos", "thassos": "Řecko/Thassos",
    "lesbos": "Řecko/Lesbos", "atheny": "Řecko/Athény",
    "mykonos": "Řecko/Mykonos", "santorini": "Řecko/Santorini",
    "kefalonie": "Řecko/Kefalonie",
    "kypr": "Kypr",
    "chorvatsko": "Chorvatsko",
    "italie": "Itálie",
    "kanarske-ostrovy": "Kanárské ostrovy", "fuerteventura": "Kanárské ostrovy/Fuerteventura",
    "tenerife": "Kanárské ostrovy/Tenerife", "gran-canaria": "Kanárské ostrovy/Gran Canaria",
    "lanzarote": "Kanárské ostrovy/Lanzarote", "thajsko": "Thajsko",
    "bulharsko": "Bulharsko", "tunisko": "Tunisko",
    "dominikanska-republika": "Dominikánská republika", "albanie": "Albánie",
    "kena": "Keňa", "maledivy": "Maledivy", "zanzibar": "Zanzibar",
    "mexiko": "Mexiko", "kuba": "Kuba", "mauricius": "Mauricius",
    "kapverdske-ostrovy": "Kapverdské ostrovy", "madeira": "Madeira",
    "maroko": "Maroko", "jordansko": "Jordánsko", "bali": "Bali",
    "srilanka": "Srí Lanka", "vietnam": "Vietnam",
}


# ---------------------------------------------------------------------------
# Slugify
# ---------------------------------------------------------------------------

def slugify(text: str) -> str:
    text = unicodedata.normalize("NFD", text.lower())
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    text = re.sub(r"[^a-z0-9\s-]", "", text)
    text = re.sub(r"\s+", "-", text.strip())
    text = re.sub(r"-+", "-", text)
    return text


# ---------------------------------------------------------------------------
# DB
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
                agency TEXT NOT NULL,
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
        for col, typ in [("photos", "TEXT"), ("review_score", "REAL"),
                         ("tags", "TEXT"), ("distances", "TEXT"),
                         ("amenities", "TEXT"), ("food_options", "TEXT"),
                         ("price_includes", "TEXT"), ("api_config", "TEXT")]:
            try:
                self.conn.execute(f"ALTER TABLE hotels ADD COLUMN {col} {typ}")
                self.conn.commit()
            except Exception:
                pass
        for col, typ in [("is_last_minute", "INTEGER DEFAULT 0"),
                         ("is_first_minute", "INTEGER DEFAULT 0"),
                         ("departure_city", "TEXT"),
                         ("price_single", "REAL"),
                         ("url_single", "TEXT")]:
            try:
                self.conn.execute(f"ALTER TABLE tours ADD COLUMN {col} {typ}")
                self.conn.commit()
            except Exception:
                pass

        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS hotel_checkpoints (
                agency     TEXT NOT NULL,
                key        TEXT NOT NULL,
                cycle_date TEXT NOT NULL,
                PRIMARY KEY (agency, key, cycle_date)
            )
        """)
        self.conn.commit()

    def get_done_keys(self, agency: str) -> set:
        today = datetime.now().strftime("%Y-%m-%d")
        rows = self.conn.execute(
            "SELECT key FROM hotel_checkpoints WHERE agency = ? AND cycle_date = ?",
            (agency, today),
        ).fetchall()
        return {r[0] for r in rows}

    def mark_done(self, agency: str, key: str):
        today = datetime.now().strftime("%Y-%m-%d")
        self.conn.execute(
            "INSERT OR IGNORE INTO hotel_checkpoints (agency, key, cycle_date) VALUES (?, ?, ?)",
            (agency, key, today),
        )
        self.conn.commit()

    def upsert_hotel(self, slug: str, data: dict) -> int:
        self.conn.execute("""
            INSERT INTO hotels (slug, agency, name, country, destination, resort_town,
                                stars, review_score, description, thumbnail_url, photos,
                                amenities, tags, distances, food_options, price_includes,
                                latitude, longitude, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(slug) DO UPDATE SET
                agency         = excluded.agency,
                name           = excluded.name,
                country        = excluded.country,
                destination    = excluded.destination,
                resort_town    = excluded.resort_town,
                stars          = excluded.stars,
                review_score   = excluded.review_score,
                description    = excluded.description,
                thumbnail_url  = excluded.thumbnail_url,
                photos         = excluded.photos,
                amenities      = excluded.amenities,
                tags           = excluded.tags,
                updated_at     = datetime('now')
        """, (
            slug, AGENCY, data["name"], data.get("country"), data.get("destination"),
            data.get("resort_town"), data.get("stars"), data.get("review_score"),
            data.get("description"), data.get("thumbnail_url"), data.get("photos"),
            data.get("amenities"), data.get("tags"), data.get("distances"),
            data.get("food_options"), data.get("price_includes"),
            data.get("latitude"), data.get("longitude"),
        ))
        row = self.conn.execute("SELECT id FROM hotels WHERE slug = ?", (slug,)).fetchone()
        return row[0]

    def upsert_tour(self, hotel_id: int, t: dict):
        self.conn.execute("""
            INSERT INTO tours (hotel_id, agency, departure_date, return_date, duration,
                               price, transport, meal_plan, adults, room_code, url,
                               is_last_minute, is_first_minute, departure_city, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(url) DO UPDATE SET
                price           = excluded.price,
                transport       = excluded.transport,
                meal_plan       = excluded.meal_plan,
                return_date     = excluded.return_date,
                departure_date  = excluded.departure_date,
                is_last_minute  = excluded.is_last_minute,
                is_first_minute = excluded.is_first_minute,
                departure_city  = excluded.departure_city,
                updated_at      = datetime('now')
        """, (
            hotel_id, AGENCY,
            t["departure_date"], t.get("return_date"), t.get("duration"),
            t["price"], t.get("transport", "letecky"), t.get("meal_plan", ""),
            t.get("adults", ADULTS), t.get("room_code", ""), t["url"],
            int(t.get("is_last_minute", False)),
            int(t.get("is_first_minute", False)),
            t.get("departure_city", ""),
        ))

    def update_single_price(self, two_adult_url: str, price_single: float, url_single: str):
        """Aktualizuje cenu pro 1 dospělého na existujícím termínu (matchuje dle 2-adult URL)."""
        self.conn.execute(
            "UPDATE tours SET price_single = ?, url_single = ?, updated_at = datetime('now') WHERE url = ?",
            (price_single, url_single, two_adult_url),
        )

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
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "cs-CZ,cs;q=0.9",
    })
    return s


def _get(session: requests.Session, url: str, timeout: int = 20) -> str | None:
    try:
        r = session.get(url, timeout=timeout)
        if r.status_code == 200:
            return r.text
        logger.warning(f"HTTP {r.status_code}: {url}")
        return None
    except Exception as e:
        logger.error(f"Fetch error {url}: {e}")
        return None


# ---------------------------------------------------------------------------
# Pomocné funkce
# ---------------------------------------------------------------------------

def _clean_city(val: str) -> str:
    """Odstraní '(letiště)' a podobné přípony z názvu města."""
    if not val:
        return ""
    return re.sub(r"\s*\(.*?\)\s*", "", val).strip()


def _detect_tour_type(dep_date: str, promotions: list) -> tuple[bool, bool]:
    promo_vals = [p.get("value", "") for p in (promotions or [])]
    if "LastMinute" in promo_vals:
        return True, False
    if "FirstMinute" in promo_vals or "EarlyBooking" in promo_vals:
        return False, True
    try:
        today = datetime.today().replace(hour=0, minute=0, second=0, microsecond=0)
        dep_dt = datetime.strptime(dep_date[:10], "%Y-%m-%d")
        days = (dep_dt - today).days
        return 0 <= days <= LAST_MINUTE_DAYS, days >= FIRST_MINUTE_DAYS
    except Exception:
        return False, False


# ---------------------------------------------------------------------------
# Parsování __NEXT_DATA__ ze stránek výsledků
# ---------------------------------------------------------------------------

def _extract_next_data(html: str) -> dict | None:
    m = re.search(r'id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.DOTALL)
    if not m:
        return None
    try:
        return json.loads(m.group(1))
    except json.JSONDecodeError:
        return None


def _extract_hotel_links(html: str) -> dict[str, str]:
    """
    Extrahuje hotel URLs z JSON-LD ItemList (čisté, bez ?id=).
    Vrací dict: hotel_code -> absolute_url
    """
    links = {}
    for url in re.findall(
        r'"url":"(https://www\.cedok\.cz/dovolena/[^"]+,([A-Z0-9]+)/)"',
        html
    ):
        full_url, code = url
        if code not in links:
            links[code] = full_url
    return links


def _get_rates(html: str) -> tuple[list, int]:
    """
    Vrací (list_of_rates, total_count) z __NEXT_DATA__ na stránce výsledků.
    """
    data = _extract_next_data(html)
    if not data:
        return [], 0
    try:
        qs = data["props"]["pageProps"]["initialQueryState"]["queries"]
        if not qs:
            return [], 0
        rates_obj = qs[0]["state"]["data"]["main"]["rates"]
        return rates_obj.get("list", []), rates_obj.get("ratesCount", 0)
    except (KeyError, IndexError, TypeError):
        return [], 0


def _parse_rate(rate: dict, hotel_links: dict, dest_slug: str) -> tuple[dict, dict] | None:
    """
    Parsuje jeden rate objekt z výsledků hledání.
    Vrací (hotel_dict, tour_dict) nebo None při chybě.
    """
    code = rate.get("supplierObjectId", "")
    offer_id = rate.get("id", "")

    # Segments
    segments = rate.get("segments", [])
    flight_seg = next((s for s in segments if s.get("type") == "flight"), {})
    hotel_seg  = next((s for s in segments if s.get("type") == "hotel"),  {})
    content    = hotel_seg.get("content", {})

    # --- Hotel info ---
    name = content.get("title", "") or code
    if not name:
        return None

    photos_raw = content.get("photos", {}).get("gallery", [])
    thumbnail  = photos_raw[0] if photos_raw else ""
    photos_json = json.dumps(photos_raw) if photos_raw else "[]"

    hotel_rating = content.get("hotelRating")  # 40 = 4 hvězdičky
    stars = int(hotel_rating / 10) if hotel_rating else None

    facilities = [f.get("title", "") for f in content.get("facilities", []) if isinstance(f, dict)]
    categories = [c.get("title", "") for c in content.get("categories", []) if isinstance(c, dict)]

    # Krajina + destinace z URL (nebo slug)
    hotel_url_base = hotel_links.get(code, "")
    if hotel_url_base:
        parts = hotel_url_base.rstrip("/").split("/")
        # https://www.cedok.cz/dovolena/[country]/[region]/[name,CODE]/
        country_slug = parts[4] if len(parts) > 4 else ""
        region_slug  = parts[5] if len(parts) > 5 else dest_slug
    else:
        country_slug = ""
        region_slug  = dest_slug

    country     = COUNTRY_MAP.get(country_slug) or COUNTRY_MAP.get(dest_slug) or dest_slug.replace("-", " ").title()
    destination = region_slug.replace("-", " ").title()

    hotel_dict = {
        "name":          name,
        "country":       country,
        "destination":   destination,
        "resort_town":   destination,
        "stars":         stars,
        "review_score":  None,
        "description":   None,
        "thumbnail_url": thumbnail,
        "photos":        photos_json,
        "amenities":     json.dumps(facilities) if facilities else None,
        "tags":          json.dumps(categories) if categories else None,
        "distances":     None,
        "food_options":  None,
        "price_includes": None,
        "latitude":      None,
        "longitude":     None,
        "_hotel_url":    hotel_url_base,  # interní – není v DB
    }

    # --- Tour info ---
    dep_date = hotel_seg.get("beginDate", "")
    ret_date = hotel_seg.get("endDate", "")
    if not dep_date:
        return None

    duration_days = rate.get("duration", {}).get("days", 8)
    nights = max(1, duration_days - 1)

    price_raw = rate.get("price", 0)
    price = round(price_raw / 100 / ADULTS, 0)  # haléře → CZK / os.
    if price <= 0:
        return None

    meal_plan = hotel_seg.get("meal", {}).get("title", "")

    dep_city_raw = flight_seg.get("departure", {}).get("title", "")
    dep_city = _clean_city(dep_city_raw)

    dep_airport  = flight_seg.get("departure", {}).get("iata") or ""
    arr_airport  = flight_seg.get("destination", {}).get("iata") or ""
    if dep_airport and arr_airport:
        transport = f"letecky {dep_airport}→{arr_airport}"
    else:
        transport = "letecky"

    promotions = rate.get("promotions", [])
    is_lm, is_fm = _detect_tour_type(dep_date, promotions)

    # Tour URL = hotel stránka s nabídkovým ID (deeplink přímo na zájezd)
    if hotel_url_base and offer_id:
        encoded_id = urllib.parse.quote(offer_id, safe="")
        tour_url = f"{hotel_url_base}?id={encoded_id}&participants[0][adults]={ADULTS}"
    elif hotel_url_base:
        tour_url = hotel_url_base
    else:
        return None  # bez URL nemůžeme uložit

    tour_dict = {
        "departure_date": dep_date,
        "return_date":    ret_date,
        "duration":       nights,
        "price":          price,
        "transport":      transport,
        "meal_plan":      meal_plan,
        "adults":         ADULTS,
        "room_code":      "",
        "url":            tour_url,
        "departure_city": dep_city,
        "is_last_minute": is_lm,
        "is_first_minute": is_fm,
    }

    return hotel_dict, tour_dict


# ---------------------------------------------------------------------------
# Stažení jedné destinace (s paginací)
# ---------------------------------------------------------------------------

def _fetch_dest_slug(session: requests.Session, dest_slug: str, delay: float) -> list[tuple[dict, dict, str]]:
    """
    Stahuje výsledky pro daný slug. Paginuje přes ?skip=N.
    Vrací list (hotel_dict, tour_dict, db_slug).
    """
    results = []
    slug_counter: dict[str, int] = {}
    seen_codes: set[str] = set()

    skip = 0
    take = 25

    while True:
        url = f"{SEARCH_BASE}/{dest_slug}/?skip={skip}" if skip else f"{SEARCH_BASE}/{dest_slug}/"
        html = _get(session, url)
        if not html:
            break

        rates, total = _get_rates(html)
        if not rates:
            logger.debug(f"  {dest_slug} skip={skip}: žádné výsledky")
            break

        hotel_links = _extract_hotel_links(html)
        logger.debug(f"  {dest_slug} skip={skip}: {len(rates)} hotelů (z {total}), {len(hotel_links)} URL")

        for rate in rates:
            code = rate.get("supplierObjectId", "")
            if not code or code in seen_codes:
                continue
            seen_codes.add(code)

            parsed = _parse_rate(rate, hotel_links, dest_slug)
            if not parsed:
                continue
            hotel_dict, tour_dict = parsed

            # Slug z hotel URL (stabilní přes regiony)
            hotel_url = hotel_links.get(code, "")
            if hotel_url:
                url_part = hotel_url.rstrip("/").split("/")[-1]  # "hotel-name,CODE"
                slug_base = "cd-" + slugify(url_part.split(",")[0])
            else:
                slug_base = "cd-" + slugify(hotel_dict["name"])

            slug = slug_base
            n = slug_counter.get(slug_base, 0)
            if n > 0:
                slug = f"{slug_base}-{n}"
            slug_counter[slug_base] = n + 1

            results.append((hotel_dict, tour_dict, slug))

        skip += take
        if skip >= total:
            break

        time.sleep(delay / 2)

    return results


# ---------------------------------------------------------------------------
# Parsování všech termínů z hotelové detail stránky (RSC "dates" dict)
# ---------------------------------------------------------------------------

_DATES_OFFER_RE = re.compile(
    r'"id":"([A-Za-z0-9+/=]{20,})",'
    r'"beginDate":"(\d{4}-\d{2}-\d{2})",'
    r'"endDate":"(\d{4}-\d{2}-\d{2})",'
    r'"duration":\{"days":(\d+),"nights":(\d+)\},'
    r'"departure":\{"type":"flight","id":"(\w+)","title":"([^"]+)"[^}]*\},'
    r'"meal":\{"id":"[^"]*","title":"([^"]+)"\},'
    r'"room":\{"id":"([^"]*)"[^}]*\},'
    r'"price":\{"total":\{"amount":(\d+)'
)


def _parse_hotel_info(html: str) -> dict:
    """
    Extrahuje doplňkové info o hotelu z detail stránky:
    description, review_score, latitude, longitude.
    Zkouší JSON-LD → RSC chunks → meta description.
    """
    info: dict = {}

    # 1. JSON-LD
    for ld_raw in re.findall(
        r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
        html, re.DOTALL | re.IGNORECASE
    ):
        try:
            ld = json.loads(ld_raw)
            schemas = ld if isinstance(ld, list) else [ld]
            for schema in schemas:
                if schema.get("@type") in ("Hotel", "LodgingBusiness", "Accommodation"):
                    if schema.get("description") and not info.get("description"):
                        info["description"] = schema["description"]
                    ar = schema.get("aggregateRating", {})
                    if ar.get("ratingValue") and not info.get("review_score"):
                        try:
                            info["review_score"] = float(ar["ratingValue"])
                        except Exception:
                            pass
                    geo = schema.get("geo", {})
                    if geo.get("latitude") and not info.get("latitude"):
                        try:
                            info["latitude"]  = float(geo["latitude"])
                            info["longitude"] = float(geo["longitude"])
                        except Exception:
                            pass
        except Exception:
            pass

    # 2. RSC chunks — hledáme description/abstract/teaser
    if not info.get("description") or not info.get("latitude"):
        chunks_raw = re.findall(r'self\.__next_f\.push\(\[1,"(.*?)"\]\)', html, re.DOTALL)
        for chunk_raw in chunks_raw:
            try:
                unescaped = json.loads(f'"{chunk_raw}"')
            except Exception:
                continue

            # Popis hotelu (hledáme delší řetězce)
            if not info.get("description"):
                m = re.search(
                    r'"(?:description|abstract|teaser|longDescription)":"((?:[^"\\]|\\.){60,})"',
                    unescaped
                )
                if m:
                    try:
                        info["description"] = json.loads(f'"{m.group(1)}"')
                    except Exception:
                        info["description"] = m.group(1)

            # Souřadnice
            if not info.get("latitude"):
                mg = re.search(r'"latitude":([\d.]+).*?"longitude":([\d.]+)', unescaped)
                if not mg:
                    mg = re.search(r'"lat":([\d.]+).*?"lon(?:g)?":([\d.]+)', unescaped)
                if mg:
                    try:
                        info["latitude"]  = float(mg.group(1))
                        info["longitude"] = float(mg.group(2))
                    except Exception:
                        pass

            # Review score
            if not info.get("review_score"):
                mr = re.search(r'"(?:rating|reviewScore|score)":([\d.]+)', unescaped)
                if mr:
                    try:
                        score = float(mr.group(1))
                        if 0 < score <= 10:
                            info["review_score"] = score
                    except Exception:
                        pass

    # 3. Meta description jako záloha
    if not info.get("description"):
        m = re.search(
            r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']{30,})["\']',
            html, re.IGNORECASE
        )
        if not m:
            m = re.search(
                r'<meta[^>]+content=["\']([^"\']{30,})["\'][^>]+name=["\']description["\']',
                html, re.IGNORECASE
            )
        if m:
            info["description"] = m.group(1)

    return info


def _parse_hotel_dates(html: str, hotel_url: str, adults: int = ADULTS) -> list[dict]:
    """
    Extrahuje všechny dostupné termíny z hotelové detail stránky.
    Data jsou v RSC chunks v sekci "dates":{...}.
    Vrací list tour dicts.
    """
    tours = []
    seen: set[str] = set()

    # RSC chunks jsou JSON string literals
    chunks_raw = re.findall(r'self\.__next_f\.push\(\[1,"(.*?)"\]\)', html, re.DOTALL)

    for chunk_raw in chunks_raw:
        try:
            unescaped = json.loads(f'"{chunk_raw}"')
        except Exception:
            continue

        if '"current":{' not in unescaped:
            continue

        matches = _DATES_OFFER_RE.findall(unescaped)
        if not matches:
            continue

        for m in matches:
            offer_id, begin_date, end_date, days_str, nights_str, dep_id, dep_title, meal, room_code, price_str = m
            price = float(price_str) / adults  # RSC vrací celkovou cenu za skupinu
            nights = int(nights_str) or max(1, int(days_str) - 1)

            dep_city = _clean_city(dep_title)
            dep_key = f"{begin_date}_{dep_id}_{nights}"
            if dep_key in seen:
                continue
            seen.add(dep_key)

            if price <= 0:
                continue

            hotel_base = hotel_url.rstrip("/") + "/"
            encoded_id = urllib.parse.quote(offer_id, safe="")
            tour_url = f"{hotel_base}?id={encoded_id}&participants[0][adults]={adults}"
            is_lm, is_fm = _detect_tour_type(begin_date, [])

            tours.append({
                "departure_date": begin_date,
                "return_date":    end_date,
                "duration":       nights,
                "price":          price,
                "transport":      f"letecky {dep_id}",
                "meal_plan":      meal,
                "adults":         adults,
                "room_code":      room_code,
                "url":            tour_url,
                "departure_city": dep_city,
                "is_last_minute": is_lm,
                "is_first_minute": is_fm,
            })

        break  # jen první "current" chunk

    return tours


# ---------------------------------------------------------------------------
# Smazání Čedok dat
# ---------------------------------------------------------------------------

def delete_all(db: ZaletoDB):
    hotels_count = db.conn.execute("SELECT COUNT(*) FROM hotels WHERE agency = ?", (AGENCY,)).fetchone()[0]
    tours_count  = db.conn.execute("SELECT COUNT(*) FROM tours  WHERE agency = ?", (AGENCY,)).fetchone()[0]
    db.conn.execute("DELETE FROM tours  WHERE agency = ?", (AGENCY,))
    db.conn.execute("DELETE FROM hotels WHERE agency = ?", (AGENCY,))
    db.commit()
    logger.info(f"Smazáno: {hotels_count} hotelů, {tours_count} termínů (Čedok).")


# ---------------------------------------------------------------------------
# Hlavní scraper
# ---------------------------------------------------------------------------

def run(limit: int = 0, delay: float = 1.5, delete: bool = False,
        dest_slugs: list[str] | None = None):
    session = _make_session()
    db = ZaletoDB()

    if delete:
        logger.info("--delete: mažu stávající Čedok data...")
        delete_all(db)

    slugs = dest_slugs or DEFAULT_DEST_SLUGS
    logger.info(f"Destinace ke stažení: {slugs}")

    total_hotels = 0
    total_tours  = 0

    # Načti checkpoint — hotely zpracované dnes v předchozím běhu
    done_slugs = db.get_done_keys(AGENCY)
    if done_slugs:
        logger.info(f"Checkpoint: přeskakuji {len(done_slugs)} již zpracovaných hotelů z dnešního cyklu")
    global_seen_codes: set[str] = set(done_slugs)  # hotely z checkpointu = už viděné

    for i, dest_slug in enumerate(slugs):
        logger.info(f"[{i+1}/{len(slugs)}] Destinace: {dest_slug}")

        results = _fetch_dest_slug(session, dest_slug, delay)

        new = 0
        for hotel_dict, tour_dict, slug in results:
            # Deduplikace přes destinace (hotel může být ve více hledáních)
            code_key = f"{slug}"
            if code_key in global_seen_codes:
                continue
            global_seen_codes.add(code_key)

            try:
                hotel_id = db.upsert_hotel(slug, hotel_dict)

                # Načteme detail stránku pro všechny termíny (RSC "dates" dict)
                hotel_url = hotel_dict.get("_hotel_url", "")
                detail_tours = []
                if hotel_url:
                    detail_html = _get(session, hotel_url)
                    if detail_html:
                        # Doplň info o hotelu (popis, souřadnice, hodnocení)
                        detail_info = _parse_hotel_info(detail_html)
                        if detail_info:
                            for key in ("description", "review_score", "latitude", "longitude"):
                                if detail_info.get(key) is not None:
                                    hotel_dict[key] = detail_info[key]
                            db.upsert_hotel(slug, hotel_dict)
                        detail_tours = _parse_hotel_dates(detail_html, hotel_url)
                        time.sleep(delay / 3)

                if detail_tours:
                    # Smažeme staré tours a nahradíme detailními
                    db.conn.execute("DELETE FROM tours WHERE hotel_id = ? AND agency = ?", (hotel_id, AGENCY))
                    saved = 0
                    for t in detail_tours:
                        try:
                            db.upsert_tour(hotel_id, t)
                            saved += 1
                        except Exception:
                            pass
                    db.commit()

                    # Fetch ceny pro 1 dospělého
                    single_html = _get(session, hotel_url + "?participants[0][adults]=1")
                    if single_html:
                        single_tours = _parse_hotel_dates(single_html, hotel_url, adults=1)
                        for st in single_tours:
                            # Odvoď 2-adult URL (klíč) z 1-adult URL
                            two_url = st["url"].replace("participants[0][adults]=1", f"participants[0][adults]={ADULTS}")
                            db.update_single_price(two_url, st["price"], st["url"])
                        db.commit()
                        time.sleep(delay / 3)

                    logger.info(f"  ✓ {hotel_dict['name']} ⭐{hotel_dict['stars']} — {saved} termínů")
                else:
                    # Fallback: ulož aspoň best offer z výsledků hledání
                    db.upsert_tour(hotel_id, tour_dict)
                    db.commit()
                    logger.info(f"  ✓ {hotel_dict['name']} ⭐{hotel_dict['stars']} "
                                f"{tour_dict['departure_city']} {tour_dict['departure_date']} "
                                f"{tour_dict['price']:.0f} Kč (1 termín)")

                db.mark_done(AGENCY, slug)
                new += 1
                total_hotels += 1
                total_tours  += len(detail_tours) if detail_tours else 1
            except Exception as e:
                logger.debug(f"  Skip {slug}: {e}")

            if limit and total_hotels >= limit:
                break

        logger.info(f"  → {new} nových hotelů")

        if limit and total_hotels >= limit:
            logger.info(f"Dosažen limit {limit} hotelů")
            break

        if i < len(slugs) - 1:
            time.sleep(delay)

    db.close()
    logger.info(f"Hotovo. Uloženo: {total_hotels} hotelů, {total_tours} termínů.")
    return total_tours


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Čedok scraper → zaleto.db")
    parser.add_argument("--limit", type=int, default=0,
                        help="Max počet hotelů (0 = všechny)")
    parser.add_argument("--delay", type=float, default=1.5,
                        help="Pauza mezi stránkami v sekundách (default 1.5)")
    parser.add_argument("--delete", action="store_true",
                        help="Před stažením smaže všechny stávající Čedok záznamy")
    parser.add_argument("--slugs", type=str, default="",
                        help="Destinační slugy oddělené čárkou (default: vše)")
    args = parser.parse_args()

    dest_slugs = [s.strip() for s in args.slugs.split(",") if s.strip()] or None

    run(limit=args.limit, delay=args.delay, delete=args.delete,
        dest_slugs=dest_slugs)
