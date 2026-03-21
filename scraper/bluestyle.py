"""
Blue Style scraper — stahuje hotely a termíny do zaleto.db přes GraphQL API.

Strategie:
  1. SearchForm GraphQL → seznam destinací (arrCity IDs), dostupných departure dat a výchozích měst
  2. Pro každou kombinaci (depCity × arrCity × datum): SearchResults → hotely s termíny
  3. Upsert hotel + tours do zaleto.db (sdílená DB s Fischer scraiperem)

Použití:
  python bluestyle.py                        # stáhne vše (všechna výchozí města ze SearchForm)
  python bluestyle.py --limit 30             # jen prvních 30 hotelů (test)
  python bluestyle.py --delay 1.0            # pauza 1s mezi požadavky (default 0.5)
  python bluestyle.py --dep-cities 2,5,8    # více výchozích letišť (default: všechna ze SearchForm)
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
from pathlib import Path

import requests

# ---------------------------------------------------------------------------
# Konfigurace
# ---------------------------------------------------------------------------

BASE_URL   = "https://www.blue-style.cz"
GQL_URL    = f"{BASE_URL}/graphql"
CDN_BASE   = "https://cdn.siteone.io/img.siteone.cz/o_jpeg/www.blue-style.cz"
AGENCY     = "Blue Style"
DEP_CITY   = 2      # Praha Václav Havel (default, pokud není --dep-cities)
ADULTS     = 2
DURATION   = 7      # nocí — nejběžnější

LAST_MINUTE_DAYS  = 21
FIRST_MINUTE_DAYS = 180

DEFAULT_DB = str(Path(__file__).resolve().parent.parent / "data" / "zaleto.db")
DB_PATH    = os.environ.get("DATABASE_PATH", DEFAULT_DB)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("bluestyle")


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

import sqlite3

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
        # Migrations
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
                         ("departure_city", "TEXT")]:
            try:
                self.conn.execute(f"ALTER TABLE tours ADD COLUMN {col} {typ}")
                self.conn.commit()
            except Exception:
                pass
        self.conn.commit()

    def upsert_hotel(self, slug: str, data: dict) -> int:
        self.conn.execute("""
            INSERT INTO hotels (slug, agency, name, country, destination, resort_town,
                                stars, review_score, description, thumbnail_url, photos,
                                amenities, tags, distances, food_options, price_includes,
                                latitude, longitude, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
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
                updated_at    = datetime('now')
        """, (
            slug, AGENCY, data["name"], data["country"], data["destination"],
            data["resort_town"], data["stars"], data["review_score"],
            data.get("description"), data["thumbnail_url"], data["photos"],
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
                is_last_minute  = excluded.is_last_minute,
                is_first_minute = excluded.is_first_minute,
                departure_city  = excluded.departure_city,
                updated_at      = datetime('now')
        """, (
            hotel_id, AGENCY,
            t["departure_date"], t["return_date"], t["duration"],
            t["price"], t["transport"], t["meal_plan"],
            t.get("adults", ADULTS), t.get("room_code"), t["url"],
            int(t.get("is_last_minute", False)),
            int(t.get("is_first_minute", False)),
            t.get("departure_city", ""),
        ))

    def commit(self):
        self.conn.commit()

    def close(self):
        self.conn.close()


# ---------------------------------------------------------------------------
# HTTP session + GraphQL helper
# ---------------------------------------------------------------------------

