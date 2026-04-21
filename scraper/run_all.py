#!/usr/bin/env python3
"""
run_all.py — Orchestrátor scraperů pro zaleto.cz

Spouští všechny scrapery sekvenčně, po každém cyklu odesílá report e-mailem
a spouští párování hotelů napříč cestovkami (canonical_slug).
Navrženo pro nasazení na Railway (infinite loop).

Použití:
    python run_all.py                  # produkce — infinite loop
    python run_all.py --once           # jednorázový běh a konec
    python run_all.py --skip-email     # bez emailu (test)

Povinné env vars pro Railway:
    DATABASE_PATH      cesta k zaleto.db (default: ../data/zaleto.db)
    SMTP_HOST          SMTP server (např. smtp.gmail.com)
    SMTP_USER          SMTP login / odesílatel
    SMTP_PASS          SMTP heslo nebo App Password
    REPORT_TO          příjemce reportů (čárkou oddělené adresy)

Volitelné env vars:
    SMTP_PORT          SMTP port (default: 587)
    REPORT_FROM        odesílatel (default = SMTP_USER)
    SCRAPE_INTERVAL_H  interval mezi cykly v hodinách (default: 12)
    SCRAPER_DELAY      pauza mezi HTTP požadavky ve scraperech (default: 1.5)
"""

import argparse
import concurrent.futures
import logging
import os
import signal
import smtplib
from db import open_db, DATABASE_URL
import subprocess
import sys
import threading
import time
import traceback
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

import requests

# Načti .env lokálně (Railway používá env vars přímo, .env jen pro vývoj)
_env_file = Path(__file__).resolve().parent / ".env"
if _env_file.exists():
    try:
        from dotenv import load_dotenv
        load_dotenv(_env_file)
    except ImportError:
        # python-dotenv není nainstalován — parsuj ručně
        for _line in _env_file.read_text(encoding="utf-8").splitlines():
            _line = _line.strip()
            if _line and not _line.startswith("#") and "=" in _line:
                _k, _, _v = _line.partition("=")
                os.environ.setdefault(_k.strip(), _v.strip())
# ---------------------------------------------------------------------------
# Konfigurace z env vars
# ---------------------------------------------------------------------------

BASE_DIR   = Path(__file__).resolve().parent

RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
SMTP_HOST    = os.environ.get("SMTP_HOST", "")
SMTP_PORT    = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER    = os.environ.get("SMTP_USER", "")
SMTP_PASS    = os.environ.get("SMTP_PASS", "")
REPORT_TO    = [e.strip() for e in os.environ.get("REPORT_TO", "").split(",") if e.strip()]
REPORT_FROM  = os.environ.get("REPORT_FROM", SMTP_USER)
INTERVAL_H        = float(os.environ.get("SCRAPE_INTERVAL_H", "12"))
SCRAPER_DELAY     = float(os.environ.get("SCRAPER_DELAY", "1.5"))
# Kolik hodin zpět se bere checkpoint za platný (default 14h).
# CK se přeskočí, pokud od posledního úspěšného doběhnutí neuplynulo víc než
# SCRAPE_CHECKPOINT_HOURS hodin — ochrana proti double-run v rámci jednoho cyklu.
# Hodnota by měla být o něco větší než SCRAPE_INTERVAL_H (12h), ale menší než 2× interval.
CHECKPOINT_HOURS  = int(os.environ.get("SCRAPE_CHECKPOINT_HOURS", "14"))
# Maximální počet scraperů běžících paralelně.
# 0 = neomezeno (všechny najednou). Výchozí: 3 (Fischer + Čedok + TUI souběžně,
# Exim + Nev-Dama se přidají jakmile je slot volný).
# Výchozí limit 3: každý scraper drží 1 DB conn + 1 background refresh conn = 2 na scraper.
# 3 scrapery = 6 conn + 1 run_all main + ~10 backend pool = ~17 → pod Railway limitem (~25).
# Nastav MAX_PARALLEL_SCRAPERS=0 pro neomezený běh (riziko connection timeout).
MAX_PARALLEL = int(os.environ.get("MAX_PARALLEL_SCRAPERS", "3"))
# Počet paralelních workerů uvnitř každého scraperu (update-only mód).
# Fischer/Exim/Nev-Dama otevřou tolik paralelních HTTP spojení najednou.
# 0 = výchozí (1 — sekvenční). Doporučeno: 3–5.
SCRAPER_WORKERS = int(os.environ.get("SCRAPER_WORKERS", "0"))

# GPS tolerance pro párování hotelů (~55 m na rovníku)
# Různé CK mohou reportovat GPS téhož hotelu s odchylkou do ~50 m.
# Hodnota 0.0005° je kompromis: chytí shody napříč CK, ale nespojí sousední hotely.
GPS_TOLERANCE = 0.0005

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("run_all")

# ---------------------------------------------------------------------------
# Definice scraperů
# ---------------------------------------------------------------------------

def _worker_args() -> list[str]:
    """Přidá --workers pouze pokud je SCRAPER_WORKERS > 0."""
    if SCRAPER_WORKERS > 0:
        return ["--workers", str(SCRAPER_WORKERS)]
    return []


SCRAPERS: list[dict] = [
    {
        "agency":     "Fischer",
        "module":     "fischer.py",
        "args":       ["--delay", str(SCRAPER_DELAY)] + _worker_args(),
    },
    {
        "agency":     "Exim Tours",
        "module":     "eximtours.py",
        "args":       ["--delay", str(SCRAPER_DELAY)] + _worker_args(),
    },
    {
        "agency":     "Nev-Dama",
        "module":     "nevdama.py",
        "args":       ["--delay", str(SCRAPER_DELAY)] + _worker_args(),
    },
    {
        "agency":     "Blue Style",
        "module":     "bluestyle.py",
        "args":       [],   # delay: výchozí 2.0s (definován v bluestyle.py)
    },
    {
        "agency":     "Čedok",
        "module":     "cedok.py",
        "args":       ["--delay", str(SCRAPER_DELAY)],
    },
    {
        "agency":     "TUI",
        "module":     "tui.py",
        "args":       ["--delay", str(SCRAPER_DELAY)],
    },
]

# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

# open_db() je importováno z db.py


# ---------------------------------------------------------------------------
# Checkpoint — přežije restart kontejneru (deploy)
# ---------------------------------------------------------------------------

FULL_SCRAPE_DAYS = 14   # po kolika dnech se spustí plný scrape (Fischer / Exim)
UPDATE_ONLY_AGENCIES = {"Fischer", "Exim Tours"}  # CK podporující --update-only

def ensure_checkpoint_table(conn):
    conn.execute("""
        CREATE TABLE IF NOT EXISTS scraper_checkpoints (
            agency       TEXT NOT NULL,
            cycle_date   TEXT NOT NULL,
            completed_at TEXT NOT NULL,
            PRIMARY KEY (agency, cycle_date)
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS hotel_checkpoints (
            agency     TEXT NOT NULL,
            key        TEXT NOT NULL,
            cycle_date TEXT NOT NULL,
            PRIMARY KEY (agency, key, cycle_date)
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS scraper_full_scrapes (
            agency       TEXT PRIMARY KEY,
            completed_at TEXT NOT NULL
        )
    """)
    conn.commit()


def last_full_scrape_date(conn, agency: str) -> datetime | None:
    """Vrátí datum posledního plného scrape dané CK, nebo None."""
    row = conn.execute(
        "SELECT completed_at FROM scraper_full_scrapes WHERE agency = ?", (agency,)
    ).fetchone()
    if not row:
        return None
    try:
        return datetime.strptime(row["completed_at"], "%Y-%m-%d %H:%M:%S")
    except Exception:
        return None


def mark_full_scrape(conn, agency: str):
    """Zaznamená úspěšný plný scrape dané CK."""
    conn.execute(
        "INSERT INTO scraper_full_scrapes (agency, completed_at) VALUES (?, ?) "
        "ON CONFLICT (agency) DO UPDATE SET completed_at = EXCLUDED.completed_at",
        (agency, datetime.now().strftime("%Y-%m-%d %H:%M:%S")),
    )
    conn.commit()


def get_recently_completed(conn) -> set:
    """
    Vrátí CK, které úspěšně dokončily scraping v posledních CHECKPOINT_HOURS hodinách.
    Nezávislé na kalendářním dni — Fischer může trvat přes půlnoc.
    """
    from datetime import timedelta
    threshold = (datetime.now() - timedelta(hours=CHECKPOINT_HOURS)).strftime("%Y-%m-%d %H:%M:%S")
    rows = conn.execute(
        "SELECT agency FROM scraper_checkpoints WHERE completed_at >= ?", (threshold,)
    ).fetchall()
    return {r["agency"] for r in rows}


def mark_completed(conn, agency: str):
    today = datetime.now().strftime("%Y-%m-%d")
    conn.execute(
        "INSERT INTO scraper_checkpoints (agency, cycle_date, completed_at) "
        "VALUES (?, ?, ?) ON CONFLICT (agency, cycle_date) DO UPDATE SET completed_at = EXCLUDED.completed_at",
        (agency, today, datetime.now().strftime("%Y-%m-%d %H:%M:%S")),
    )
    conn.commit()


def clear_checkpoints(conn):
    """Smaže checkpointy starší než 2× CHECKPOINT_HOURS (min. 48 h)."""
    keep_h = max(CHECKPOINT_HOURS * 2, 48)
    from datetime import timedelta
    threshold = (datetime.now() - timedelta(hours=keep_h)).strftime("%Y-%m-%d %H:%M:%S")
    conn.execute(
        "DELETE FROM scraper_checkpoints WHERE completed_at < ?", (threshold,)
    )
    try:
        cycle_threshold = (datetime.now() - timedelta(hours=keep_h)).strftime("%Y-%m-%d")
        conn.execute(
            "DELETE FROM hotel_checkpoints WHERE cycle_date < ?", (cycle_threshold,)
        )
    except Exception:
        pass
    conn.commit()


def _db_now(conn) -> datetime:
    """Vrátí aktuální čas PostgreSQL serveru (tz-naive) — konzistentní s updated_at = NOW()."""
    try:
        row = conn.execute("SELECT NOW() AT TIME ZONE 'UTC' AS t").fetchone()
        t = row["t"]
        if hasattr(t, "tzinfo") and t.tzinfo is not None:
            from datetime import timezone as _tz
            return t.astimezone(_tz.utc).replace(tzinfo=None)
        return t if isinstance(t, datetime) else datetime.now()
    except Exception:
        return datetime.now()


def get_counts(conn, agency: str) -> dict:
    """Vrátí počty hotelů a termínů pro danou CK."""
    h = conn.execute(
        "SELECT COUNT(*) AS n FROM hotels WHERE agency = ?", (agency,)
    ).fetchone()["n"]
    t = conn.execute(
        "SELECT COUNT(*) AS n FROM tours WHERE agency = ?", (agency,)
    ).fetchone()["n"]
    return {"hotels": h, "tours": t}


def ensure_canonical_slug(conn):
    """Inicializuje canonical_slug pro hotely kde chybí."""
    conn.execute(
        "UPDATE hotels SET canonical_slug = slug "
        "WHERE canonical_slug IS NULL OR canonical_slug = ''"
    )
    conn.commit()


