import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseFeed } from '../src/lib/feed.ts'

const RSS = `<?xml version="1.0"?><rss><channel><title>Blog</title>
<item><title><![CDATA[10 pláží, které stojí za cestu]]></title><link>https://example.com/a?x=1&amp;y=2</link><pubDate>Sat, 31 Oct 2026 11:00:00 GMT</pubDate><description>x</description></item>
<item><title>Bez data</title><link>https://example.com/b</link></item>
<item><title>Špatný odkaz</title><link>/relativni</link><pubDate>Sat, 31 Oct 2026 11:00:00 GMT</pubDate></item>
<item><title>Druhý &amp; třetí</title><link>https://example.com/c</link><dc:date>2026-10-30T08:00:00Z</dc:date></item>
</channel></rss>`

const ATOM = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Atom článek</title><link rel="alternate" href="https://example.com/atom-1"/><published>2026-10-29T10:00:00+01:00</published></entry></feed>`

test('parseFeed: RSS – CDATA, entity v URL, položky bez data nebo s relativním odkazem se vynechají', () => {
  const items = parseFeed(RSS)
  const byUrl = Object.fromEntries(items.map(i => [i.url, i]))
  assert.equal(byUrl['https://example.com/a?x=1&y=2'].title, '10 pláží, které stojí za cestu')
  assert.equal(byUrl['https://example.com/a?x=1&y=2'].publishedAt, '2026-10-31T11:00:00.000Z')
  assert.equal(byUrl['https://example.com/b'].publishedAt, null)
  assert.ok(!('/relativni' in byUrl))
  assert.equal(byUrl['https://example.com/c'].title, 'Druhý & třetí')
  assert.equal(byUrl['https://example.com/c'].publishedAt, '2026-10-30T08:00:00.000Z')
})

test('parseFeed: Atom – odkaz v atributu href a datum z <published>', () => {
  const [item] = parseFeed(ATOM)
  assert.equal(item.url, 'https://example.com/atom-1')
  assert.equal(item.publishedAt, '2026-10-29T09:00:00.000Z')
})

test('parseFeed: prázdný nebo nevalidní vstup nevyhodí chybu', () => {
  assert.deepEqual(parseFeed(''), [])
  assert.deepEqual(parseFeed('<html>nic</html>'), [])
})
