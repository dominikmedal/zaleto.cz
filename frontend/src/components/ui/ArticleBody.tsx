import type { ReactNode } from 'react'
import { makeAutoLinkCtx, autolinkText, type AutoLink, type AutoLinkCtx } from '@/lib/autolink'

function inline(text: string, ctx: AutoLinkCtx, key: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((p, i) => (p.startsWith('**') && p.endsWith('**')
    ? <strong key={i}>{p.slice(2, -2)}</strong>
    : <span key={i} style={{ display: 'contents' }}>{autolinkText(p, ctx, `${key}-${i}`)}</span>))
}

/** Sazba článku (`z-prose`): ## → h2, # → h2, * / - → odrážky s modrou tečkou, první odstavec s iniciálou. */
export default function ArticleBody({ content, insert, links }: { content: string; insert?: ReactNode; links?: AutoLink[] }) {
  const lines = content.split('\n')
  const out: ReactNode[] = []
  const ctx = makeAutoLinkCtx(links, 8)
  let key = 0
  let leadDone = false

  for (let i = 0; i < lines.length; ) {
    const t = lines[i].trim()
    if (!t) { i++; continue }

    if (t.startsWith('### ')) { out.push(<h3 key={key++}>{t.slice(4)}</h3>); i++ }
    else if (t.startsWith('## ')) { out.push(<h2 key={key++}>{t.slice(3)}</h2>); i++ }
    else if (t.startsWith('# ')) { out.push(<h2 key={key++}>{t.slice(2)}</h2>); i++ }
    else if (/^[*-]\s/.test(t)) {
      const items: string[] = []
      while (i < lines.length && /^[*-]\s/.test(lines[i].trim())) { items.push(lines[i].trim().slice(2)); i++ }
      out.push(<ul key={key++}>{items.map((it, j) => <li key={j}>{inline(it, ctx, `l${key}-${j}`)}</li>)}</ul>)
    } else if (t.startsWith('> ')) {
      out.push(<blockquote key={key++}>{inline(t.slice(2), ctx, `q${key}`)}</blockquote>); i++
    } else {
      out.push(<p key={key++} className={leadDone ? undefined : 'z-lead'}>{inline(t, ctx, `p${key}`)}</p>)
      leadDone = true
      i++
    }
  }
  if (insert) {
    // reklama doprostřed textu (po 3. až polovině bloků); u krátkého článku na konec
    const at = out.length >= 6 ? Math.min(Math.max(3, Math.floor(out.length / 2)), out.length - 1) : out.length
    out.splice(at, 0, <div key="insert" className="z-prose__ad">{insert}</div>)
  }
  return <div className="z-prose">{out}</div>
}
