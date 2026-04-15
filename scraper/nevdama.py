"""
Nev-Dama scraper — píše přímo do zaleto.db (normalizované schéma hotels + tours).

Stejná platforma jako Fischer / Exim Tours (derTouristik / abnbHotelDetail),
liší se BASE_URL, AGENCY a tím, že embedded JSON má wrapper hotelDetailInfo.

Pipeline na hotel:
  1. GET hotel URL + ?TO={airport} → embedded JSON (server-side rendered)
  2. Extrakce: hotelDataKey, destinationIds, transportOrigin, sezóna, ...
  3. POST /api/SearchOffer/GetOfferWithOptions → všechny dostupné termíny
  4. Upsert hotel → zaleto.hotels, upsert termíny → zaleto.tours

Použití:
  python nevdama.py                  # stáhne všechny hotely ze sitemapy
  python nevdama.py --limit 20       # jen prvních 20 hotelů (test)
  python nevdama.py --delay 2.0      # pauza 2s mezi hotely
"""

import argparse
import concurrent.futures
import json
import logging
import os
import random
import re
import threading
import time
import unicodedata
import urllib.parse
from datetime import datetime, timedelta
from html.parser import HTMLParser
from pathlib import Path

import requests
from requests.exceptions import ConnectionError as ReqConnectionError, ChunkedEncodingError

from db import ZaletoDB

# ---------------------------------------------------------------------------
# Konfigurace
# ---------------------------------------------------------------------------

BASE_URL = "https://www.nev-dama.cz"
AGENCY   = "Nev-Dama"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("nevdama")


# ---------------------------------------------------------------------------
# Slugify
# ---------------------------------------------------------------------------

def slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    text = re.sub(r"[^\w\s-]", "", text).strip().lower()
    return re.sub(r"[\s_-]+", "-", text)


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
                r"<loc>(https://www\.nev-dama\.cz/(?!sitemap)[^<]+)</loc>", r.text
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
        if tag == "div" and d.get("data-component-name") in ("abnbHotelDetail", "hotelDetail"):
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
    4313: "Ostrava",
    4305: "Brno",
}


_CONNECTION_ERRORS = (ReqConnectionError, ChunkedEncodingError, TimeoutError)


def _fetch_embedded(session: requests.Session, url: str, airport: int = DEFAULT_AIRPORT,
                    _retries: int = 2) -> dict | None:
    if "TO=" not in url:
        sep = "&" if "?" in url else "?"
        url = f"{url}{sep}TO={airport}"
    for attempt in range(_retries + 1):
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
                logger.error(f"Fetch error po {_retries} pokusech: {e}")
                return None
        except Exception as e:
            logger.error(f"Fetch error {url}: {e}")
            return None


# ---------------------------------------------------------------------------
# Extrakce parametrů z embedded JSON
# ---------------------------------------------------------------------------

