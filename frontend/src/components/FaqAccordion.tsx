import { FAQS } from './faq-data'

export { FAQS }

/** Otázky jako rozbalovací položky (nativní <details>, funguje i bez JS). */
export default function FaqAccordion() {
  return (
    <div>
      {FAQS.map(({ q, a }, i) => (
        <details key={q} className="z-faq">
          <summary>
            <span className="z-kicker" style={{ color: 'var(--brand-strong)' }}>{String(i + 1).padStart(2, '0')}</span>
            <span className="h4">{q}</span>
          </summary>
          <p>{a}</p>
        </details>
      ))}
    </div>
  )
}
