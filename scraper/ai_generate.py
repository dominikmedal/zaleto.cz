"""
Generování AI obsahu (Google Gemini) – náhrada za fronty ve starém Express backendu na Railway.

Spouští se z GitHub Actions (.github/workflows/ai.yml) nebo ručně:
    python ai_generate.py                      # všechno, co chybí
    python ai_generate.py --only destination   # article | destination | weather | car_rental | guide | guide_images | hotel | destination_seo | landing
    python ai_generate.py --limit 10           # nejvýše 10 položek za běh

Prompty se berou z tabulky ai_prompts (úpravy v administraci, sekce Prompty);
když v DB chybí, použije se výchozí znění z frontend/src/server/promptDefaults.json.
Hotový obsah se nikdy nepřepisuje – generuje se jen to, co v DB ještě není.

Env: DATABASE_URL, GEMINI_API_KEY, volitelně AI_PAUSE (s mezi voláními, výchozí 35),
     AI_HOTEL_MAX (kolik nejnabízenějších hotelů celkem dostane vlastní text, výchozí 2000),
     AI_LANDING_MIN (nejméně hotelů pro vznik vstupní stránky, výchozí 8),
     SITE_URL + REVALIDATE_SECRET (po doběhu obnoví cache webu).
"""

import argparse
import json
import logging
import os
import re
import sys
import time
import unicodedata
from pathlib import Path
from urllib.parse import quote, urlencode

import requests

import db  # načte scraper/.env a DATABASE_URL

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s", datefmt="%H:%M:%S")
log = logging.getLogger("ai")

HERE = Path(__file__).parent
DEFAULTS = json.loads((HERE.parent / "frontend" / "src" / "server" / "promptDefaults.json").read_text(encoding="utf-8"))
TOPICS_FILE = HERE / "article_topics.txt"

MODELS = ["gemini-2.5-flash-lite", "gemini-2.5-flash"]
NON_GEO = re.compile(r"safari|bike|trek|plus|sport|aktivní", re.I)
PAUSE = float(os.environ.get("AI_PAUSE", "35"))

# nastavení generování podle druhu obsahu (stejné jako ve starém backendu)
GEN = {
    "article": {"max_tokens": 4096, "temperature": 0.75, "timeout": 30},
    "destination": {"max_tokens": 4096, "temperature": 0.7, "timeout": 25},
    "weather": {"max_tokens": 2048, "temperature": 0.4, "timeout": 25},
    "car_rental": {"max_tokens": 8192, "temperature": 0.5, "timeout": 45},
    "guide": {"max_tokens": 24000, "temperature": 0.4, "timeout": 120},
    "hotel": {"max_tokens": 4096, "temperature": 0.45, "timeout": 40},
    "destination_seo": {"max_tokens": 8192, "temperature": 0.5, "timeout": 70},
    "landing": {"max_tokens": 4096, "temperature": 0.5, "timeout": 45},
}


class RateLimited(Exception):
    pass


class QuotaExhausted(Exception):
    """Vyčerpaný hodinový limit Unsplash API: běh skončí, další hodinový běh naváže."""


# ── Gemini ──────────────────────────────────────────────────────────────────

def load_prompt(conn, key: str, **vars) -> str:
    template = next(d["template"] for d in DEFAULTS if d["key"] == key)
    try:
        cur = conn.cursor()
        cur.execute("SELECT template FROM ai_prompts WHERE key = %s", (key,))
        row = cur.fetchone()
        conn.commit()
        if row and row["template"]:
            template = row["template"]
    except Exception:  # tabulka ještě neexistuje
        conn.rollback()
    return re.sub(r"\{\{(\w+)\}\}", lambda m: str(vars.get(m.group(1), m.group(0))), template)


USAGE: list[tuple] = []  # (kind, model, vstupní tokeny, výstupní tokeny) čeká na uložení do ai_usage


def flush_usage(conn):
    """Uloží naměřenou spotřebu tokenů (pro přehled nákladů v administraci). Chyba evidence nesmí shodit generování."""
    if not USAGE:
        return
    rows_ = USAGE[:]
    USAGE.clear()
    try:
        cur = conn.cursor()
        cur.execute("""CREATE TABLE IF NOT EXISTS ai_usage (
            id SERIAL PRIMARY KEY, at TIMESTAMPTZ NOT NULL DEFAULT NOW(), source TEXT NOT NULL, kind TEXT NOT NULL,
            model TEXT NOT NULL, input_tokens INT NOT NULL DEFAULT 0, output_tokens INT NOT NULL DEFAULT 0, images INT NOT NULL DEFAULT 0)""")
        for k, m, i, o in rows_:
            cur.execute("INSERT INTO ai_usage (source, kind, model, input_tokens, output_tokens) VALUES ('actions', %s, %s, %s, %s)", (k, m, i, o))
        conn.commit()
    except Exception as e:
        conn.rollback()
        log.warning("evidence spotřeby AI se nepodařila: %s", e)


def gemini_json(kind: str, prompt: str) -> dict:
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY není nastaven")
    cfg = GEN[kind]
    last = None
    for model in MODELS:
        r = requests.post(
            f"https://generativelanguage.googleapis.com/v1/models/{model}:generateContent?key={api_key}",
            json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"maxOutputTokens": cfg["max_tokens"], "temperature": cfg["temperature"]},
            },
            timeout=cfg["timeout"] + 30,
        )
        if not r.ok:
            if r.status_code == 404 or (r.status_code == 400 and "no longer available" in r.text):
                last = RuntimeError(f"model {model} není dostupný")
                continue
            if r.status_code == 429:
                raise RateLimited()
            raise RuntimeError(f"Gemini HTTP {r.status_code}: {r.text[:300]}")
        body = r.json()
        um = body.get("usageMetadata") or {}
        # myšlenkové tokeny se účtují jako výstup; zkrácená odpověď (MAX_TOKENS) se platí taky
        USAGE.append((kind, model, int(um.get("promptTokenCount") or 0),
                      int(um.get("candidatesTokenCount") or 0) + int(um.get("thoughtsTokenCount") or 0)))
        cand = (body.get("candidates") or [{}])[0]
        if cand.get("finishReason") == "MAX_TOKENS":
            last = RuntimeError("MAX_TOKENS")
            continue
        parts = (cand.get("content") or {}).get("parts") or [{}]
        text = parts[0].get("text")
        if not text:
            raise RuntimeError("Gemini vrátil prázdnou odpověď")
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.I)
        text = re.sub(r"\s*```$", "", text).strip()
        return json.loads(text)
    raise last or RuntimeError("Žádný dostupný model Gemini")


def generate(kind: str, prompt: str) -> dict | None:
    """Volání s exponenciálním čekáním při 429 (60 → 120 → 240 s). Po vyčerpání vrátí None."""
    for attempt, wait in enumerate([60, 120, 240, None], start=1):
        try:
            return gemini_json(kind, prompt)
        except RateLimited:
            if wait is None:
                return None
            log.info("429 rate limit, čekám %ss (pokus %s/4)", wait, attempt)
            time.sleep(wait)
    return None


# ── Pomocné ─────────────────────────────────────────────────────────────────

def slugify(text: str, article: bool = False) -> str:
    s = unicodedata.normalize("NFD", text.lower())
    s = "".join(c for c in s if not unicodedata.combining(c))
    if article:
        s = re.sub(r"[^a-z0-9\s-]", "", s).strip()
        return re.sub(r"-+", "-", re.sub(r"\s+", "-", s))[:80]
    return re.sub(r"^-+|-+$", "", re.sub(r"[^a-z0-9]+", "-", s))


def rows(conn, sql: str, params=()):
    cur = conn.cursor()
    cur.execute(sql, params)
    out = cur.fetchall()
    conn.commit()
    return out


def geo_names(conn, with_resorts: bool) -> list[str]:
    names: dict[str, None] = {}
    for r in rows(conn, "SELECT DISTINCT country, destination, resort_town FROM hotels "
                        "WHERE country IS NOT NULL OR destination IS NOT NULL OR resort_town IS NOT NULL"):
        if r["country"]:
            names[r["country"].strip()] = None
        if r["destination"]:
            parts = r["destination"].split("/")
            region = (parts[1] if len(parts) >= 2 else parts[0]).strip()
            if region and not NON_GEO.search(region):
                names[region] = None
        if with_resorts and r["resort_town"]:
            names[r["resort_town"].strip()] = None
    return list(names)


def js(v) -> str:
    return json.dumps(v, ensure_ascii=False)


# ── Jednotlivé druhy obsahu ─────────────────────────────────────────────────

def todo_destination(conn):
    have = {r["name"] for r in rows(conn, "SELECT name FROM destination_ai WHERE description IS NOT NULL AND LENGTH(description) >= 50")}
    return [n for n in geo_names(conn, True) if n not in have]


def run_destination(conn, name):
    p = generate("destination", load_prompt(conn, "destination", name=name))
    if not p or len(p.get("description") or "") < 50:
        return False
    conn.cursor().execute(
        """INSERT INTO destination_ai (name, description, excursions, best_time, places, food, trips, generated_at)
           VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
           ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description, excursions = EXCLUDED.excursions,
             best_time = EXCLUDED.best_time, places = EXCLUDED.places, food = EXCLUDED.food,
             trips = EXCLUDED.trips, generated_at = NOW()""",
        (name, p["description"], js((p.get("excursions") or [])[:8]), p.get("best_time") or None,
         js((p.get("places") or [])[:6]), js((p.get("food") or [])[:6]), js((p.get("trips") or [])[:6])),
    )
    conn.commit()
    return True


