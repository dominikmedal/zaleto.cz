import { test } from 'node:test'
import assert from 'node:assert/strict'
import { apiErrorBody, apiError } from '../src/lib/apiError.ts'
import { openapi } from '../src/lib/openapi.ts'

test('apiErrorBody: strukturovaná chyba se zpětně kompatibilním textovým polem error', () => {
  const b = apiErrorBody(404, 'Hotel not found')
  assert.equal(b.error, 'Hotel not found')
  assert.equal(b.code, 'not_found')
  assert.equal(b.status, 404)
  assert.equal(b.message, 'Hotel not found')
  assert.ok(b.hint.length > 20)
  assert.equal(b.docs, 'https://zaleto.cz/openapi.json')
})

test('apiErrorBody: kódy pro 400, 405, 429 a neznámé 5xx; vlastní hint', () => {
  assert.equal(apiErrorBody(400, 'x').code, 'bad_request')
  assert.equal(apiErrorBody(405, 'x').code, 'method_not_allowed')
  assert.equal(apiErrorBody(429, 'x').code, 'rate_limited')
  assert.equal(apiErrorBody(502, 'x').code, 'internal_error')
  assert.equal(apiErrorBody(400, 'x', 'vlastní nápověda').hint, 'vlastní nápověda')
})

test('apiError: JSON odpověď se správným stavem a hlavičkami', async () => {
  const r = apiError(404, 'Endpoint neexistuje.')
  assert.equal(r.status, 404)
  assert.match(r.headers.get('content-type') ?? '', /^application\/json/)
  assert.equal(r.headers.get('cache-control'), 'no-store')
  const body = await r.json()
  assert.equal(body.code, 'not_found')
  assert.equal(apiError(405, 'x', undefined, { Allow: 'GET' }).headers.get('allow'), 'GET')
})

type Op = { operationId?: string; summary?: string; description?: string; parameters?: { name: string; in: string; description?: string; schema?: unknown; required?: boolean }[]; responses?: Record<string, { content?: Record<string, { schema?: unknown }> }> }
const operations = Object.entries(openapi.paths).flatMap(([path, item]) =>
  Object.entries(item as Record<string, Op>).map(([method, op]) => ({ path, method, op })),
)

test('openapi: verze 3.1, info a server', () => {
  assert.equal(openapi.openapi, '3.1.0')
  assert.ok(openapi.info.title && openapi.info.version && openapi.info.description.length > 50)
  assert.equal(openapi.servers[0].url, 'https://zaleto.cz')
})

test('openapi: každá operace má unikátní operationId, summary a description', () => {
  const ids = operations.map(o => o.op.operationId)
  assert.ok(operations.length >= 10)
  assert.ok(ids.every(Boolean), 'chybí operationId')
  assert.equal(new Set(ids).size, ids.length, 'operationId musí být unikátní')
  for (const { path, method, op } of operations) {
    assert.ok(op.summary && op.summary.length > 5, `${method} ${path}: summary`)
    assert.ok(op.description && op.description.length > 20, `${method} ${path}: description`)
  }
})

test('openapi: parametry mají typ a popis, path parametry odpovídají adrese', () => {
  for (const { path, method, op } of operations) {
    for (const p of op.parameters ?? []) {
      assert.ok(p.schema, `${method} ${path}: parametr ${p.name} nemá schema`)
      assert.ok(p.description, `${method} ${path}: parametr ${p.name} nemá popis`)
    }
    const inPath = [...path.matchAll(/\{(\w+)\}/g)].map(m => m[1])
    const declared = (op.parameters ?? []).filter(p => p.in === 'path').map(p => p.name)
    assert.deepEqual(declared.sort(), inPath.sort(), `${method} ${path}: path parametry`)
    assert.ok((op.parameters ?? []).filter(p => p.in === 'path').every(p => p.required === true))
  }
})

test('openapi: odpovědi mají schéma a chyby odkazují na schéma Error; všechny $ref existují', () => {
  const schemas = Object.keys(openapi.components.schemas)
  const refs = [...JSON.stringify(openapi).matchAll(/"\$ref":"#\/components\/schemas\/(\w+)"/g)].map(m => m[1])
  for (const r of refs) assert.ok(schemas.includes(r), `chybí schéma ${r}`)
  for (const { path, method, op } of operations) {
    const ok = op.responses?.['200']
    assert.ok(ok?.content?.['application/json']?.schema, `${method} ${path}: 200 bez schématu`)
    for (const [code, r] of Object.entries(op.responses ?? {})) {
      if (code.startsWith('4') || code.startsWith('5')) assert.ok(JSON.stringify(r).includes('#/components/schemas/Error'), `${method} ${path}: ${code} bez Error`)
    }
  }
})

test('openapi: dokumentovaný je jen veřejný API prostor (bez administrace a zápisů)', () => {
  for (const { path, method } of operations) {
    assert.equal(method, 'get')
    assert.ok(path.startsWith('/api/'))
    assert.ok(!/admin|revalidate|redirect|contact|markdown/.test(path))
  }
})
