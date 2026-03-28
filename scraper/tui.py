"""
TUI scraper — stahuje hotely a termíny do zaleto.db.

Strategie:
  1. Discovery: TUI sitemap → hotelové URL → odvození destinačních stránek;
     doplněno statickými DISCOVERY_PAGES (PRG/BRQ/OSR/PED odletové stránky).
  2. Z každé stránky: __NEXT_DATA__ → initialTopOffersData / initialOffersData → hotel URL + offer kód
  3. Paginace (initialOffersData stránky): ?page=N
  4. Offer kód → dekódování: datum odjezdu/návratu, letiště odletu/příletu
  5. Hotel detail stránka → name, stars, popis, fotky, GPS, vybavenost, hodnocení
  6. Upsert hotel + tours do zaleto.db (sdílená DB s Fischer, Čedok, Blue Style)

URL formát termínu:
  {hotel_url}/OfferCodeWS/{DEPCODE}{ARRCODE}{DEP_DATE8}{DEP_TIME4}{???8}{RET_DATE8}{RET_TIME4}...

Použití:
  python tui.py                    # stáhne vše
  python tui.py --limit 50         # jen prvních 50 hotelů (test)
  python tui.py --delay 1.5        # pauza mezi požadavky (default 1.5)
  python tui.py --delete           # smaže TUI data a stáhne znovu
  python tui.py --debug            # zapne DEBUG logování (zobrazí klíče __NEXT_DATA__)
"""

import argparse
import json
import logging
import os
import random
import re
import time
import unicodedata
import urllib.parse
from datetime import datetime, timedelta
from pathlib import Path

import requests
from requests.exceptions import ConnectionError as ReqConnectionError, ChunkedEncodingError

from db import ZaletoDB

# ---------------------------------------------------------------------------
# Konfigurace
# ---------------------------------------------------------------------------

BASE_URL          = "https://www.tui.cz"
AGENCY            = "TUI"
ADULTS            = 2
CONFIGURATOR_BASE = f"{BASE_URL}/api/services/tui-search/api/hotel-cards/configurators"

# TUI configurator API vyžaduje JavaScript-inicializovaný session token —
# z Pythonu vždy vrátí 500. Nastavte na True jen pokud máte Playwright/browser proxy.
USE_CONFIGURATOR_API = False

LAST_MINUTE_DAYS  = 21
FIRST_MINUTE_DAYS = 180

# IATA kód letiště → název města (pro departure_city)
AIRPORT_NAMES: dict[str, str] = {
    "PRG": "Praha",
    "BRQ": "Brno",
    "OSR": "Ostrava",
    "PED": "Pardubice",
    "CBU": "České Budějovice",
    "KTW": "Katowice",
    "WRO": "Wrocław",
    "VIE": "Vídeň",
    "BUD": "Budapešť",
}

# Záložní seznam destinačních a odletových stránek.
# Používá se jen pokud TUI sitemap nevrátí hotelové URL.
# Odletové stránky (odlety-z-*) mají paginaci a vracejí VŠECHNY hotely dané destinace/letiště.
DISCOVERY_PAGES: list[str] = [
    # ------------------------------------------------------------------
    # Odlety z Prahy (PRG) — největší letiště, nejvíce hotelů
    # ------------------------------------------------------------------
    "/dovolena/turecko/odlety-z-prahy/",
    "/dovolena/recko/odlety-z-prahy/",
    "/dovolena/egypt/odlety-z-prahy/",
    "/dovolena/kanarske-ostrovy/odlety-z-prahy/",
    "/dovolena/spanelsko/odlety-z-prahy/",
    "/dovolena/kypr/odlety-z-prahy/",
    "/dovolena/bulharsko/odlety-z-prahy/",
    "/dovolena/tunisko/odlety-z-prahy/",
    "/dovolena/chorvatsko/odlety-z-prahy/",
    "/dovolena/malta/odlety-z-prahy/",
    "/dovolena/portugal/odlety-z-prahy/",
    "/dovolena/dominikanska-republika/odlety-z-prahy/",
    "/dovolena/mauricius/odlety-z-prahy/",
    "/dovolena/sri-lanka/odlety-z-prahy/",
    "/dovolena/thajsko/odlety-z-prahy/",
    "/dovolena/spojene-arabske-emiraty/odlety-z-prahy/",
    "/dovolena/zanzibar/odlety-z-prahy/",
    "/dovolena/kuba/odlety-z-prahy/",
    "/dovolena/mexiko/odlety-z-prahy/",
    "/dovolena/albanie/odlety-z-prahy/",
    "/dovolena/cerna-hora/odlety-z-prahy/",
    # ------------------------------------------------------------------
    # Odlety z Brna (BRQ)
    # ------------------------------------------------------------------
    "/dovolena/turecko/odlety-z-brna/",
    "/dovolena/recko/odlety-z-brna/",
    "/dovolena/egypt/odlety-z-brna/",
    "/dovolena/bulharsko/odlety-z-brna/",
    "/dovolena/tunisko/odlety-z-brna/",
    "/dovolena/kanarske-ostrovy/odlety-z-brna/",
    "/dovolena/spanelsko/odlety-z-brna/",
    "/dovolena/kypr/odlety-z-brna/",
    "/dovolena/chorvatsko/odlety-z-brna/",
    "/dovolena/malta/odlety-z-brna/",
    # ------------------------------------------------------------------
    # Odlety z Ostravy (OSR)
    # ------------------------------------------------------------------
    "/dovolena/turecko/odlety-z-ostravy/",
    "/dovolena/recko/odlety-z-ostravy/",
    "/dovolena/egypt/odlety-z-ostravy/",
    "/dovolena/bulharsko/odlety-z-ostravy/",
    "/dovolena/tunisko/odlety-z-ostravy/",
    "/dovolena/kanarske-ostrovy/odlety-z-ostravy/",
    "/dovolena/spanelsko/odlety-z-ostravy/",
    # ------------------------------------------------------------------
    # Odlety z Pardubic (PED)
    # ------------------------------------------------------------------
    "/dovolena/turecko/odlety-z-pardubic/",
    "/dovolena/recko/odlety-z-pardubic/",
    "/dovolena/egypt/odlety-z-pardubic/",
    "/dovolena/bulharsko/odlety-z-pardubic/",
    # ------------------------------------------------------------------
    # Záložní hlavní destinační stránky (top 3 hotely, bez paginace)
    # Použijí se pro hotely, které nejsou v odletových stránkách.
    # ------------------------------------------------------------------
    "/dovolena/turecko/",
    "/dovolena/turecko/turecka-riviera/",
    "/dovolena/turecko/egejska-riviera/",
    "/dovolena/turecko/bodrum/",
    "/dovolena/turecko/antalya/",
    "/dovolena/egypt/",
    "/dovolena/egypt/hurghada/",
    "/dovolena/egypt/marsa-alam/",
    "/dovolena/egypt/sharm-el-sheikh/",
    "/dovolena/recko/",
    "/dovolena/recko/kreta/",
    "/dovolena/recko/rhodos/",
    "/dovolena/recko/korfu/",
    "/dovolena/recko/kos/",
    "/dovolena/recko/zakynthos/",
    "/dovolena/recko/mykonos/",
    "/dovolena/recko/santorini/",
    "/dovolena/recko/thassos/",
    "/dovolena/recko/lesbos/",
    "/dovolena/recko/kefalonie/",
    "/dovolena/kanarske-ostrovy/",
    "/dovolena/kanarske-ostrovy/tenerife/",
    "/dovolena/kanarske-ostrovy/lanzarote/",
    "/dovolena/kanarske-ostrovy/gran-canaria/",
    "/dovolena/kanarske-ostrovy/fuerteventura/",
    "/dovolena/spanelsko/",
    "/dovolena/spanelsko/mallorca/",
    "/dovolena/spanelsko/ibiza/",
    "/dovolena/spanelsko/costa-del-sol/",
    "/dovolena/kypr/",
    "/dovolena/bulharsko/",
    "/dovolena/albanie/",
    "/dovolena/chorvatsko/",
    "/dovolena/cerna-hora/",
    "/dovolena/portugal/",
    "/dovolena/portugal/madeira/",
    "/dovolena/portugal/azory/",
    "/dovolena/dominikanska-republika/",
    "/dovolena/mauricius/",
    "/dovolena/sri-lanka/",
    "/dovolena/tunisko/",
    "/dovolena/malta/",
    "/dovolena/thajsko/",
    "/dovolena/spojene-arabske-emiraty/",
    "/dovolena/zanzibar/",
    "/dovolena/kuba/",
    "/dovolena/mexiko/",
]