def _parse_embedded_capacity(info: dict, embedded: dict) -> dict | None:
    """Fallback parser pro nový formát kapacitních hotelů (bez dataNew/offerFilter).
    Extrahuje data přímo z hotelDetailInfo — používá minPrice pro jeden termín."""
    try:
        cap_id     = info.get("identifier")
        data_src   = info.get("dataSource", 8)
        name       = info.get("name", "") or info.get("nameWithoutHotel", "")
        star       = info.get("star")

        dest_list  = info.get("destination", [])
        breadcrumbs = [{"name": d["name"]} for d in dest_list if isinstance(d, dict) and d.get("name")]
        destination = " / ".join(b["name"] for b in breadcrumbs) if breadcrumbs else ""
        resort_town = breadcrumbs[-1]["name"] if breadcrumbs else ""
        country     = breadcrumbs[0]["name"] if breadcrumbs else ""

        desc_obj    = info.get("description", {}) or {}
        description = desc_obj.get("mainDescription", "") if isinstance(desc_obj, dict) else ""

        images_raw = info.get("images", []) or []
        images = [img["large"] for img in images_raw if isinstance(img, dict) and img.get("large")]

        equip = info.get("hotelEquipment", {})
        if isinstance(equip, dict):
            items = equip.get("items") or equip.get("hotelEquipments") or []
            amenities_list = [e.get("name", "") for e in items if isinstance(e, dict) and e.get("name")]
        elif isinstance(equip, list):
            amenities_list = [e if isinstance(e, str) else e.get("name", "") for e in equip if e]
        else:
            amenities_list = []

        latitude, longitude = None, None
        geo = info.get("hotelMapMarker") or info.get("hotelPin") or {}
        if isinstance(geo, dict):
            latitude  = geo.get("latitude") or geo.get("lat")
            longitude = geo.get("longitude") or geo.get("lng")
        elif isinstance(geo, str) and geo:
            import base64
            gp = dict(urllib.parse.parse_qsl(geo))
            bhmm = gp.get("bhmm", "")
            if bhmm:
                try:
                    gps_j = json.loads(base64.b64decode(bhmm + "==").decode("utf-8"))
                    gps   = gps_j.get("GPS") or {} if isinstance(gps_j, dict) else {}
                    latitude  = gps.get("Latitude")
                    longitude = gps.get("Longitude")
                except Exception:
                    pass

        terms = info.get("termsFilter") or info.get("tourTip") or ""
        tip   = dict(urllib.parse.parse_qsl(terms))

        df = tip.get("DF", "")
        main_from, main_to = ("", "")
        if "|" in df:
            main_from, main_to = df.split("|", 1)
            main_from = main_from[:10]
            main_to   = main_to[:10]

        min_price = info.get("minPrice") or {}

        return {
            "hotel_data_key":    {"hotelId": cap_id, "giata": 0, "dataSource": data_src,
                                  "bedBank": "NevDama", "bedBankID": str(cap_id)},
            "hotel_id":          cap_id,
            "hotel_name":        name,
            "stars":             star,
            "review_score":      None,
            "description":       description,
            "images":            images,
            "amenities":         ", ".join(amenities_list),
            "tags":              "",
            "distances":         "",
            "latitude":          latitude,
            "longitude":         longitude,
            "destination":       destination,
            "resort_town":       resort_town,
            "country":           country,
            "destination_ids":   [],
            "transport_origin":  [],
            "meal_code":         "",
            "room_code":         "",
            "nights":            int(min_price.get("lengthOfStay") or 7),
            "all_nights":        [int(min_price.get("lengthOfStay") or 7)],
            "adults":            2,
            "departure_date":    (min_price.get("departureDate") or "")[:10],
            "package_id":        "",
            "main_filter_from":  main_from,
            "main_filter_to":    main_to,
            "tour_filter_query": terms,
            "_offer_filter":     {},
            "_bus_hotel":        True,
            "_min_price":        min_price,
            "_hotel_url_base":   info.get("url", ""),
        }
    except Exception as e:
        logger.error(f"parse_embedded_capacity: {e}")
        return None


