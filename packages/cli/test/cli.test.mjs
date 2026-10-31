import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { spawnSync } from 'node:child_process'
import { parseArgs, buildRequest, format, formatApiError } from '../src/lib.mjs'

test('parseArgs: hodnoty, --klíč=hodnota, příznaky a pozice', () => {
  const { flags, positional } = parseArgs(['hotels', 'Turecko', '--sort', 'price_asc', '--limit=3', '--json'])
  assert.deepEqual(positional, ['hotels', 'Turecko'])
  assert.deepEqual(flags, { sort: 'price_asc', limit: '3', json: true })
})

test('buildRequest: hotels mapuje volby na parametry API', () => {
  const url = new URL(buildRequest('hotels', [], { destination: 'Turecko', from: '2027-05-01', meal: 'All Inclusive', 'max-price': '20000', exact: true, 'base-url': 'http://x.test/' }))
  assert.equal(url.origin + url.pathname, 'http://x.test/api/hotels')
  assert.equal(url.searchParams.get('destination'), 'Turecko')
  assert.equal(url.searchParams.get('date_from'), '2027-05-01')
  assert.equal(url.searchParams.get('meal_plan'), 'All Inclusive')
  assert.equal(url.searchParams.get('max_price'), '20000')
  assert.equal(url.searchParams.get('date_flex'), '0')
})

test('buildRequest: chybějící argumenty a neznámý příkaz hlásí srozumitelnou chybu', () => {
  assert.throws(() => buildRequest('search', [], {}), /Použití: zaleto search/)
  assert.throws(() => buildRequest('hotel', [], {}), /Použití: zaleto hotel/)
  assert.throws(() => buildRequest('nic', [], {}), /Neznámý příkaz/)
})

test('format a formatApiError', () => {
  assert.match(format('search', { destinations: [], hotels: [], articles: [], cars: [], pages: [] }), /Nic nenalezeno/)
  assert.match(format('destinations', [{ country: 'Řecko', resort_town: 'Kréta', hotel_count: 3 }]), /Řecko/)
  const msg = formatApiError(404, { code: 'not_found', message: 'Hotel not found', hint: 'Zkontroluj slug.' })
  assert.match(msg, /Chyba 404 \(not_found\): Hotel not found/)
  assert.match(msg, /Nápověda: Zkontroluj slug\./)
})

test('bin: volání proti lokálnímu mock API (úspěch i JSON chyba)', async () => {
  const server = http.createServer((req, res) => {
    res.setHeader('content-type', 'application/json')
    if (req.url.startsWith('/api/search')) return res.end(JSON.stringify({ q: 'x', destinations: [{ name: 'Kréta', count: 5, href: '/destinace/kreta' }], hotels: [], articles: [], cars: [], pages: [] }))
    res.statusCode = 404
    res.end(JSON.stringify({ error: 'nope', code: 'not_found', status: 404, message: 'nope', hint: 'zkus jinak', docs: 'x' }))
  })
  await new Promise(r => server.listen(0, r))
  const base = `http://127.0.0.1:${server.address().port}`
  const run = args => new Promise(resolve => {
    import('node:child_process').then(({ execFile }) => execFile(process.execPath, ['bin/zaleto.mjs', ...args], { cwd: new URL('..', import.meta.url) }, (err, stdout, stderr) => resolve({ code: err ? err.code : 0, stdout, stderr })))
  })
  try {
    const ok = await run(['search', 'kreta', '--base-url', base])
    assert.equal(ok.code, 0)
    assert.match(ok.stdout, /Kréta/)
    const bad = await run(['hotel', 'x', '--base-url', base])
    assert.equal(bad.code, 1)
    assert.match(bad.stderr, /Chyba 404 \(not_found\)/)
    assert.match(bad.stderr, /Nápověda: zkus jinak/)
  } finally { server.close() }
})
