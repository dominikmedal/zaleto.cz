# zaleto-cli

Příkazový řádek pro veřejné API [Zaleto](https://zaleto.cz) (zájezdy od českých cestovních kanceláří, destinace, články, vyhledávání).
Bez závislostí, vyžaduje Node.js 18+. API je veřejné, nepotřebuješ klíč. Dokumentace: https://zaleto.cz/developers

```bash
npx zaleto-cli search kreta
npx zaleto-cli hotels Turecko --duration 7 --meal "All Inclusive" --sort price_asc --limit 5
npx zaleto-cli tours cd-studia-sofia --sort price_asc --limit 5
npx zaleto-cli destinations
npx zaleto-cli hotel cd-studia-sofia --json
```

Příkaz `zaleto` (po `npm i -g zaleto-cli`) má stejné volby. `--json` vypíše surovou odpověď, `--base-url` přepíše adresu API.
Chyby API se vypisují včetně `code` a `hint` a program končí kódem 1.

## Publikace (správce projektu)

```bash
cd packages/cli
npm test
npm publish --access public   # vyžaduje přihlášení k npm (npm login)
```
