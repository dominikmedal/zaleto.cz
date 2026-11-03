import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseJson } from '../src/lib/aiJson.ts'

test('parseJson: běžný JSON a obalení do ```json', () => {
  assert.deepEqual(parseJson('{"a":1}'), { a: 1 })
  assert.deepEqual(parseJson('```json\n{"a":[1,2]}\n```'), { a: [1, 2] })
})

test('parseJson: surové zalomení řádku a tabulátor uvnitř řetězce (původní chyba „Bad control character“)', () => {
  const raw = '{"title":"A","content":"řádek 1\nřádek 2\tTab \\"citát\\" a zpětné \\\\ lomítko","n":[1,2]}'
  assert.throws(() => JSON.parse(raw))
  const r = parseJson<{ title: string; content: string; n: number[] }>(raw)
  assert.equal(r.title, 'A')
  assert.equal(r.content, 'řádek 1\nřádek 2\tTab "citát" a zpětné \\ lomítko')
  assert.deepEqual(r.n, [1, 2])
})

test('parseJson: JSON obklopený textem a s řídicími znaky', () => {
  const r = parseJson<{ x: string }>('Tady je výsledek:\n```json\n{"x":"a\nb"}\n```\nHotovo.')
  assert.equal(r.x, 'a\nb')
})

test('parseJson: bez JSON vyhodí chybu', () => {
  assert.throws(() => parseJson('žádný json'), /neobsahuje JSON/)
})