def purge_expired_tours(conn) -> int:
    """Smaže termíny s datem odjezdu v minulosti. Vrátí počet smazaných."""
    cur = conn.execute(
        "DELETE FROM tours WHERE departure_date < CURRENT_DATE::text AND departure_date != ''"
    )
    conn.commit()
    return cur.rowcount


# ---------------------------------------------------------------------------
# Párování hotelů napříč CK (canonical_slug)
# ---------------------------------------------------------------------------

def match_hotels(conn) -> int:
    """
    Spáruje fyzicky totožné hotely od různých CK dle GPS souřadnic.

    Hotely do GPS_TOLERANCE stupňů (~220 m) jsou považovány za tentýž hotel.
    Sdílejí canonical_slug nejstaršího záznamu (nejnižší id).
    Vrátí počet spárovaných hotelů (extra záznamy → jeden canonical).
    """
    rows = conn.execute(
        "SELECT id, slug, latitude, longitude FROM hotels "
        "WHERE latitude IS NOT NULL AND longitude IS NOT NULL "
        "ORDER BY id"
    ).fetchall()

    if not rows:
        return 0

    # Union-Find
    parent: dict[int, int] = {r["id"]: r["id"] for r in rows}

    def find(x: int) -> int:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a: int, b: int):
        ra, rb = find(a), find(b)
        if ra != rb:
            # Nižší id (starší záznam) bude kořen
            if ra < rb:
                parent[rb] = ra
            else:
                parent[ra] = rb

    # Sweep-line podle latitude
    sorted_rows = sorted(rows, key=lambda r: r["latitude"])
    for i, a in enumerate(sorted_rows):
        for b in sorted_rows[i + 1:]:
            if b["latitude"] - a["latitude"] > GPS_TOLERANCE:
                break
            if abs(b["longitude"] - a["longitude"]) <= GPS_TOLERANCE:
                union(a["id"], b["id"])

    # canonical_slug = slug kořenového (nejstaršího) záznamu v každé skupině
    id_to_slug = {r["id"]: r["slug"] for r in rows}
    canonical: dict[int, str] = {}
    for hotel_id in id_to_slug:
        root = find(hotel_id)
        canonical.setdefault(root, id_to_slug[root])

    updates = [(canonical[find(r["id"])], r["id"]) for r in rows]
    conn.executemany("UPDATE hotels SET canonical_slug = ? WHERE id = ?", updates)

    # Hotely bez GPS dostanou canonical_slug = vlastní slug
    conn.execute(
        "UPDATE hotels SET canonical_slug = slug "
        "WHERE canonical_slug IS NULL OR canonical_slug = ''"
    )
    conn.commit()

    n_groups   = len({find(r["id"]) for r in rows})
    n_matched  = len(rows) - n_groups
    if n_matched:
        logger.info(
            f"Hotel matching: {len(rows)} hotelů s GPS → "
            f"{n_groups} unikátních skupin, {n_matched} spárováno"
        )
    return n_matched


# ---------------------------------------------------------------------------
# Spuštění jednoho scraperu
# ---------------------------------------------------------------------------

def purge_mislabeled_tours(conn) -> int:
    """
    Odstraní termíny chybně označené jiným scraperem.

    Historická chyba: eximtours.py neobsahoval 'agency' v tour dict, takže
    upsert_tour použil výchozí 'Fischer'. Tyto termíny nikdy nebyly mazány
    (DELETE WHERE agency='Exim Tours' je nenašel) a hromadily se.
    Bezpečné smazat: Exim hotel_id nikdy nenabízí Fischer termíny.
    """
    cur = conn.execute("""
        DELETE FROM tours
        WHERE agency = 'Fischer'
          AND hotel_id IN (SELECT id FROM hotels WHERE agency = 'Exim Tours')
    """)
    conn.commit()
    deleted = cur.rowcount
    if deleted:
        logger.info(f"Cleanup: smazáno {deleted} chybně označených termínů (Exim→Fischer bug)")
    return deleted


def dedup_tours(conn) -> int:
    """
    Odstraní duplicitní termíny pomocí self-join — zachová záznam s nižším id.

    Self-join DELETE je výrazně efektivnější než NOT IN (GROUP BY) na velké tabulce:
    nevytváří obří hash set všech id v paměti a drží lock kratší dobu.

    Duplicity vznikaly kombinací mislabel bugu + nestabilních URL (DF=, cjevent=).
    Po opravě scraperů by se nové duplicity neměly tvořit — tato funkce pak
    projde tabulku rychle (žádný self-join match = žádný DELETE).
    """
    cur = conn.execute("""
        DELETE FROM tours t1
        USING tours t2
        WHERE t1.hotel_id      = t2.hotel_id
          AND t1.agency        = t2.agency
          AND t1.departure_date = t2.departure_date
          AND t1.duration      = t2.duration
          AND t1.meal_plan     = t2.meal_plan
          AND t1.room_code     = t2.room_code
          AND t1.departure_city = t2.departure_city
          AND t1.id > t2.id
    """)
    conn.commit()
    deleted = cur.rowcount
    if deleted:
        logger.info(f"Dedup: odstraněno {deleted} duplicitních termínů")
    return deleted


def purge_stale_tours(conn, agency: str, run_started: datetime) -> int:
    """
    Smaže termíny dané CK, které nebyly aktualizovány v tomto běhu scraperu.

    Každý scraper dělá upsert_tour s updated_at = now(). Termíny, které se
    v aktuálním běhu neobjevily (updated_at < run_started), už CK nenabízí
    — mají tedy zastaralé ceny a musí být smazány.

    Bezpečné pouze při úspěšném dokončení scraperu (returncode == 0).
    """
    threshold = run_started.strftime("%Y-%m-%d %H:%M:%S")
    cur = conn.execute(
        "DELETE FROM tours WHERE agency = ? AND updated_at < ?",
        (agency, threshold),
    )
    conn.commit()
    return cur.rowcount