# Keywords odletových stránek — mají paginaci a vracejí všechny hotely
_DEPARTURE_PAGE_KEYWORDS = ("odlety-z-", "odlety-prg", "odlety-brq", "odlety-osr")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("tui")


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
# HTTP session
# ---------------------------------------------------------------------------

def _make_session() -> requests.Session:
    s = requests.Session()
    s.headers.update({
        "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                           "(KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
        "Accept":          "text/html,application/xhtml+xml,*/*;q=0.8",
        "Accept-Language": "cs,en;q=0.9",
        "Referer":         f"{BASE_URL}/",
    })
    return s


_CONNECTION_ERRORS = (ReqConnectionError, ChunkedEncodingError, TimeoutError)


def _get(session: requests.Session, url: str, timeout: int = 20, _retries: int = 2) -> str | None:
    for attempt in range(_retries + 1):
        try:
            r = session.get(url, timeout=timeout)
            if r.status_code == 200:
                return r.text
            logger.warning(f"HTTP {r.status_code}: {url}")
            return None
        except _CONNECTION_ERRORS as e:
            if attempt < _retries:
                wait = 5 * (attempt + 1) + random.uniform(0, 3)
                logger.warning(f"Spojení přerušeno ({e.__class__.__name__}), retry #{attempt+1} za {wait:.1f}s")
                time.sleep(wait)
                session.close()
                new_s = _make_session()
                session.headers = new_s.headers
                session.cookies = new_s.cookies
            else:
                logger.error(f"Fetch error po {_retries} pokusech {url}: {e}")
                return None
        except Exception as e:
            logger.error(f"Fetch error {url}: {e}")
            return None


# ---------------------------------------------------------------------------
# Configurator API — více termínů na hotel
# ---------------------------------------------------------------------------

_HOTEL_CODE_FROM_SLUG_RE = re.compile(r'-([a-z]{3}\d{4,5})$')


def _hotel_code_from_path(hotel_path: str) -> str:
    """Extrahuje hotel kód z URL slug. '/dovolena/.../three-corners-hrg11155/' → 'HRG11155'."""
    segment = hotel_path.rstrip("/").split("/")[-1]
    m = _HOTEL_CODE_FROM_SLUG_RE.search(segment)
    return m.group(1).upper() if m else ""


def _post_json(session: requests.Session, url: str, body: dict, referer: str = "") -> dict | list | None:
    """POST JSON na TUI API. Vrátí naparsovaný JSON nebo None."""
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "cs,en-US;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Origin": BASE_URL,
        "Referer": referer or BASE_URL,
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        "X-Requested-With": "XMLHttpRequest",
    }
    for attempt in range(3):
        try:
            r = session.post(url, json=body, headers=headers, timeout=30)
            if r.status_code == 200:
                return r.json()
            logger.debug(f"  API HTTP {r.status_code} [{url.split('/')[-1]}]: {r.text[:300]}")
            return None
        except _CONNECTION_ERRORS as e:
            if attempt < 2:
                wait = 6 * (attempt + 1) + random.uniform(0, 4)
                logger.warning(f"API spojení přerušeno ({e.__class__.__name__}), retry #{attempt+1} za {wait:.1f}s")
                time.sleep(wait)
                session.close()
                new_s = _make_session()
                session.headers = new_s.headers
                session.cookies = new_s.cookies
            else:
                logger.debug(f"  API error po 3 pokusech {url.split('/')[-1]}: {e}")
                return None
        except Exception as e:
            logger.debug(f"  API error {url.split('/')[-1]}: {e}")
            return None
    return None


def _parse_all_offers_response(raw: list | dict, hotel_path: str) -> list[dict]:
    """Konvertuje API odpověď s nabídkami na seznam tour dictů."""
    offers_list: list = []
    if isinstance(raw, list):
        offers_list = raw
    elif isinstance(raw, dict):
        offers_list = raw.get("offers") or []

    tours: list[dict] = []
    seen_urls: set[str] = set()

    for o in offers_list:
        if not isinstance(o, dict):
            continue

        offer_code = o.get("offerCode") or ""
        dep_date   = o.get("departureDate") or o.get("startDate") or ""
        ret_date   = o.get("returnDate") or ""
        duration   = o.get("duration")
        airport_name = o.get("airportName") or ""
        meal_plan  = o.get("boardName") or ""
        room_code  = o.get("roomCode") or ""

        try:
            price = float(o.get("price") or o.get("pricePerPerson") or 0)
        except Exception:
            price = 0.0
        if price <= 0:
            continue

        if offer_code:
            tour_url = f"{BASE_URL}{hotel_path}OfferCodeWS/{offer_code}"
        elif dep_date:
            tour_url = f"{BASE_URL}{hotel_path}?date={dep_date}"
        else:
            continue

        if tour_url in seen_urls:
            continue
        seen_urls.add(tour_url)

        parsed = _parse_offer_code(offer_code) if offer_code else {}
        dep_airport = parsed.get("dep_airport", "")
        arr_airport = parsed.get("arr_airport", "")
        dep_city    = parsed.get("dep_city", airport_name)

        if not dep_date and parsed.get("dep_date"):
            dep_date = parsed["dep_date"]
        if not ret_date and parsed.get("ret_date"):
            ret_date = parsed["ret_date"]
        if duration is None and parsed.get("duration"):
            duration = parsed["duration"]

        transport = "letecky"
        if dep_airport and arr_airport:
            transport = f"letecky {dep_airport}→{arr_airport}"

        is_lm, is_fm = _detect_tour_type(dep_date) if dep_date else (False, False)

        tours.append({
            "departure_date":  dep_date,
            "return_date":     ret_date,
            "duration":        duration,
            "price":           price,
            "transport":       transport,
            "meal_plan":       meal_plan,
            "adults":          ADULTS,
            "room_code":       room_code,
            "url":             tour_url,
            "is_last_minute":  is_lm,
            "is_first_minute": is_fm,
            "departure_city":  dep_city,
        })

    return tours


def _fetch_filters(
    session: requests.Session,
    hotel_code: str,
    initial_offer_code: str,
    airport: str,
    start_date: str | None,
    board_code: str | None,
    referer: str,
) -> dict:
    """
    Volá TUI filters endpoint a vrátí dostupná data a hodiny odletu.
    Odpověď: {dates: {value: [...]}, availableHours: {value: [...]}}
    """
    body = {
        "offerCode":         initial_offer_code,
        "hotelCode":         hotel_code,
        "tripType":          "WS",
        "airportCode":       airport,
        "startDate":         start_date,
        "durationFrom":      "1",
        "durationTo":        "21",
        "boardCode":         board_code,
        "adultsCount":       "2",
        "childrenBirthdays": [],
        "occupancies":       [{"id": 0, "adultsCount": 2, "participantsCount": 2}],
    }
    result = _post_json(session, f"{CONFIGURATOR_BASE}/filters", body, referer)
    return result if isinstance(result, dict) else {}


