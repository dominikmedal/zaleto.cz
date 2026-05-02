#!/usr/bin/env python3
"""
Debug Exim Tours price structure.
Ukáže všechna pole v availableDates[0] z reálné API odpovědi.

Použití:
  python debug_exim_price.py
  python debug_exim_price.py "https://www.eximtours.cz/spanelsko/gran-canaria/maspalomaskoala-garden"
"""
import json
import sys

sys.path.insert(0, ".")
from eximtours import _make_session, _fetch_embedded, _parse_embedded, _get_offer

DEFAULT_URL = "https://www.eximtours.cz/spanelsko/gran-canaria/maspalomaskoala-garden"

def main():
    url = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_URL
    session = _make_session()

    print(f"\n=== Fetching: {url} ===")
    embedded = _fetch_embedded(session, url)
    if not embedded:
        print("ERROR: Embedded JSON nenalezen")
        return

    p = _parse_embedded(embedded)
    if not p:
        print("ERROR: parse_embedded selhal")
        return

    print(f"Hotel:          {p['hotel_name']}")
    print(f"Destination IDs:{p['destination_ids']}")
    print(f"Transport:      {p['transport_origin']}")
    print(f"Nights:         {p['nights']} (all: {p['all_nights']})")
    print(f"Date range:     {p['main_filter_from']} → {p['main_filter_to']}")

    api_data = _get_offer(session, p, p["main_filter_from"], p["main_filter_to"])
    if not api_data:
        print("ERROR: API vrátila None")
        return

    avail = api_data.get("availableDates", [])
    print(f"\nAvailable dates: {len(avail)}")

    if not avail:
        print("Žádné termíny — zkus jiný hotel nebo zkontroluj parametry.")
        print("offer keys:", list(api_data.get("offer", {}).keys()))
        return

    sample = avail[0]
    print(f"\n=== availableDates[0] ===")
    print(json.dumps(sample, indent=2, ensure_ascii=False))

    print("\n=== Všechna pole se slovem 'price'/'cena'/'amount'/'cost' ===")
    for k, v in sample.items():
        if any(x in k.lower() for x in ("price", "cena", "amount", "cost", "kc", "czk")):
            print(f"  {k}: {v}")

    print("\n=== Ukázka prvních 5 termínů (datum + pricePerPerson + price) ===")
    for d in avail[:5]:
        date = d.get("date", "?")[:10]
        ppp  = d.get("pricePerPerson", "—")
        p2   = d.get("price", "—")
        tp   = d.get("totalPrice", "—")
        tppp = d.get("totalPricePerPerson", "—")
        print(f"  {date}  pricePerPerson={ppp}  price={p2}  totalPrice={tp}  totalPricePerPerson={tppp}")

    print("\n=== offer objekt ===")
    offer = api_data.get("offer", {})
    print(json.dumps(offer, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    main()
