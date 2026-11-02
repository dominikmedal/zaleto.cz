import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import { Linked, type AutoLink } from '@/lib/autolink'
import { formatPrice } from '@/components/ui/format'
import { MONTHS, RATING_LABEL, type AudienceItem, type DestinationSeo, type FaqItem, type MonthRating } from '@/lib/seoContent'

/** Odstavce z textu s \n\n (AI texty se ukládají s prázdným řádkem mezi odstavci). */
export function Paragraphs({ text, lead, links, exclude }: { text: string; lead?: boolean; links?: AutoLink[]; exclude?: string[] }) {
  return <>{text.split(/\n\s*\n/).filter(Boolean).map((p, i) => <p key={i} className={lead && i === 0 ? 'z-lead' : undefined}><Linked text={p} links={links} exclude={exclude} /></p>)}</>
}

/** „Pro koho“: skupina + jedna věta proč. */
export function AudienceList({ items, links, exclude }: { items: AudienceItem[]; links?: AutoLink[]; exclude?: string[] }) {
  if (!items.length) return null
  return (
    <ul className="z-who">
      {items.map(a => <li key={a.who}><b>{a.who}</b><span><Linked text={a.text} links={links} exclude={exclude} /></span></li>)}
    </ul>
  )
}

/** Časté otázky jako nativní <details> (funguje bez JS, text je v HTML pro vyhledávače). */
export function FaqList({ items, links, exclude }: { items: FaqItem[]; links?: AutoLink[]; exclude?: string[] }) {
  return (
    <div>
      {items.map(({ q, a }) => (
        <details key={q} className="z-faq">
          <summary><span className="h4">{q}</span></summary>
          <p><Linked text={a} links={links} exclude={exclude} /></p>
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

/** Poznámka o autorovi textu (redakce Zaleto) a datum poslední aktualizace. */
export function AiNote({ at, what = 'Text' }: { at: string; what?: string }) {
  const d = new Date(at)
  const when = Number.isNaN(d.getTime()) ? '' : ` · aktualizováno ${d.toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' })}`
  return (
    <p className="z-data z-ainote" style={{ textTransform: 'none' }}>
      <Icon name="info" size="sm" />{what} připravila redakce Zaleto{when}.
    </p>
  )
}

const RATING_DOTS: Record<MonthRating, number> = { top: 3, dobre: 2, prumer: 1, slabe: 0 }

/** Odznak hodnocení: tři tečky (vyplněné = kolik toho měsíc nabízí) a popisek. */
export function RatingBadge({ rating }: { rating: MonthRating }) {
  return (
    <span className={`z-rate z-rate--${rating}`}>
      <span className="z-rate__dots" aria-hidden="true">{[0, 1, 2].map(i => <i key={i} className={i < RATING_DOTS[rating] ? 'on' : undefined} />)}</span>
      {RATING_LABEL[rating]}
    </span>
  )
}

/** Dvanáct měsíců: hodnocení sezóny, krátký popis a nejnižší cena zájezdu z našich dat. */
export function MonthsGrid({ seo }: { seo: DestinationSeo }) {
  const prices = seo.stats.monthly ?? {}
  const hasPrices = Object.keys(prices).length > 0
  const thousands = (v: number) => (v / 1000).toLocaleString('cs-CZ', { maximumFractionDigits: 1 })
  return (
    <div>
      {/* osa celého roku: výška sloupce = hodnocení měsíce, pod ním nejnižší cena zájezdu */}
      <div className="z-mseason" role="img" aria-label="Hodnocení sezóny po měsících">
        {seo.months.map(m => (
          <div key={m.month} className={`z-mseason__col z-mseason__col--${m.rating}`} title={`${MONTHS[m.month - 1]}: ${RATING_LABEL[m.rating]}`}>
            <div className="z-mseason__bar"><i /></div>
            <span className="z-mseason__name">{MONTHS[m.month - 1].slice(0, 3)}</span>
            {hasPrices && <span className="z-mseason__price">{prices[String(m.month)] ? thousands(prices[String(m.month)]) : '–'}</span>}
          </div>
        ))}
      </div>
      <div className="z-mseason__legend">
        <span className="z-mseason__key">
          {(['top', 'dobre', 'prumer', 'slabe'] as const).map(r => (
            <span key={r} className="z-mseason__keyitem"><i className={`z-mseason__sw z-mseason__sw--${r}`} />{RATING_LABEL[r]}</span>
          ))}
          <span>= jak se v daném měsíci hodí jet na dovolenou</span>
        </span>
        {hasPrices && <span>Číslo pod měsícem = nejnižší cena zájezdu v tisících Kč (7,3 = 7 300 Kč)</span>}
      </div>

      {/* popis každého měsíce: nejlepší měsíce jsou rozbalené, ostatní jedním klikem */}
      <div className="z-mlist">
        {seo.months.map(m => (
          <details key={m.month} className={`z-mrow z-mrow--${m.rating}`} open={m.rating === 'top'}>
            <summary>
              <span className="z-mrow__name">{MONTHS[m.month - 1]}</span>
              <RatingBadge rating={m.rating} />
              <span className="z-mrow__price">{prices[String(m.month)] ? <><small>od</small>{formatPrice(prices[String(m.month)])}</> : ''}</span>
            </summary>
            <p>{m.text}</p>
          </details>
        ))}
      </div>
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