def run_scraper(scraper: dict, conn=None) -> dict:
    """
    Spustí scraper jako subprocess, změří čas, zachytí výstup a chyby.
    Po úspěšném běhu smaže zastaralé termíny (stale price cleanup).
    Vrátí dict se statistikami.
    """
    agency = scraper["agency"]
    script = str(BASE_DIR / scraper["module"])

    _own_conn = conn is None
    if _own_conn:
        conn = open_db()

    # Fischer / Exim Tours / Nev-Dama: rozhodni full vs update-only
    is_update_only = False
    if agency in UPDATE_ONLY_AGENCIES:
        last_full = last_full_scrape_date(conn, agency)
        if last_full and (datetime.now() - last_full).days < FULL_SCRAPE_DAYS:
            is_update_only = True
            logger.info(
                f"{agency}: poslední plný scrape {last_full.strftime('%Y-%m-%d')} "
                f"({(datetime.now() - last_full).days} dní), spouštím UPDATE-ONLY"
            )
        else:
            logger.info(f"{agency}: spouštím PLNÝ SCRAPE (metadata + termíny)")

    scraper_args = list(scraper["args"])
    if is_update_only:
        scraper_args.append("--update-only")

    cmd = [sys.executable, "-u", script] + scraper_args
    env = {**os.environ, "DATABASE_URL": DATABASE_URL}

    before      = get_counts(conn, agency)
    run_started = _db_now(conn)   # DB čas = stejná reference jako updated_at = NOW()
    started     = time.time()

    result: dict = {
        "agency":         agency,
        "hotels_before":  before["hotels"],
        "tours_before":   before["tours"],
        "hotels_after":   before["hotels"],
        "tours_after":    before["tours"],
        "stale_removed":  0,
        "duration_sec":   0.0,
        "error":          "",
        "log_tail":       "",
    }

    # Background thread — refreshuje hotel_stats každé 2 min během scrape
    _stop_refresh = threading.Event()

    def _bg_refresh():
        while not _stop_refresh.wait(120):
            bg_conn = None
            try:
                bg_conn = open_db()
                refresh_hotel_stats(bg_conn)
                _invalidate_api_cache()
            except Exception:
                pass
            finally:
                if bg_conn:
                    try:
                        bg_conn.close()
                    except Exception:
                        pass

    _refresh_thread = threading.Thread(target=_bg_refresh, daemon=True)
    _refresh_thread.start()

    try:
        logger.info(f"{'─'*55}")
        logger.info(f"Spouštím: {agency}  ({' '.join(cmd[-2:])})")
        logger.info(f"{'─'*55}")

        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
            env=env,
            cwd=str(BASE_DIR),
        )

        # Stream stdout v reálném čase
        captured_lines: list[str] = []

        for line in proc.stdout:
            line = line.rstrip("\n")
            captured_lines.append(line)
            if len(captured_lines) > 5000:
                captured_lines = captured_lines[-2500:]
            logger.info(f"  [{agency}] {line}")

        proc.wait()

        if proc.returncode != 0:
            err_lines = captured_lines or ["neznámá chyba"]
            result["error"] = err_lines[-1][:200] if err_lines else f"exit {proc.returncode}"
            result["log_tail"] = "\n".join(err_lines[-20:])
            logger.error(f"{agency} skončil s kódem {proc.returncode}: {result['error']}")
        else:
            logger.info(f"{agency} dokončen OK")
            # Safety guard: pokud scraper neaktualizoval žádné termíny ale před ním jich bylo hodně
            # → pravděpodobně síťová chyba / prázdná sitemap → zachovej stará data, nemaž je.
            updated_count = conn.execute(
                "SELECT COUNT(*) AS n FROM tours WHERE agency = ? AND updated_at >= ?",
                (agency, run_started.strftime("%Y-%m-%d %H:%M:%S")),
            ).fetchone()["n"]
            if updated_count == 0 and before["tours"] > 100:
                logger.warning(
                    f"{agency}: 0 termínů aktualizováno (síťová chyba? prázdná sitemap?) "
                    f"— přeskakuji purge_stale_tours, stará data ZACHOVÁNA"
                )
                result["stale_removed"] = 0
            elif is_update_only:
                # Update-only navštíví každý hotel, ale hotel může vrátit prázdné availableDates
                # (sezónní výpadek, dočasná chyba API). Mazání by odstranilo platné termíny.
                # Cleanup provedeme až po příštím plném scrape, kdy je zaručeno úplné pokrytí.
                logger.info(f"{agency}: update-only → purge_stale přeskočen (provede příštní full scrape)")
                result["stale_removed"] = 0
            else:
                # Plný scrape: hotely, které scraper nenašel, už CK nenabízí → smaž jejich termíny
                stale = purge_stale_tours(conn, agency, run_started)
                result["stale_removed"] = stale
                if stale:
                    logger.info(f"  Stale cleanup: smazáno {stale} zastaralých termínů ({agency})")
            # Smaž hotel_checkpoints pro tuto CK — cyklus dokončen, pro příští cyklus
            # musíme začít od začátku (checkpointy slouží jen pro crash recovery uvnitř cyklu)
            try:
                conn.execute("DELETE FROM hotel_checkpoints WHERE agency = ?", (agency,))
                conn.commit()
            except Exception:
                pass  # tabulka ještě nemusí existovat při prvním běhu
            # Plný scrape: zaznamej datum jen pokud scraper skutečně aktualizoval data
            if agency in UPDATE_ONLY_AGENCIES and not is_update_only and updated_count > 0:
                mark_full_scrape(conn, agency)
                logger.info(f"{agency}: plný scrape zaznamenán → příštích {FULL_SCRAPE_DAYS} dní bude update-only")
            # Ulož checkpoint — přežije restart kontejneru
            mark_completed(conn, agency)

    except Exception:
        tb = traceback.format_exc()
        result["error"] = tb.splitlines()[-1][:200]
        result["log_tail"] = tb[-2000:]
        logger.exception(f"Chyba při spuštění {agency}")
    finally:
        result["duration_sec"] = time.time() - started
        try:
            after = get_counts(conn, agency)
            result["hotels_after"] = after["hotels"]
            result["tours_after"]  = after["tours"]
        except Exception:
            pass
        _stop_refresh.set()
        _refresh_thread.join(timeout=5)
        if _own_conn:
            try: conn.close()
            except Exception: pass

    h_diff = result["hotels_after"] - result["hotels_before"]
    t_diff = result["tours_after"]  - result["tours_before"]
    logger.info(
        f"{agency}: {result['hotels_after']} hotelů ({h_diff:+d}), "
        f"{result['tours_after']} termínů ({t_diff:+d}), "
        f"{result['duration_sec']:.0f} s"
    )
    return result