def todo_weather(conn):
    have = {r["name"] for r in rows(conn, "SELECT name FROM weather_ai WHERE description IS NOT NULL")}
    return [n for n in geo_names(conn, False) if n not in have]


def run_weather(conn, name):
    p = generate("weather", load_prompt(conn, "weather", name=name))
    if not p or not p.get("description"):
        return False

    def arr(k):
        v = p.get(k)
        return js(v[:12]) if isinstance(v, list) else None

    conn.cursor().execute(
        """INSERT INTO weather_ai (name, description, monthly_air, monthly_sea, monthly_rain_days, monthly_sun_hours,
             best_months, winter, spring, summer, autumn, wind_info, sea_info, generated_at)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
           ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description, monthly_air = EXCLUDED.monthly_air,
             monthly_sea = EXCLUDED.monthly_sea, monthly_rain_days = EXCLUDED.monthly_rain_days,
             monthly_sun_hours = EXCLUDED.monthly_sun_hours, best_months = EXCLUDED.best_months,
             winter = EXCLUDED.winter, spring = EXCLUDED.spring, summer = EXCLUDED.summer, autumn = EXCLUDED.autumn,
             wind_info = EXCLUDED.wind_info, sea_info = EXCLUDED.sea_info, generated_at = NOW()""",
        (name, p["description"], arr("monthly_air"), arr("monthly_sea"), arr("monthly_rain_days"), arr("monthly_sun_hours"),
         js(p.get("best_months") if isinstance(p.get("best_months"), list) else []),
         p.get("winter"), p.get("spring"), p.get("summer"), p.get("autumn"), p.get("wind_info"), p.get("sea_info")),
    )
    conn.commit()
    return True


def todo_car_rental(conn):
    dests: dict[str, dict] = {}
    try:
        for r in rows(conn, "SELECT slug, name, country FROM car_destinations WHERE active = TRUE ORDER BY country, name"):
            dests.setdefault(r["slug"], r)
    except Exception:
        conn.rollback()
    try:
        for r in rows(conn, """
            SELECT DISTINCT h.country, COALESCE(h.resort_town, split_part(h.destination, '/', 2)) AS resort_town
            FROM hotels h INNER JOIN hotel_stats s ON s.hotel_id = h.id
            WHERE s.next_departure >= CURRENT_DATE::text
              AND (h.resort_town IS NOT NULL OR h.destination IS NOT NULL) AND h.country IS NOT NULL
            ORDER BY h.country, resort_town"""):
            name = (r["resort_town"] or "").strip()
            if not name or NON_GEO.search(name):
                continue
            dests.setdefault(slugify(name), {"slug": slugify(name), "name": name, "country": r["country"]})
    except Exception as e:
        conn.rollback()
        log.warning("dotaz na hotely: %s", e)
    have = {r["slug"] for r in rows(conn, "SELECT slug FROM car_rental_ai WHERE intro IS NOT NULL")}
    return [d for s, d in dests.items() if s not in have]


def run_car_rental(conn, d):
    p = generate("car_rental", load_prompt(conn, "car_rental", name=d["name"], country=d["country"]))
    if not p or not p.get("intro"):
        return False
    lst = lambda k: js(p[k]) if isinstance(p.get(k), list) else "[]"
    mp = p.get("monthly_prices")
    conn.cursor().execute(
        """INSERT INTO car_rental_ai (slug, name, country, intro, fuel_info, driving_rules, price_overview, best_car_types,
             trip_tips, faq, practical_tips, car_examples, airport_info, monthly_prices, generated_at)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
           ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, country = EXCLUDED.country, intro = EXCLUDED.intro,
             fuel_info = EXCLUDED.fuel_info, driving_rules = EXCLUDED.driving_rules, price_overview = EXCLUDED.price_overview,
             best_car_types = EXCLUDED.best_car_types, trip_tips = EXCLUDED.trip_tips, faq = EXCLUDED.faq,
             practical_tips = EXCLUDED.practical_tips, car_examples = EXCLUDED.car_examples,
             airport_info = EXCLUDED.airport_info, monthly_prices = EXCLUDED.monthly_prices, generated_at = NOW()""",
        (d["slug"], d["name"], d["country"], p.get("intro"), p.get("fuel_info"), p.get("driving_rules"),
         p.get("price_overview"), p.get("best_car_types"), lst("trip_tips"), lst("faq"), lst("practical_tips"), lst("car_examples"),
         js(p["airport_info"]) if isinstance(p.get("airport_info"), dict) else None,
         js([float(x) for x in mp]) if isinstance(mp, list) and len(mp) == 12 else None),
    )
    conn.commit()
    return True


def todo_article(conn):
    if not TOPICS_FILE.exists():
        log.info("article_topics.txt nenalezen")
        return []
    topics = [l.strip() for l in TOPICS_FILE.read_text(encoding="utf-8").splitlines() if l.strip() and not l.strip().startswith("#")]
    have = {r["topic"] for r in rows(conn, "SELECT topic FROM articles")}
    return [t for t in topics if t not in have]


# Pokyn pro AI: vlastními slovy vložit jeden odkaz na ubytování (stejné znění jako ARTICLE_STAY_INSTRUCTION ve frontend/src/lib/booking.ts).
# Přidává se v kódu, aby ho nešlo přepsat v administraci promptů.
ARTICLE_STAY_INSTRUCTION = (
    "\n\nDODATEČNÝ POKYN K ODKAZU NA UBYTOVÁNÍ (má přednost před případným pravidlem o zákazu odkazů):\n"
    "Pokud má článek konkrétní lokalitu, vlož do textu PŘESNĚ JEDEN odkaz na naši nabídku nejlevnějšího ubytování v této lokalitě, "
    "v Markdownu ve tvaru [text odkazu](ubytovani). Adresa musí být doslova ubytovani. Odkaz zasaď do věty tam, kde to v článku dává smysl, "
    "klidně uprostřed textu, nemusí to být na konci. Formulaci vymysli vlastními slovy tak, aby odpovídala tématu a tónu článku a nezněla "
    "jako reklama; vždy ji napiš jinak. Sdělení je, že máme nabídku nejlevnějšího ubytování v dané lokalitě. Odkazem má být jen pár slov "
    "uvnitř věty. Nikdy nezmiňuj Booking.com ani žádného jiného partnera. Bez konkrétní lokality odkaz nevkládej."
)
STAY_LINK = re.compile(r"\[([^\]]+)\]\(/?ubytovani/?\)")


def apply_stay_link(content, location):
    """Nahradí zástupný odkaz (ubytovani) skutečným affiliate odkazem (stejně jako applyStayLink ve frontendu).
    První výskyt nechá, další změní na prostý text; bez lokality odkazy odstraní; když AI odkaz vynechala, přidá krátkou větu na konec."""
    place = re.sub(r"[()\[\]*]", "", location or "").strip()
    valid = bool(place) and place.lower() != "null"
    href = ""
    if valid:
        search = "https://www.booking.com/searchresults.cs.html?" + urlencode(
            {"ss": place, "group_adults": 2, "no_rooms": 1, "group_children": 0, "selected_currency": "CZK"})
        href = "/api/booking/click?url=" + quote(search, safe="-_.!~*'()") + "&sid=clanek"
    used = [False]

    def repl(m):
        if not valid or used[0]:
            return m.group(1)
        used[0] = True
        return f"[{m.group(1)}]({href})"

    out = STAY_LINK.sub(repl, content)
    if valid and not used[0]:
        out = out.rstrip() + f"\n\nNabídku [nejlevnějšího ubytování: {place}]({href}) máme připravenou."
    return out


def run_article(conn, topic):
    p = generate("article", load_prompt(conn, "article", topic=topic) + ARTICLE_STAY_INSTRUCTION)
    if not p or not p.get("content") or not p.get("title"):
        return False
    slug = slugify(p["title"], article=True) or slugify(topic, article=True)
    if rows(conn, "SELECT id FROM articles WHERE slug = %s AND topic != %s", (slug, topic)):
        slug = f"{slug}-2"
    conn.cursor().execute(
        """INSERT INTO articles (topic, slug, title, category, location, excerpt, content, reading_time, published_at, generated_at)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
           ON CONFLICT (topic) DO UPDATE SET slug = EXCLUDED.slug, title = EXCLUDED.title, category = EXCLUDED.category,
             location = EXCLUDED.location, excerpt = EXCLUDED.excerpt, content = EXCLUDED.content,
             reading_time = EXCLUDED.reading_time, generated_at = NOW()""",
        (topic, slug, p["title"], p.get("category") or "Inspirace", p.get("location") or None,
         p.get("excerpt") or None, apply_stay_link(p["content"], p.get("location")), p.get("reading_time") or 5),
    )
    conn.commit()
    return True



# ── Průvodce oblastí (pláže, kláštery, památky, příroda, vesničky) ─────────

