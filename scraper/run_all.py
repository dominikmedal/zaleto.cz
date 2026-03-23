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
import logging
import os
import signal
import smtplib
import sqlite3
import subprocess
import sys
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
DEFAULT_DB = str(BASE_DIR.parent / "data" / "zaleto.db")
DB_PATH    = os.environ.get("DATABASE_PATH", DEFAULT_DB)

SMTP_HOST    = os.environ.get("SMTP_HOST", "")
SMTP_PORT    = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER    = os.environ.get("SMTP_USER", "")
SMTP_PASS    = os.environ.get("SMTP_PASS", "")
REPORT_TO    = [e.strip() for e in os.environ.get("REPORT_TO", "").split(",") if e.strip()]
REPORT_FROM  = os.environ.get("REPORT_FROM", SMTP_USER)
INTERVAL_H   = float(os.environ.get("SCRAPE_INTERVAL_H", "12"))
SCRAPER_DELAY = float(os.environ.get("SCRAPER_DELAY", "1.5"))

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

SCRAPERS: list[dict] = [
    {
        "agency":  "Fischer",
        "module":  "fischer.py",
        "args":    ["--delay", str(SCRAPER_DELAY)],
    },
    {
        "agency":  "Blue Style",
        "module":  "bluestyle.py",
        "args":    ["--delay", str(min(SCRAPER_DELAY, 0.8))],
    },
    {
        "agency":  "Čedok",
        "module":  "cedok.py",
        "args":    ["--delay", str(SCRAPER_DELAY)],
    },
    {
        "agency":  "TUI",
        "module":  "tui.py",
        "args":    ["--delay", str(SCRAPER_DELAY)],
    },
]

# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

def open_db() -> sqlite3.Connection:
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=30)
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA foreign_keys = ON")
    conn.row_factory = sqlite3.Row
    return conn


# ---------------------------------------------------------------------------
# Checkpoint — přežije restart kontejneru (deploy)
# ---------------------------------------------------------------------------

def ensure_checkpoint_table(conn: sqlite3.Connection):
    conn.execute("""
        CREATE TABLE IF NOT EXISTS scraper_checkpoints (
            agency       TEXT NOT NULL,
            cycle_date   TEXT NOT NULL,
            completed_at TEXT NOT NULL,
            PRIMARY KEY (agency, cycle_date)
        )
    """)
    conn.commit()


def get_completed_today(conn: sqlite3.Connection) -> set:
    """Vrátí množinu CK, které dnes již úspěšně dokončily stahování."""
    today = datetime.now().strftime("%Y-%m-%d")
    rows = conn.execute(
        "SELECT agency FROM scraper_checkpoints WHERE cycle_date = ?", (today,)
    ).fetchall()
    return {r["agency"] for r in rows}


def mark_completed(conn: sqlite3.Connection, agency: str):
    today = datetime.now().strftime("%Y-%m-%d")
    conn.execute(
        "INSERT OR REPLACE INTO scraper_checkpoints (agency, cycle_date, completed_at) "
        "VALUES (?, ?, ?)",
        (agency, today, datetime.now().strftime("%Y-%m-%d %H:%M:%S")),
    )
    conn.commit()


def clear_checkpoints(conn: sqlite3.Connection):
    """Smaže checkpointy starší než 2 dny (údržba tabulky)."""
    conn.execute(
        "DELETE FROM scraper_checkpoints WHERE cycle_date < date('now', '-2 days')"
    )
    # hotel_checkpoints tvoří scrapers samy — promazáváme je taky
    try:
        conn.execute(
            "DELETE FROM hotel_checkpoints WHERE cycle_date < date('now', '-2 days')"
        )
    except Exception:
        pass  # tabulka ještě neexistuje při prvním běhu
    conn.commit()


def get_counts(conn: sqlite3.Connection, agency: str) -> dict:
    """Vrátí počty hotelů a termínů pro danou CK."""
    h = conn.execute(
        "SELECT COUNT(*) FROM hotels WHERE agency = ?", (agency,)
    ).fetchone()[0]
    t = conn.execute(
        "SELECT COUNT(*) FROM tours WHERE agency = ?", (agency,)
    ).fetchone()[0]
    return {"hotels": h, "tours": t}


def ensure_canonical_slug(conn: sqlite3.Connection):
    """Přidá sloupec canonical_slug (pokud neexistuje) a inicializuje jej."""
    cols = {row[1] for row in conn.execute("PRAGMA table_info(hotels)")}
    if "canonical_slug" not in cols:
        conn.execute("ALTER TABLE hotels ADD COLUMN canonical_slug TEXT")
        logger.info("DB: přidán sloupec canonical_slug")
    conn.execute(
        "UPDATE hotels SET canonical_slug = slug "
        "WHERE canonical_slug IS NULL OR canonical_slug = ''"
    )
    conn.commit()


def purge_expired_tours(conn: sqlite3.Connection) -> int:
    """Smaže termíny s datem odjezdu v minulosti. Vrátí počet smazaných."""
    today = datetime.now().strftime("%Y-%m-%d")
    cur = conn.execute(
        "DELETE FROM tours WHERE departure_date < ? AND departure_date != ''",
        (today,),
    )
    conn.commit()
    return cur.rowcount


# ---------------------------------------------------------------------------
# Párování hotelů napříč CK (canonical_slug)
# ---------------------------------------------------------------------------

def match_hotels(conn: sqlite3.Connection) -> int:
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

def purge_stale_tours(conn: sqlite3.Connection, agency: str, run_started: datetime) -> int:
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