# ---------------------------------------------------------------------------
# Email report
# ---------------------------------------------------------------------------

def _invalidate_api_cache(final: bool = False):
    """Zavolá backend endpoint pro invalidaci in-memory cache po dokončení scrapingu."""
    backend = os.environ.get("BACKEND_URL", "http://localhost:3001")
    url = f"{backend}/api/cache/invalidate" + ("?final=1" if final else "")
    try:
        resp = requests.post(url, timeout=5)
        if resp.ok:
            logger.info("Cache: invalidována")
        else:
            logger.warning(f"Cache: invalidace selhala ({resp.status_code})")
    except Exception as e:
        logger.warning(f"Cache: invalidace selhala — {e}")


def _trigger_ai(endpoint: str, label: str) -> int:
    """
    Spustí AI generování na daném endpointu (fire-and-forget).
    Vrátí počet zařazených destinací.
    """
    backend = os.environ.get("BACKEND_URL", "http://localhost:3001")
    try:
        resp = requests.post(f"{backend}{endpoint}", timeout=15)
        resp.raise_for_status()
        data = resp.json()
        queued  = data.get("queued", 0)
        pending = data.get("pending", 0)
        if queued == 0 and pending == 0:
            logger.info(f"{label}: vše již vygenerováno, přeskakuji")
        else:
            logger.info(f"{label}: zařazeno {queued} destinací (celkem čeká {pending}) — generování běží na pozadí")
        return queued
    except Exception as e:
        logger.warning(f"{label}: spuštění selhalo — {e}")
        return 0


def wait_for_ai_generation(timeout_minutes: int = 360):
    """
    Spustí generování AI popisků pro všechny destinace bez popisu a čeká na dokončení.
    Vrátí počet nově zařazených destinací (0 = vše bylo již vygenerováno).
    """
    backend = os.environ.get("BACKEND_URL", "http://localhost:3001")

    # Spusť generování a zjisti, kolik bylo zařazeno do fronty
    try:
        resp = requests.post(f"{backend}/api/destination-ai/generate", timeout=15)
        resp.raise_for_status()
        data = resp.json()
        queued = data.get("queued", 0)
        pending = data.get("pending", 0)
    except Exception as e:
        logger.warning(f"AI generování: spuštění selhalo — {e}")
        return 0

    if queued == 0 and pending == 0:
        logger.info("AI generování: všechny destinace již mají popis, přeskakuji čekání")
        return 0

    logger.info(f"AI generování: zařazeno {queued} destinací do fronty (celkem čeká {pending})")

    # Čekej na dokončení — kontroluj každých 60 s
    deadline = time.time() + timeout_minutes * 60
    last_pending = pending
    while time.time() < deadline:
        if _shutdown:
            logger.info("AI generování: přerušeno (shutdown signál)")
            return queued
        time.sleep(60)
        try:
            status = requests.get(f"{backend}/api/destination-ai/status", timeout=5).json()
            current_pending = status.get("pending", 0)
        except Exception as e:
            logger.warning(f"AI generování: kontrola stavu selhala — {e}")
            continue

        if current_pending != last_pending:
            done = queued - current_pending if current_pending <= queued else 0
            logger.info(f"AI generování: {current_pending} zbývá z {queued} ({done} hotovo)")
            last_pending = current_pending

        if current_pending == 0:
            logger.info(f"AI generování: dokončeno ({queued} destinací)")
            return queued

    logger.warning(f"AI generování: timeout {timeout_minutes} min — pokračuji se scrapingem")


def send_email(subject: str, html: str, text: str):
    """Odešle report — Resend HTTP API (primární) nebo SMTP (fallback)."""
    if not REPORT_TO:
        logger.info("Email: přeskakuji (REPORT_TO není nastaven)")
        return
    if RESEND_API_KEY:
        _send_via_resend(subject, html, text)
    elif SMTP_HOST:
        _send_via_smtp(subject, html, text)
    else:
        logger.info("Email: přeskakuji (není nastaven RESEND_API_KEY ani SMTP_HOST)")


def _send_via_resend(subject: str, html: str, text: str):
    """Resend.com HTTP API — funguje na Railway (SMTP je tam blokováno)."""
    sender = REPORT_FROM or "scraper@zaleto.cz"
    try:
        resp = requests.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {RESEND_API_KEY}", "Content-Type": "application/json"},
            json={"from": sender, "to": REPORT_TO, "subject": subject, "html": html, "text": text},
            timeout=15,
        )
        resp.raise_for_status()
        logger.info(f"Email (Resend): odeslán na {', '.join(REPORT_TO)}")
    except requests.HTTPError as e:
        body = e.response.text[:300] if e.response is not None else ""
        logger.warning(f"Email (Resend): HTTP chyba — {e} | {body}")
    except Exception as e:
        logger.warning(f"Email (Resend): chyba — {e}")