def _parse_filter_dates(filters: dict) -> list[str]:
    """Extrahuje seznam dostupných datumů z odpovědi filters endpointu."""
    dates_obj = filters.get("dates") or {}
    if isinstance(dates_obj, dict):
        items = dates_obj.get("value") or []
    elif isinstance(dates_obj, list):
        items = dates_obj
    else:
        return []

    dates = []
    for item in items:
        if isinstance(item, dict):
            d = item.get("value") or item.get("date") or ""
        elif isinstance(item, str):
            d = item
        else:
            continue
        if re.match(r'^\d{4}-\d{2}-\d{2}$', d):
            dates.append(d)
    return dates


def _parse_filter_hours(filters: dict) -> list[str]:
    """Extrahuje seznam dostupných hodin odletu z odpovědi filters endpointu."""
    hours_obj = filters.get("availableHours") or filters.get("hours") or {}
    if isinstance(hours_obj, dict):
        items = hours_obj.get("value") or []
    elif isinstance(hours_obj, list):
        items = hours_obj
    else:
        return []

    hours = []
    for item in items:
        if isinstance(item, dict):
            h = item.get("value") or item.get("label") or ""
        elif isinstance(item, str):
            h = item
        else:
            continue
        if re.match(r'^\d{2}:\d{2}$', h):
            hours.append(h)
    return hours


def _fetch_tours_from_api(
    session: requests.Session,
    hotel_path: str,
    initial_offer_code: str,
    fallback_tour: dict,
) -> list[dict]:
    """
    Volá TUI configurator API a vrátí všechny termíny pro daný hotel.
    Při selhání API vrátí [fallback_tour] (1 termín z listingu).
    """
    hotel_code = _hotel_code_from_path(hotel_path)
    if not hotel_code:
        return [fallback_tour]

    referer    = f"{BASE_URL}{hotel_path}OfferCodeWS/{initial_offer_code}"
    parsed_0   = _parse_offer_code(initial_offer_code)
    airport    = parsed_0.get("dep_airport") or "PRG"
    start_date = parsed_0.get("dep_date")
    board_code = parsed_0.get("meal_plan", "")
    # Zpětné mapování: "All Inclusive" → "A"
    _BOARD_NAME_TO_CODE = {v: k for k, v in BOARD_CODE_NAMES.items()}
    board_code_api = _BOARD_NAME_TO_CODE.get(board_code) or None

    # Priming: navštiv hotel offer stránku pro správné cookies
    _get(session, referer)
    time.sleep(0.5)

    occupancies = [{"id": 0, "adultsCount": 2, "participantsCount": 2}]

    # Získej dostupná data + hodiny odletu přes filters endpoint
    filters = _fetch_filters(session, hotel_code, initial_offer_code, airport, start_date, board_code_api, referer)
    available_dates = _parse_filter_dates(filters)
    available_hours = _parse_filter_hours(filters)
    logger.debug(f"  filters → {len(available_dates)} dat, {len(available_hours)} hodin pro {hotel_code}")

    # Pokud nemáme data z filters, použij datum z offer kódu
    dates_to_try = available_dates or ([start_date] if start_date else [])
    # Nejlvíce 1 hodina (první dostupná), nebo None
    hour_to_use: str | None = available_hours[0] if available_hours else None

    all_tours: list[dict] = []
    seen_urls: set[str] = set()

    for date in dates_to_try:
        body: dict = {
            "offerCode":         initial_offer_code,
            "hotelCode":         hotel_code,
            "tripType":          "WS",
            "airportCode":       airport,
            "startDate":         date,
            "durationFrom":      "1",
            "durationTo":        "21",
            "boardCode":         board_code_api,
            "adultsCount":       "2",
            "childrenBirthdays": [],
            "occupancies":       occupancies,
            "pagination":        {"pageNo": 0, "pageSize": 50},
            "sort":              {"field": "PRICE", "order": "ASCENDING"},
        }
        if hour_to_use:
            body["hours"] = hour_to_use

        result = _post_json(session, f"{CONFIGURATOR_BASE}/all-offers", body, referer)
        if not result:
            continue
        tours = _parse_all_offers_response(result, hotel_path)
        for t in tours:
            if t["url"] not in seen_urls:
                seen_urls.add(t["url"])
                all_tours.append(t)

    if all_tours:
        logger.debug(f"  all-offers: {len(all_tours)} termínů pro {hotel_code}")
        return all_tours

    # Fallback: price-calendar
    cal_body: dict = {
        "offerCode":         initial_offer_code,
        "hotelCode":         hotel_code,
        "tripType":          "WS",
        "airportCode":       airport,
        "startDate":         start_date,
        "durationFrom":      "1",
        "durationTo":        "21",
        "boardCode":         board_code_api,
        "adultsCount":       "2",
        "childrenBirthdays": [],
        "occupancies":       occupancies,
        "pagination":        {"pageNo": 0, "pageSize": 365},
        "sort":              {"field": "PRICE", "order": "ASCENDING"},
    }
    if hour_to_use:
        cal_body["hours"] = hour_to_use

    result = _post_json(session, f"{CONFIGURATOR_BASE}/price-calendar", cal_body, referer)
    if result:
        tours = _parse_all_offers_response(result, hotel_path)
        if tours:
            logger.debug(f"  price-calendar: {len(tours)} termínů pro {hotel_code}")
            return tours

    logger.debug(f"  Configurator API nedostupné pro {hotel_code}, použit 1 termín z listingu")
    return [fallback_tour]


# ---------------------------------------------------------------------------
# LM/FM detekce
# ---------------------------------------------------------------------------

def _detect_tour_type(dep_date: str) -> tuple[bool, bool]:
    """Vrátí (is_last_minute, is_first_minute) podle počtu dní do odjezdu."""
    try:
        today  = datetime.today().replace(hour=0, minute=0, second=0, microsecond=0)
        dep_dt = datetime.strptime(dep_date[:10], "%Y-%m-%d")
        days   = (dep_dt - today).days
        return 0 <= days <= LAST_MINUTE_DAYS, days >= FIRST_MINUTE_DAYS
    except Exception:
        return False, False


# ---------------------------------------------------------------------------
# Parsování offer kódu z URL
# ---------------------------------------------------------------------------

# Offer kód: {DEP3}{ARR3}{DEP_YYYYMMDD}{DEP_HHMM}{???8}{RET_YYYYMMDD}{RET_HHMM}{...}
# Příklad: PRG AYT 20260510 1835 20260510 20260516 1635 L06 AYT17050 DZX1 AA02 ...
_OFFER_CODE_RE = re.compile(
    r'^([A-Z]{3})'    # dep letiště (3 písmena)
    r'([A-Z]{3})'     # arr letiště (3 písmena)
    r'(\d{8})'        # datum odjezdu YYYYMMDD
    r'\d{4}'          # čas odjezdu HHMM (přeskočit)
    r'\d{8}'          # neznámé datum (přeskočit — pravděp. outbound segment datum)
    r'(\d{8})'        # datum návratu YYYYMMDD
)

# Hotel kód v offer kódu: {3-písm. arr airport}{4-5 číslic}
# Příklad: AYT17050, AYT61172, HRG14031, RMF18004
_HOTEL_CODE_IN_OFFER_RE = re.compile(r'([A-Z]{3})(\d{4,5})')

