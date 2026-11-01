import { query } from './db'

/** Hledání ve schválených cestopisech (název nebo destinace). Samostatný modul bez dalších závislostí, aby ho mohlo importovat hledání. */
export async function searchTravelogues(t: string, limit: number): Promise<{ title: string; destination: string; author: string; href: string }[]> {
  try {
    const like = `%${t.replace(/[%_\\]/g, m => '\\' + m)}%`
    const N = (c: string) => `translate(lower(${c}), 'áäčďéěëíňóöřšťúůüýž', 'aacdeeeinoorstuuuyz')`
    const r = await query<{ slug: string; title: string; destination: string; author_name: string }>(
      `SELECT slug, title, destination, author_name FROM travelogues WHERE status = 'approved' AND (${N('title')} LIKE ? OR ${N('destination')} LIKE ?) ORDER BY approved_at DESC LIMIT ?`,
      [like, like, limit])
    return r.rows.map(x => ({ title: x.title, destination: x.destination, author: x.author_name, href: `/cestopisy/${x.slug}` }))
  } catch { return [] }
}