def _parse_embedded(embedded: dict) -> dict | None:
    try:
        # Nev-Dama (stejně jako Exim) obaluje data do hotelDetailInfo
        info     = embedded.get("hotelDetailInfo", embedded)
        data_new = info.get("dataNew") or embedded.get("dataNew") or {}
        hotel    = data_new.get("hotel", {})
        identifiers = hotel.get("identifiers", {})

        if not identifiers.get("hotelId"):
            # Fallback: nový formát kapacitních hotelů (bez dataNew/identifiers)
            cap_id = info.get("identifier")
            if not cap_id:
                return None
            return _parse_embedded_capacity(info, embedded)

        hotel_data_key = {
            "hotelId":    identifiers["hotelId"],
            "giata":      identifiers.get("giata"),
            "dataSource": identifiers.get("dataSource", 8192),
            "bedBank":    identifiers.get("bedBank"),
            "bedBankID":  identifiers.get("bedBankID"),
        }

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

        # Fallback přes termsFilter / tourTip
        if not destination_ids or not transport_origin:
            terms = info.get("termsFilter") or info.get("tourTip") or tour_filter_query
            if terms:
                tip = dict(urllib.parse.parse_qsl(terms))
                if not destination_ids:
                    destination_ids = [int(d) for d in tip.get("D", "").split("|") if d.isdigit()]
                if not transport_origin and tip.get("TO", "").isdigit():
                    transport_origin = [int(tip["TO"])]

        # Fallback přes hotelMapMarker (string s query params: D=, TO=, bhmm=GPS)
        if not destination_ids:
            hm = info.get("hotelMapMarker")
            if isinstance(hm, str) and hm:
                hm_p = dict(urllib.parse.parse_qsl(hm))
                destination_ids = [int(d) for d in hm_p.get("D", "").split("|") if d.isdigit()]
                if not transport_origin and hm_p.get("TO", "").isdigit():
                    transport_origin = [int(hm_p["TO"])]

        # Pokud chybí destination_ids — skutečný bus/kapacitní hotel bez letů
        if not destination_ids and info.get("minPrice"):
            return _parse_embedded_capacity(info, embedded)

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
            gallery    = hotel.get("gallery", {})
            image_ids  = gallery.get("imageIds", [])
            hotel_slug = info.get("url", "").rstrip("/").split("/")[-1] if info.get("url") else ""
            for iid in image_ids[:10]:
                images.append(f"https://img.nev-dama.cz/hotels/720/{hotel_slug}/{iid}.jpg")

        benefits = [b["title"] for b in hotel.get("mainBenefits", []) if b.get("title")]

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
# API call — identický s Fischerem / Exim Tours
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

    for attempt in range(3):
        try:
            r = session.post(
                f"{BASE_URL}/api/SearchOffer/GetOfferWithOptions",
                json=payload,
                headers={"Content-Type": "application/json", "Accept": "application/json"},
                timeout=35,
            )
            if r.status_code == 200 and r.text.strip():
                return r.json()
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
                logger.error(f"API error po 3 pokusech: {e}")
                return None
        except Exception as e:
            logger.error(f"API error: {e}")
            return None
    return None


# ---------------------------------------------------------------------------
# Detekce last minute / first minute
# ---------------------------------------------------------------------------

LAST_MINUTE_DAYS  = 21
FIRST_MINUTE_DAYS = 180

# Minimální rozumná cena za osobu — filtruje příplatky / dílčí ceny vrácené API
# místo celkové ceny balíčku. Česká republika → jakákoliv destinace = min. ~1 000 Kč.
MIN_TOUR_PRICE = 1000


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
        "agency":         AGENCY,
        "api_config":     json.dumps({
            **p["_offer_filter"],
            "_hotelPath":    "/" + hotel_url.split("nev-dama.cz/", 1)[-1].split("?")[0],
            "_hotelDataKey": p["hotel_data_key"],
        }),
    }

    base_url = hotel_url.split("?")[0]
    tours = []
    for d in api_data.get("availableDates", []):
        raw_date = d.get("date", "")[:10]
        # Jako u Fischeru: pricePerPerson je cena za osobu zobrazovaná na webu.
        # Nepoužíváme fallback na 'price' — pro kapacitní/campingové hotely
        # může 'price' obsahovat jen příplatek (např. 500 Kč), ne celkovou cenu balíčku.
        price = d.get("pricePerPerson") or 0.0
        if not raw_date or price < MIN_TOUR_PRICE:
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
            "agency":          AGENCY,
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
# Zpracování bus/kapacitního hotelu — pouze minPrice termín
# ---------------------------------------------------------------------------

