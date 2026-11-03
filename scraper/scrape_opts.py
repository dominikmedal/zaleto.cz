"""
Volitelné rozšíření pokrytí Fischer / Exim Tours (vše VYPNUTÉ, dokud se nezapne env proměnnou):

  EXTRA_MEALS=1          pro každou kombinaci letiště × noci, která má nabídku, stáhne i ostatní stravy z `mealOptions`
                         (výchozí je jen jedna strava hotelu). Měřením na vzorku ≈ +90 % termínů a ≈ +30–50 % API požadavků.
  EXTRA_NIGHTS=4,5,6,15  další počty nocí mimo výchozí 7–14 (měřením ≈ +25–30 % termínů; každé číslo = +1 požadavek na letiště)

Pozor na velikost DB (tabulka tours + indexy) a na délku průchodu – viz komentář u workflow scrape.yml.
"""
import os

EXTRA_MEALS = os.environ.get("EXTRA_MEALS", "0") == "1"
EXTRA_NIGHTS = [int(x) for x in os.environ.get("EXTRA_NIGHTS", "").replace(" ", "").split(",") if x.isdigit()]


def nights(base) -> list:
    """Výchozí počty nocí hotelu + volitelné další (bez duplicit, pořadí zachováno)."""
    return list(dict.fromkeys(list(base) + EXTRA_NIGHTS))


def extra_meal_tours(m, session, p: dict, api_data: dict, nights_val: int, hotel_url: str, airport_name: str) -> list:
    """Termíny pro ostatní stravy hotelu (jen je-li EXTRA_MEALS=1). `m` je modul scraperu (fischer / eximtours)."""
    if not EXTRA_MEALS:
        return []
    out: list = []
    for mo in (api_data.get("mealOptions") or []):
        code = mo.get("code")
        if not code or code == p["meal_code"]:
            continue
        pp = {**p, "meal_code": code}
        d = m._get_offer(session, pp, p["main_filter_from"], p["main_filter_to"], nights_override=nights_val)
        if d and d.get("availableDates"):
            out.extend(m._build_hotel_and_tours(hotel_url, pp, d, airport_name)[1])
    return out
