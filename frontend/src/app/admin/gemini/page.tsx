'use client'
import { useEffect, useState } from 'react'
import { fetchAiUsage, type AiUsage } from '@/lib/adminApi'
import { PageHead, ErrorBox, Loading } from '@/components/admin/AdminUI'

const KIND: Record<string, string> = {
  destination: 'Popisy destinací', weather: 'Počasí', car_rental: 'Půjčovny aut', guide: 'Průvodci oblastí', hotel: 'Hotely: shrnutí', destination_seo: 'Destinace: kdy jet', landing: 'Přehledy zájezdů', article: 'Články (GitHub Actions)',
  article_select: 'Články: výběr zdrojů', article_rewrite: 'Články: přepis', cover: 'Titulní obrázky', text: 'Ostatní text',
}
const fmtKc = (n: number) => `${Math.round(n).toLocaleString('cs-CZ')} Kč`
const fmtKcSmall = (n: number) => (n < 10 ? `${n.toLocaleString('cs-CZ', { maximumFractionDigits: 2 })} Kč` : fmtKc(n))
const fmtDate = (s: string) => new Date(s).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' })

export default function GeminiPage() {
  const [d, setD] = useState<AiUsage | null>(null)
  const [error, setError] = useState('')
  const [rate, setRate] = useState(23)

  useEffect(() => {
    try { const r = Number(localStorage.getItem('usd_czk')); if (r > 5 && r < 100) setRate(r) } catch { /* ignore */ }
    fetchAiUsage().then(setD).catch(e => setError(e instanceof Error ? e.message : 'Chyba'))
  }, [])
  const setRateSave = (v: number) => { setRate(v); try { localStorage.setItem('usd_czk', String(v)) } catch { /* ignore */ } }

  if (error) return <ErrorBox text={error} />
  if (!d) return <Loading />

  const kc = (usd: number) => usd * rate
  const maxDay = Math.max(0.0001, ...d.byDay.map(x => x.usd))

  return (
    <div className="z-admin__stack">
      <PageHead kicker="Automatizace" title="náklady na AI" sub="Orientační přehled útraty za Gemini v celém projektu (web i GitHub Actions). Skutečné částky jsou ve fakturaci Google AI Studio." />

      <label className="z-admcost__rate">Kurz 1 USD = <input type="number" min={10} max={60} step={0.1} value={rate} onChange={e => setRateSave(Number(e.target.value) || 23)} /> Kč</label>

      <div className="z-admin__tiles">
        <div className="z-tk z-admintile"><div className="z-tk__in"><span className="z-admintile__value">{fmtKcSmall(kc(d.month))}</span><span className="z-kicker">Tento měsíc</span><span className="z-data" style={{ textTransform: 'none' }}>naměřeno</span></div></div>
        <div className="z-tk z-admintile"><div className="z-tk__in"><span className="z-admintile__value">{fmtKcSmall(kc(d.last30))}</span><span className="z-kicker">Posledních 30 dní</span><span className="z-data" style={{ textTransform: 'none' }}>naměřeno</span></div></div>
        <div className="z-tk z-admintile"><div className="z-tk__in"><span className="z-admintile__value">{fmtKcSmall(kc(d.tracked.total_usd))}</span><span className="z-kicker">Naměřeno celkem</span><span className="z-data" style={{ textTransform: 'none' }}>{d.tracked.since ? `od ${fmtDate(d.tracked.since)} · ${d.tracked.calls.toLocaleString('cs-CZ')} volání` : 'měření právě začalo'}</span></div></div>
        <div className="z-tk z-admintile"><div className="z-tk__in"><span className="z-admintile__value">≈ {fmtKc(kc(d.estimateUsd))}</span><span className="z-kicker">Odhad za vše dosud</span><span className="z-data" style={{ textTransform: 'none' }}>podle počtu položek</span></div></div>
      </div>

      <section className="z-info" style={{ padding: 'var(--space-5)' }}>
        <h2 className="z-info__title" style={{ fontSize: 24, lineHeight: '28px' }}>posledních 30 dní<span className="z-dot">.</span></h2>
        {d.byDay.length === 0 ? <p className="z-data" style={{ textTransform: 'none' }}>Zatím žádná naměřená volání. Záznamy se začnou ukládat s dalším během generování.</p> : (
          <div className="z-admcost__bars" role="img" aria-label="Denní náklady">
            {d.byDay.map(x => (
              <div key={x.day} className="z-admcost__bar" title={`${fmtDate(x.day)}: ${fmtKcSmall(kc(x.usd))}`}>
                <i style={{ height: `${Math.max(4, (x.usd / maxDay) * 100)}%` }} />
                <span>{new Date(x.day).getDate()}.</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="z-grid-2">
        <section className="z-info" style={{ padding: 'var(--space-5)' }}>
          <h2 className="z-info__title" style={{ fontSize: 24, lineHeight: '28px', marginBottom: 'var(--space-3)' }}>naměřeno podle druhu<span className="z-dot">.</span></h2>
          {d.byKind.length === 0 ? <p className="z-data" style={{ textTransform: 'none' }}>Zatím nic.</p> : (
            <table className="z-admcost__table">
              <thead><tr><th>Druh</th><th>Volání</th><th>Tokeny (vstup / výstup)</th><th>Cena</th></tr></thead>
              <tbody>
                {d.byKind.map(k => (
                  <tr key={`${k.source}/${k.kind}`}>
                    <td>{KIND[k.kind] ?? k.kind}<small>{k.source === 'web' ? 'web' : 'GitHub Actions'}</small></td>
                    <td>{k.calls.toLocaleString('cs-CZ')}</td>
                    <td>{k.in.toLocaleString('cs-CZ')} / {k.out.toLocaleString('cs-CZ')}{k.images ? ` · ${k.images} obr.` : ''}</td>
                    <td>{fmtKcSmall(kc(k.usd))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="z-info" style={{ padding: 'var(--space-5)' }}>
          <h2 className="z-info__title" style={{ fontSize: 24, lineHeight: '28px', marginBottom: 'var(--space-3)' }}>odhad podle obsahu<span className="z-dot">.</span></h2>
          <table className="z-admcost__table">
            <thead><tr><th>Obsah</th><th>Položek</th><th>Odhad</th></tr></thead>
            <tbody>
              {d.estimate.map(e => (
                <tr key={e.kind}><td>{e.label}</td><td>{e.count.toLocaleString('cs-CZ')}</td><td>≈ {fmtKcSmall(kc(e.usd))}</td></tr>
              ))}
              <tr className="z-admcost__sum"><td colSpan={2}>Celkem</td><td>≈ {fmtKc(kc(d.estimateUsd))}</td></tr>
            </tbody>
          </table>
          <p className="z-data" style={{ textTransform: 'none', marginTop: 'var(--space-3)' }}>Zpětný odhad počítá průměrnou spotřebu tokenů na položku (např. popis destinace ≈ 700 vstupních a 2 600 výstupních tokenů). Neobsahuje opakované pokusy ani zahozené odpovědi, proto je skutečná útrata o něco vyšší. Naměřená čísla vlevo jsou přesnější a rostou s každým během.</p>
        </section>
      </div>
    </div>
  )
}