def _make_session() -> requests.Session:
    s = requests.Session()
    s.headers.update({
        "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                           "(KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
        "Accept":          "application/json",
        "Accept-Language": "cs,en;q=0.9",
        "Content-Type":    "application/json",
        "Origin":          BASE_URL,
        "Referer":         f"{BASE_URL}/",
    })
    return s


def gql(session: requests.Session, query: str, variables: dict = None) -> dict | None:
    payload = {"query": query}
    if variables:
        payload["variables"] = variables
    try:
        r = session.post(GQL_URL, json=payload, timeout=30)
        if r.status_code != 200:
            logger.warning(f"GraphQL HTTP {r.status_code}")
            return None
        data = r.json()
        if "errors" in data:
            logger.warning(f"GraphQL errors: {data['errors'][:2]}")
            return None
        return data.get("data")
    except Exception as e:
        logger.error(f"GraphQL error: {e}")
        return None


# ---------------------------------------------------------------------------
# Hotel detail page — description z JSON-LD
# ---------------------------------------------------------------------------

def _fetch_hotel_description(session: requests.Session, hotel_url_path: str) -> str | None:
    """
    Fetchne hotel stránku a extrahuje description z JSON-LD (Schema.org Hotel).
    hotel_url_path: relativní path, např. '/egypt/marsa-alam/hotel-pickalbatros-oasis/'
    """
    url = f"{BASE_URL}{hotel_url_path}"
    try:
        r = session.get(url, timeout=20, headers={"Accept": "text/html,*/*"})
        if r.status_code != 200:
            return None
        # Najdi JSON-LD blok s @type Hotel
        for m in re.finditer(r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
                             r.text, re.DOTALL):
            try:
                data = json.loads(m.group(1))
                # Může být objekt nebo {"@graph": [...]}
                items = data.get("@graph", [data])
                for item in items:
                    if item.get("@type") == "Hotel" and item.get("description"):
                        return item["description"].strip()
            except (json.JSONDecodeError, AttributeError):
                continue
    except Exception as e:
        logger.debug(f"Detail page error {hotel_url_path}: {e}")
    return None


# ---------------------------------------------------------------------------
# GraphQL queries
# ---------------------------------------------------------------------------

SEARCH_FORM_QUERY = """
query SearchForm {
  searchFormV3 {
    depCity { default options { key value } }
    arrCity {
      countries {
        key value
        destinations {
          key value
          regions { key value }
        }
      }
    }
    dates { key value durations { days nights } }
    durations
  }
}
"""

SEARCH_RESULTS_QUERY = """
query SearchResults($request: SearchV3RequestInput!) {
  searchV3(request: $request) {
    hotels {
      idHotel
      idSeason
      name
      stars
      countryName
      destinationName
      regionName
      url
      photoUrl
      photos { url isPrimary }
      gps { latitude longitude }
      discounts
      facilities { key value }
      rating {
        blueStyle { summary { rating ratingCount } }
      }
      defaultSearchTerm {
        arrCity
        arrivalAirportCode
        depCity
        flightDate
        flightNumber
        minPrice
        nights
        returnDate
      }
      rooms {
        id
        variants {
          board { key value }
          pricePerPerson
          room { key value }
        }
      }
    }
    pagination { page pageCount totalItems itemsPerPage }
  }
}
"""


# ---------------------------------------------------------------------------
# LM/FM detekce
# ---------------------------------------------------------------------------

def _detect_tour_type(dep_date: str, is_lm_native: bool = False, is_fm_native: bool = False,
                      discounts: list = None) -> tuple[bool, bool]:
    """Vrátí (is_last_minute, is_first_minute)."""
    # 1. Nativní flagy z API (pokud jsou dostupné)
    if is_lm_native:
        return True, False
    if is_fm_native:
        return False, True

    # 2. Zkontroluj discounts seznam
    discount_str = " ".join(str(d).lower() for d in (discounts or []))
    if "last" in discount_str or "lastminute" in discount_str:
        return True, False
    if "first" in discount_str or "early" in discount_str or "firstminute" in discount_str:
        return False, True

    # 3. Výpočet z data
    try:
        today = datetime.today().replace(hour=0, minute=0, second=0, microsecond=0)
        dep_dt = datetime.strptime(dep_date[:10], "%Y-%m-%d")
        days_until = (dep_dt - today).days
        return 0 <= days_until <= LAST_MINUTE_DAYS, days_until >= FIRST_MINUTE_DAYS
    except Exception:
        return False, False


# ---------------------------------------------------------------------------
# Sestavení URL termínu
# ---------------------------------------------------------------------------

def _build_tour_url(hotel_url: str, dep_city: int, arr_city: int, date: str,
                    nights: int, flight_no: str,
                    room_key: str, board_key: str) -> str:
    """Sestaví booking URL pro Bluestyle."""
    base = f"{BASE_URL}{hotel_url.rstrip('/')}/"
    params = {
        "depCity": dep_city,
        "arrCity": arr_city,
        "date": date,
        "duration": nights,
    }
    if flight_no:
        params["flightNo"] = flight_no
    # room1=adults|roomCode|boardCode
    room_part = f"{ADULTS}"
    if room_key:
        room_part += f"|{room_key}"
    if board_key:
        room_part += f"|{board_key}"
    params["room1"] = room_part
    return base + "?" + urllib.parse.urlencode(params)


# ---------------------------------------------------------------------------
# Zpracování dat z API
# ---------------------------------------------------------------------------

def _parse_stars(raw) -> int | None:
    """Parsuje hvězdičky — přijímá int nebo string jako 'STAR_5' nebo '5'."""
    if raw is None:
        return None
    s = str(raw)
    m = re.search(r"(\d+)", s)
    return int(m.group(1)) if m else None


def _process_hotel(h: dict) -> dict:
    """Sestaví hotel_dict z GraphQL hotel objektu."""
    def _abs(url: str) -> str:
        if not url:
            return url
        if url.startswith("http"):
            return url
        return CDN_BASE + url

    photos_raw = h.get("photos") or []
    photos = [_abs(p["url"]) for p in photos_raw if p.get("url")]
    if not photos and h.get("photoUrl"):
        photos = [_abs(h["photoUrl"])]

    thumbnail = photos[0] if photos else _abs(h.get("photoUrl") or "")

    gps = h.get("gps") or {}

    rating_obj = ((h.get("rating") or {}).get("blueStyle") or {}).get("summary") or {}
    _rs = rating_obj.get("rating")
    try:
        review_score = float(_rs) if _rs is not None else None
    except (TypeError, ValueError):
        review_score = None

    country          = h.get("countryName") or ""
    region           = h.get("regionName") or ""
    destination_name = h.get("destinationName") or ""
    destination      = " / ".join(filter(None, [country, destination_name, region]))

    # Facilities → amenities (JSON array of strings)
    raw_facilities = h.get("facilities") or []
    amenities_list = [f["value"] for f in raw_facilities if f.get("value")]
    amenities = json.dumps(amenities_list, ensure_ascii=False) if amenities_list else None

    return {
        "name":           h.get("name", ""),
        "country":        country,
        "destination":    destination,
        "resort_town":    region,
        "stars":          _parse_stars(h.get("stars")),
        "review_score":   review_score,
        "description":    None,   # doplní se z detail page
        "thumbnail_url":  thumbnail,
        "photos":         json.dumps(photos) if photos else "[]",
        "amenities":      amenities,
        "tags":           None,
        "distances":      None,
        "food_options":   None,
        "price_includes": None,
        "latitude":       gps.get("latitude"),
        "longitude":      gps.get("longitude"),
    }


def _process_tours(h: dict, dep_city_name: str = "") -> list[dict]:
    """Sestaví seznam tour_dict z GraphQL hotel objektu."""
    tours = []
    term = h.get("defaultSearchTerm") or {}
    hotel_url = (h.get("url") or "").split("?")[0]  # odstraň query params z URL
    discounts = h.get("discounts") or []

    dep_date   = (term.get("flightDate") or "")[:10]
    ret_date   = (term.get("returnDate") or "")[:10]
    nights     = int(term.get("nights") or DURATION)
    arr_city   = int(term.get("arrCity") or 0)
    dep_city   = int(term.get("depCity") or DEP_CITY)
    flight_no  = term.get("flightNumber") or ""
    arr_code   = term.get("arrivalAirportCode") or ""

    if not dep_date:
        return tours

    transport = "letecky"
    if arr_code:
        transport = f"letecky → {arr_code}"
    if flight_no:
        transport += f" ({flight_no})"

    # Pro každý typ stravování / pokoje v rooms
    rooms = h.get("rooms") or []
    seen_urls: set[str] = set()

    for room in rooms:
        for variant in (room.get("variants") or []):
            board     = variant.get("board") or {}
            room_type = variant.get("room") or {}
            board_key  = board.get("key") or ""
            board_name = board.get("value") or ""
            room_key   = room_type.get("key") or ""
            price      = float(variant.get("pricePerPerson") or 0)

            if price <= 0:
                # Fallback na defaultSearchTerm cenu
                price = float(term.get("minPrice") or 0)
            if price <= 0:
                continue

            tour_url = _build_tour_url(
                hotel_url, dep_city, arr_city, dep_date,
                nights, flight_no, room_key, board_key
            )

            if tour_url in seen_urls:
                continue
            seen_urls.add(tour_url)

            is_lm, is_fm = _detect_tour_type(dep_date, discounts=discounts)

            tours.append({
                "departure_date":  dep_date,
                "return_date":     ret_date,
                "duration":        nights,
                "price":           price,
                "transport":       transport,
                "meal_plan":       board_name,
                "adults":          ADULTS,
                "room_code":       room_key,
                "url":             tour_url,
                "is_last_minute":  is_lm,
                "is_first_minute": is_fm,
                "departure_city":  dep_city_name,
            })

    # Pokud rooms byly prázdné, přidej alespoň defaultní termín
    if not tours:
        price = float(term.get("minPrice") or 0)
        if price > 0:
            tour_url = _build_tour_url(
                hotel_url, dep_city, arr_city, dep_date,
                nights, flight_no, "", ""
            )
            is_lm, is_fm = _detect_tour_type(dep_date, discounts=discounts)
            tours.append({
                "departure_date":  dep_date,
                "return_date":     ret_date,
                "duration":        nights,
                "price":           price,
                "transport":       transport,
                "meal_plan":       "",
                "adults":          ADULTS,
                "room_code":       "",
                "url":             tour_url,
                "is_last_minute":  is_lm,
                "is_first_minute": is_fm,
                "departure_city":  dep_city_name,
            })

    return tours


# ---------------------------------------------------------------------------
# Načtení dat ze SearchForm
# ---------------------------------------------------------------------------

def get_search_form(session: requests.Session) -> dict:
    """
    Vrátí:
      arr_cities: list[str]     — IDs destinací pro arrCity parametr (mohou být "123" nebo "1814-1809")
      dates: list[str]          — dostupná departure data (YYYY-MM-DD)
      dep_city_names: dict[int, str] — mapa dep city ID → název
    """
    data = gql(session, SEARCH_FORM_QUERY)
    if not data or not data.get("searchFormV3"):
        logger.error("SearchForm vrátil prázdná data")
        return {"arr_cities": [], "dates": [], "dep_city_names": {}}

    form = data["searchFormV3"]

    # Dep city names
    dep_city_data = form.get("depCity") or {}
    dep_city_names: dict[int, str] = {}
    for opt in (dep_city_data.get("options") or []):
        try:
            dep_city_names[int(opt["key"])] = opt.get("value") or str(opt["key"])
        except (KeyError, ValueError, TypeError):
            pass

    # DEBUG: vypiš strukturu arrCity aby bylo vidět formát klíčů
    arr_city_raw = (form.get("arrCity") or {})
    countries = arr_city_raw.get("countries") or []
    logger.info(f"SearchForm: {len(countries)} zemí v arrCity")
    if countries:
        sample = countries[0]
        logger.debug(f"  Ukázka country: key={sample.get('key')} value={sample.get('value')}")
        dests = sample.get("destinations") or []
        if dests:
            d0 = dests[0]
            logger.debug(f"  Ukázka dest: key={d0.get('key')} value={d0.get('value')}")
            regs = d0.get("regions") or []
            if regs:
                logger.debug(f"  Ukázka region: key={regs[0].get('key')} value={regs[0].get('value')}")

    # Sbírej destination-level IDs (jednoduché číslo jako "1814")
    # Region klíče jsou composite "destKey-regionKey" a nelze je přímo použít jako arrCity
    # URL příklad: arrCity=12 → odpovídá destination.key
    arr_ids = []
    for country in countries:
        for dest in country.get("destinations") or []:
            k = dest.get("key")
            if k is not None:
                try:
                    arr_ids.append(str(int(k)))  # jen čistá čísla
                except (ValueError, TypeError):
                    pass  # přeskoč composite klíče na destination úrovni (nemělo by nastat)

    # Departure dates
    raw_dates = form.get("dates") or []
    dates = []
    for d in raw_dates:
        key = str(d.get("key") or "")
        # key může být "2026-03-23" nebo jiný formát
        if re.match(r"\d{4}-\d{2}-\d{2}", key):
            dates.append(key[:10])
        else:
            # zkus value
            val = str(d.get("value") or "")
            m = re.search(r"(\d{4}-\d{2}-\d{2})", val)
            if m:
                dates.append(m.group(1))

    # Deduplikace + seřazení
    dates = sorted(set(dates))
    arr_ids = list(dict.fromkeys(arr_ids))

    logger.info(f"SearchForm: {len(arr_ids)} destinací, {len(dates)} termínů, {len(dep_city_names)} dep cities")
    return {"arr_cities": arr_ids, "dates": dates, "dep_city_names": dep_city_names}


# ---------------------------------------------------------------------------
# SearchResults pro jednu kombinaci arrCity × datum
# ---------------------------------------------------------------------------

def search_hotels(session: requests.Session, arr_city: str, date: str,
                  page: int = 1, dep_city: int = DEP_CITY) -> dict | None:
    """Vrátí data ze SearchResults pro danou destinaci a datum."""
    request: dict = {
        "depCity":  dep_city,
        "arrCity":  [int(arr_city)],
        "durations": [DURATION],
        "rooms":    [{"adults": ADULTS, "children": []}],
        "page":     page,
    }
    if date:
        request["dateFrom"] = date
        request["dateTo"]   = date

    variables = {"request": request}
    data = gql(session, SEARCH_RESULTS_QUERY, variables)
    if not data:
        return None
    result = data.get("searchV3")
    if result is not None:
        hotels = result.get("hotels") or []
        pagination = result.get("pagination") or {}
        logger.debug(f"  searchV3 depCity={dep_city} arrCity={arr_city} date={date}: {len(hotels)} hotelů, pagination={pagination}")
        if hotels:
            logger.debug(f"  Ukázka hotelu: {json.dumps(hotels[0], ensure_ascii=False)[:300]}")
    return result


# ---------------------------------------------------------------------------
# Hlavní scraper
# ---------------------------------------------------------------------------

def delete_all(db: ZaletoDB):
    """Smaže všechny Blue Style hotely a termíny. Zachová Fischer data."""
    hotels_count = db.conn.execute("SELECT COUNT(*) FROM hotels WHERE agency = ?", (AGENCY,)).fetchone()[0]
    tours_count  = db.conn.execute("SELECT COUNT(*) FROM tours  WHERE agency = ?", (AGENCY,)).fetchone()[0]
    db.conn.execute("DELETE FROM tours  WHERE agency = ?", (AGENCY,))
    db.conn.execute("DELETE FROM hotels WHERE agency = ?", (AGENCY,))
    db.commit()
    logger.info(f"Smazáno: {hotels_count} hotelů, {tours_count} termínů (Blue Style).")


def run(limit: int = 0, delay: float = 0.5, dep_cities: list[int] | None = None, delete: bool = False):
    session = _make_session()
    db = ZaletoDB()

    if delete:
        logger.info("--delete: mažu stávající Blue Style data...")
        delete_all(db)

    # 1. Načti SearchForm
    form_data = get_search_form(session)
    arr_cities = form_data["arr_cities"]
    dates      = form_data["dates"]
    dep_city_names = form_data.get("dep_city_names") or {}

    # Pokud nejsou dep_cities zadány, použij všechna z SearchForm
    if dep_cities is None:
        dep_cities = list(dep_city_names.keys()) or [DEP_CITY]

    if not arr_cities:
        logger.error("Žádné destinace ze SearchForm — zkontroluj GraphQL")
        db.close()
        return

    if not dates:
        # Fallback: scrapuj bez data (default termin pro každou destinaci)
        logger.warning("Žádná data ze SearchForm — používám prázdné datum")
        dates = [""]

    hotel_count    = 0
    tour_count     = 0
    slug_by_path:  dict = {}  # url_path → přiřazený slug (stejný hotel = stejný slug)
    slug_used:     set  = set()  # všechny použité slugy (pro detekci kolizí jiných hotelů)
    fetched_detail: set = set()  # url_path hotelů, pro které jsme již fetchli detail stránku

    logger.info(f"Začínám scrape: {len(dep_cities)} dep cities × {len(arr_cities)} destinací × {len(dates)} dat")
    logger.info(f"Dep cities: {dep_cities}")
    logger.info(f"Ukázka arrCity IDs: {arr_cities[:5]}")
    logger.info(f"Ukázka dat: {dates[:5]}")

    for dep_city in dep_cities:
        dep_city_name = dep_city_names.get(dep_city, str(dep_city))
        logger.info(f"== Dep city: {dep_city} ({dep_city_name}) ==")
        for date in dates:
            for arr_city in arr_cities:
                page = 1
                while True:
                    result = search_hotels(session, arr_city, date, page, dep_city)
                    if not result:
                        break

                    hotels_raw = result.get("hotels") or []
                    pagination = result.get("pagination") or {}
                    page_count = pagination.get("pageCount") or 1

                    for h in hotels_raw:
                        if not h.get("name"):
                            continue

                        # Slug — stabilní per hotel URL path (stejný hotel = vždy stejný slug)
                        hotel_url_path = (h.get("url") or "").split("?")[0].strip("/")
                        is_known = hotel_url_path in slug_by_path

                        # Přeskoč nový hotel, pokud jsme dosáhli limitu
                        if limit and hotel_count >= limit and not is_known:
                            continue

                        try:
                            hotel_dict = _process_hotel(h)
                            tours      = _process_tours(h, dep_city_name)
                        except Exception as e:
                            logger.error(f"  Chyba zpracování hotelu {h.get('name','?')}: {e} | data={json.dumps(h, ensure_ascii=False)[:200]}")
                            continue

                        if not tours:
                            logger.debug(f"  Skip {h.get('name')} — žádné tours")
                            continue

                        slug_from_url = hotel_url_path.split("/")[-1] if hotel_url_path else ""
                        base_slug = f"bs-{slug_from_url or slugify(hotel_dict['name'])}"

                        if is_known:
                            slug = slug_by_path[hotel_url_path]
                        else:
                            slug = base_slug
                            n = 0
                            while slug in slug_used:
                                n += 1
                                slug = f"{base_slug}-{n}"
                            slug_by_path[hotel_url_path] = slug
                            slug_used.add(slug)

                        is_new_hotel = hotel_url_path not in fetched_detail

                        # Fetchni description z detail page (jen jednou per hotel)
                        if is_new_hotel and hotel_url_path:
                            fetched_detail.add(hotel_url_path)
                            desc = _fetch_hotel_description(session, "/" + hotel_url_path + "/")
                            if desc:
                                hotel_dict["description"] = desc

                        hotel_id = db.upsert_hotel(slug, hotel_dict)

                        saved = 0
                        for t in tours:
                            try:
                                db.upsert_tour(hotel_id, t)
                                saved += 1
                            except Exception as e:
                                logger.debug(f"Tour skip: {e}")

                        db.commit()
                        if is_new_hotel:
                            hotel_count += 1
                        tour_count += saved
                        logger.info(f"  {'[NEW] ' if is_new_hotel else '[+]   '}{hotel_dict['name']} ⭐{hotel_dict['stars']} — {saved} termínů [dep={dep_city} arr={arr_city} / {date or 'default'}]")

                    if page >= page_count or not hotels_raw:
                        break
                    page += 1
                    time.sleep(delay)

                time.sleep(delay)

    if limit and hotel_count >= limit:
        logger.info(f"Dosažen limit {limit} hotelů")

    db.close()
    logger.info(f"Hotovo. Uloženo: {hotel_count} hotelů, {tour_count} termínů.")
    return hotel_count


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Blue Style scraper → zaleto.db")
    parser.add_argument("--limit", type=int, default=0,
                        help="Max počet nových hotelů (0 = všechny); existující hotely dostávají termíny i po dosažení limitu")
    parser.add_argument("--delay", type=float, default=0.5,
                        help="Pauza mezi API požadavky v sekundách")
    parser.add_argument("--dep-cities", type=str, default='',
                        help=f"ID výchozích letišť oddělená čárkou (default: všechna ze SearchForm). Př: --dep-cities 2,5,8")
    parser.add_argument("--delete", action="store_true",
                        help="Před stažením smaže všechny stávající Blue Style záznamy")
    parser.add_argument("--debug", action="store_true",
                        help="Zapne DEBUG logování (zobrazí strukturu API odpovědí)")
    args = parser.parse_args()
    if args.debug:
        logging.getLogger().setLevel(logging.DEBUG)
    if args.dep_cities:
        dep_cities = [int(x.strip()) for x in args.dep_cities.split(",") if x.strip()]
    else:
        dep_cities = None  # použij všechna výchozí města ze SearchForm
    run(limit=args.limit, delay=args.delay, dep_cities=dep_cities, delete=args.delete)
