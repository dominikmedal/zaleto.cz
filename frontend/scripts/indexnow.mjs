#!/usr/bin/env node
/**
 * Oznámí vyhledávačům (IndexNow: Bing, Seznam, Yandex…) nové a změněné adresy.
 * Použití: node scripts/indexnow.mjs [https://zaleto.cz] [--all]
 * Bez --all pošle hlavní stránky, destinace, články a půjčovny; s --all celou sitemapu (po částech do 10 000 adres).
 */
import { readdirSync } from 'node:fs'

const BASE = (process.argv.find(a => a.startsWith('http')) || 'https://zaleto.cz').replace(/\/$/, '')
const ALL = process.argv.includes('--all')
const keyFile = readdirSync(new URL('../public/', import.meta.url)).find(f => /^[0-9a-f]{32}\.txt$/.test(f))
if (!keyFile) { console.error('V public/ chybí soubor s klíčem IndexNow (<32 hex>.txt).'); process.exit(1) }
const key = keyFile.replace('.txt', '')

// /sitemap.xml je index; adresy jsou v jednotlivých částech (/sitemap/<id>.xml)
const index = await (await fetch(`${BASE}/sitemap.xml`)).text()
const parts = [...index.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1])
let urls = []
for (const part of parts) {
  const xml = await (await fetch(BASE + new URL(part).pathname)).text()
  urls.push(...[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]))
}
if (!ALL) urls = urls.filter(u => !/\/hotel\//.test(u) && !/\/pujcovna-aut\/[^/]+\/[^/]+$/.test(u) && !/\/pocasi\/[^/]+\/[^/]+$/.test(u))
console.log(`Odesílám ${urls.length} adres (${ALL ? 'celá sitemapa' : 'hlavní stránky, destinace, články'})`)

const host = new URL(BASE).host
for (let i = 0; i < urls.length; i += 10000) {
  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host, key, keyLocation: `${BASE}/${keyFile}`, urlList: urls.slice(i, i + 10000) }),
  })
  console.log(`dávka ${i / 10000 + 1}: HTTP ${res.status} ${res.status === 200 || res.status === 202 ? '(přijato)' : await res.text()}`)
  if (![200, 202].includes(res.status)) process.exit(1)
}