IMAGE_CAPS = {"beaches": 16, "monasteries": 8, "sights": 8, "nature": 8, "villages": 8}
IMG_VERSION = 4  # 2 = Wikimedia Commons první, Unsplash záloha; 3 = přesnější fotky pláží; 4 = kontrola názvu souboru i u míst
BEACH_V = 3
PLACE_V = 4
UNSPLASH_UTM = "utm_source=zaleto&utm_medium=referral"


def ensure_guide_table(conn):
    conn.cursor().execute(
        """CREATE TABLE IF NOT EXISTS destination_guide (
             name TEXT PRIMARY KEY,
             country TEXT,
             data JSONB NOT NULL DEFAULT '{}',
             images_done BOOLEAN NOT NULL DEFAULT FALSE,
             generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())""")
    conn.commit()


def region_info(conn) -> dict[str, dict]:
    """Oblasti (druhá část pole destination) s jejich zemí, středisky a souřadnicemi hotelů."""
    out: dict[str, dict] = {}
    for r in rows(conn, "SELECT country, destination, resort_town, latitude, longitude FROM hotels "
                        "WHERE destination IS NOT NULL AND destination <> ''"):
        parts = [x.strip() for x in r["destination"].split("/")]
        if len(parts) < 2:
            continue
        region = parts[1]
        if not region or NON_GEO.search(region):
            continue
        info = out.setdefault(region, {"country": r["country"], "resorts": {}, "coords": []})
        if r["resort_town"]:
            rt = r["resort_town"].strip()
            info["resorts"][rt] = info["resorts"].get(rt, 0) + 1
        if r["latitude"] is not None and r["longitude"] is not None:
            info["coords"].append((float(r["latitude"]), float(r["longitude"])))
    return out


def todo_guide(conn):
    ensure_guide_table(conn)
    have = {r["name"] for r in rows(conn, "SELECT name FROM destination_guide")}
    info = region_info(conn)
    names = sorted(info, key=lambda n: -sum(info[n]["resorts"].values()))  # nejdřív oblasti s nejvíce hotely
    def key(n):  # Kréta / Kreta = jedna oblast
        return re.sub(r"[^a-z0-9]+", "-", unicodedata.normalize("NFD", n).encode("ascii", "ignore").decode().lower()).strip("-")
    seen = {key(n) for n in have}
    out = []
    for n in names:
        if n in have or key(n) in seen:
            continue
        seen.add(key(n))
        out.append({"name": n, **info[n]})
    return out


def _clean_text(v, limit=600):
    if not isinstance(v, str):
        return None
    v = re.sub(r"\s+", " ", v).strip()
    return v[:limit] or None


def _clean_items(lst, keys, limit):
    out = []
    for it in (lst if isinstance(lst, list) else [])[:limit]:
        if not isinstance(it, dict) or not _clean_text(it.get("name"), 120):
            continue
        row = {"name": _clean_text(it["name"], 120)}
        for k in keys:
            t = _clean_text(it.get(k), 700 if k == "description" else 160)
            if t:
                row[k] = t
        q = _clean_text(it.get("image_query"), 80)
        if q:
            row["image_query"] = q
        if row.get("description") and len(row["description"]) >= 20:
            out.append(row)
    return out


def sanitize_guide(p: dict, d: dict) -> dict:
    coords = d.get("coords") or []
    box = None
    if len(coords) >= 3:
        lats = [c[0] for c in coords]
        lngs = [c[1] for c in coords]
        pad = 0.45
        box = (min(lats) - pad, max(lats) + pad, min(lngs) - pad, max(lngs) + pad)

    beaches = []
    seen = set()
    for it in (p.get("beaches") if isinstance(p.get("beaches"), list) else [])[:16]:
        if not isinstance(it, dict):
            continue
        name = _clean_text(it.get("name"), 120)
        desc = _clean_text(it.get("description"), 700)
        if not name or not desc or len(desc) < 20 or name.lower() in seen:
            continue
        seen.add(name.lower())
        b = {"name": name, "description": desc}
        res = _clean_text(it.get("resort"), 80)
        if res:
            b["resort"] = res
        for k in ("type", "tip", "crowd", "image_query"):
            t = _clean_text(it.get(k), 240)
            if t:
                b[k] = t
        for k in ("facilities", "suitable_for"):
            if isinstance(it.get(k), list):
                vals = [x.strip() for x in it[k] if isinstance(x, str) and x.strip()][:6]
                if vals:
                    b[k] = vals
        lat, lng = it.get("lat"), it.get("lng")
        # souřadnice jen v rozumném okolí hotelů oblasti (ochrana proti vymyšleným souřadnicím)
        if isinstance(lat, (int, float)) and isinstance(lng, (int, float)) and box \
                and box[0] <= lat <= box[1] and box[2] <= lng <= box[3]:
            b["lat"], b["lng"] = round(float(lat), 5), round(float(lng), 5)
        beaches.append(b)

    facts = []
    for f in (p.get("facts") if isinstance(p.get("facts"), list) else [])[:6]:
        if isinstance(f, dict) and _clean_text(f.get("label"), 40) and _clean_text(f.get("value"), 80):
            facts.append({"label": _clean_text(f["label"], 40), "value": _clean_text(f["value"], 80)})

    resorts = []
    for it in (p.get("resorts") if isinstance(p.get("resorts"), list) else [])[:16]:
        if isinstance(it, dict) and _clean_text(it.get("name"), 80) and _clean_text(it.get("description"), 400):
            r = {"name": _clean_text(it["name"], 80), "description": _clean_text(it["description"], 400)}
            v = _clean_text(it.get("vibe"), 40)
            if v:
                r["vibe"] = v
            resorts.append(r)

    tr = p.get("transport") if isinstance(p.get("transport"), dict) else {}
    transport = {k: _clean_text(tr.get(k), 700) for k in ("to", "around") if _clean_text(tr.get(k), 700)}

    return {
        "facts": facts,
        "resorts": resorts,
        "beaches": beaches,
        "monasteries": _clean_items(p.get("monasteries"), ("location", "description"), 8),
        "sights": _clean_items(p.get("sights"), ("kind", "location", "description"), 10),
        "nature": _clean_items(p.get("nature"), ("location", "description"), 10),
        "villages": _clean_items(p.get("villages"), ("description",), 10),
        "transport": transport,
    }



def hotel_box(coords, pad=0.45):
    if len(coords) < 3:
        return None
    lats, lngs = [c[0] for c in coords], [c[1] for c in coords]
    return (min(lats) - pad, max(lats) + pad, min(lngs) - pad, max(lngs) + pad)


_last_geocode = 0.0


def geocode_beach(name: str, region: str, country: str, box) -> tuple[float, float] | None:
    """Přesná poloha pláže z OpenStreetMap (Nominatim, max. 1 dotaz/s podle podmínek služby).
    Hledá se jen uvnitř oblasti kolem hotelů; AI souřadnice jsou jen přibližné, proto se opravují."""
    global _last_geocode
    if not box:
        return None
    wait = 1.1 - (time.time() - _last_geocode)
    if wait > 0:
        time.sleep(wait)
    _last_geocode = time.time()
    clean = re.sub(r"\s*\(.*?\)", "", name).strip()
    try:
        r = requests.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": f"{clean}, {region}, {country}", "format": "jsonv2", "limit": 5,
                    "viewbox": f"{box[2]},{box[1]},{box[3]},{box[0]}", "bounded": 1},
            headers={"User-Agent": "zaleto.cz content generator (https://zaleto.cz)"},
            timeout=20,
        )
        if not r.ok:
            return None
        for h in r.json():
            if h.get("category") in ("natural", "tourism", "leisure", "place", "waterway", "amenity") or h.get("type") in ("beach", "bay", "cape"):
                lat, lng = float(h["lat"]), float(h["lon"])
                if box[0] <= lat <= box[1] and box[2] <= lng <= box[3]:
                    return round(lat, 5), round(lng, 5)
    except Exception as e:
        log.warning("geokódování %s: %s", name, e)
    return None


def run_guide(conn, d):
    resorts = ", ".join(sorted(d["resorts"], key=lambda r: -d["resorts"][r])[:25]) or "neuvedena"
    p = generate("guide", load_prompt(conn, "destination_guide", name=d["name"], country=d["country"] or "", resorts=resorts))
    if not p:
        return False
    data = sanitize_guide(p, d)
    box = hotel_box(d.get("coords") or [])
    for b in data["beaches"]:
        pos = geocode_beach(b["name"], d["name"], d["country"] or "", box)
        if pos:
            b["lat"], b["lng"] = pos
            b["geo"] = "osm"
    if not any(data[k] for k in ("beaches", "resorts", "monasteries", "sights", "nature", "villages")):
        log.warning("průvodce %s: AI nevrátila použitelný obsah", d["name"])
        return False
    conn.cursor().execute(
        """INSERT INTO destination_guide (name, country, data, images_done, generated_at)
           VALUES (%s, %s, %s, FALSE, NOW())
           ON CONFLICT (name) DO NOTHING""",
        (d["name"], d["country"], js(data)),
    )
    conn.commit()
    return True


# Unsplash fotky k položkám průvodce: samostatný druh, hlídá hodinový limit API a běží každou hodinu

_unsplash_remaining = None


