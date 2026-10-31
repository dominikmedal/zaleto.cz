#!/usr/bin/env node
/**
 * Ověří veřejné endpointy a strojově čitelné soubory pro AI agenty.
 * Použití: node scripts/verify-agent-readiness.mjs [https://zaleto.cz]   (výchozí http://localhost:3000)
 * Návratový kód 0 = vše v pořádku, 1 = některá kontrola selhala.
 */
const BASE = (process.argv[2] || process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
const results = []
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` – ${detail}` : ''}`) }
const get = (path, headers = {}) => fetch(BASE + path, { headers, redirect: 'follow' })
const textOf = html => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

// 1) přístupnost pro AI agenty (user-agenty z doporučení)
for (const ua of ['ChatGPT-User/1.0', 'OAI-SearchBot/1.0', 'PerplexityBot/1.0', 'Claude-User/1.0']) {
  const r = await get('/', { 'user-agent': `Mozilla/5.0 (compatible; ${ua})` })
  check(`homepage dostupná pro ${ua.split('/')[0]}`, r.status === 200, `HTTP ${r.status}`)
}

// 2) 404 v Markdownu
{
  const r = await get('/__verify-404-probe', { accept: 'text/markdown' })
  const body = await r.text()
  check('404: správný stav', r.status === 404, `HTTP ${r.status}`)
  check('404: Content-Type text/markdown', (r.headers.get('content-type') || '').startsWith('text/markdown'))
  check('404: tělo ≥ 20 znaků s odkazem na llms.txt/sitemapu', body.length >= 20 && /llms\.txt|sitemap\.xml/.test(body))
}

// 3) vyjednávání Markdownu na homepage
{
  const md = await get('/', { accept: 'text/markdown' })
  const body = await md.text()
  check('Markdown: HTTP 200', md.status === 200, `HTTP ${md.status}`)
  check('Markdown: Content-Type text/markdown', (md.headers.get('content-type') || '').startsWith('text/markdown'), md.headers.get('content-type') || '')
  check('Markdown: Vary obsahuje Accept', /\baccept\b/i.test(md.headers.get('vary') || ''), md.headers.get('vary') || '')
  check('Markdown: neprázdné tělo', body.trim().length > 200)
  const html = await get('/', { accept: 'text/html' })
  check('HTML pro Accept: text/html', (html.headers.get('content-type') || '').startsWith('text/html'))
}

// 4) llms.txt
{
  const r = await get('/llms.txt')
  const t = await r.text()
  check('llms.txt: HTTP 200', r.status === 200)
  check('llms.txt: sekce „kdy použít“ (when to use)', /when to use/i.test(t) && /Kdy použít/i.test(t))
  check('llms.txt: začíná H1 a shrnutím', /^# Zaleto/.test(t) && /\n> /.test(t))
}

// 5) sitemap.xml
{
  const r = await get('/sitemap.xml')
  const x = await r.text()
  const locs = [...x.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1])
  check('sitemap.xml: platný urlset', r.status === 200 && /<urlset/.test(x) && locs.length > 10, `${locs.length} adres`)
  check('sitemap.xml: lastmod u adres', (x.match(/<lastmod>/g) || []).length >= locs.length * 0.9)
  check('sitemap.xml: bez adres s ?tour_type na homepage', !locs.some(l => /^https:\/\/zaleto\.cz\/\?/.test(l)))
}

// 6) robots.txt
{
  const r = await get('/robots.txt')
  const t = await r.text()
  check('robots.txt: odkaz na sitemap', r.status === 200 && /Sitemap:\s*\S+sitemap\.xml/i.test(t))
}

// 7) stránky důvěry (≥ 500 znaků textu)
for (const path of ['/about', '/contact', '/privacy']) {
  const r = await get(path)
  const t = textOf(await r.text())
  check(`${path}: HTTP 200 a ≥ 500 znaků textu`, r.status === 200 && t.length >= 500, `${t.length} znaků`)
}

// 8) metadata a schéma na homepage
{
  const h = await (await get('/')).text()
  check('metadata: canonical', /<link[^>]+rel="canonical"/.test(h))
  check('metadata: <html lang>', /<html[^>]+lang="cs"/.test(h))
  check('metadata: og:image', /<meta[^>]+property="og:image"/.test(h))
  check('metadata: og:type', /<meta[^>]+property="og:type"/.test(h))
  const ld = [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => { try { return JSON.parse(m[1]) } catch { return null } })
  const org = ld.find(o => o && o['@type'] === 'Organization')
  check('Organization: contactPoint', !!org?.contactPoint?.contactType && !!(org.contactPoint.email || org.contactPoint.telephone))
  check('Organization: PostalAddress', org?.address?.['@type'] === 'PostalAddress' && !!org.address.streetAddress)
  const og = h.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/)?.[1]
  if (og) {
    const ir = await fetch(og.replace(/^https:\/\/zaleto\.cz/, BASE))
    check('og:image: obrázek existuje', ir.status === 200 && (ir.headers.get('content-type') || '').startsWith('image/'), `HTTP ${ir.status}`)
  }
}

const failed = results.filter(r => !r.ok).length
console.log(`\n${results.length - failed}/${results.length} kontrol v pořádku (${BASE})`)
process.exit(failed ? 1 : 0)