def _send_via_smtp(subject: str, html: str, text: str):
    """SMTP fallback — funguje lokálně, na Railway je port 587/465 blokován."""
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = REPORT_FROM or SMTP_USER
        msg["To"]      = ", ".join(REPORT_TO)
        msg.attach(MIMEText(text, "plain", "utf-8"))
        msg.attach(MIMEText(html, "html",  "utf-8"))
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=30) as s:
            s.ehlo(); s.starttls(); s.ehlo()
            if SMTP_USER:
                s.login(SMTP_USER, SMTP_PASS)
            s.sendmail(msg["From"], REPORT_TO, msg.as_bytes())
        logger.info(f"Email (SMTP): odeslán na {', '.join(REPORT_TO)}")
    except OSError as e:
        logger.warning(f"Email (SMTP): síťová chyba — {e}")
    except Exception as e:
        logger.warning(f"Email (SMTP): chyba — {e}")


def build_report(
    cycle: int,
    started: datetime,
    results: list[dict],
    expired_tours: int,
    matched_hotels: int,
) -> tuple[str, str, str]:
    """Sestaví subject, HTML a plain-text verzi reportu."""
    finished  = datetime.now()
    total_sec = (finished - started).total_seconds()

    errors    = [r for r in results if r.get("error")]
    status    = "ERR" if errors else "OK"

    total_h_diff = sum(r["hotels_after"] - r["hotels_before"] for r in results)
    total_t_diff = sum(r["tours_after"]  - r["tours_before"]  for r in results)

    subject = (
        f"[Zaleto] Cyklus #{cycle} [{status}] — "
        f"{total_h_diff:+d} hotelů, {total_t_diff:+d} termínů"
    )

    # ── HTML ──────────────────────────────────────────────────────────────
    rows_html = ""
    for r in results:
        skipped = r.get("skipped", False)
        icon    = "⏭️" if skipped else ("✅" if not r["error"] else "❌")
        h_diff  = r["hotels_after"]  - r["hotels_before"]
        t_diff  = r["tours_after"]   - r["tours_before"]
        stale   = r.get("stale_removed", 0)
        dur     = "—" if skipped else f"{r['duration_sec'] / 60:.1f} min"
        err_txt = "přeskočeno (checkpoint)" if skipped else (r["error"] or "OK")
        err_col = "#888" if skipped else ("#d32f2f" if r["error"] else "#388e3c")
        rows_html += f"""
        <tr>
          <td>{icon}&nbsp;<strong>{r['agency']}</strong></td>
          <td style="text-align:right">{r['hotels_after']}</td>
          <td style="text-align:right;color:{'#388e3c' if h_diff>=0 else '#d32f2f'}">{h_diff:+d}</td>
          <td style="text-align:right">{r['tours_after']}</td>
          <td style="text-align:right;color:{'#388e3c' if t_diff>=0 else '#d32f2f'}">{t_diff:+d}</td>
          <td style="text-align:right;color:#888">-{stale}</td>
          <td style="text-align:right">{dur}</td>
          <td style="color:{err_col};font-size:12px">{err_txt}</td>
        </tr>"""

    html = f"""<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="utf-8">
<style>
  body  {{ font-family: Arial, sans-serif; max-width: 720px; margin: 24px auto; color: #333; }}
  h2   {{ color: #008afe; margin-bottom: 4px; }}
  .meta {{ color: #666; font-size: 13px; margin-bottom: 20px; }}
  table {{ border-collapse: collapse; width: 100%; }}
  th, td {{ padding: 9px 14px; text-align: left; border-bottom: 1px solid #eee; font-size: 14px; }}
  th    {{ background: #f5f7fa; font-weight: 600; color: #555; }}
  .note {{ color: #888; font-size: 12px; margin-top: 18px; }}
</style>
</head>
<body>
<h2>Zaleto — Scraper Report #{cycle}</h2>
<p class="meta">
  Dokončeno: <strong>{finished.strftime('%d.%m.%Y %H:%M:%S')}</strong>
  &nbsp;|&nbsp; Celková doba: <strong>{total_sec/60:.1f} min</strong>
  &nbsp;|&nbsp; Expired termínů smazáno: <strong>{expired_tours}</strong>
  &nbsp;|&nbsp; Hotelů spárováno: <strong>{matched_hotels}</strong>
</p>
<table>
  <tr>
    <th>Cestovka</th>
    <th style="text-align:right">Hotelů</th>
    <th style="text-align:right">Změna</th>
    <th style="text-align:right">Termínů</th>
    <th style="text-align:right">Změna</th>
    <th style="text-align:right" title="Smazané zastaralé termíny (neobjevily se v tomto běhu)">Stale−</th>
    <th style="text-align:right">Doba</th>
    <th>Status</th>
  </tr>
  {rows_html}
</table>
<p class="note">
  Záznamy jsou aktualizovány upsert logikou — stávající slug a id hotelů se nemění.<br>
  Hotely sdílí <code>canonical_slug</code> pokud jsou fyzicky totožné (&lt;220 m GPS).
</p>
<p class="note">Zaleto.cz automatický scraper</p>
</body>
</html>"""

    # ── Plain text ────────────────────────────────────────────────────────
    lines = [
        f"Zaleto — Scraper Report #{cycle}",
        "=" * 50,
        f"Dokončeno:  {finished.strftime('%d.%m.%Y %H:%M:%S')}",
        f"Celkem:     {total_sec/60:.1f} min",
        f"Expired:    {expired_tours} termínů smazáno",
        f"Spárováno:  {matched_hotels} hotelů",
        "",
    ]
    for r in results:
        skipped = r.get("skipped", False)
        icon    = "SKP" if skipped else ("OK " if not r["error"] else "ERR")
        h_diff  = r["hotels_after"]  - r["hotels_before"]
        t_diff  = r["tours_after"]   - r["tours_before"]
        stale   = r.get("stale_removed", 0)
        dur     = "checkpoint" if skipped else f"{r['duration_sec']/60:.1f} min"
        lines.append(
            f"  [{icon}] {r['agency']:<12}  "
            f"hotely: {r['hotels_after']} ({h_diff:+d})  "
            f"termíny: {r['tours_after']} ({t_diff:+d})  "
            f"stale: -{stale}  "
            f"{dur}"
            + (f"  CHYBA: {r['error']}" if r["error"] else "")
        )
    text = "\n".join(lines)

    return subject, html, text


