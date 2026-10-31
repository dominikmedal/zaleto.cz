import defaults from './promptDefaults.json'
import { query } from './db'

export interface PromptRow {
  key: string; label: string; description: string; vars: string[]
  template: string; default_template: string; customized: boolean; updated_at: string | null
}

type Def = (typeof defaults)[number]

let ready: Promise<void> | null = null

/** Tabulka se vytvoří a naplní výchozími prompty při prvním použití; existující úpravy se nepřepisují. */
function ensure(): Promise<void> {
  ready ??= (async () => {
    await query(`CREATE TABLE IF NOT EXISTS ai_prompts (
      key TEXT PRIMARY KEY, template TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`)
  })().catch(e => { ready = null; throw e })
  return ready
}

const def = (key: string): Def | undefined => defaults.find(d => d.key === key)

export async function listPrompts(): Promise<PromptRow[]> {
  await ensure()
  const stored = (await query<{ key: string; template: string; updated_at: string }>('SELECT key, template, updated_at FROM ai_prompts')).rows
  return defaults.map(d => {
    const s = stored.find(r => r.key === d.key)
    return {
      key: d.key, label: d.label, description: d.description, vars: d.vars,
      template: s?.template ?? d.template, default_template: d.template,
      customized: !!s && s.template !== d.template, updated_at: s?.updated_at ?? null,
    }
  })
}

export async function savePrompt(key: string, template: string): Promise<void> {
  if (!def(key)) throw new Error('Neznámý prompt')
  await ensure()
  await query(`INSERT INTO ai_prompts (key, template, updated_at) VALUES (?, ?, NOW())
               ON CONFLICT (key) DO UPDATE SET template = EXCLUDED.template, updated_at = NOW()`, [key, template])
}

export async function resetPrompt(key: string): Promise<void> {
  await ensure()
  await query('DELETE FROM ai_prompts WHERE key = ?', [key])
}

/** Vrátí text promptu s dosazenými proměnnými ({{name}}, {{country}}, {{topic}}). Pro generování AI obsahu. */
export async function renderPrompt(key: string, vars: Record<string, string>): Promise<string> {
  const d = def(key)
  if (!d) throw new Error(`Neznámý prompt: ${key}`)
  let template = d.template
  try {
    await ensure()
    const r = await query<{ template: string }>('SELECT template FROM ai_prompts WHERE key = ?', [key])
    if (r.rows[0]) template = r.rows[0].template
  } catch { /* bez DB použijeme výchozí text */ }
  return template.replace(/\{\{(\w+)\}\}/g, (m, k) => vars[k] ?? m)
}
