"""
Sdílená psycopg2 DB vrstva pro všechny scrapery a run_all.py.

Nahrazuje sqlite3 + individuální ZaletoDB třídy v každém scraperu.
Připojení přes env var DATABASE_URL (Railway internal nebo public URL).
"""

import logging
import os
from datetime import datetime
from pathlib import Path

import psycopg2
import psycopg2.extras

# Načti .env ze složky scraperů (pokud existuje)
_env_file = Path(__file__).parent / ".env"
if _env_file.exists():
    for _line in _env_file.read_text(encoding="utf-8").splitlines():
        _line = _line.strip()
        if _line and not _line.startswith("#") and "=" in _line:
            _k, _, _v = _line.partition("=")
            os.environ.setdefault(_k.strip(), _v.strip())

logger = logging.getLogger(__name__)

DATABASE_URL = os.environ.get("DATABASE_URL", "")


def _connect():
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL není nastaven")
    ssl = {"sslmode": "require"} if "localhost" not in DATABASE_URL and "127.0.0.1" not in DATABASE_URL else {}
    conn = psycopg2.connect(
        DATABASE_URL,
        cursor_factory=psycopg2.extras.RealDictCursor,
        **ssl,
    )
    conn.autocommit = False
    return conn


# ---------------------------------------------------------------------------
# PgConn — sqlite3-kompatibilní wrapper pro run_all.py
# ---------------------------------------------------------------------------

class PgConn:
    """
    Tenký wrapper kolem psycopg2 connection, který napodobuje sqlite3 rozhraní.
    Umožňuje run_all.py používat conn.execute() / executemany() stejně jako dřív.
    """

    def __init__(self):
        self._conn = _connect()

    def execute(self, sql: str, params=None):
        sql = sql.replace("?", "%s")
        cur = self._conn.cursor()
        cur.execute(sql, params or ())
        return cur

    def executemany(self, sql: str, params_list):
        sql = sql.replace("?", "%s")
        cur = self._conn.cursor()
        cur.executemany(sql, params_list)
        return cur

    def commit(self):
        self._conn.commit()

    def close(self):
        self._conn.close()


def open_db() -> PgConn:
    """Otevře DB spojení — používá run_all.py."""
    conn = PgConn()
    logger.info("DB: PostgreSQL (připojeno)")
    return conn


# ---------------------------------------------------------------------------
# ZaletoDB — třída pro individuální scrapery
# ---------------------------------------------------------------------------

class _ConnWrapper:
    """
    Wrapper kolem psycopg2 connection, který napodobuje sqlite3 conn.execute() rozhraní.
    Používá standardní (tuple) cursor, aby fetchone()[0] a for (x,) in ... fungovaly.
    """

    def __init__(self, conn):
        self._conn = conn

    def execute(self, sql: str, params=None):
        sql = sql.replace("?", "%s")
        cur = self._conn.cursor(cursor_factory=psycopg2.extensions.cursor)
        cur.execute(sql, params or ())
        return cur

    def commit(self):
        self._conn.commit()

    def close(self):
        self._conn.close()