def _scrape_bus_hotel(hotel_url: str, p: dict, db: ZaletoDB, slug_counter: dict) -> int:
    min_price = p.get("_min_price") or {}
    dep_date  = (min_price.get("departureDate") or "")[:10]
    ret_date  = (min_price.get("returnDate")    or "")[:10]
    nights    = int(min_price.get("lengthOfStay") or 7)
    price     = float(min_price.get("amount") or 0)

    if not dep_date or price < MIN_TOUR_PRICE:
        logger.debug(f"Bus hotel bez platné ceny (price={price}): {hotel_url}")
        return 0

    try:
        dep_dt = datetime.strptime(dep_date, "%Y-%m-%d")
    except ValueError:
        return 0

    tip = dict(urllib.parse.parse_qsl(p.get("tour_filter_query", "")))
    # Odstraň expirující / nevalidní parametry (stejně jako flight path)
    for _ep in ("PC", "IFC", "OFC", "DPR", "PID", "GIATA", "ERM", "DS", "TrustYou"):
        tip.pop(_ep, None)
    tip["DD"]  = dep_date
    tip["RD"]  = ret_date
    tip["NN"]  = str(nights)
    tip["AC1"] = "2"
    tip["KC1"] = "0"
    qs = "&".join(f"{k}={urllib.parse.quote(str(v), safe='|,')}" for k, v in tip.items() if v)
    base_url  = (p.get("_hotel_url_base") or hotel_url).split("?")[0]
    tour_url  = f"{base_url}?{qs}" if qs else base_url

    is_lm, is_fm = _detect_tour_type(dep_dt)

    hotel_dict = {
        "name":           p["hotel_name"],
        "country":        p["country"],
        "destination":    p["destination"],
        "resort_town":    p["resort_town"],
        "stars":          int(p["stars"]) if p.get("stars") else None,
        "review_score":   None,
        "description":    p["description"],
        "thumbnail_url":  p["images"][0] if p["images"] else "",
        "photos":         json.dumps(p["images"]) if p["images"] else "[]",
        "amenities":      p["amenities"],
        "tags":           "",
        "distances":      "",
        "food_options":   "",
        "price_includes": "",
        "latitude":       p.get("latitude"),
        "longitude":      p.get("longitude"),
        "agency":         AGENCY,
        "api_config":     json.dumps({"_hotelPath": "/" + base_url.split("nev-dama.cz/", 1)[-1]}),
    }

    tour = {
        "agency":          AGENCY,
        "departure_date":  dep_date,
        "return_date":     ret_date,
        "duration":        nights,
        "price":           price,
        "transport":       "autobusem",
        "meal_plan":       "",
        "adults":          2,
        "room_code":       "",
        "url":             tour_url,
        "url_single":      None,
        "price_single":    None,
        "is_last_minute":  is_lm,
        "is_first_minute": is_fm,
        "departure_city":  "",
    }

    base_slug = slugify(hotel_dict["name"])
    slug = base_slug
    n = slug_counter.get(base_slug, 0)
    if n > 0:
        slug = f"{base_slug}-{n}"
    slug_counter[base_slug] = n + 1

    hotel_id = db.upsert_hotel(slug, hotel_dict)
    db.conn.execute("DELETE FROM tours WHERE hotel_id = %s AND agency = %s", (hotel_id, AGENCY))
    db.upsert_tour(hotel_id, tour)
    db.commit()
    logger.debug(f"Bus hotel uložen: {hotel_dict['name']} @ {dep_date} = {price} Kč")
    return 1


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

    # --- Zkus první letiště a zjisti typ hotelu ---
    first_embedded = _fetch_embedded(session, hotel_url, airports[0] if airports else DEFAULT_AIRPORT)
    first_p = _parse_embedded(first_embedded) if first_embedded else None

    # Kapacitní bus hotel — použij minPrice pro jeden termín
    if first_p and first_p.get("_bus_hotel"):
        return _scrape_bus_hotel(hotel_url, first_p, db, slug_counter)

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

    if hotel_dict is None or not all_tours:
        # Fallback: letecká cesta nevrátila žádné platné termíny (nebo všechny ceny
        # pod MIN_TOUR_PRICE) — zkus capacity/bus cestu přes minPrice
        if first_embedded:
            info = first_embedded.get("hotelDetailInfo", first_embedded)
            if info.get("minPrice"):
                cap_p = _parse_embedded_capacity(info, first_embedded)
                if cap_p:
                    return _scrape_bus_hotel(hotel_url, cap_p, db, slug_counter)
        if hotel_dict is not None and not all_tours:
            logger.warning(f"Všechny ceny pod {MIN_TOUR_PRICE} Kč — hotel přeskočen: {hotel_url}")
        else:
            logger.warning(f"Žádné termíny ani data: {hotel_url}")
        return 0

    base_slug = slugify(hotel_dict["name"])
    slug = base_slug
    n = slug_counter.get(base_slug, 0)
    if n > 0:
        slug = f"{base_slug}-{n}"
    slug_counter[base_slug] = n + 1

    hotel_id = db.upsert_hotel(slug, hotel_dict)
    db.conn.execute("DELETE FROM tours WHERE hotel_id = %s AND agency = %s", (hotel_id, AGENCY))
    for t in all_tours:
        db.upsert_tour(hotel_id, t)
    db.commit()

    logger.info(f"  {hotel_dict['name']} ⭐{hotel_dict['stars']} — {len(all_tours)} termínů")
    return len(all_tours)