def run_scraper(scraper: dict, conn: sqlite3.Connection) -> dict:
    """
    Spustí scraper jako subprocess, změří čas, zachytí výstup a chyby.
    Po úspěšném běhu smaže zastaralé termíny (stale price cleanup).
    Vrátí dict se statistikami.
    """
    agency = scraper["agency"]
    script = str(BASE_DIR / scraper["module"])
    cmd    = [sys.executable, "-u", script] + scraper["args"]

    env = {**os.environ, "DATABASE_PATH": DB_PATH}

    before      = get_counts(conn, agency)
    run_started = datetime.now()
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
            logger.info(f"  [{agency}] {line}")

        proc.wait()

        if proc.returncode != 0:
            err_lines = captured_lines or ["neznámá chyba"]
            result["error"] = err_lines[-1][:200] if err_lines else f"exit {proc.returncode}"
            result["log_tail"] = "\n".join(err_lines[-20:])
            logger.error(f"{agency} skončil s kódem {proc.returncode}: {result['error']}")
        else:
            logger.info(f"{agency} dokončen OK")
            # Smaž termíny, které se v tomto běhu neobjevily → zastaralé ceny
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
            # Ulož checkpoint — přežije restart kontejneru
            mark_completed(conn, agency)

    except Exception:
        tb = traceback.format_exc()
        result["error"] = tb.splitlines()[-1][:200]
        result["log_tail"] = tb[-2000:]
        logger.exception(f"Chyba při spuštění {agency}")

    result["duration_sec"] = time.time() - started
    after = get_counts(conn, agency)
    result["hotels_after"] = after["hotels"]
    result["tours_after"]  = after["tours"]

    h_diff = after["hotels"] - before["hotels"]
    t_diff = after["tours"]  - before["tours"]
    logger.info(
        f"{agency}: {after['hotels']} hotelů ({h_diff:+d}), "
        f"{after['tours']} termínů ({t_diff:+d}), "
        f"{result['duration_sec']:.0f} s"
    )
    return result


# ---------------------------------------------------------------------------
# Email report
# ---------------------------------------------------------------------------

def _invalidate_api_cache():
    """Zavolá backend endpoint pro invalidaci in-memory cache po dokončení scrapingu."""
    backend = os.environ.get("BACKEND_URL", "http://localhost:3001")
    try:
        resp = requests.post(f"{backend}/api/cache/invalidate", timeout=5)
        if resp.ok:
            logger.info("Cache: invalidována")
        else:
            logger.warning(f"Cache: invalidace selhala ({resp.status_code})")
    except Exception as e:
        logger.warning(f"Cache: invalidace selhala — {e}")


def send_email(subject: str, html: str, text: str):
    """Odešle report email přes SMTP s TLS."""
    if not SMTP_HOST or not REPORT_TO:
        logger.info("Email: přeskakuji (SMTP_HOST nebo REPORT_TO není nastaven)")
        return

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = REPORT_FROM or SMTP_USER
        msg["To"]      = ", ".join(REPORT_TO)
        msg.attach(MIMEText(text, "plain",  "utf-8"))
        msg.attach(MIMEText(html, "html",   "utf-8"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=30) as s:
            s.ehlo()
            s.starttls()
            s.ehlo()
            if SMTP_USER:
                s.login(SMTP_USER, SMTP_PASS)
            s.sendmail(msg["From"], REPORT_TO, msg.as_bytes())

        logger.info(f"Email: odeslán na {', '.join(REPORT_TO)}")
    except OSError as e:
        logger.warning(f"Email: síťová chyba — {e} (na Railway použij RESEND_API_KEY)")
    except Exception as e:
        logger.warning(f"Email: chyba — {e}")


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

    already_done = get_completed_today(conn)
    if already_done:
        logger.info(f"Checkpoint: přeskakuji již dokončené CK: {', '.join(sorted(already_done))}")

    results: list[dict] = []
    for scraper in SCRAPERS:
        if _shutdown:
            break
        if scraper["agency"] in already_done:
            logger.info(f"✓ {scraper['agency']} — přeskočeno (checkpoint z dnešního cyklu)")
            # Přidej do výsledků jako "skipped" pro report
            before = get_counts(conn, scraper["agency"])
            results.append({
                "agency": scraper["agency"],
                "hotels_before": before["hotels"], "tours_before": before["tours"],
                "hotels_after":  before["hotels"], "tours_after":  before["tours"],
                "stale_removed": 0, "duration_sec": 0.0,
                "error": "", "log_tail": "", "skipped": True,
            })
            continue
        result = run_scraper(scraper, conn)
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

        logger.info("Post-processing: párování hotelů napříč CK...")
        try:
            matched = match_hotels(conn)
        except Exception:
            logger.exception("Chyba při párování hotelů")

    conn.close()

    # Invalidace API cache — nová data jsou v DB
    _invalidate_api_cache()

    # Sestav a odešli report
    subject, html, text = build_report(cycle, started, results, expired, matched)
    logger.info(f"\n{subject}")
    if not skip_email:
        send_email(subject, html, text)
    else:
        logger.info("Email: přeskočen (--skip-email)")


def main():
    parser = argparse.ArgumentParser(description="Zaleto scraper orchestrátor")
    parser.add_argument("--once",       action="store_true", help="Jednorázový běh a konec")
    parser.add_argument("--skip-email", action="store_true", help="Neodesílat report email")
    args = parser.parse_args()

    logger.info("Zaleto scraper orchestrátor spuštěn")
    logger.info(f"  DB:       {DB_PATH}")
    logger.info(f"  Interval: {INTERVAL_H} h")
    logger.info(f"  Email:    {REPORT_TO if REPORT_TO else 'není nastaven'}")
    logger.info(f"  Scrapery: {[s['agency'] for s in SCRAPERS]}")

    cycle = 0
    while not _shutdown:
        cycle += 1
        run_cycle(cycle, skip_email=args.skip_email)

        if args.once or _shutdown:
            break

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