class ZaletoDB:
    """
    Psycopg2 obdoba původní sqlite3 ZaletoDB.
    Parametr path je ignorován (zachován pro zpětnou kompatibilitu).
    """

    def __init__(self, path: str = None):
        self._pg_conn = _connect()
        self.conn = _ConnWrapper(self._pg_conn)
        self._ensure_extra_tables()
        logger.info("DB: PostgreSQL")

    def _cur(self):
        return self._pg_conn.cursor()

    def _ensure_extra_tables(self):
        """Checkpoint tabulky — backend je nevytváří, scrapery ano."""
        cur = self._cur()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS hotel_checkpoints (
                agency     TEXT NOT NULL,
                key        TEXT NOT NULL,
                cycle_date TEXT NOT NULL,
                PRIMARY KEY (agency, key, cycle_date)
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS scraper_checkpoints (
                agency       TEXT NOT NULL,
                cycle_date   TEXT NOT NULL,
                completed_at TEXT NOT NULL,
                PRIMARY KEY (agency, cycle_date)
            )
        """)
        self._pg_conn.commit()

    # ── Checkpointy ──────────────────────────────────────────────────────

    def get_done_keys(self, agency: str) -> set:
        today = datetime.now().strftime("%Y-%m-%d")
        cur = self._cur()
        cur.execute(
            "SELECT key FROM hotel_checkpoints WHERE agency = %s AND cycle_date = %s",
            (agency, today),
        )
        return {r["key"] for r in cur.fetchall()}

    def mark_done(self, agency: str, key: str):
        today = datetime.now().strftime("%Y-%m-%d")
        cur = self._cur()
        cur.execute(
            "INSERT INTO hotel_checkpoints (agency, key, cycle_date) VALUES (%s, %s, %s) "
            "ON CONFLICT DO NOTHING",
            (agency, key, today),
        )
        self.conn.commit()

    # ── Hotely ───────────────────────────────────────────────────────────

    def upsert_hotel(self, slug: str, data: dict) -> int:
        cur = self._cur()
        agency = data.get("agency", data.get("_agency", "Fischer"))

        # Deduplicate: if a hotel with the same name+agency already exists under a
        # different slug, reuse that slug instead of creating a duplicate entry.
        cur.execute(
            "SELECT slug FROM hotels WHERE name = %s AND agency = %s AND slug != %s LIMIT 1",
            (data["name"], agency, slug),
        )
        existing = cur.fetchone()
        if existing:
            slug = existing["slug"]

        cur.execute("""
            INSERT INTO hotels (
                slug, agency, name, country, destination, resort_town,
                stars, review_score, description, thumbnail_url, photos,
                amenities, tags, distances, food_options, price_includes,
                latitude, longitude, api_config, updated_at
            ) VALUES (
                %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s,
                %s, %s, %s, NOW()
            )
            ON CONFLICT (slug) DO UPDATE SET
                agency         = EXCLUDED.agency,
                name           = EXCLUDED.name,
                country        = EXCLUDED.country,
                destination    = EXCLUDED.destination,
                resort_town    = EXCLUDED.resort_town,
                stars          = EXCLUDED.stars,
                review_score   = EXCLUDED.review_score,
                description    = EXCLUDED.description,
                thumbnail_url  = EXCLUDED.thumbnail_url,
                photos         = EXCLUDED.photos,
                amenities      = EXCLUDED.amenities,
                tags           = EXCLUDED.tags,
                distances      = EXCLUDED.distances,
                food_options   = EXCLUDED.food_options,
                price_includes = EXCLUDED.price_includes,
                latitude       = EXCLUDED.latitude,
                longitude      = EXCLUDED.longitude,
                api_config     = EXCLUDED.api_config,
                updated_at     = NOW()
        """, (
            slug,
            data.get("agency", data.get("_agency", "Fischer")),
            data["name"],
            data.get("country"),
            data.get("destination"),
            data.get("resort_town"),
            data.get("stars"),
            data.get("review_score"),
            data.get("description"),
            data.get("thumbnail_url"),
            data.get("photos"),
            data.get("amenities"),
            data.get("tags"),
            data.get("distances"),
            data.get("food_options"),
            data.get("price_includes"),
            data.get("latitude"),
            data.get("longitude"),
            data.get("api_config"),
        ))
        cur.execute("SELECT id FROM hotels WHERE slug = %s", (slug,))
        row = cur.fetchone()
        self.conn.commit()
        return row["id"]

    # ── Termíny ──────────────────────────────────────────────────────────

    def upsert_tour(self, hotel_id: int, t: dict):
        cur = self._cur()
        cur.execute("""
            INSERT INTO tours (
                hotel_id, agency, departure_date, return_date, duration,
                price, transport, meal_plan, adults, room_code, url,
                is_last_minute, is_first_minute, departure_city,
                price_single, url_single, updated_at
            ) VALUES (
                %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s,
                %s, %s, %s,
                %s, %s, NOW()
            )
            ON CONFLICT (url) DO UPDATE SET
                price           = EXCLUDED.price,
                transport       = EXCLUDED.transport,
                meal_plan       = EXCLUDED.meal_plan,
                return_date     = EXCLUDED.return_date,
                departure_date  = EXCLUDED.departure_date,
                is_last_minute  = EXCLUDED.is_last_minute,
                is_first_minute = EXCLUDED.is_first_minute,
                departure_city  = EXCLUDED.departure_city,
                price_single    = EXCLUDED.price_single,
                url_single      = EXCLUDED.url_single,
                updated_at      = NOW()
        """, (
            hotel_id,
            t.get("agency", t.get("_agency", "Fischer")),
            t["departure_date"],
            t.get("return_date"),
            t.get("duration"),
            t["price"],
            t.get("transport", "letecky"),
            t.get("meal_plan", ""),
            t.get("adults", 2),
            t.get("room_code", ""),
            t["url"],
            int(t.get("is_last_minute", False)),
            int(t.get("is_first_minute", False)),
            t.get("departure_city", ""),
            t.get("price_single"),
            t.get("url_single"),
        ))
        self.conn.commit()

    def commit(self):
        self._pg_conn.commit()

    def close(self):
        self._pg_conn.close()
