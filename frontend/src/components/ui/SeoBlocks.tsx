import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import { formatPrice } from '@/components/ui/format'
import { MONTHS, RATING_LABEL, type AudienceItem, type DestinationSeo, type FaqItem } from '@/lib/seoContent'

/** Odstavce z textu s \n\n (AI texty se ukládají s prázdným řádkem mezi odstavci). */
export function Paragraphs({ text, lead }: { text: string; lead?: boolean }) {
  return <>{text.split(/\n\s*\n/).filter(Boolean).map((p, i) => <p key={i} className={lead && i === 0 ? 'z-lead' : undefined}>{p}</p>)}</>
}

/** „Pro koho“: skupina + jedna věta proč. */
export function AudienceList({ items }: { items: AudienceItem[] }) {
  if (!items.length) return null
  return (
    <ul className="z-who">
      {items.map(a => <li key={a.who}><b>{a.who}</b><span>{a.text}</span></li>)}
    </ul>
  )
}

/** Časté otázky jako nativní <details> (funguje bez JS, text je v HTML pro vyhledávače). */
export function FaqList({ items }: { items: FaqItem[] }) {
  return (
    <div>
      {items.map(({ q, a }) => (
        <details key={q} className="z-faq">
          <summary><span className="h4">{q}</span></summary>
          <p>{a}</p>
        </details>
      ))}
    </div>
  )
}

/** Strukturovaná data FAQPage; odpovědi musí odpovídat viditelnému textu. */
export function faqSchema(items: FaqItem[]) {
  return items.length ? {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: items.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
  } : null
}

/** Průhledná poznámka o původu textu (AI + data Zaleto) a datum poslední aktualizace. */
export function AiNote({ at, what = 'Text' }: { at: string; what?: string }) {
  const d = new Date(at)
  const when = Number.isNaN(d.getTime()) ? '' : ` · aktualizováno ${d.toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' })}`
  return (
    <p className="z-data z-ainote" style={{ textTransform: 'none' }}>
      <Icon name="info" size="sm" />{what} připravila redakce Zaleto s pomocí AI z údajů cestovních kanceláří a našich dat{when}.
    </p>
  )
}

/** Dvanáct měsíců: hodnocení sezóny, krátký popis a nejnižší cena zájezdu z našich dat. */
export function MonthsGrid({ seo }: { seo: DestinationSeo }) {
  const prices = seo.stats.monthly ?? {}
  return (
    <div className="z-months">
      {seo.months.map(m => (
        <div key={m.month} className={`z-month z-month--${m.rating}`}>
          <div className="z-month__head">
            <h3>{MONTHS[m.month - 1]}</h3>
            <span className="z-month__tag">{RATING_LABEL[m.rating]}</span>
          </div>
          <p>{m.text}</p>
          {prices[String(m.month)] ? <span className="z-month__price">zájezdy od {formatPrice(prices[String(m.month)])}</span> : null}
        </div>
      ))}
    </div>
  )
}

/** Odkazy na související stránky: vnitřní prolinkování (průvodci, přehledy, počasí, články). */
export function LinkList({ title, links }: { title: string; links: { href: string; label: string; hint?: string }[] }) {
  if (!links.length) return null
  return (
    <nav aria-label={title} className="z-linklist">
      <div className="z-kicker">{title}</div>
      <ul>
        {links.map(l => (
          <li key={l.href}><Link href={l.href}>{l.label}</Link>{l.hint && <small>{l.hint}</small>}</li>
        ))}
      </ul>
    </nav>
  )
}
