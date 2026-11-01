import { query } from './db'

let ready: Promise<void> | null = null

/** Sloupce a tabulky automatizace článků; vytvoří se při prvním použití a existující data se nemění. */
export function ensureAutomationSchema(): Promise<void> {
  ready ??= (async () => {
    await query(`ALTER TABLE articles ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'published'`)
    await query(`ALTER TABLE articles ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ`)
    await query(`ALTER TABLE articles ADD COLUMN IF NOT EXISTS auto_published BOOLEAN NOT NULL DEFAULT FALSE`)
    await query(`ALTER TABLE articles ADD COLUMN IF NOT EXISTS source_url TEXT`)
    await query(`ALTER TABLE articles ADD COLUMN IF NOT EXISTS source_name TEXT`)
    await query(`CREATE TABLE IF NOT EXISTS scrape_sources (
      id SERIAL PRIMARY KEY, name TEXT NOT NULL, feed_url TEXT NOT NULL UNIQUE,
      enabled BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`)
    await query(`CREATE TABLE IF NOT EXISTS automation_settings (
      id INT PRIMARY KEY, enabled BOOLEAN NOT NULL DEFAULT FALSE,
      max_per_day INT NOT NULL DEFAULT 3, min_score INT NOT NULL DEFAULT 7)`)
    await query(`INSERT INTO automation_settings (id) VALUES (1) ON CONFLICT DO NOTHING`)
    await query(`CREATE TABLE IF NOT EXISTS auto_publish_runs (
      id SERIAL PRIMARY KEY, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      candidates INT NOT NULL DEFAULT 0, decisions JSONB NOT NULL DEFAULT '[]', note TEXT)`)
    // výchozí zdroje (jen při prvním vytvoření; později je spravuje administrace)
    const n = await query('SELECT COUNT(*)::int AS n FROM scrape_sources')
    if (n.rows[0].n === 0) {
      for (const [name, url, enabled] of DEFAULT_SOURCES) {
        await query('INSERT INTO scrape_sources (name, feed_url, enabled) VALUES (?, ?, ?) ON CONFLICT DO NOTHING', [name, url, enabled])
      }
    }
  })().catch(e => { ready = null; throw e })
  return ready
}

export const DEFAULT_SOURCES: [string, string, boolean][] = [
  ['Condé Nast Traveler', 'https://www.cntraveler.com/feed/rss', true],
  ['Matador Network', 'https://matadornetwork.com/feed/', true],
  ['Novinky.cz – Cestování', 'https://www.novinky.cz/rss/cestovani', true],
  ['Skift (cestovní ruch)', 'https://skift.com/feed/', false],
]
