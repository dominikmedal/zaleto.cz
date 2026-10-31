import { test } from 'node:test'
import assert from 'node:assert/strict'
import { prefersMarkdown, parseAccept, markdownError } from '../src/lib/agent.ts'
import { htmlToMarkdown } from '../src/lib/htmlToMarkdown.ts'

test('parseAccept čte váhy q a výchozí hodnotu 1', () => {
  assert.deepEqual(parseAccept('text/markdown, text/html;q=0.5'), [
    { type: 'text/markdown', q: 1 },
    { type: 'text/html', q: 0.5 },
  ])
  assert.deepEqual(parseAccept(null), [])
})

test('prefersMarkdown: výslovný text/markdown vyhrává, prohlížeč dostává HTML', () => {
  assert.equal(prefersMarkdown('text/markdown'), true)
  assert.equal(prefersMarkdown('text/markdown, text/html;q=0.5'), true)
  assert.equal(prefersMarkdown('text/markdown;q=0.4, text/html'), false)
  // typická hlavička prohlížeče
  assert.equal(prefersMarkdown('text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'), false)
  assert.equal(prefersMarkdown('*/*'), false)
  assert.equal(prefersMarkdown(undefined), false)
  assert.equal(prefersMarkdown('text/markdown;q=0'), false)
})

test('markdownError: 404 obsahuje vysvětlení (≥ 20 znaků) a odkazy na llms.txt a sitemapu', () => {
  const body = markdownError('/neexistuje', 404)
  assert.match(body, /^# 404/)
  assert.ok(body.length > 20)
  assert.match(body, /\/neexistuje/)
  assert.match(body, /https:\/\/zaleto\.cz\/llms\.txt/)
  assert.match(body, /https:\/\/zaleto\.cz\/sitemap\.xml/)
})

test('markdownError: znaky řídící formátování se z cesty odstraní', () => {
  const body = markdownError('/a`\n# injekce', 404)
  assert.ok(!body.includes('\n# injekce'))
})

test('htmlToMarkdown: bere <main>, převádí odkazy na absolutní, vypouští skripty a obrázky', () => {
  const html = `<html><head><title>Test | Zaleto</title></head><body>
    <header>MENU</header>
    <main><h1>Nadpis</h1><p>Text s <a href="/zajezdy">odkazem</a>.</p><img src="/x.jpg" alt="x"><script>alert(1)</script></main>
    <footer>ZÁPATÍ</footer></body></html>`
  const md = htmlToMarkdown(html, 'https://zaleto.cz/test')
  assert.match(md, /^# Nadpis/)
  assert.match(md, /\[odkazem\]\(https:\/\/zaleto\.cz\/zajezdy\)/)
  assert.ok(!md.includes('MENU') && !md.includes('ZÁPATÍ') && !md.includes('alert') && !md.includes('x.jpg'))
  assert.match(md, /Zdroj: https:\/\/zaleto\.cz\/test/)
})

test('htmlToMarkdown: bez textu vrací prázdný řetězec', () => {
  assert.equal(htmlToMarkdown('<html><body><main></main></body></html>', 'https://zaleto.cz/'), '')
})
