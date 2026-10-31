"""
Generování AI obsahu (Google Gemini) – náhrada za fronty ve starém Express backendu na Railway.

Spouští se z GitHub Actions (.github/workflows/ai.yml) nebo ručně:
    python ai_generate.py                      # všechno, co chybí
    python ai_generate.py --only destination   # article | destination | weather | car_rental
    python ai_generate.py --limit 10           # nejvýše 10 položek za běh

Prompty se berou z tabulky ai_prompts (úpravy v administraci, sekce Prompty);
když v DB chybí, použije se výchozí znění z frontend/src/server/promptDefaults.json.
Hotový obsah se nikdy nepřepisuje – generuje se jen to, co v DB ještě není.

Env: DATABASE_URL, GEMINI_API_KEY, volitelně AI_PAUSE (s mezi voláními, výchozí 35),
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
}


class RateLimited(Exception):
    pass


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
        cand = (r.json().get("candidates") or [{}])[0]
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


def run_article(conn, topic):
    p = generate("article", load_prompt(conn, "article", topic=topic))
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
         p.get("excerpt") or None, p["content"], p.get("reading_time") or 5),
    )
    conn.commit()
    return True


KINDS = {
    "article": (todo_article, run_article, lambda x: x),
    "destination": (todo_destination, run_destination, lambda x: x),
    "weather": (todo_weather, run_weather, lambda x: x),
    "car_rental": (todo_car_rental, run_car_rental, lambda d: f"{d['name']} ({d['country']})"),
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
    kinds = args.only or list(KINDS)
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
        time.sleep(PAUSE)

    log.info("hotovo: %d vygenerováno, %d neúspěšných", done, failed)
    if done:
        revalidate()
    return 0


if __name__ == "__main__":
    sys.exit(main())
