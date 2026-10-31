const db = require('./db')

/**
 * Prompt upravený v administraci (tabulka ai_prompts); když chybí nebo DB selže, použije se výchozí text z kódu.
 * Proměnné {{name}}, {{country}}, {{topic}} se nahradí hodnotami z `vars`.
 */
async function loadPrompt(key, vars, fallback) {
  try {
    const r = await db.query('SELECT template FROM ai_prompts WHERE key = $1', [key])
    if (r.rows[0]?.template) return r.rows[0].template.replace(/\{\{(\w+)\}\}/g, (m, k) => (vars[k] ?? m))
  } catch { /* tabulka ještě neexistuje */ }
  return fallback
}

module.exports = { loadPrompt }