def unsplash_search(query: str) -> list[dict]:
    global _unsplash_remaining
    key = os.environ.get("UNSPLASH_ACCESS_KEY", "")
    if not key:
        raise RuntimeError("UNSPLASH_ACCESS_KEY není nastaven")
    if _unsplash_remaining is not None and _unsplash_remaining <= 2:
        raise QuotaExhausted()
    r = requests.get(
        "https://api.unsplash.com/search/photos",
        params={"query": query, "orientation": "landscape", "content_filter": "high", "per_page": 10},
        headers={"Authorization": f"Client-ID {key}", "Accept-Version": "v1"},
        timeout=20,
    )
    rem = r.headers.get("X-Ratelimit-Remaining")
    if rem is not None:
        _unsplash_remaining = int(rem)
    if r.status_code in (403, 429):
        raise QuotaExhausted()
    r.raise_for_status()
    return r.json().get("results") or []


# Wikimedia Commons: fotky konkrétních míst bez klíče a limitu; u každé se uvádí autor a licence

WIKI_UA = {"User-Agent": "zaleto.cz/1.0 (https://zaleto.cz; info@zaleto.cz) guide-images"}
FREE_LICENSE = re.compile(r"^(CC BY|CC0|Public domain|PD|Attribution)", re.I)


def _strip_html(t: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", t or "")).strip()


def _norm(t: str) -> str:
    return re.sub(r"[^a-z0-9 ]", "", unicodedata.normalize("NFD", t).encode("ascii", "ignore").decode().lower())


def _commons_candidate(ii: dict, used: set) -> dict | None:
    """Z údajů o souboru na Commons vyrobí fotku, jen pokud je svobodně licencovaná a dost velká na šířku."""
    meta = ii.get("extmetadata") or {}
    lic = _strip_html((meta.get("LicenseShortName") or {}).get("value", ""))
    if not FREE_LICENSE.match(lic):
        return None
    w, h = ii.get("width") or 0, ii.get("height") or 1
    if w < 900 or w < h * 1.15:
        return None
    url = (ii.get("thumburl") or ii.get("url") or "").split("?")[0]
    if not url or url in used:
        return None
    artist = re.split(r"\s\d{1,2}:\d\d|\(UTC\)", _strip_html((meta.get("Artist") or {}).get("value", "")))[0].strip()
    if len(artist) < 3 or artist.lower().startswith("no machine"):
        artist = "Wikimedia Commons"
    return {"url": url, "id": url, "source": "wikimedia", "license": lic,
            "credit": artist[:80], "creditUrl": ii.get("descriptionurl") or "https://commons.wikimedia.org"}


def commons_search_photo(name: str, region: str, used: set) -> dict | None:
    """Záloha: fulltext hledání souborů přímo na Commons."""
    try:
        r = requests.get("https://commons.wikimedia.org/w/api.php", params={
            "action": "query", "generator": "search", "gsrnamespace": 6, "gsrsearch": f"{name} {region}", "gsrlimit": 8,
            "prop": "imageinfo", "iiprop": "url|extmetadata|size", "iiurlwidth": 1280, "format": "json"},
            headers=WIKI_UA, timeout=15).json()
        words = _place_words(name)
        pages = sorted((r.get("query") or {}).get("pages", {}).values(), key=lambda p: p.get("index", 99))
        for pg in pages:
            if not _file_ok(pg.get("title", "").replace("File:", "", 1), words):
                continue
            ii = (pg.get("imageinfo") or [None])[0]
            c = ii and _commons_candidate(ii, used)
            if c:
                return c
    except Exception as e:
        log.debug("commons_search %s: %s", name, e)
    return None


BEACH_WORDS = ("playa", "platja", "beach", "strand", "plage", "praia", "spiaggia", "cala", "cove", "bay", "paralia", "plaz")
BAD_WORDS = ("castle", "castell", "castillo", "porta", "gate", "puerta", "church", "iglesia", "glesia", "muralla", "wall", "map", "mapa",
              "logo", "flag", "escut", "coat", "hotel", "exterior", "interior", "room", "restaurant", "resort", "apartment", "torre", "tower", "plaza", "street", "calle", "carrer", "museum", "museo", "statue", "monument")


def beach_photo(name: str, region: str, used: set) -> dict | None:
    """Pláže: jen fulltext na Commons s kontrolou názvu souboru (článek na Wikipedii bývá o městě, ne o pláži)."""
    words = [w for w in _norm(name).split() if len(w) > 2 and w not in ("playa", "platja", "plaza", "beach", "cala", "de", "del", "des", "sa", "es", "els", "los", "las", "la", "el", "d", "den")]
    if not words:
        return None
    for q in (f"{name} {region} beach", f"{name} {region}", f"{name} beach"):
        try:
            r = requests.get("https://commons.wikimedia.org/w/api.php", params={
                "action": "query", "generator": "search", "gsrnamespace": 6, "gsrsearch": q, "gsrlimit": 12,
                "prop": "imageinfo", "iiprop": "url|extmetadata|size", "iiurlwidth": 1280, "format": "json"},
                headers=WIKI_UA, timeout=15).json()
        except Exception as e:
            log.debug("beach_photo %s: %s", name, e)
            continue
        pages = sorted((r.get("query") or {}).get("pages", {}).values(), key=lambda p: p.get("index", 99))
        good, ok = None, None
        for pg in pages:
            t = _norm(pg.get("title", ""))
            if not any(w in t for w in words) or any(b in t.split() for b in BAD_WORDS):
                continue
            ii = (pg.get("imageinfo") or [None])[0]
            c = ii and _commons_candidate(ii, used)
            if not c:
                continue
            if any(b in t for b in BEACH_WORDS):
                good = good or c
            ok = ok or c
        if good or ok:
            return good or ok
        time.sleep(0.2)
    return None


PLACE_GENERIC = {"de", "del", "la", "las", "el", "los", "des", "sa", "es", "els", "d", "den", "the", "of", "san", "sant", "santa", "santuari", "playa", "platja", "beach",
                 "cala", "castell", "castillo", "castle", "monestir", "monasterio", "monastery", "convent", "convento", "catedral", "cathedral", "iglesia", "esglesia",
                 "church", "parque", "parc", "park", "natural", "nacional", "cuevas", "coves", "cueva", "cova", "museu", "museo", "museum", "pohori", "serra", "sierra",
                 "sa", "mirador", "ermita", "palau", "palacio", "palace", "jeskyne", "klaster", "hrad", "mesto", "stare", "vesnice", "town"}
PLACE_BAD = ("map", "mapa", "logo", "flag", "escut", "coat", "locator", "plan", "diagram", "poster", "stamp", "icon", "interior", "room", "menu", "poster")


def _place_words(name: str) -> list[str]:
    """Rozlišující slova názvu (bez obecných typu „castell“, „playa“): musí být v názvu souboru fotky."""
    all_w = [w for w in _norm(name).split() if len(w) > 2]
    return [w for w in all_w if w not in PLACE_GENERIC] or all_w


def _file_ok(title: str, words: list[str]) -> bool:
    t = _norm(title.rsplit(".", 1)[0].replace("_", " "))
    return bool(words) and any(w in t for w in words) and not any(b in t.split() for b in PLACE_BAD)


def wiki_photo(name: str, region: str, used: set) -> dict | None:
    """Hlavní obrázek článku na Wikipedii o daném místě + autor a licence z Commons."""
    words = _place_words(name)
    if not words:
        return None
    for lang in ("cs", "en", "es", "el", "de"):
        try:
            r = requests.get(f"https://{lang}.wikipedia.org/w/rest.php/v1/search/page",
                             params={"q": f"{name} {region}", "limit": 3}, headers=WIKI_UA, timeout=15)
            if r.status_code != 200:
                continue
            for page in (r.json().get("pages") or []):
                title = _norm(page.get("title", ""))
                if not any(w in title for w in words):
                    continue
                sm = requests.get(f"https://{lang}.wikipedia.org/api/rest_v1/page/summary/" + requests.utils.quote(page["key"], safe=""),
                                  headers=WIKI_UA, timeout=15)
                if sm.status_code != 200:
                    continue
                orig = ((sm.json().get("originalimage") or {}).get("source", "") or "").split("?")[0]
                m = re.match(r"https://upload\.wikimedia\.org/wikipedia/commons/(?:thumb/)?[0-9a-f]/[0-9a-f]{2}/([^/]+)", orig)
                if not m:
                    continue  # soubor mimo Commons (nesvobodný)
                fname = requests.utils.unquote(m.group(1))
                if not _file_ok(fname, words):
                    continue  # hlavní obrázek článku nesedí na místo (např. kaple místo hradu): zkusí se hledání na Commons
                info = requests.get("https://commons.wikimedia.org/w/api.php", params={
                    "action": "query", "titles": f"File:{fname}", "prop": "imageinfo", "iiprop": "url|extmetadata|size",
                    "iiurlwidth": 1280, "format": "json"}, headers=WIKI_UA, timeout=15).json()
                pg = next(iter((info.get("query") or {}).get("pages", {}).values()), {})
                ii = (pg.get("imageinfo") or [None])[0]
                if not ii:
                    continue
                c = _commons_candidate(ii, used)
                if c:
                    return c
        except Exception as e:  # síť, neočekávaný tvar odpovědi: zkusíme další jazyk / zálohu
            log.debug("wiki_photo %s: %s", name, e)
        time.sleep(0.2)
    return commons_search_photo(name, region, used)



def pick_photo(results: list[dict], used: set, words: list[str] | None = None) -> dict | None:
    """Fotka z Unsplash. S `words` musí popis, alt text nebo štítky fotky obsahovat rozlišující slovo místa
    (stejná kontrola jako u Commons); bez shody raději žádná fotka než špatná."""
    for h in results:
        url = (h.get("urls") or {}).get("regular", "")
        base = url.split("?")[0]
        w, hh = h.get("width") or 0, h.get("height") or 1
        if not url or base in used or w < 1600 or w / max(hh, 1) < 1.2:
            continue
        if words:
            text = _norm(" ".join([h.get("alt_description") or "", h.get("description") or "", " ".join(t.get("title", "") for t in (h.get("tags") or []))]))
            if not any(x in text for x in words) or any(b in text.split() for b in PLACE_BAD):
                continue
        user = h.get("user") or {}
        return {
            "url": url, "id": base,
            "credit": user.get("name") or "Unsplash",
            "creditUrl": f"{(user.get('links') or {}).get('html', 'https://unsplash.com')}?{UNSPLASH_UTM}",
            "download": (h.get("links") or {}).get("download_location"),
        }
    return None


def register_download(url):
    key = os.environ.get("UNSPLASH_ACCESS_KEY", "")
    if url and url.startswith("https://api.unsplash.com/") and key:
        try:
            requests.get(url, headers={"Authorization": f"Client-ID {key}"}, timeout=10)
        except Exception:
            pass


def todo_guide_images(conn):
    ensure_guide_table(conn)
    return rows(conn, "SELECT name, country, data FROM destination_guide "
                      "WHERE images_done = FALSE OR (data->>'_img_v') IS DISTINCT FROM %s ORDER BY generated_at", (str(IMG_VERSION),))


def run_guide_images(conn, g):
    data = g["data"] if isinstance(g["data"], dict) else json.loads(g["data"])
    region, country = g["name"], g["country"] or ""
    used = {it["image"]["id"] for sec in IMAGE_CAPS for it in data.get(sec, []) if it.get("image")}
    for sec_ in ("monasteries", "sights", "nature", "villages"):
        for it in data.get(sec_, []):
            if it.get("place_v") != PLACE_V:  # fotky bez kontroly názvu souboru se hledají znovu
                it.pop("image", None); it.pop("image_failed", None); it["place_v"] = PLACE_V
    for it in data.get("beaches", []):
        if it.get("beach_v") != BEACH_V:  # dřívější fotky pláží často ukazovaly město; hledá se znovu
            it.pop("image", None); it.pop("image_failed", None); it["beach_v"] = BEACH_V
    used = {it["image"]["id"] for sec in IMAGE_CAPS for it in data.get(sec, []) if it.get("image")}
    complete, changed, quota = True, True, False
    try:
        for sec, cap in IMAGE_CAPS.items():
            for it in data.get(sec, [])[:cap]:
                if it.get("image"):
                    continue
                if it.get("image_failed") and it.get("img_v") == IMG_VERSION:
                    continue
                photo = beach_photo(it["name"], region, used) if sec == "beaches" else wiki_photo(it["name"], region, used)
                if not photo and not quota:
                    try:
                        q = it.get("image_query") or f"{it['name']} {region}"
                        photo = pick_photo(unsplash_search(q), used, _place_words(it["name"]))
                        if photo:
                            photo["source"] = "unsplash"
                    except QuotaExhausted:
                        quota = True
                if not photo and quota:
                    complete = False  # počká na další hodinu (Unsplash limit)
                    continue
                if photo:
                    used.add(photo["id"])
                    register_download(photo.pop("download", None))
                    it["image"] = photo
                    it.pop("image_failed", None)
                else:
                    it["image_failed"] = True
                it["img_v"] = IMG_VERSION
                changed = True
    finally:
        if changed or complete:
            if complete:
                data["_img_v"] = IMG_VERSION
            conn.cursor().execute("UPDATE destination_guide SET data = %s, images_done = %s WHERE name = %s",
                                  (js(data), complete, region))
            conn.commit()
    if quota:
        raise QuotaExhausted()
    return True


# ── SEO obsah: hotely, destinace (kdy jet / pro koho / rozpočet), vstupní stránky ──────────────

MIN_LANDING_HOTELS = int(os.environ.get("AI_LANDING_MIN", "8"))
HOTEL_MAX = int(os.environ.get("AI_HOTEL_MAX", "2000"))
# texty vygenerované před tímto časem vznikly se starším promptem (obsahovaly ceny a počty, které zastarávají) a přegenerují se
PROMPT_CUTOFF = "2026-11-02 21:30:00+00"
# po kolika dnech se text přegeneruje (jsou v něm ceny a počty hotelů, které zastarávají)
REFRESH_DAYS = int(os.environ.get("AI_REFRESH_DAYS", "60"))
HOTEL_REFRESH_DAYS = int(os.environ.get("AI_HOTEL_REFRESH_DAYS", "120"))
CANON = "(h.canonical_slug IS NULL OR h.canonical_slug = h.slug)"
MONTHS = ["leden", "únor", "březen", "duben", "květen", "červen", "červenec", "srpen", "září", "říjen", "listopad", "prosinec"]
MONTHS_IN = ["lednu", "únoru", "březnu", "dubnu", "květnu", "červnu", "červenci", "srpnu", "září", "říjnu", "listopadu", "prosinci"]
AUDIENCES = {"Rodiny s dětmi", "Páry", "Aktivní dovolená", "Klidná dovolená", "Parta přátel", "Senioři"}


def ensure_seo_tables(conn):
    cur = conn.cursor()
    cur.execute("""CREATE TABLE IF NOT EXISTS hotel_ai (
        slug TEXT PRIMARY KEY, summary TEXT NOT NULL, audience JSONB NOT NULL DEFAULT '[]', highlights JSONB NOT NULL DEFAULT '[]',
        watch_out JSONB NOT NULL DEFAULT '[]', location TEXT, food TEXT, faq JSONB NOT NULL DEFAULT '[]',
        generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())""")
    cur.execute("""CREATE TABLE IF NOT EXISTS destination_seo (
        name TEXT PRIMARY KEY, months JSONB NOT NULL DEFAULT '[]', audiences JSONB NOT NULL DEFAULT '[]', budget TEXT,
        comparison JSONB, faq JSONB NOT NULL DEFAULT '[]', stats JSONB NOT NULL DEFAULT '{}',
        generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())""")
    cur.execute("""CREATE TABLE IF NOT EXISTS landing_ai (
        slug TEXT PRIMARY KEY, type TEXT NOT NULL, value TEXT NOT NULL, country TEXT, title TEXT NOT NULL,
        intro TEXT NOT NULL, sections JSONB NOT NULL DEFAULT '[]', faq JSONB NOT NULL DEFAULT '[]',
        hotel_count INT NOT NULL DEFAULT 0, min_price REAL, generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())""")
    conn.commit()


def clean_faq(lst, limit, a_max=420):
    out = []
    for it in (lst if isinstance(lst, list) else [])[:limit]:
        if not isinstance(it, dict):
            continue
        q, a = _clean_text(it.get("q"), 160), _clean_text(it.get("a"), a_max)
        if q and a and len(a) >= 20 and q.endswith("?"):
            out.append({"q": q, "a": a})
    return out


def clean_audience(lst, limit, t_max=320):
    out, seen = [], set()
    for it in (lst if isinstance(lst, list) else [])[:limit]:
        if not isinstance(it, dict):
            continue
        who, text = _clean_text(it.get("who"), 40), _clean_text(it.get("text"), t_max)
        if who in AUDIENCES and text and len(text) >= 20 and who not in seen:
            seen.add(who)
            out.append({"who": who, "text": text})
    return out


def clean_strs(lst, limit, max_len):
    out = []
    for s in (lst if isinstance(lst, list) else [])[:limit]:
        v = _clean_text(s, max_len) if isinstance(s, str) else None
        if v and len(v) >= 4:
            out.append(v)
    return out


def clean_paragraphs(raw, each=900, total=2000):
    """Odstavce oddělené prázdným řádkem zůstanou odstavci (_clean_text jinak spojuje řádky)."""
    parts = [_clean_text(x, each) for x in re.split(r"\n\s*\n", raw if isinstance(raw, str) else "")]
    return "\n\n".join(x for x in parts if x)[:total]


def _strip_html(s: str) -> str:
    s = re.sub(r"<[^>]*>", " ", s or "")
    s = s.replace("&nbsp;", " ").replace("&amp;", "&").replace("&quot;", '"')
    return re.sub(r"\s+", " ", s).strip()


def _list_field(raw) -> list[str]:
    if not raw:
        return []
    try:
        v = json.loads(raw)
        if isinstance(v, list):
            return [str(x).strip() for x in v if str(x).strip()]
    except Exception:
        pass
    return [x.strip() for x in re.split(r"[|,\n]", raw) if x.strip()]


def kc(v) -> str:
    return f"{int(round(float(v))):,}".replace(",", " ") + " Kč"


# ---- hotel ----

HOTEL_COLS = """h.id, h.slug, h.name, h.country, h.destination, h.resort_town, h.stars, h.review_score, h.amenities,
               h.food_options, h.price_includes, h.distances, h.description, s.min_price, s.max_price, s.available_dates"""


def todo_hotel(conn):
    """Nejdřív hotely bez textu (nejnabízenější první), potom nejstarší texty: v textu je cena, která časem zastará."""
    ensure_seo_tables(conn)
    have = rows(conn, "SELECT COUNT(*) AS n FROM hotel_ai")[0]["n"]
    missing = []
    if HOTEL_MAX - have > 0:
        missing = rows(conn, f"""
            SELECT {HOTEL_COLS}
            FROM hotels h JOIN hotel_stats s ON s.hotel_id = h.id
            WHERE s.next_departure >= CURRENT_DATE::text AND s.min_price IS NOT NULL AND {CANON}
              AND NOT EXISTS (SELECT 1 FROM hotel_ai a WHERE a.slug = h.slug)
            ORDER BY s.available_dates DESC NULLS LAST, h.review_score DESC NULLS LAST, h.id
            LIMIT %s""", (HOTEL_MAX - have,))
    stale = rows(conn, f"""
        SELECT {HOTEL_COLS}
        FROM hotels h JOIN hotel_stats s ON s.hotel_id = h.id JOIN hotel_ai a ON a.slug = h.slug
        WHERE s.next_departure >= CURRENT_DATE::text AND s.min_price IS NOT NULL AND {CANON}
          AND (a.generated_at < NOW() - make_interval(days => %s) OR a.generated_at < %s::timestamptz)
        ORDER BY a.generated_at LIMIT 300""", (HOTEL_REFRESH_DAYS, PROMPT_CUTOFF))
    return stale + missing


def run_hotel(conn, h):
    region = (h["destination"] or "").split("/")
    region = region[1].strip() if len(region) > 1 else ""
    place = ", ".join(dict.fromkeys(x for x in [h["resort_town"], region, h["country"]] if x))
    amenities = _list_field(h["amenities"])[:40]
    distances = [x.strip() for x in (h["distances"] or "").split("|") if x.strip()][:12]
    food = [x.strip() for x in (h["food_options"] or "").split("|") if x.strip()][:8]
    includes = [x.strip() for x in (h["price_includes"] or "").split("|") if x.strip()][:10]
    desc = _strip_html(h["description"] or "")[:1200]
    tour_rows = rows(conn, """SELECT meal_plan, COUNT(*) AS n, MIN(duration) AS dmin, MAX(duration) AS dmax,
                                     MIN(departure_date) AS first, MAX(departure_date) AS last
                              FROM tours WHERE hotel_id = %s AND price > 0 AND departure_date >= CURRENT_DATE::text
                              GROUP BY meal_plan ORDER BY n DESC""", (h["id"],))
    cities = [r["departure_city"] for r in rows(conn, """SELECT departure_city, COUNT(*) AS n FROM tours
        WHERE hotel_id = %s AND price > 0 AND departure_date >= CURRENT_DATE::text AND departure_city IS NOT NULL
        GROUP BY departure_city ORDER BY n DESC LIMIT 4""", (h["id"],))]

    facts = [f"Název: {h['name']}", f"Lokalita: {place or 'neuvedena'}", f"Hvězdičky: {h['stars'] or 'neuvedeno'}"]
    facts.append("Vybavení: " + ("; ".join(amenities) if amenities else "neuvedeno"))
    facts.append("Vzdálenosti: " + ("; ".join(distances) if distances else "neuvedeny"))
    facts.append("Stravování (z nabídky hotelu): " + ("; ".join(food) if food else "neuvedeno"))
    if includes:
        facts.append("V ceně zájezdu: " + "; ".join(includes))
    if desc:
        facts.append("Popis od cestovní kanceláře (jen podklad, přeformuluj vlastními slovy, nekopíruj věty): " + desc)
    prices = [f"Nejnižší cena zájezdu: {kc(h['min_price'])} na osobu"
              + (f", nejvyšší {kc(h['max_price'])}" if h["max_price"] and h["max_price"] > h["min_price"] else ""),
              f"Počet volných termínů: {h['available_dates'] or 0}"]
    for r in tour_rows[:5]:
        dur = f"{r['dmin']}–{r['dmax']} nocí" if r["dmin"] != r["dmax"] else f"{r['dmin']} nocí"
        prices.append(f"Strava {r['meal_plan'] or 'neuvedena'}: {r['n']} termínů, {dur}, odlety {r['first']} až {r['last']}")
    if cities:
        prices.append("Odlety z: " + ", ".join(cities))

    review = f"{h['review_score']:.1f} z 10" if h["review_score"] else "zatím bez hodnocení"
    stars = f"{h['stars']} hvězdy" if h["stars"] else "bez hvězdiček"
    p = generate("hotel", load_prompt(conn, "hotel", name=h["name"], place=place or "neuvedena", stars=stars, review=review,
                                       facts="\n".join(facts), prices="\n".join(prices)))
    if not p:
        return False
    summary = clean_paragraphs(p.get("summary"), 900, 1600)
    if len(summary) < 120:
        return False
    conn.cursor().execute(
        """INSERT INTO hotel_ai (slug, summary, audience, highlights, watch_out, location, food, faq, generated_at)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW())
           ON CONFLICT (slug) DO UPDATE SET summary = EXCLUDED.summary, audience = EXCLUDED.audience,
             highlights = EXCLUDED.highlights, watch_out = EXCLUDED.watch_out, location = EXCLUDED.location,
             food = EXCLUDED.food, faq = EXCLUDED.faq, generated_at = NOW()""",
        (h["slug"], summary, js(clean_audience(p.get("audience"), 4)), js(clean_strs(p.get("highlights"), 6, 90)),
         js(clean_strs(p.get("watch_out"), 4, 130)), _clean_text(p.get("location"), 400), _clean_text(p.get("food"), 400),
         js(clean_faq(p.get("faq"), 4))),
    )
    conn.commit()
    return True


# ---- destinace: kdy jet, pro koho, rozpočet ----

def _dest_match(name):
    like = f"%{name}%"
    return "(h.destination ILIKE %s OR h.resort_town ILIKE %s OR h.country ILIKE %s)", [like, like, like]


def dest_stats(conn, name):
    cond, params = _dest_match(name)
    s = rows(conn, f"""SELECT COUNT(DISTINCT h.id) AS hotels, MIN(t.price) AS minp
                       FROM tours t JOIN hotels h ON h.id = t.hotel_id
                       WHERE t.price > 0 AND t.departure_date >= CURRENT_DATE::text AND {CANON} AND {cond}""", params)[0]
    if not s["hotels"]:
        return None
    per_hotel = sorted(float(r["m"]) for r in rows(conn, f"""SELECT MIN(t.price) AS m FROM tours t JOIN hotels h ON h.id = t.hotel_id
        WHERE t.price > 0 AND t.departure_date >= CURRENT_DATE::text AND {CANON} AND {cond} GROUP BY h.id""", params))
    monthly = {int(r["m"]): float(r["minp"]) for r in rows(conn, f"""SELECT substr(t.departure_date, 6, 2) AS m, MIN(t.price) AS minp
        FROM tours t JOIN hotels h ON h.id = t.hotel_id
        WHERE t.price > 0 AND t.departure_date >= CURRENT_DATE::text AND {CANON} AND {cond} GROUP BY 1""", params)}
    stats = {"hotels": int(s["hotels"]), "min_price": float(s["minp"]), "median_price": per_hotel[len(per_hotel) // 2],
             "monthly": {str(k): v for k, v in sorted(monthly.items())}}
    if len(monthly) >= 3:
        stats["cheapest_month"] = min(monthly, key=monthly.get)
        stats["priciest_month"] = max(monthly, key=monthly.get)
    return stats


def todo_destination_seo(conn):
    ensure_seo_tables(conn)
    have = {r["name"] for r in rows(conn, "SELECT name FROM destination_seo")}
    fresh = {r["name"] for r in rows(conn, "SELECT name FROM destination_seo WHERE generated_at > NOW() - make_interval(days => %s)", (REFRESH_DAYS,))}
    # země a oblasti (střediska mají jen krátký text z průvodce); nejdřív chybějící, pak zastaralé
    names = geo_names(conn, False)
    return [n for n in names if n not in have] + [n for n in names if n in have and n not in fresh]


def run_destination_seo(conn, name):
    st = dest_stats(conn, name)
    if not st or st["hotels"] < 3:
        # málo dat na poctivý text: uložíme prázdný záznam, ať se destinace neopakuje v každém běhu
        conn.cursor().execute("""INSERT INTO destination_seo (name, stats) VALUES (%s, %s)
                                 ON CONFLICT (name) DO UPDATE SET stats = EXCLUDED.stats, generated_at = NOW()""", (name, js(st or {})))
        conn.commit()
        return True
    cond, params = _dest_match(name)
    ctry = rows(conn, f"SELECT h.country, COUNT(*) AS n FROM hotels h WHERE {cond} GROUP BY h.country ORDER BY n DESC LIMIT 1", params)
    country = ctry[0]["country"] if ctry else None
    is_country = bool(country) and slugify(country) == slugify(name)
    resorts = [r["resort_town"] for r in rows(conn, f"""SELECT h.resort_town, COUNT(*) AS n FROM hotels h
        WHERE {cond} AND h.resort_town IS NOT NULL GROUP BY 1 ORDER BY n DESC LIMIT 10""", params)]
    # podobné destinace: jiné země (u země) nebo jiné oblasti téže země
    if is_country:
        sim = [r["country"] for r in rows(conn, f"""SELECT h.country, COUNT(*) AS n FROM hotels h JOIN hotel_stats s ON s.hotel_id = h.id
            WHERE s.next_departure >= CURRENT_DATE::text AND h.country IS NOT NULL AND h.country <> %s AND {CANON}
            GROUP BY 1 ORDER BY n DESC LIMIT 5""", (country,))]
    else:
        sim = [r["reg"] for r in rows(conn, f"""SELECT btrim(split_part(h.destination, '/', 2)) AS reg, COUNT(*) AS n
            FROM hotels h JOIN hotel_stats s ON s.hotel_id = h.id
            WHERE s.next_departure >= CURRENT_DATE::text AND h.country = %s AND h.destination LIKE '%%/%%' AND {CANON}
              AND btrim(split_part(h.destination, '/', 2)) NOT ILIKE %s
            GROUP BY 1 ORDER BY n DESC LIMIT 5""", (country, f"%{name}%")) if r["reg"]]
    sim = [x for x in sim if x and not NON_GEO.search(x)][:4]

    lines = [f"Počet hotelů s volným termínem: {st['hotels']}", f"Nejnižší cena zájezdu: {kc(st['min_price'])} na osobu",
             f"Typická cena (medián nejnižších cen hotelů): {kc(st['median_price'])} na osobu"]
    if st["monthly"]:
        lines.append("Nejnižší cena zájezdu podle měsíce odletu: "
                     + "; ".join(f"{MONTHS[int(m) - 1]} {kc(v)}" for m, v in st["monthly"].items()))
    if "cheapest_month" in st:
        lines.append(f"Nejlevnější měsíc: {MONTHS[st['cheapest_month'] - 1]}; nejdražší: {MONTHS[st['priciest_month'] - 1]}")
    p = generate("destination_seo", load_prompt(conn, "destination_seo", name=name,
                                                 country=f" ({country})" if country and not is_country else "",
                                                 stats="\n".join(lines), resorts=", ".join(resorts) or "neuvedena",
                                                 similar=", ".join(sim) or "žádná, srovnání vynech"))
    if not p:
        return False
    months, seen = [], set()
    for it in (p.get("months") if isinstance(p.get("months"), list) else []):
        if not isinstance(it, dict):
            continue
        m, txt = it.get("month"), _clean_text(it.get("text"), 260)
        if isinstance(m, int) and 1 <= m <= 12 and m not in seen and txt and len(txt) >= 15:
            seen.add(m)
            r = it.get("rating") if it.get("rating") in ("top", "dobre", "prumer", "slabe") else "prumer"
            months.append({"month": m, "rating": r, "text": txt})
    months.sort(key=lambda x: x["month"])
    if len(months) != 12:
        return False  # neúplná tabulka měsíců by na webu působila nedůvěryhodně
    cmp_ = p.get("comparison") if isinstance(p.get("comparison"), dict) else None
    comparison = None
    if cmp_ and _clean_text(cmp_.get("with"), 80) in sim and len(_clean_text(cmp_.get("text"), 600) or "") >= 40:
        comparison = {"with": _clean_text(cmp_["with"], 80), "text": _clean_text(cmp_["text"], 600)}
    conn.cursor().execute(
        """INSERT INTO destination_seo (name, months, audiences, budget, comparison, faq, stats, generated_at)
           VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
           ON CONFLICT (name) DO UPDATE SET months = EXCLUDED.months, audiences = EXCLUDED.audiences, budget = EXCLUDED.budget,
             comparison = EXCLUDED.comparison, faq = EXCLUDED.faq, stats = EXCLUDED.stats, generated_at = NOW()""",
        (name, js(months), js(clean_audience(p.get("audiences"), 4, 420)), clean_paragraphs(p.get("budget")) or None,
         js(comparison) if comparison else None, js(clean_faq(p.get("faq"), 5, 520)), js(st)),
    )
    conn.commit()
    return True


# ---- vstupní stránky (All Inclusive Egypt, 5hvězdičkové hotely Turecko, Řecko v září …) ----

MEAL_TYPES = [("All Inclusive", "all-inclusive", "All Inclusive zájezdy"),
              ("Polopenze", "polopenze", "Zájezdy s polopenzí"),
              ("Snídaně", "snidane", "Zájezdy se snídaní")]
STAR_TYPES = [("5", "5-hvezdickove-hotely", "5hvězdičkové hotely"), ("4", "4-hvezdickove-hotely", "4hvězdičkové hotely")]


def landing_cond(c):
    cond, params = [], []
    if c["country"]:
        cond.append("h.country = %s")
        params.append(c["country"])
    if c["type"] == "meal":
        cond.append("t.meal_plan = %s")
        params.append(c["value"])
    elif c["type"] == "stars":
        cond.append("h.stars = %s")
        params.append(int(c["value"]))
    elif c["type"] == "month":
        cond.append("substr(t.departure_date, 1, 7) = %s")
        params.append(c["ym"])
    return (" AND " + " AND ".join(cond)) if cond else "", params


def landing_title(c):
    if c["type"] == "month":
        m = MONTHS_IN[int(c["value"]) - 1]
        return f"{c['country']} v {m}" if c["country"] else f"Zájezdy v {m}"
    return f"{c['label']} {c['country']}" if c["country"] else c["label"]


def landing_candidates(conn):
    """Kombinace typ × země, které mají dost hotelů s volným termínem (jinak by stránka byla tenká)."""
    base = f"t.price > 0 AND t.departure_date >= CURRENT_DATE::text AND {CANON}"
    out = []
    ym_now = time.strftime("%Y-%m")
    horizon = time.strftime("%Y-%m", time.localtime(time.time() + 330 * 86400))
    mealmap = {v: (slug, label) for v, slug, label in MEAL_TYPES}
    starmap = {v: (slug, label) for v, slug, label in STAR_TYPES}

    for r in rows(conn, f"""SELECT h.country, t.meal_plan, COUNT(DISTINCT h.id) AS n FROM tours t JOIN hotels h ON h.id = t.hotel_id
                            WHERE {base} AND h.country IS NOT NULL GROUP BY 1, 2"""):
        if r["meal_plan"] in mealmap and r["n"] >= MIN_LANDING_HOTELS:
            slug, label = mealmap[r["meal_plan"]]
            out.append({"type": "meal", "value": r["meal_plan"], "type_slug": slug, "label": label, "country": r["country"], "n": r["n"]})
    for r in rows(conn, f"SELECT t.meal_plan, COUNT(DISTINCT h.id) AS n FROM tours t JOIN hotels h ON h.id = t.hotel_id WHERE {base} GROUP BY 1"):
        if r["meal_plan"] in mealmap and r["n"] >= MIN_LANDING_HOTELS:
            slug, label = mealmap[r["meal_plan"]]
            out.append({"type": "meal", "value": r["meal_plan"], "type_slug": slug, "label": label, "country": None, "n": r["n"]})

    for r in rows(conn, f"""SELECT h.country, h.stars, COUNT(DISTINCT h.id) AS n FROM hotels h JOIN hotel_stats s ON s.hotel_id = h.id
                            WHERE s.next_departure >= CURRENT_DATE::text AND {CANON} AND h.country IS NOT NULL AND h.stars IN (4, 5)
                            GROUP BY 1, 2"""):
        v = str(r["stars"])
        if v in starmap and r["n"] >= MIN_LANDING_HOTELS:
            slug, label = starmap[v]
            out.append({"type": "stars", "value": v, "type_slug": slug, "label": label, "country": r["country"], "n": r["n"]})
    for r in rows(conn, f"""SELECT h.stars, COUNT(DISTINCT h.id) AS n FROM hotels h JOIN hotel_stats s ON s.hotel_id = h.id
                            WHERE s.next_departure >= CURRENT_DATE::text AND {CANON} AND h.stars IN (4, 5) GROUP BY 1"""):
        v = str(r["stars"])
        if v in starmap and r["n"] >= MIN_LANDING_HOTELS:
            slug, label = starmap[v]
            out.append({"type": "stars", "value": v, "type_slug": slug, "label": label, "country": None, "n": r["n"]})

    # měsíce: každý měsíc v nejbližších ~11 měsících (stránka ukazuje vždy nejbližší výskyt měsíce)
    for r in rows(conn, f"""SELECT h.country, substr(t.departure_date, 1, 7) AS ym, COUNT(DISTINCT h.id) AS n FROM tours t JOIN hotels h ON h.id = t.hotel_id
                            WHERE {base} AND h.country IS NOT NULL GROUP BY 1, 2"""):
        if ym_now <= r["ym"] <= horizon and r["n"] >= MIN_LANDING_HOTELS:
            out.append({"type": "month", "value": str(int(r["ym"][5:7])), "label": "", "country": r["country"], "n": r["n"], "ym": r["ym"]})
    for r in rows(conn, f"SELECT substr(t.departure_date, 1, 7) AS ym, COUNT(DISTINCT h.id) AS n FROM tours t JOIN hotels h ON h.id = t.hotel_id WHERE {base} GROUP BY 1"):
        if ym_now <= r["ym"] <= horizon and r["n"] >= MIN_LANDING_HOTELS:
            out.append({"type": "month", "value": str(int(r["ym"][5:7])), "label": "", "country": None, "n": r["n"], "ym": r["ym"]})

    for c in out:
        cs = slugify(c["country"]) if c["country"] else ""
        if c["type"] == "month":
            m = slugify(MONTHS_IN[int(c["value"]) - 1])
            c["slug"] = f"{cs}-v-{m}" if cs else f"zajezdy-v-{m}"
        else:
            c["slug"] = f"{c['type_slug']}-{cs}" if cs else c["type_slug"]
    uniq = {}
    for c in sorted(out, key=lambda c: -c["n"]):
        if c["slug"] and not c["slug"].startswith("-"):
            uniq.setdefault(c["slug"], c)
    return list(uniq.values())


def todo_landing(conn):
    ensure_seo_tables(conn)
    have = {r["slug"] for r in rows(conn, "SELECT slug FROM landing_ai")}
    fresh = {r["slug"] for r in rows(conn, "SELECT slug FROM landing_ai WHERE generated_at > NOW() - make_interval(days => %s) AND generated_at > %s::timestamptz",
                                     (REFRESH_DAYS, PROMPT_CUTOFF))}
    cands = landing_candidates(conn)
    # nejdřív přehledy se zastaralým textem (je jich málo), pak nové; globální přehled aktuálního a příštího měsíce
    # má přednost (aktuální měsíc je v hlavním menu webu: „Zájezdy v listopadu“)
    this_m = int(time.strftime("%m"))
    soon = {this_m, this_m % 12 + 1}
    def prio(c):
        return 0 if (c["type"] == "month" and not c["country"] and int(c["value"]) in soon) else 1
    stale = [c for c in cands if c["slug"] in have and c["slug"] not in fresh]
    new = [c for c in cands if c["slug"] not in have]
    return sorted(stale, key=prio) + sorted(new, key=prio)


def run_landing(conn, c):
    where, params = landing_cond(c)
    base = f"t.price > 0 AND t.departure_date >= CURRENT_DATE::text AND {CANON}"
    s = rows(conn, f"SELECT COUNT(DISTINCT h.id) AS n, MIN(t.price) AS minp, MAX(t.price) AS maxp FROM tours t JOIN hotels h ON h.id = t.hotel_id WHERE {base}{where}", params)[0]
    if not s["n"] or s["n"] < MIN_LANDING_HOTELS:
        return True  # mezitím ubylo termínů; stránka nevznikne
    tops = rows(conn, f"""SELECT h.name, h.resort_town, h.stars, MIN(t.price) AS minp FROM tours t JOIN hotels h ON h.id = t.hotel_id
                          WHERE {base}{where} GROUP BY h.id, h.name, h.resort_town, h.stars ORDER BY COUNT(*) DESC LIMIT 6""", params)
    title = landing_title(c)
    where_txt = f" v destinaci {c['country']}" if c["country"] else " do všech destinací"
    if c["type"] == "meal":
        about = f"Zájezdy se stravováním {c['value']}{where_txt}"
    elif c["type"] == "stars":
        about = f"{c['value']}hvězdičkové hotely{where_txt}"
    else:
        mon = MONTHS[int(c["value"]) - 1]
        about = f"Zájezdy{' do destinace ' + c['country'] if c['country'] else ''} s odletem v měsíci {mon} (nejbližší termíny: {c['ym']})"
    stats = [f"Počet hotelů s volným termínem: {s['n']}", f"Nejnižší cena zájezdu: {kc(s['minp'])} na osobu",
             f"Nejvyšší cena zájezdu: {kc(s['maxp'])} na osobu"]
    hotels = "\n".join(
        f"- {r['name']} ({', '.join(x for x in [r['resort_town'], (str(r['stars']) + '*') if r['stars'] else None] if x)}), od {kc(r['minp'])}"
        for r in tops)
    p = generate("landing", load_prompt(conn, "landing", title=title, about=about, stats="\n".join(stats), hotels=hotels))
    if not p:
        return False
    intro = clean_paragraphs(p.get("intro"), 1000, 2200)
    if len(intro) < 150:
        return False
    sections = []
    for it in (p.get("sections") if isinstance(p.get("sections"), list) else [])[:3]:
        if isinstance(it, dict) and _clean_text(it.get("heading"), 70) and len(_clean_text(it.get("text"), 700) or "") >= 40:
            sections.append({"heading": _clean_text(it["heading"], 70), "text": _clean_text(it["text"], 700)})
    conn.cursor().execute(
        """INSERT INTO landing_ai (slug, type, value, country, title, intro, sections, faq, hotel_count, min_price, generated_at)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
           ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, intro = EXCLUDED.intro, sections = EXCLUDED.sections,
             faq = EXCLUDED.faq, hotel_count = EXCLUDED.hotel_count, min_price = EXCLUDED.min_price, generated_at = NOW()""",
        (c["slug"], c["type"], c["value"], c["country"], title, intro, js(sections), js(clean_faq(p.get("faq"), 4)),
         int(s["n"]), float(s["minp"])),
    )
    conn.commit()
    return True


KINDS = {
    "article": (todo_article, run_article, lambda x: x),
    "destination": (todo_destination, run_destination, lambda x: x),
    "weather": (todo_weather, run_weather, lambda x: x),
    "car_rental": (todo_car_rental, run_car_rental, lambda d: f"{d['name']} ({d['country']})"),
    "guide": (todo_guide, run_guide, lambda d: f"{d['name']} ({d['country']})"),
    "guide_images": (todo_guide_images, run_guide_images, lambda g: g["name"]),
    # pořadí = pořadí zpracování; hotelů jsou tisíce, proto až poslední (jinak by zablokovaly menší druhy obsahu)
    "destination_seo": (todo_destination_seo, run_destination_seo, lambda n: n),
    "landing": (todo_landing, run_landing, lambda c: c["slug"]),
    "hotel": (todo_hotel, run_hotel, lambda h: f"{h['name']} ({h['country']})"),
}


def revalidate():
    site, secret = os.environ.get("SITE_URL", "").rstrip("/"), os.environ.get("REVALIDATE_SECRET", "")
    if not site or not secret:
        log.warning("SITE_URL / REVALIDATE_SECRET nejsou nastaveny, cache webu se obnoví sama podle TTL")
        return
    try:
        requests.post(f"{site}/api/revalidate", json={"tag": "api", "secret": secret}, timeout=15)
        log.info("cache webu obnovena")
    except Exception as e:
        log.warning("revalidace selhala: %s", e)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", choices=list(KINDS), action="append", help="jen tento druh (lze opakovat)")
    ap.add_argument("--limit", type=int, default=0, help="nejvýše tolik položek za běh (0 = bez limitu)")
    ap.add_argument("--max-minutes", type=float, default=300, help="po uplynutí času už nezačínat další položku")
    args = ap.parse_args()

    if not os.environ.get("GEMINI_API_KEY"):
        log.error("GEMINI_API_KEY není nastaven")
        return 1

    started = time.time()
    conn = db._connect()
    kinds = args.only or [k for k in KINDS if k != "guide_images"]  # fotky běží samostatně (hodinový limit Unsplash)
    queue = []
    for k in kinds:
        todo, run, label = KINDS[k]
        items = todo(conn)
        log.info("%s: chybí %d", k, len(items))
        queue += [(k, run, label(i), i) for i in items]
    if args.limit:
        queue = queue[: args.limit]

    done = failed = 0
    skipped_429 = 0
    for n, (kind, run, label, item) in enumerate(queue, start=1):
        if time.time() - started > args.max_minutes * 60:
            log.info("vypršel časový limit, zbývá %d položek na příští běh", len(queue) - n + 1)
            break
        log.info("[%d/%d] %s → %s", n, len(queue), kind, label)
        try:
            ok = run(conn, item)
        except QuotaExhausted:
            conn.rollback()
            log.info("limit Unsplash API na tuto hodinu vyčerpán, další hodinový běh naváže")
            if kind == "guide_images":
                continue  # fotky z Wikimedia Commons limit nemají, ostatní průvodci se zpracují
            break
        except Exception as e:
            conn.rollback()
            log.error("chyba: %s", e)
            ok = False
        if ok:
            done += 1
            skipped_429 = 0
        else:
            failed += 1
            skipped_429 += 1
            if skipped_429 >= 3:
                log.error("3 neúspěchy po sobě (pravděpodobně vyčerpaný limit Gemini), končím; další běh naváže")
                break
        flush_usage(conn)
        time.sleep(PAUSE)

    flush_usage(conn)
    log.info("hotovo: %d vygenerováno, %d neúspěšných", done, failed)
    if done or (args.only and "guide_images" in args.only and queue):
        revalidate()
    if failed and not done:
        log.error("nic se nevygenerovalo – zkontroluj GEMINI_API_KEY a kredit u Googlu")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