# ---------------------------------------------------------------------------
# Update-only mode
# ---------------------------------------------------------------------------

def _p_from_api_config(cfg: dict) -> dict | None:
    hdk = cfg.get("_hotelDataKey")
    if not hdk or not hdk.get("hotelId"):
        return None
    dest_ids = cfg.get("destinationIds", [])
    if not dest_ids:
        return None
    rooms  = cfg.get("rooms", [{}])
    room   = rooms[0] if rooms else {}
    adults = len([t for t in room.get("travellers", []) if t.get("type") == 0]) or 2
    number_nights = cfg.get("numberNights", [7])
    nights = number_nights[0] if number_nights else 7
    mfd = (cfg.get("offerDate") or {}).get("mainFilterDates", [])
    main_from = mfd[0][:10] if len(mfd) > 0 else ""
    main_to   = mfd[1][:10] if len(mfd) > 1 else ""
    today = datetime.today().strftime("%Y-%m-%d")
    far   = (datetime.today() + timedelta(days=548)).strftime("%Y-%m-%d")
    if not main_from or main_from < today:
        main_from = today
    if not main_to or main_to < today:
        main_to = far
    return {
        "hotel_data_key":    hdk,
        "hotel_id":          hdk.get("hotelId"),
        "destination_ids":   dest_ids,
        "transport_origin":  cfg.get("transportOrigin", []),
        "meal_code":         cfg.get("mealCode", ""),
        "room_code":         room.get("roomCode", ""),
        "nights":            nights,
        "all_nights":        number_nights if number_nights else [7],
        "adults":            adults,
        "package_id":        cfg.get("packageId", ""),
        "main_filter_from":  main_from,
        "main_filter_to":    main_to,
        "tour_filter_query": cfg.get("tourFilterQuery", ""),
        "_offer_filter":     cfg,
        "departure_date":    "",
        "hotel_name": "", "country": "", "destination": "", "resort_town": "",
        "stars": None, "review_score": None, "description": "", "images": [],
        "amenities": "", "tags": "", "distances": "", "latitude": None, "longitude": None,
    }


