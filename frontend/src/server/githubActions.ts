import 'server-only'

/**
 * Přehled a logy GitHub Actions pro administraci.
 * Potřebuje GITHUB_TOKEN (fine-grained token jen s právem Actions: Read-only pro tento repozitář).
 */

const REPO = process.env.GITHUB_REPO || 'dominikmedal/zaleto.cz'

export const actionsConfigured = () => !!process.env.GITHUB_TOKEN

async function gh(path: string, init: RequestInit = {}) {
  return fetch(`https://api.github.com/repos/${REPO}${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'zaleto-admin',
    },
  })
}

export interface RunRow {
  id: number; name: string; status: string; conclusion: string | null; event: string
  created_at: string; started_at: string | null; updated_at: string; url: string; branch: string
}

export async function listRuns(): Promise<{ configured: boolean; runs: RunRow[]; error?: string }> {
  if (!actionsConfigured()) return { configured: false, runs: [] }
  const r = await gh('/actions/runs?per_page=30')
  if (!r.ok) return { configured: true, runs: [], error: `GitHub API ${r.status}` }
  const d = await r.json() as { workflow_runs: Record<string, unknown>[] }
  return {
    configured: true,
    runs: d.workflow_runs.map(w => ({
      id: w.id as number, name: (w.name as string) ?? '', status: w.status as string, conclusion: (w.conclusion as string) ?? null,
      event: w.event as string, created_at: w.created_at as string, started_at: (w.run_started_at as string) ?? null,
      updated_at: w.updated_at as string, url: w.html_url as string, branch: w.head_branch as string,
    })),
  }
}

const TAIL = 400
/** Zkrátí log: bez časových značek GitHubu a ovládacích značek, jen posledních TAIL řádků. */
function tidy(text: string): string {
  const lines = text.split('\n')
    .map(l => l.replace(/^\uFEFF/, '').replace(/^\d{4}-\d\d-\d\dT(\d\d:\d\d:\d\d)\.\d+Z /, '$1 '))
    .filter(l => !/^\S* ?##\[(group|endgroup)\]/.test(l.replace(/^\d\d:\d\d:\d\d /, '')))
  return (lines.length > TAIL ? ['… (začátek zkrácen)', ...lines.slice(-TAIL)] : lines).join('\n')
}

export interface JobLog { id: number; name: string; status: string; conclusion: string | null; steps: { name: string; status: string; conclusion: string | null }[]; log: string }

export async function runJobs(runId: number): Promise<{ jobs: JobLog[]; error?: string }> {
  if (!actionsConfigured()) return { jobs: [] }
  const r = await gh(`/actions/runs/${runId}/jobs?per_page=20`)
  if (!r.ok) return { jobs: [], error: `GitHub API ${r.status}` }
  const d = await r.json() as { jobs: { id: number; name: string; status: string; conclusion: string | null; steps?: { name: string; status: string; conclusion: string | null }[] }[] }
  const jobs = await Promise.all(d.jobs.map(async j => {
    let log = ''
    try {
      const lr = await gh(`/actions/jobs/${j.id}/logs`) // přesměruje na dočasný odkaz; fetch ho následuje
      log = lr.ok ? tidy(await lr.text()) : lr.status === 404 ? '(log zatím není k dispozici)' : `(log nelze načíst: ${lr.status})`
    } catch { log = '(log nelze načíst)' }
    return { id: j.id, name: j.name, status: j.status, conclusion: j.conclusion, steps: (j.steps ?? []).map(s => ({ name: s.name, status: s.status, conclusion: s.conclusion })), log }
  }))
  return { jobs }
}