# Kód pokoje + kód stravování za hotel kódem
# Příklad: DZX1 A A02... → room_code=DZX1, board_char=A
_ROOM_BOARD_RE = re.compile(r'([A-Z]{2,4}\d+)([A-Z])')

BOARD_CODE_NAMES: dict[str, str] = {
    "A": "All Inclusive",
    "B": "Snídaně",
    "F": "Plná penze",
    "H": "Polopenze",
    "R": "Bez stravy",
    "S": "Samoobsluha",
    "G": "Ultra All Inclusive",
    "U": "Ultra All Inclusive",
    "L": "All Inclusive Light",
    "D": "Večeře",
    "N": "Bez stravy",
}


def _parse_offer_code(offer_code: str) -> dict:
    """
    Dekóduje TUI offer kód a vrátí:
      dep_airport, arr_airport, dep_date (YYYY-MM-DD), ret_date (YYYY-MM-DD),
      duration (noci), hotel_code, dep_city, room_code, meal_plan.
    """
    result: dict = {}
    m = _OFFER_CODE_RE.match(offer_code)
    if not m:
        logger.debug(f"  Offer kód neodpovídá regulárnímu výrazu: {offer_code[:30]}")
        return result

    dep_raw = m.group(3)
    ret_raw = m.group(4)

    dep_date = f"{dep_raw[:4]}-{dep_raw[4:6]}-{dep_raw[6:8]}"
    ret_date = f"{ret_raw[:4]}-{ret_raw[4:6]}-{ret_raw[6:8]}"

    dep_airport = m.group(1)
    arr_airport = m.group(2)

    try:
        dep_dt = datetime.strptime(dep_date, "%Y-%m-%d")
        ret_dt = datetime.strptime(ret_date, "%Y-%m-%d")
        duration = max(1, (ret_dt - dep_dt).days)
    except Exception:
        duration = None

    # Hotel kód (za flight code L06/L07 apod.)
    after_times = offer_code[m.end():]
    hm = _HOTEL_CODE_IN_OFFER_RE.search(after_times)
    hotel_code = hm.group(0) if hm else ""

    # Kód pokoje a stravování (za hotel kódem)
    room_code = ""
    meal_plan = ""
    if hm:
        after_hotel = after_times[hm.end():]
        rm = _ROOM_BOARD_RE.match(after_hotel)
        if rm:
            room_code = rm.group(1)
            meal_plan = BOARD_CODE_NAMES.get(rm.group(2), "")

    result["dep_airport"] = dep_airport
    result["arr_airport"] = arr_airport
    result["dep_date"]    = dep_date
    result["ret_date"]    = ret_date
    result["duration"]    = duration
    result["hotel_code"]  = hotel_code
    result["dep_city"]    = AIRPORT_NAMES.get(dep_airport, dep_airport)
    result["room_code"]   = room_code
    result["meal_plan"]   = meal_plan
    return result


# ---------------------------------------------------------------------------
# Extrakce __NEXT_DATA__ a nabídek
# ---------------------------------------------------------------------------