def update_hotel_tours(session: requests.Session, db: ZaletoDB,
                       hotel_id: int, api_config_str: str, airports: list[int]) -> int:
    try:
        cfg = json.loads(api_config_str)
    except Exception:
        return 0
    hotel_path = cfg.get("_hotelPath", "")
    if not hotel_path:
        return 0
    hotel_url_base = f"{BASE_URL}{hotel_path}"
    base_p = _p_from_api_config(cfg)
    if not base_p:
        return 0
    all_tours: list = []
    for airport in airports:
        p = {**base_p, "transport_origin": [airport]}
        airport_name  = AIRPORT_NAMES.get(airport, str(airport))
        airport_tours: list = []
        for nights_val in p["all_nights"]:
            api_data = _get_offer(session, p, p["main_filter_from"], p["main_filter_to"],
                                  nights_override=nights_val)
            if not api_data or not api_data.get("availableDates"):
                continue
            _, tour_list = _build_hotel_and_tours(hotel_url_base, p, api_data, airport_name)
            airport_tours.extend(tour_list)
        if airport_tours:
            all_tours.extend(airport_tours)
    if not all_tours:
        # Touch updated_at to protect from purge_stale
        db.conn.execute(
            "UPDATE tours SET updated_at = NOW() WHERE hotel_id = %s AND agency = %s",
            (hotel_id, AGENCY),
        )
        db.commit()
        return 0
    db.conn.execute("DELETE FROM tours WHERE hotel_id = %s AND agency = %s", (hotel_id, AGENCY))
    for t in all_tours:
        db.upsert_tour(hotel_id, t)
    db.commit()
    return len(all_tours)


def _run_update_only(db: ZaletoDB, session: requests.Session,
                     delay: float, airports: list[int], workers: int = 1) -> int:
    rows = db.conn.execute(
        "SELECT id, slug, api_config FROM hotels WHERE agency = %s AND api_config IS NOT NULL",
        (AGENCY,)
    ).fetchall()
    total = len(rows)
    logger.info(f"Update-only: {total} hotelů k aktualizaci")
    slug_counter: dict = {}
    for (s,) in db.conn.execute("SELECT slug FROM hotels WHERE agency = %s", (AGENCY,)).fetchall():
        parts = s.rsplit("-", 1)
        if len(parts) == 2 and parts[1].isdigit():
            slug_counter[parts[0]] = max(slug_counter.get(parts[0], 0), int(parts[1]) + 1)
        else:
            slug_counter[s] = max(slug_counter.get(s, 0), 1)
    done_keys = db.get_done_keys(AGENCY)
    to_process = [
        (hid, slug, cfg_str)
        for (hid, slug, cfg_str) in rows
        if f"upd:{hid}" not in done_keys
    ]
    logger.info(f"Update-only: {len(to_process)} hotelů zbývá (přeskočeno {total - len(to_process)} checkpointů)")

    _counter = [0]
    _saved   = [0]
    _lock    = threading.Lock()

    def _process_one(hotel_id: int, slug: str, api_config_str: str):
        if workers > 1:
            w_session = _make_session()
            w_db      = ZaletoDB()
        else:
            w_session, w_db = session, db
        try:
            cfg = json.loads(api_config_str) if api_config_str else {}
        except Exception:
            cfg = {}
        hotel_path = cfg.get("_hotelPath", "")
        hotel_url  = f"{BASE_URL}{hotel_path}" if hotel_path else ""
        ck = f"upd:{hotel_id}"
        try:
            if cfg.get("_hotelDataKey") and hotel_url:
                saved = update_hotel_tours(w_session, w_db, hotel_id, api_config_str, airports)
                w_db.mark_done(AGENCY, ck)
                with _lock:
                    _saved[0]   += saved
                    _counter[0] += 1
                    logger.info(f"[{_counter[0]}/{len(to_process)}] (fast) {slug} → {saved} termínů")
            elif hotel_url:
                with _lock:
                    saved = scrape_hotel(w_session, w_db, hotel_url, slug_counter, airports)
                    w_db.mark_done(AGENCY, ck)
                    _saved[0]   += saved
                    _counter[0] += 1
                    logger.info(f"[{_counter[0]}/{len(to_process)}] (full fallback) {slug} → {saved} termínů")
            else:
                with _lock:
                    _counter[0] += 1
                logger.debug(f"Přeskakuji {slug} — chybí _hotelPath")
        except Exception as e:
            logger.error(f"Chyba {slug}: {e}")
        finally:
            if workers > 1:
                time.sleep(delay + random.uniform(0, delay * 0.4))
                w_db.close()
                w_session.close()

    if workers <= 1:
        for i, (hotel_id, slug, api_config_str) in enumerate(to_process):
            _process_one(hotel_id, slug, api_config_str)
            if i < len(to_process) - 1:
                time.sleep(delay + random.uniform(0, delay * 0.4))
    else:
        logger.info(f"Update-only: {workers} paralelních workerů")
        with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as executor:
            futures = [
                executor.submit(_process_one, hid, slug, cfg_str)
                for hid, slug, cfg_str in to_process
            ]
            for f in concurrent.futures.as_completed(futures):
                f.result()

    return _saved[0]