# ---------------------------------------------------------------------------
# Materializovaná tabulka hotel_stats
# ---------------------------------------------------------------------------

# Zámek zabraňuje souběžnému spuštění refresh_hotel_stats z více scraperů najednou.
_refresh_lock = threading.Lock()


def refresh_hotel_stats(conn):
    """
    Přepočítá hotel_stats ze všech aktuálních termínů.
    Voláno po každém cyklu scraperů, aby fast-path v API měl aktuální data.
    Při paralelním běhu scraperů vrátí ihned pokud jiný refresh právě běží.
    """
    if not _refresh_lock.acquire(blocking=False):
        logger.debug("  hotel_stats: přeskakuji (probíhá jiný refresh)")
        return
    try:
        conn.execute("""
            WITH next_dep AS (
                SELECT DISTINCT ON (hotel_id)
                    hotel_id, return_date
                FROM tours
                WHERE price > 0 AND departure_date >= CURRENT_DATE::text
                ORDER BY hotel_id, departure_date ASC, price ASC
            ),
            agg AS (
                SELECT
                    hotel_id,
                    MIN(price)                        AS min_price,
                    MAX(price)                        AS max_price,
                    COUNT(*)                          AS available_dates,
                    MIN(departure_date)               AS next_departure,
                    MAX(COALESCE(is_last_minute,  0)) AS has_last_minute,
                    MAX(COALESCE(is_first_minute, 0)) AS has_first_minute
                FROM tours
                WHERE price > 0 AND departure_date >= CURRENT_DATE::text
                GROUP BY hotel_id
            )
            INSERT INTO hotel_stats
                (hotel_id, min_price, max_price, available_dates, next_departure,
                 next_return_date, has_last_minute, has_first_minute, updated_at)
            SELECT
                a.hotel_id, a.min_price, a.max_price, a.available_dates, a.next_departure,
                n.return_date,
                a.has_last_minute, a.has_first_minute, NOW()
            FROM agg a
            LEFT JOIN next_dep n ON n.hotel_id = a.hotel_id
            ON CONFLICT (hotel_id) DO UPDATE SET
                min_price        = EXCLUDED.min_price,
                max_price        = EXCLUDED.max_price,
                available_dates  = EXCLUDED.available_dates,
                next_departure   = EXCLUDED.next_departure,
                next_return_date = EXCLUDED.next_return_date,
                has_last_minute  = EXCLUDED.has_last_minute,
                has_first_minute = EXCLUDED.has_first_minute,
                updated_at       = EXCLUDED.updated_at
        """)
        conn.execute("""
            DELETE FROM hotel_stats
            WHERE hotel_id NOT IN (
                SELECT DISTINCT hotel_id FROM tours
                WHERE price > 0 AND departure_date >= CURRENT_DATE::text
            )
        """)
        conn.commit()
        n = conn.execute("SELECT COUNT(*) AS n FROM hotel_stats").fetchone()["n"]
        logger.info(f"  hotel_stats: {n} hotelů aktualizováno")
    finally:
        _refresh_lock.release()


# ---------------------------------------------------------------------------
# Graceful shutdown
# ---------------------------------------------------------------------------

_shutdown = False

def _handle_signal(signum, _frame):
    global _shutdown
    logger.info(f"Přijat signál {signum}, ukončuji po aktuálním cyklu...")
    _shutdown = True

signal.signal(signal.SIGTERM, _handle_signal)
signal.signal(signal.SIGINT,  _handle_signal)


# ---------------------------------------------------------------------------
# Hlavní smyčka
# ---------------------------------------------------------------------------

