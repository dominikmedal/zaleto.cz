'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchActionRuns, fetchActionJobs, type ActionRun, type ActionJob } from '@/lib/adminApi'
import { PageHead, ErrorBox, Loading, EmptyState } from '@/components/admin/AdminUI'

const fmt = (s: string) => new Date(s).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })
const dur = (a: string | null, b: string) => {
  if (!a) return ''
  const sec = Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 1000))
  return sec < 60 ? `${sec} s` : sec < 3600 ? `${Math.floor(sec / 60)} min ${sec % 60} s` : `${Math.floor(sec / 3600)} h ${Math.floor((sec % 3600) / 60)} min`
}
const state = (s: string, c: string | null): 'run' | 'ok' | 'bad' | 'idle' =>
  s !== 'completed' ? (s === 'queued' || s === 'waiting' ? 'idle' : 'run') : c === 'success' ? 'ok' : c === 'cancelled' || c === 'skipped' ? 'idle' : 'bad'
const TXT = { run: 'běží', ok: 'hotovo', bad: 'selhalo', idle: 'čeká / zrušeno' }

function LogView({ run, live }: { run: number; live: boolean }) {
  const [jobs, setJobs] = useState<ActionJob[] | null>(null)
  const [err, setErr] = useState('')
  const box = useRef<HTMLPreElement>(null)
  const load = useCallback(async () => {
    try { const r = await fetchActionJobs(run); if (r.error) setErr(r.error); else setJobs(r.jobs) } catch (e) { setErr(e instanceof Error ? e.message : 'Chyba') }
  }, [run])
  useEffect(() => { load() }, [load])
  useEffect(() => { if (!live) return; const t = setInterval(load, 8000); return () => clearInterval(t) }, [live, load])
  useEffect(() => { const el = box.current; if (el && live) el.scrollTop = el.scrollHeight }, [jobs, live])
  if (err) return <ErrorBox text={err} />
  if (!jobs) return <Loading />
  return (
    <div className="z-admlog">
      {jobs.map(j => (
        <div key={j.id}>
          <div className="z-admlog__job"><span className={`z-adminact__dot z-admact-${state(j.status, j.conclusion)}`} /><b>{j.name}</b>
            <span className="z-data">{j.steps.filter(s => s.conclusion === 'success').length}/{j.steps.length} kroků</span></div>
          <pre ref={jobs.length === 1 ? box : undefined} tabIndex={0}>{j.log || '(prázdný log)'}</pre>
        </div>
      ))}
    </div>
  )
}

export default function AkcePage() {
  const [data, setData] = useState<{ configured: boolean; runs: ActionRun[]; error?: string } | null>(null)
  const [open, setOpen] = useState<number | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try { setData(await fetchActionRuns()); setError('') } catch (e) { setError(e instanceof Error ? e.message : 'Chyba') }
  }, [])
  useEffect(() => { load() }, [load])
  const anyRunning = !!data?.runs.some(r => r.status !== 'completed')
  useEffect(() => { const t = setInterval(load, anyRunning ? 10000 : 60000); return () => clearInterval(t) }, [load, anyRunning])
  useEffect(() => { if (data && open == null) { const r = data.runs.find(x => x.status === 'in_progress'); if (r) setOpen(r.id) } }, [data, open])

  return (
    <div className="z-admin__stack">
      <PageHead kicker="Automatizace" title="logy akcí" sub="Běhy GitHub Actions (scrapery, AI obsah, fotky). Běžící akce se obnovují samy." />
      {error && <ErrorBox text={error} />}
      {!data ? <Loading /> : !data.configured ? (
        <div className="z-info" style={{ padding: 'var(--space-5)' }}>
          <h2 className="h3">chybí přístup ke GitHubu<span className="z-dot">.</span></h2>
          <p className="body">Ve Vercelu (Settings → Environment Variables) přidej <code>GITHUB_TOKEN</code>: fine-grained token pro repozitář zaleto.cz s právem <b>Actions: Read-only</b>. Po novém nasazení se logy tady objeví.</p>
        </div>
      ) : data.error ? <ErrorBox text={data.error} /> : data.runs.length === 0 ? <EmptyState icon="cas" text="Žádné běhy." /> : (
        <ul className="z-admruns">
          {data.runs.map(r => {
            const st = state(r.status, r.conclusion)
            return (
              <li key={r.id} data-state={st}>
                <button type="button" className="z-admruns__head" onClick={() => setOpen(open === r.id ? null : r.id)} aria-expanded={open === r.id}>
                  <span className={`z-adminact__dot z-admact-${st}`} />
                  <b>{r.name}</b>
                  <span className="z-data">{TXT[st]} · {r.event === 'schedule' ? 'plán' : r.event === 'workflow_dispatch' ? 'ručně' : r.event} · {fmt(r.created_at)} · {dur(r.started_at ?? r.created_at, r.status === 'completed' ? r.updated_at : new Date().toISOString())}</span>
                </button>
                {open === r.id && (
                  <div className="z-admruns__body">
                    <a className="z-more" href={r.url} target="_blank" rel="noopener noreferrer">Otevřít na GitHubu</a>
                    <LogView run={r.id} live={st === 'run'} />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