def _extract_next_data(html: str) -> dict | None:
    m = re.search(r'id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.DOTALL)
    if not m:
        return None
    try:
        return json.loads(m.group(1))
    except json.JSONDecodeError:
        return None


def _extract_top_offers(next_data: dict) -> list[dict]:
    """
    Extrahuje pole hotelů z initialTopOffersData v __NEXT_DATA__.
    Formát: [{hotelName, image, hotelStars, breadcrumbs, topReasons, price, url}]
    Url = /dovolena/{zeme}/{region}/{hotel-slug}/OfferCodeWS/{offer_code}
    """
    page_props = (next_data.get("props") or {}).get("pageProps") or {}

    for key in ("initialTopOffersData", "topOffersData", "featuredHotels", "initialHotels"):
        val = page_props.get(key)
        if isinstance(val, list) and val and isinstance(val[0], dict) and val[0].get("hotelName"):
            logger.debug(f"  Top offers nalezeny pod pageProps.{key}: {len(val)} ks")
            return val

    if logger.isEnabledFor(logging.DEBUG):
        logger.debug(f"  pageProps klíče: {list(page_props.keys())[:20]}")
    return []


def _extract_offers_data(next_data: dict) -> list[dict]:
    """
    Extrahuje nabídky z initialOffersData (listing stránky).

    Struktura: initialOffersData = [{"offers": [...], "pagination": ..., "currency": ...}]
    Každý offer: {hotelCode, hotelName, offerCode, offerUrl, roomCode, hotelStandard,
                  duration, breadcrumbs, city, features, ...} — BEZ ceny.
    Ceny doplníme z initialCalendarOffersData (cenový kalendář).
    """
    page_props = (next_data.get("props") or {}).get("pageProps") or {}

    # Sestav mapu cen: hotelCode → nejnižší cena z cenového kalendáře
    price_map: dict[str, float] = _build_price_map(page_props)

    results: list[dict] = []

    for key in ("initialPromotedOffersData", "initialOffersData"):
        raw = page_props.get(key)
        if not isinstance(raw, list) or not raw:
            continue

        first = raw[0] if isinstance(raw[0], dict) else {}
        if logger.isEnabledFor(logging.DEBUG) and first:
            logger.debug(f"  {key}[0] klíče: {list(first.keys())[:15]}")

        # Wrapper: [{pagination, offers, responseType, currency}]
        item_list: list = []
        if isinstance(first.get("offers"), list):
            item_list = first["offers"]
            if logger.isEnabledFor(logging.DEBUG) and item_list:
                f0 = item_list[0] if isinstance(item_list[0], dict) else {}
                logger.debug(f"  {key}.offers[0] klíče: {list(f0.keys())[:15]}")
        else:
            item_list = [x for x in raw if isinstance(x, dict)]

        for item in item_list:
            if not isinstance(item, dict):
                continue
            entry = _normalize_offer_item(item, price_map)
            if entry:
                results.append(entry)

        if results:
            logger.debug(f"  {key}: {len(results)} nabídek")
            return results

    return results


def _build_price_map(page_props: dict) -> dict[str, float]:
    """
    Sestav mapu {hotelCode: nejnižší_cena} z initialCalendarOffersData.
    TUI ukládá cenový kalendář v: [{offers: [{hotelCode, minPrice, price, ...}]}]
    """
    price_map: dict[str, float] = {}

    for key in ("initialCalendarOffersData", "initialCalendarRangeData"):
        raw = page_props.get(key)
        if not isinstance(raw, list) or not raw:
            continue

        first = raw[0] if isinstance(raw[0], dict) else {}
        if logger.isEnabledFor(logging.DEBUG) and first:
            logger.debug(f"  {key}[0] klíče: {list(first.keys())[:10]}")

        items = first.get("offers") or first.get("dates") or []
        if not isinstance(items, list):
            # Může být přímo seznam
            items = [x for x in raw if isinstance(x, dict)]

        for item in items:
            if not isinstance(item, dict):
                continue
            hotel_code = item.get("hotelCode") or item.get("code") or ""
            price_raw = item.get("minPrice") or item.get("price") or item.get("pricePerPerson") or 0
            if isinstance(price_raw, dict):
                price_raw = price_raw.get("amount") or price_raw.get("value") or 0
            try:
                price = float(price_raw)
            except Exception:
                price = 0.0
            if hotel_code and price > 0:
                if hotel_code not in price_map or price < price_map[hotel_code]:
                    price_map[hotel_code] = price

        if price_map:
            logger.debug(f"  price_map z {key}: {len(price_map)} hotelů")
            break

    return price_map


def _normalize_offer_item(item: dict, price_map: dict[str, float] | None = None) -> dict | None:
    """
    Normalizuje jeden offer objekt z initialOffersData na standardní formát
    kompatibilní s _parse_top_offer_entry.

    initialOffersData.offers format:
      {hotelCode, hotelName, offerCode, offerUrl, roomCode, hotelStandard,
       duration, breadcrumbs, city, features, ...}
    """
    # Přímé klíče (initialOffersData.offers format)
    name = (item.get("hotelName") or item.get("name") or "").strip()
    if not name:
        return None

    hotel_code = item.get("hotelCode") or item.get("code") or ""

    # Offer URL — přímé nebo z offer kódu
    offer_code = item.get("offerCode") or ""
    offer_url  = item.get("offerUrl") or item.get("url") or ""
    if not offer_url:
        hotel_url = item.get("hotelUrl") or item.get("detailUrl") or ""
        if offer_code and hotel_url:
            hp = hotel_url.rstrip("/")
            if not hp.startswith("/"):
                hp = "/" + hp
            offer_url = f"{hp}/OfferCodeWS/{offer_code}"

    if offer_url.startswith(BASE_URL):
        offer_url = offer_url[len(BASE_URL):]

    # offerUrl z initialOffersData je zkrácené: "/hotel-path/OfferCodeWS" — bez kódu na konci
    # Doplníme offer kód, pokud chybí
    if offer_url and "OfferCodeWS" in offer_url and offer_code:
        after = offer_url.split("OfferCodeWS", 1)[1]
        if "/" not in after.lstrip("/") or not after.strip("/"):
            offer_url = offer_url.split("OfferCodeWS")[0] + f"OfferCodeWS/{offer_code}"

    if not offer_url or "OfferCodeWS" not in offer_url:
        logger.debug(f"    Offer bez URL: name={name[:30]}, klíče: {list(item.keys())[:12]}")
        return None

    # Cena — initialOffersData používá discountPerPersonPrice/originalPerPersonPrice
    price_raw = (
        item.get("discountPerPersonPrice") or item.get("originalPerPersonPrice") or
        item.get("price") or item.get("pricePerPerson") or item.get("minPrice") or 0
    )
    if isinstance(price_raw, dict):
        price_raw = price_raw.get("amount") or price_raw.get("value") or 0
    try:
        price = float(price_raw)
    except Exception:
        price = 0.0

    if price <= 0 and price_map and hotel_code:
        price = price_map.get(hotel_code, 0.0)

    if price <= 0:
        return None

    # Obrázek — initialOffersData nemá image, doplní se z detail stránky
    img_raw = (
        item.get("image") or item.get("photo") or item.get("thumbnail") or
        item.get("imageUrl") or {}
    )
    if isinstance(img_raw, str):
        img = {"url": img_raw} if img_raw.startswith("http") else {}
    elif isinstance(img_raw, dict):
        img = img_raw
    else:
        img = {}

    # Hvězdičky — initialOffersData: 'hotelStandard' (int)
    stars_raw = item.get("hotelStandard") or item.get("stars") or item.get("hotelStars")
    try:
        stars = int(re.search(r"\d+", str(stars_raw)).group()) if stars_raw is not None else None
    except Exception:
        stars = None

    # Breadcrumbs — initialOffersData: buď list dicts [{label,url},...] nebo string
    bc_raw = item.get("breadcrumbs") or item.get("destination") or ""
    if isinstance(bc_raw, list):
        breadcrumbs = " / ".join(x.get("label", "") for x in bc_raw if isinstance(x, dict) and x.get("label"))
    else:
        breadcrumbs = str(bc_raw)

    # Tags/features — initialOffersData: 'features' (list of strings or dicts)
    features_raw = item.get("features") or item.get("topReasons") or []
    top_reasons: list[str] = []
    for f in features_raw:
        if isinstance(f, str):
            top_reasons.append(f)
        elif isinstance(f, dict):
            val = f.get("name") or f.get("label") or f.get("value") or ""
            if val:
                top_reasons.append(str(val))

    return {
        "url":         offer_url,
        "hotelName":   name,
        "image":       img,
        "price":       price,
        "hotelStars":  stars,
        "breadcrumbs": breadcrumbs,
        "topReasons":  top_reasons,
    }


# ---------------------------------------------------------------------------
# Extrakce nabídek ze stránek s JSON-LD ItemList (listing stránky)
# ---------------------------------------------------------------------------

# Ceny ve formátu "7 801 Kč" nebo "21 350 Kč" (čísla oddělena nezlomitelnou mezerou)
_PRICE_RE = re.compile(r'(\d{1,3}(?:[\s\u00a0]\d{3})+)\s*Kč', re.IGNORECASE)


def _extract_jsonld_offers(html: str) -> list[dict]:
    """
    Extrahuje hotel nabídky z JSON-LD ItemList (listing a filter stránky).
    Doplňuje ceny z HTML (parsování v pořadí výskytu).

    Vrací nabídky ve stejném formátu jako initialTopOffersData, ale bez stars/breadcrumbs.
    """
    offers: list[dict] = []

    # Najdi JSON-LD ItemList s offer URL
    for raw in re.findall(
        r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
        html, re.DOTALL | re.IGNORECASE
    ):
        try:
            ld = json.loads(raw)
        except Exception:
            continue
        if not isinstance(ld, dict):
            continue
        items = None
        if ld.get("@type") == "ItemList":
            items = ld.get("itemListElement") or []
        elif isinstance(ld.get("@graph"), list):
            for node in ld["@graph"]:
                if node.get("@type") == "ItemList":
                    items = node.get("itemListElement") or []
                    break
        if not items:
            continue

        for item in items:
            url = item.get("url") or ""
            name = item.get("name") or ""
            image = item.get("image") or ""
            if not url or not name or "OfferCodeWS" not in url:
                continue
            # Relativní URL
            if url.startswith(BASE_URL):
                url = url[len(BASE_URL):]
            offers.append({
                "url":         url,
                "hotelName":   name,
                "image":       {"url": image} if isinstance(image, str) else {},
                "price":       None,
                "hotelStars":  None,
                "breadcrumbs": "",
                "topReasons":  [],
            })
        if offers:
            break  # stačí první ItemList

    if not offers:
        return []

    # Ceny extrahuj pouze za pozicí prvního OfferCodeWS odkazu, aby se
    # přeskočily ceny v hlavičce/navigaci stránky
    search_start = html.find("OfferCodeWS")
    if search_start < 0:
        search_start = 0

    prices = []
    for m in _PRICE_RE.finditer(html, search_start):
        try:
            price_str = re.sub(r'[\s\u00a0]', '', m.group(1))
            p = float(price_str)
            if 1000 < p < 500_000:  # rozumný rozsah ceny zájezdu v Kč
                prices.append(p)
        except Exception:
            pass

    # Přiřaď ceny k hotelům dle pořadí
    for i, offer in enumerate(offers):
        if i < len(prices):
            offer["price"] = prices[i]

    valid = [o for o in offers if o["price"]]
    logger.debug(f"  JSON-LD ItemList: {len(offers)} hotelů, {len(valid)} s cenou")
    return valid


# ---------------------------------------------------------------------------
# Parsování jednoho záznamu z initialTopOffersData
# ---------------------------------------------------------------------------

# Cesta k hotelu může mít 3–5 segmentů (zeme/region/[subregion/]hotel/)
_HOTEL_OFFER_URL_RE = re.compile(
    r'^(/dovolena/(?:[^/]+/){2,4})'  # /dovolena/ + 2–4 path segmenty + trailing /
    r'OfferCodeWS/([A-Z0-9]+)$'      # offer kód
)


def _parse_top_offer_entry(entry: dict) -> dict | None:
    """
    Parsuje jeden objekt z initialTopOffersData.
    Vrací unified dict nebo None.
    """
    offer_url_raw = entry.get("url") or ""
    m = _HOTEL_OFFER_URL_RE.match(offer_url_raw)
    if not m:
        logger.debug(f"  Entry URL neodpovídá formátu: {offer_url_raw[:60]}")
        return None

    hotel_path   = m.group(1)  # /dovolena/turecko/turecka-riviera/miss-cleopatra-hotel-ayt61172/
    offer_code   = m.group(2)
    hotel_url    = f"{BASE_URL}{hotel_path}"
    tour_url     = f"{BASE_URL}{offer_url_raw}"

    # Cena
    try:
        price = float(entry.get("price") or 0)
    except Exception:
        price = 0.0
    if price <= 0:
        return None

    # Hotel metadata z listingu (základní, bude doplněna z detail stránky)
    hotel_name = (entry.get("hotelName") or "").strip()
    if not hotel_name:
        return None

    stars_raw = entry.get("hotelStars")
    try:
        stars = int(stars_raw) if stars_raw is not None else None
    except Exception:
        stars = None

    # Fotka z listingu
    img_obj = entry.get("image") or {}
    thumbnail = img_obj.get("url") or "" if isinstance(img_obj, dict) else str(img_obj)
    if not thumbnail.startswith("http"):
        thumbnail = ""

    # Breadcrumbs → destinace + zemé
    # Příklad: "Turecko / Turecká riviéra"
    breadcrumbs = entry.get("breadcrumbs") or ""
    parts = [p.strip() for p in breadcrumbs.split("/") if p.strip()]
    country     = parts[0] if parts else ""
    destination = " / ".join(parts) if parts else ""
    resort_town = parts[-1] if len(parts) > 1 else country

    # Tags z topReasons
    top_reasons = entry.get("topReasons") or []
    tags = json.dumps(top_reasons, ensure_ascii=False) if top_reasons else None

    # Dekóduj offer kód
    parsed_code = _parse_offer_code(offer_code)
    if not parsed_code.get("dep_date"):
        return None

    dep_date    = parsed_code["dep_date"]
    ret_date    = parsed_code.get("ret_date", "")
    duration    = parsed_code.get("duration")
    dep_airport = parsed_code.get("dep_airport", "")
    arr_airport = parsed_code.get("arr_airport", "")
    dep_city    = parsed_code.get("dep_city", "")

    transport = "letecky"
    if dep_airport and arr_airport:
        transport = f"letecky {dep_airport}→{arr_airport}"

    is_lm, is_fm = _detect_tour_type(dep_date)

    return {
        # Hotel info
        "hotel_url":   hotel_url,
        "hotel_path":  hotel_path,
        "hotel_name":  hotel_name,
        "stars":       stars,
        "thumbnail":   thumbnail,
        "country":     country,
        "destination": destination,
        "resort_town": resort_town,
        "tags":        tags,
        # Tour info
        "tour_url":      tour_url,
        "price":         price,
        "dep_date":      dep_date,
        "ret_date":      ret_date,
        "duration":      duration,
        "transport":     transport,
        "dep_city":      dep_city,
        "is_last_minute": is_lm,
        "is_first_minute": is_fm,
        "meal_plan":     parsed_code.get("meal_plan", ""),
        "room_code":     parsed_code.get("room_code", ""),
    }


# ---------------------------------------------------------------------------
# Hotel detail stránka — doplnění metadat
# ---------------------------------------------------------------------------

def _fetch_hotel_detail(session: requests.Session, hotel_url: str) -> dict:
    """
    Stáhne detail stránku hotelu a extrahuje bohatší metadata:
    description, review_score, latitude, longitude, photos (seznam), amenities.
    Zkouší __NEXT_DATA__ i JSON-LD.
    """
    info: dict = {}
    html = _get(session, hotel_url)
    if not html:
        return info

    # 1. JSON-LD (rychlé, spolehlivé pro základní údaje)
    for raw in re.findall(
        r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
        html, re.DOTALL | re.IGNORECASE
    ):
        try:
            ld = json.loads(raw)
            schemas = ld if isinstance(ld, list) else [ld]
            for schema in schemas:
                if schema.get("@type") in ("Hotel", "LodgingBusiness", "Accommodation"):
                    if schema.get("description") and not info.get("description"):
                        info["description"] = schema["description"].strip()
                    geo = schema.get("geo") or {}
                    if geo.get("latitude") and not info.get("latitude"):
                        try:
                            info["latitude"]  = float(geo["latitude"])
                            info["longitude"] = float(geo["longitude"])
                        except Exception:
                            pass
                    ar = schema.get("aggregateRating") or {}
                    if ar.get("ratingValue") and not info.get("review_score"):
                        try:
                            info["review_score"] = float(ar["ratingValue"])
                        except Exception:
                            pass
        except Exception:
            continue

    # 2. __NEXT_DATA__ — rekurzivní hledání polí photos/facilities/description
    next_data = _extract_next_data(html)
    if next_data:
        _enrich_from_next_data(next_data, info)

    # 3. Fotky z meta og:image jako záloha
    if not info.get("photos"):
        og_imgs = re.findall(
            r'<meta[^>]+(?:property=["\']og:image["\']|name=["\']og:image["\'])[^>]+content=["\']([^"\']+)["\']',
            html, re.IGNORECASE
        )
        if not og_imgs:
            og_imgs = re.findall(
                r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:property=["\']og:image["\'])',
                html, re.IGNORECASE
            )
        if og_imgs:
            info["photos"] = og_imgs

    # 4. Popis z meta description jako záloha
    if not info.get("description"):
        m = re.search(
            r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']{40,})["\']',
            html, re.IGNORECASE
        )
        if not m:
            m = re.search(
                r'<meta[^>]+content=["\']([^"\']{40,})["\'][^>]+name=["\']description["\']',
                html, re.IGNORECASE
            )
        if m:
            info["description"] = m.group(1).strip()

    return info


def _enrich_from_next_data(next_data: dict, info: dict) -> None:
    """Rekurzivně prohledá __NEXT_DATA__ a doplní chybějící info."""
    page_props = (next_data.get("props") or {}).get("pageProps") or {}

    def _walk(obj, depth=0):
        if depth > 8:
            return
        if isinstance(obj, dict):
            # Hledej photos/images pole
            if not info.get("photos"):
                for img_key in ("photos", "images", "gallery", "mediaGallery"):
                    imgs = obj.get(img_key)
                    if isinstance(imgs, list) and imgs:
                        urls = []
                        for img in imgs:
                            if isinstance(img, str) and img.startswith("http"):
                                urls.append(img)
                            elif isinstance(img, dict):
                                url = img.get("url") or img.get("src") or ""
                                if url.startswith("http"):
                                    urls.append(url)
                        if urls:
                            info["photos"] = urls
                            break

            # Hledej amenities/facilities
            if not info.get("amenities"):
                for fac_key in ("facilities", "amenities", "features", "highlights"):
                    facs = obj.get(fac_key)
                    if isinstance(facs, list) and facs:
                        names = []
                        for f in facs:
                            if isinstance(f, str):
                                names.append(f)
                            elif isinstance(f, dict):
                                val = f.get("name") or f.get("value") or f.get("title") or f.get("label")
                                if val:
                                    names.append(str(val))
                        if names:
                            info["amenities"] = names
                            break

            # Hledej GPS pokud chybí
            if not info.get("latitude"):
                for geo_key in ("geo", "gps", "coordinates", "location"):
                    geo = obj.get(geo_key)
                    if isinstance(geo, dict):
                        lat = geo.get("latitude") or geo.get("lat")
                        lon = geo.get("longitude") or geo.get("lng") or geo.get("lon")
                        if lat and lon:
                            try:
                                info["latitude"]  = float(lat)
                                info["longitude"] = float(lon)
                            except Exception:
                                pass
                            break

            for v in obj.values():
                _walk(v, depth + 1)

        elif isinstance(obj, list):
            for item in obj:
                _walk(item, depth + 1)

    _walk(page_props)


# ---------------------------------------------------------------------------
# Zpracování discovery stránky
# ---------------------------------------------------------------------------

def scrape_listing_page(session: requests.Session, path: str) -> list[dict]:
    """
    Stáhne listing stránku (včetně všech stránek paginace) a vrátí seznam parsed offer entrit.
    Zkouší: 1) initialTopOffersData z __NEXT_DATA__,  2) initialOffersData (s paginací),
            3) JSON-LD ItemList.
    """
    url  = f"{BASE_URL}{path}"
    html = _get(session, url)
    if not html:
        return []

    # Primární: initialTopOffersData (country/region stránky — 3 hotely, bez paginace)
    next_data  = _extract_next_data(html)
    raw_offers = _extract_top_offers(next_data) if next_data else []

    # Druhý pokus: initialOffersData / initialPromotedOffersData (odletové/kategoriální stránky)
    if not raw_offers and next_data:
        raw_offers = _extract_offers_data(next_data)

        # Paginace — TUI ukládá totalPages přímo v pageProps
        if raw_offers and next_data:
            page_props  = (next_data.get("props") or {}).get("pageProps") or {}
            total_pages = int(page_props.get("totalPages") or 1)
            if total_pages > 1:
                base_url = url.rstrip("/")
                logger.info(f"  Paginace: {total_pages} stránek")
                for page_n in range(2, total_pages + 1):
                    page_html = _get(session, f"{base_url}?page={page_n}")
                    if not page_html:
                        break
                    page_nd = _extract_next_data(page_html)
                    if page_nd:
                        more = _extract_offers_data(page_nd)
                        raw_offers.extend(more)

    # Fallback: JSON-LD ItemList (filter/departure stránky — bez ceny)
    if not raw_offers:
        raw_offers = _extract_jsonld_offers(html)

    if not raw_offers:
        logger.debug(f"  Žádné nabídky na stránce: {path}")
        return []

    entries = []
    for entry in raw_offers:
        parsed = _parse_top_offer_entry(entry)
        if parsed:
            entries.append(parsed)

    logger.info(f"  {path} → {len(entries)} nabídek")
    return entries


# ---------------------------------------------------------------------------
# Slug z hotel URL path
# ---------------------------------------------------------------------------

def _slug_from_hotel_path(hotel_path: str) -> str:
    """
    Vytvoří slug z hotel URL path.
    /dovolena/turecko/turecka-riviera/miss-cleopatra-hotel-ayt61172/ → tui-miss-cleopatra-hotel-ayt61172
    """
    segment = hotel_path.rstrip("/").split("/")[-1]
    return f"tui-{segment}" if segment else ""


# ---------------------------------------------------------------------------
# Sitemap discovery — hotelové URL → odvozené destinační stránky
# ---------------------------------------------------------------------------

def discover_pages_from_sitemap(session: requests.Session) -> list[str]:
    """
    Stáhne TUI hotels.xml (přímé hotelové URL) a destinations.xml (destinační stránky)
    a vrátí deduplikovaný seznam listing stránek pro `scrape_listing_page()`.

    hotels.xml    → přímé hotelové URL → odvodí country/region listing stránky
    destinations.xml → destinační stránky → použije přímo jako listing stránky
    """
    hdrs = {"Accept": "application/xml,text/xml,*/*", "Content-Type": ""}
    SKIP = ("odlety-z-", "nabidky-", "last-minute", "first-minute", "akce",
            "aktualni-nabidky", "?", "#", "dovolena-a-", "filtr", "zima", "jaro", "leto")

    dest_pages: set[str] = set()

    # 1. hotels.xml — přímé hotelové URL → odvozuj listing stránky (country/region)
    try:
        r = session.get(f"{BASE_URL}/hotels.xml", headers=hdrs, timeout=30)
        if r.status_code == 200:
            hotel_urls = re.findall(r"<loc>(https://www\.tui\.cz/dovolena/[^<]+)</loc>", r.text)
            for url in hotel_urls:
                path = url.replace(BASE_URL, "").rstrip("/")
                parts = [p for p in path.strip("/").split("/") if p]
                # dovolena / country / region / hotel-slug → ≥4 části
                if len(parts) >= 4 and not any(kw in path for kw in SKIP):
                    dest_pages.add("/" + "/".join(parts[:3]) + "/")  # country/region
                    dest_pages.add("/" + "/".join(parts[:2]) + "/")  # country
            logger.info(f"TUI hotels.xml: {len(hotel_urls)} hotelů → {len(dest_pages)} listing stránek")
        else:
            logger.warning(f"TUI hotels.xml: HTTP {r.status_code}")
    except Exception as e:
        logger.warning(f"TUI hotels.xml error: {e}")

    # 2. destinations.xml — destinační stránky (přímé listing stránky s paginací)
    try:
        r = session.get(f"{BASE_URL}/destinations.xml", headers=hdrs, timeout=30)
        if r.status_code == 200:
            dest_urls = re.findall(r"<loc>(https://www\.tui\.cz/dovolena/[^<]+)</loc>", r.text)
            added = 0
            for url in dest_urls:
                path = url.replace(BASE_URL, "").rstrip("/") + "/"
                if not any(kw in path for kw in SKIP):
                    dest_pages.add(path)
                    added += 1
            logger.info(f"TUI destinations.xml: {added} destinačních stránek přidáno")
        else:
            logger.warning(f"TUI destinations.xml: HTTP {r.status_code}")
    except Exception as e:
        logger.warning(f"TUI destinations.xml error: {e}")

    if not dest_pages:
        logger.info("TUI sitemap: žádné stránky — použiji DISCOVERY_PAGES")
        return []

    # Seřaď: nejkonkrétnější (více segmentů) první
    result = sorted(dest_pages, key=lambda p: (-p.count("/"), p))
    logger.info(f"TUI sitemap discovery → {len(result)} stránek ke zpracování")
    return result


# ---------------------------------------------------------------------------
# Smazání TUI dat
# ---------------------------------------------------------------------------

def delete_all(db: ZaletoDB):
    hotels_count = db.conn.execute("SELECT COUNT(*) FROM hotels WHERE agency = ?", (AGENCY,)).fetchone()[0]
    tours_count  = db.conn.execute("SELECT COUNT(*) FROM tours  WHERE agency = ?", (AGENCY,)).fetchone()[0]
    db.conn.execute("DELETE FROM tours  WHERE agency = ?", (AGENCY,))
    db.conn.execute("DELETE FROM hotels WHERE agency = ?", (AGENCY,))
    db.commit()
    logger.info(f"Smazáno: {hotels_count} hotelů, {tours_count} termínů (TUI).")


# ---------------------------------------------------------------------------
# Hlavní scraper
# ---------------------------------------------------------------------------

def run(limit: int = 0, delay: float = 1.5, delete: bool = False):
    session = _make_session()
    db      = ZaletoDB()

    if delete:
        logger.info("--delete: mažu stávající TUI data...")
        delete_all(db)

    # Shromáždíme všechny nabídky ze všech listing stránek (unikátní hotel path → list tours)
    hotel_tours:  dict[str, list[dict]] = {}  # hotel_path → list of tour dicts
    hotel_meta:   dict[str, dict]       = {}  # hotel_path → základní metadata z listingu

    # Zkus sitemap discovery — vrátí destinační stránky odvozené z hotelových URL v sitemapě
    sitemap_pages = discover_pages_from_sitemap(session)

    # Kombinuj: sitemap stránky (kompletní pokrytí) + DISCOVERY_PAGES (záloha / odletové stránky)
    # Odletové stránky (odlety-z-*) mají paginaci → vždy je přidej pro úplné pokrytí
    departure_pages = [p for p in DISCOVERY_PAGES if any(kw in p for kw in _DEPARTURE_PAGE_KEYWORDS)]
    fallback_pages  = [p for p in DISCOVERY_PAGES if not any(kw in p for kw in _DEPARTURE_PAGE_KEYWORDS)]

    if sitemap_pages:
        # Sitemap dává kompletní destinační stránky; přidáme odletové stránky pro všechna letiště
        all_pages = list(dict.fromkeys(sitemap_pages + departure_pages))
        logger.info(f"Discovery: {len(sitemap_pages)} ze sitemapy + {len(departure_pages)} odletových = {len(all_pages)} stránek")
    else:
        # Sitemap nepomohl — použij celý DISCOVERY_PAGES seznam
        all_pages = list(dict.fromkeys(departure_pages + fallback_pages))
        logger.info(f"Discovery: sitemap prázdná, používám {len(all_pages)} záložních stránek")

    logger.info(f"Procházím {len(all_pages)} discovery stránek...")
    for i, path in enumerate(all_pages, 1):
        logger.info(f"[{i}/{len(all_pages)}] {path}")
        entries = scrape_listing_page(session, path)

        for entry in entries:
            hp = entry["hotel_path"]
            if hp not in hotel_tours:
                hotel_tours[hp] = []
                # Offer kód z tour URL pro pozdější volání configurator API
                initial_offer_code = entry["tour_url"].split("OfferCodeWS/")[-1] \
                    if "OfferCodeWS/" in entry["tour_url"] else ""
                hotel_meta[hp]  = {
                    "hotel_url":          entry["hotel_url"],
                    "hotel_name":         entry["hotel_name"],
                    "stars":              entry["stars"],
                    "thumbnail":          entry["thumbnail"],
                    "country":            entry["country"],
                    "destination":        entry["destination"],
                    "resort_town":        entry["resort_town"],
                    "tags":               entry["tags"],
                    "initial_offer_code": initial_offer_code,
                }

            tour = {
                "departure_date":  entry["dep_date"],
                "return_date":     entry["ret_date"],
                "duration":        entry["duration"],
                "price":           entry["price"],
                "transport":       entry["transport"],
                "meal_plan":       entry["meal_plan"],
                "adults":          ADULTS,
                "room_code":       entry["room_code"],
                "url":             entry["tour_url"],
                "is_last_minute":  entry["is_last_minute"],
                "is_first_minute": entry["is_first_minute"],
                "departure_city":  entry["dep_city"],
            }
            # Unikátnost podle URL (identická URL = stejný termín)
            if not any(t["url"] == tour["url"] for t in hotel_tours[hp]):
                hotel_tours[hp].append(tour)

        if i < len(all_pages):
            time.sleep(delay / 2 + random.uniform(0, delay * 0.25))

    logger.info(f"Celkem nalezeno {len(hotel_tours)} unikátních hotelů")

    # Načti checkpoint — hotely zpracované dnes v předchozím běhu
    done_paths = db.get_done_keys(AGENCY)
    if done_paths:
        logger.info(f"Checkpoint: přeskakuji {len(done_paths)} již zpracovaných hotelů z dnešního cyklu")

    # Ulož hotely + termíny, fetchni detail stránky
    slug_used:   set[str] = set()
    hotel_count  = 0
    tour_count   = 0

    for hp, tours in hotel_tours.items():
        if limit and hotel_count >= limit:
            logger.info(f"Dosažen limit {limit} hotelů")
            break

        if hp in done_paths:
            logger.info(f"  ✓ checkpoint: {hp}")
            continue

        meta      = hotel_meta[hp]
        hotel_url = meta["hotel_url"]

        # Fetchni detail stránku pro bohatší data
        logger.info(f"  Detail: {hotel_url}")
        detail = _fetch_hotel_detail(session, hotel_url)

        # Načti všechny termíny přes configurator API (tours = fallback z listingu)
        initial_offer_code = meta.get("initial_offer_code", "")
        if USE_CONFIGURATOR_API and initial_offer_code:
            fallback_tour = tours[0] if tours else None
            if fallback_tour:
                api_tours = _fetch_tours_from_api(session, hp, initial_offer_code, fallback_tour)
                tours = api_tours

        photos_list = detail.get("photos") or []
        if not photos_list and meta["thumbnail"]:
            photos_list = [meta["thumbnail"]]
        thumbnail = photos_list[0] if photos_list else meta["thumbnail"]

        amenities_list = detail.get("amenities") or []
        amenities_json = json.dumps(amenities_list, ensure_ascii=False) if amenities_list else None

        hotel_dict = {
            "agency":         AGENCY,
            "name":           meta["hotel_name"],
            "country":        meta["country"],
            "destination":    meta["destination"],
            "resort_town":    meta["resort_town"],
            "stars":          meta["stars"],
            "review_score":   detail.get("review_score"),
            "description":    detail.get("description"),
            "thumbnail_url":  thumbnail,
            "photos":         json.dumps(photos_list, ensure_ascii=False),
            "amenities":      amenities_json,
            "tags":           meta["tags"],
            "distances":      None,
            "food_options":   None,
            "price_includes": None,
            "latitude":       detail.get("latitude"),
            "longitude":      detail.get("longitude"),
        }

        # Slug — stabilní z URL path
        base_slug = _slug_from_hotel_path(hp) or f"tui-{slugify(meta['hotel_name'])}"
        slug = base_slug
        n = 0
        while slug in slug_used:
            n += 1
            slug = f"{base_slug}-{n}"
        slug_used.add(slug)

        # Ulož do DB
        hotel_id = db.upsert_hotel(slug, hotel_dict)
        db.conn.execute("DELETE FROM tours WHERE hotel_id = ? AND agency = ?", (hotel_id, AGENCY))

        saved = 0
        for t in tours:
            try:
                db.upsert_tour(hotel_id, t)
                saved += 1
            except Exception as e:
                logger.debug(f"    Tour skip: {e}")

        db.commit()
        db.mark_done(AGENCY, hp)
        hotel_count += 1
        tour_count  += saved

        logger.info(
            f"  ✓ {meta['hotel_name']} ⭐{meta['stars']} "
            f"({meta.get('country', '')} / {meta.get('resort_town', '')}) "
            f"— {saved} termínů"
        )

        time.sleep(delay + random.uniform(0, delay * 0.5))

    db.close()
    logger.info(f"Hotovo. Uloženo: {hotel_count} hotelů, {tour_count} termínů.")
    return hotel_count


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="TUI scraper → zaleto.db")
    parser.add_argument("--limit", type=int, default=0,
                        help="Max počet hotelů (0 = všechny)")
    parser.add_argument("--delay", type=float, default=1.5,
                        help="Pauza mezi požadavky v sekundách (default 1.5)")
    parser.add_argument("--delete", action="store_true",
                        help="Před stažením smaže všechny stávající TUI záznamy")
    parser.add_argument("--debug", action="store_true",
                        help="Zapne DEBUG logování (zobrazí klíče __NEXT_DATA__)")
    args = parser.parse_args()

    if args.debug:
        logging.getLogger().setLevel(logging.DEBUG)

    run(limit=args.limit, delay=args.delay, delete=args.delete)
