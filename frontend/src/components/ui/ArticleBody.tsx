import type { ReactNode } from 'react'

function inline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  if (parts.length === 1) return text
  return parts.map((p, i) => (p.startsWith('**') && p.endsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : p))
}

/** Sazba článku (`z-prose`): ## → h2, # → h2, * / - → odrážky s modrou tečkou, první odstavec s iniciálou. */
export default function ArticleBody({ content }: { content: string }) {
  const lines = content.split('\n')
  const out: ReactNode[] = []
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
      out.push(<ul key={key++}>{items.map((it, j) => <li key={j}>{inline(it)}</li>)}</ul>)
    } else if (t.startsWith('> ')) {
      out.push(<blockquote key={key++}>{inline(t.slice(2))}</blockquote>); i++
    } else {
      out.push(<p key={key++} className={leadDone ? undefined : 'z-lead'}>{inline(t)}</p>)
      leadDone = true
      i++
    }
  }
  return <div className="z-prose">{out}</div>
}
