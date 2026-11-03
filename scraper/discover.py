"""
Objevení NOVÝCH hotelů Fischer / Exim Tours ze sitemapy.

Update-only režim obnovuje jen hotely, které už jsou v DB (mají uložený api_config), takže nové hotely, které CK
přidala do nabídky, by se nikdy nenašly. Tohle se spouští na začátku update-only: porovná sitemapu s DB a plně
zpracuje jen hotely, které v DB nejsou a v tomto cyklu už byly zkoušeny (checkpoint „disc:<url>“).

Zkouší se jen výchozí letiště (Praha); ostatní letiště doplní následný update-only průchod z uloženého api_config.
Funkce je obecná: `m` je modul scraperu (fischer / eximtours).
"""
import concurrent.futures
import json
import logging
import random
import time
from urllib.parse import urlparse

logger = logging.getLogger("discover")


def _path(url: str) -> str:
    return urlparse(url).path.rstrip("/")


def discover_new_hotels(m, db, session, delay: float, workers: int = 1) -> int:
    urls = m.get_hotel_urls(session, 0)
    if not urls:
        logger.warning(f"{m.AGENCY}: sitemap nevrátila žádné hotely – objevování nových přeskočeno")
        return 0

    known: set[str] = set()
    for (cfg,) in db.conn.execute(
        "SELECT api_config FROM hotels WHERE agency = %s AND api_config IS NOT NULL", (m.AGENCY,)
    ).fetchall():
        try:
            p = json.loads(cfg).get("_hotelPath", "")
        except Exception:
            continue
        if p:
            known.add(p.split("?")[0].rstrip("/"))

    done = db.get_done_keys(m.AGENCY)
    todo = [u for u in urls if _path(u) not in known and f"disc:{u}" not in done]
    logger.info(f"{m.AGENCY}: sitemap {len(urls)} hotelů, v DB {len(known)} → k vyzkoušení {len(todo)} nových")
    if not todo:
        return 0

    slug_counter: dict = {}
    for (s,) in db.conn.execute("SELECT slug FROM hotels WHERE agency = %s", (m.AGENCY,)).fetchall():
        parts = s.rsplit("-", 1)
        if len(parts) == 2 and parts[1].isdigit():
            slug_counter[parts[0]] = max(slug_counter.get(parts[0], 0), int(parts[1]) + 1)
        else:
            slug_counter[s] = max(slug_counter.get(s, 0), 1)

    airports = [m.DEFAULT_AIRPORT]
    found = [0]

    def _one(url: str):
        w_session = m._make_session()
        w_db = type(db)()
        try:
            saved = m.scrape_hotel(w_session, w_db, url, slug_counter, airports)
            if saved:
                found[0] += 1
            w_db.mark_done(m.AGENCY, f"disc:{url}")
        except Exception as e:
            logger.error(f"{m.AGENCY} objevení {url}: {e}")
        finally:
            time.sleep(delay + random.uniform(0, delay * 0.4))
            w_db.close()
            w_session.close()

    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, workers)) as ex:
        list(ex.map(_one, todo))
    logger.info(f"{m.AGENCY}: objeveno {found[0]} nových hotelů s nabídkou")
    return found[0]