def run_cycle(cycle: int, skip_email: bool = False):
    """Provede jeden úplný cyklus: všechny scrapery + post-processing + report."""
    started = datetime.now()
    logger.info(f"\n{'='*60}")
    logger.info(f"CYKLUS #{cycle} — {started.strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info(f"{'='*60}")

    conn = open_db()
    ensure_canonical_slug(conn)
    ensure_checkpoint_table(conn)
    clear_checkpoints(conn)

    # Spusť AI generování: nejprve počasí, pak popisky destinací — obojí na pozadí,
    # scraping startuje okamžitě souběžně (není třeba čekat).
    hotel_count = conn.execute("SELECT COUNT(*) AS n FROM hotels").fetchone()["n"]
    if hotel_count > 0:
        _trigger_ai("/api/weather-ai/generate",     "Počasí AI")
        _trigger_ai("/api/destination-ai/generate", "Destinace AI")
        _trigger_ai("/api/articles/generate",        "Články AI")
    else:
        logger.info("AI generování: DB je prázdná, přeskakuji (první spuštění)")

    results: list[dict] = []

    # Všechny scrapery vždy spustit — bez checkpoint přeskakování
    to_run: list[dict] = list(SCRAPERS)

    # Paralelní spuštění scraperů — každý dostane vlastní DB connection (conn=None)
    max_workers = MAX_PARALLEL if MAX_PARALLEL > 0 else len(to_run)
    if to_run and not _shutdown:
        logger.info(
            f"Spouštím {len(to_run)} scraperů paralelně "
            f"(max {max_workers} souběžně): {', '.join(s['agency'] for s in to_run)}"
        )
        with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, max_workers)) as executor:
            future_to_scraper = {executor.submit(run_scraper, s): s for s in to_run}
            for future in concurrent.futures.as_completed(future_to_scraper):
                if _shutdown:
                    for f in future_to_scraper:
                        f.cancel()
                    break
                s = future_to_scraper[future]
                try:
                    result = future.result()
                except Exception as e:
                    agency = s["agency"]
                    logger.exception(f"Neočekávaná chyba při {agency}")
                    before = get_counts(conn, agency)
                    result = {
                        "agency": agency,
                        "hotels_before": before["hotels"], "hotels_after": before["hotels"],
                        "tours_before":  before["tours"],  "tours_after":  before["tours"],
                        "stale_removed": 0, "duration_sec": 0.0,
                        "error": str(e)[:200], "log_tail": "", "skipped": False,
                    }
                results.append(result)

    # Post-processing
    expired = 0
    matched = 0
    if not _shutdown:
        logger.info("Post-processing: mazání prošlých termínů...")
        try:
            expired = purge_expired_tours(conn)
            logger.info(f"  Smazáno {expired} prošlých termínů")
        except Exception:
            logger.exception("Chyba při mazání prošlých termínů")

        logger.info("Post-processing: oprava chybně označených termínů...")
        try:
            purge_mislabeled_tours(conn)
        except Exception:
            logger.exception("Chyba při čištění chybně označených termínů")

        logger.info("Post-processing: deduplikace termínů...")
        try:
            dedup_tours(conn)
        except Exception:
            logger.exception("Chyba při deduplikaci termínů")

        logger.info("Post-processing: párování hotelů napříč CK...")
        try:
            matched = match_hotels(conn)
        except Exception:
            logger.exception("Chyba při párování hotelů")

        logger.info("Post-processing: aktualizace hotel_stats...")
        try:
            refresh_hotel_stats(conn)
        except Exception:
            logger.exception("Chyba při aktualizaci hotel_stats")

    conn.close()

    # Invalidace API cache — nová data jsou v DB, final=True spustí AI generování
    _invalidate_api_cache(final=True)

    # Sestav a odešli report
    subject, html, text = build_report(cycle, started, results, expired, matched)
    logger.info(f"\n{subject}")
    if not skip_email:
        send_email(subject, html, text)
    else:
        logger.info("Email: přeskočen (--skip-email)")


def delete_all_data():
    """Smaže všechny záznamy v DB (hotels, tours, checkpointy). Zachová schéma."""
    conn = open_db()
    for table in ("tours", "hotels", "hotel_stats", "hotel_checkpoints", "scraper_checkpoints"):
        try:
            count = conn.execute(f"SELECT COUNT(*) AS n FROM {table}").fetchone()["n"]
            conn.execute(f"DELETE FROM {table}")
            logger.info(f"  {table}: smazáno {count} záznamů")
        except Exception:
            pass
    conn.commit()
    conn.close()
    logger.info("--delete: všechna data smazána")


def main():
    parser = argparse.ArgumentParser(description="Zaleto scraper orchestrátor")
    parser.add_argument("--once",       action="store_true", help="Jednorázový běh a konec")
    parser.add_argument("--skip-email", action="store_true", help="Neodesílat report email")
    parser.add_argument("--delete",     action="store_true", help="Smaže všechna data v DB a spustí scraping znovu")
    args = parser.parse_args()

    if args.delete:
        logger.info("--delete: mažu všechna data v DB...")
        delete_all_data()

    logger.info("Zaleto scraper orchestrátor spuštěn")
    logger.info(f"  DB:       PostgreSQL")
    logger.info(f"  Interval: {INTERVAL_H} h")
    logger.info(f"  Email:    {REPORT_TO if REPORT_TO else 'není nastaven'}")
    logger.info(f"  Scrapery: {[s['agency'] for s in SCRAPERS]}")

    cycle = 0
    while not _shutdown:
        cycle += 1
        run_cycle(cycle, skip_email=args.skip_email)

        if args.once or _shutdown:
            break

        # Smaž dnešní checkpointy — cyklus dokončen, příští cyklus musí znovu
        # scrapeovat všechny CK. Checkpointy slouží jen pro crash recovery uvnitř cyklu.
        _conn = open_db()
        _conn.execute("DELETE FROM scraper_checkpoints WHERE cycle_date = CURRENT_DATE::text")
        _conn.commit()
        _conn.close()
        logger.info("Checkpointy dnešního cyklu smazány — příští cyklus scrapeuje vše znovu")

        wait_sec = INTERVAL_H * 3600
        next_run = datetime.fromtimestamp(time.time() + wait_sec)
        logger.info(f"Příští cyklus: {next_run.strftime('%Y-%m-%d %H:%M')} (za {INTERVAL_H:.0f} h)")
        logger.info(f"Čekám {INTERVAL_H:.0f} hodin...")

        # Čekej v blocích 60 s, aby šel přijmout SIGTERM
        slept = 0
        while slept < wait_sec and not _shutdown:
            time.sleep(min(60, wait_sec - slept))
            slept += 60

    logger.info("Orchestrátor ukončen.")


if __name__ == "__main__":
    main()