# ---------------------------------------------------------------------------
# Smazání dat
# ---------------------------------------------------------------------------

def delete_all(db: ZaletoDB):
    h = db.conn.execute("SELECT COUNT(*) FROM hotels WHERE agency=?", (AGENCY,)).fetchone()[0]
    t = db.conn.execute("SELECT COUNT(*) FROM tours  WHERE agency=?", (AGENCY,)).fetchone()[0]
    db.conn.execute("DELETE FROM tours  WHERE agency=?", (AGENCY,))
    db.conn.execute("DELETE FROM hotels WHERE agency=?", (AGENCY,))
    db.commit()
    logger.info(f"Smazáno: {h} hotelů, {t} termínů (Nev-Dama).")


# ---------------------------------------------------------------------------
# Hlavní run
# ---------------------------------------------------------------------------

def run(limit: int = 0, delay: float = 1.5, delete: bool = False,
        airports: list[int] | None = None, update_only: bool = False, workers: int = 1):
    if airports is None:
        airports = list(AIRPORT_NAMES.keys())

    session = _make_session()
    db      = ZaletoDB()

    if delete:
        logger.info("--delete: mažu stávající Nev-Dama data...")
        delete_all(db)

    if update_only:
        logger.info("Režim: UPDATE-ONLY (přeskočení GET stránek, jen API aktualizace termínů)")
        total_saved = _run_update_only(db, session, delay, airports, workers=workers)
        db.close()
        logger.info(f"Update-only hotovo. Celkem uloženo: {total_saved} termínů.")
        return total_saved

    hotel_urls   = get_hotel_urls(session, limit)
    if not hotel_urls:
        logger.error("Sitemap nevrátila žádné hotely — přerušuji (data v DB zachována).")
        db.close()
        raise SystemExit(1)

    total_saved  = 0
    slug_counter: dict = {}

    done_urls = db.get_done_keys(AGENCY)
    if done_urls:
        logger.info(f"Checkpoint: přeskakuji {len(done_urls)} hotely z dnešního cyklu")

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
            time.sleep(delay + random.uniform(0, delay * 0.5))

    db.close()
    logger.info(f"Hotovo. Celkem: {total_saved} termínů z {len(hotel_urls)} hotelů.")
    return total_saved


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Nev-Dama scraper")
    parser.add_argument("--limit",       type=int,   default=0,   help="Max počet hotelů (0 = vše)")
    parser.add_argument("--delay",       type=float, default=1.5, help="Pauza mezi hotely (s)")
    parser.add_argument("--delete",      action="store_true",     help="Smaž Nev-Dama data před startem")
    parser.add_argument("--update-only", action="store_true",     help="Jen API aktualizace termínů, bez GET stránek")
    parser.add_argument("--airports",    type=str,   default="",  help="Čárkou oddělená ID letišť")
    parser.add_argument("--workers",     type=int,   default=1,   help="Počet paralelních workerů pro update-only mód (default: 1). Doporučeno: 3–5.")
    args = parser.parse_args()

    airports = [int(x) for x in args.airports.split(",") if x.strip().isdigit()] or None
    run(limit=args.limit, delay=args.delay, delete=args.delete,
        airports=airports, update_only=args.update_only, workers=args.workers)
