/**
 * Model občas vloží do textových hodnot JSON surové zalomení řádku / tabulátor (zvlášť v dlouhém `content`),
 * což JSON.parse odmítne („Bad control character in string literal“). Uvnitř řetězců je doescapujeme.
 */
export function escapeControlCharsInStrings(json: string): string {
  let out = ''
  let inStr = false
  let esc = false
  for (const ch of json) {
    if (inStr) {
      if (esc) { out += ch; esc = false; continue }
      if (ch === '\\') { out += ch; esc = true; continue }
      if (ch === '"') { out += ch; inStr = false; continue }
      const code = ch.charCodeAt(0)
      if (code < 0x20) {
        out += code === 10 ? '\\n' : code === 13 ? '\\r' : code === 9 ? '\\t' : '\\u' + code.toString(16).padStart(4, '0')
        continue
      }
      out += ch
    } else {
      if (ch === '"') inStr = true
      out += ch
    }
  }
  return out
}

/** Vytáhne JSON (objekt nebo pole) z odpovědi, i když je obalený do ```json nebo obsahuje surové řídicí znaky. */
export function parseJson<T>(text: string): T {
  const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  try { return JSON.parse(clean) as T } catch { /* zkusíme opravit řídicí znaky / najít první JSON blok */ }
  try { return JSON.parse(escapeControlCharsInStrings(clean)) as T } catch { /* dál */ }
  const m = clean.match(/[\[{][\s\S]*[\]}]/)
  if (!m) throw new Error('Odpověď modelu neobsahuje JSON')
  try { return JSON.parse(m[0]) as T } catch { return JSON.parse(escapeControlCharsInStrings(m[0])) as T }
}
