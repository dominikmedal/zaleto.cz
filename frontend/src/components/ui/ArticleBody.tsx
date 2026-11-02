import Link from 'next/link'
import type { ReactNode } from 'react'

/** Odkaz, který se v textu doplní automaticky (první výskyt názvu destinace → její průvodce). */
export interface AutoLink { name: string; href: string }

interface Ctx { links: { href: string; re: RegExp }[]; used: Set<string>; max: number }

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function makeCtx(links: AutoLink[] = [], max = 6): Ctx {
  return {
    links: links.filter(l => l.name.length >= 4).map(l => ({ href: l.href, re: new RegExp(String.raw`(?<![\p{L}\d])` + esc(l.name) + String.raw`(?![\p{L}\d])`, 'u') })),
    used: new Set(), max,
  }
}

/** První výskyt každé destinace v prostém textu nahradí odkazem (nejvýš `max` odkazů v celém článku). */
function autolink(text: string, ctx: Ctx, key: string): ReactNode[] {
  let parts: ReactNode[] = [text]
  for (const l of ctx.links) {
    if (ctx.used.has(l.href) || ctx.used.size >= ctx.max) continue
    let hit = false
    const out: ReactNode[] = []
    for (const part of parts) {
      const m = !hit && typeof part === 'string' ? l.re.exec(part) : null
      if (!m || typeof part !== 'string') { out.push(part); continue }
      hit = true
      out.push(part.slice(0, m.index), <Link key={`${key}-${l.href}`} href={l.href}>{m[0]}</Link>, part.slice(m.index + m[0].length))
    }
    parts = out
    if (hit) ctx.used.add(l.href)
  }
  return parts
}

function inline(text: string, ctx: Ctx, key: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((p, i) => (p.startsWith('**') && p.endsWith('**')
    ? <strong key={i}>{p.slice(2, -2)}</strong>
    : <span key={i} style={{ display: 'contents' }}>{autolink(p, ctx, `${key}-${i}`)}</span>))
}

/** Sazba článku (`z-prose`): ## → h2, # → h2, * / - → odrážky s modrou tečkou, první odstavec s iniciálou. */
export default function ArticleBody({ content, insert, links }: { content: string; insert?: ReactNode; links?: AutoLink[] }) {
  const lines = content.split('\n')
  const out: ReactNode[] = []
  const ctx = makeCtx(links)
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
