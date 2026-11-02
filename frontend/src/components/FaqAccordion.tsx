import { FAQS } from './faq-data'
import AutoLinked from '@/components/AutoLinked'

export { FAQS }

/** Otázky jako rozbalovací položky (nativní <details>, funguje i bez JS). */
export default function FaqAccordion() {
  return (
    <div>
      {FAQS.map(({ q, a }) => (
        <details key={q} className="z-faq">
          <summary>
            <span className="h4">{q}</span>
          </summary>
          <p><AutoLinked text={a} /></p>
        </details>
      ))}
    </div>
  )
}
