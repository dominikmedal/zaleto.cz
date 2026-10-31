import type { ReactNode } from 'react'
import Icon, { type IconName } from './Icon'

interface Props {
  title: string
  text: string
  icon: IconName
  /** Volitelné údaje pod textem (vzdálenost, doba jízdy…). */
  meta?: ReactNode
}

/** Karta s místem / jídlem / výletem: lístek s perforací, vpravo ústřižek s ikonou a modrou tečkou na trase. */
export default function ItemCard({ title, text, icon, meta }: Props) {
  return (
    <article className="z-tk z-tk--v z-itemcard" style={{ ['--stub' as string]: '96px' }}>
      <div className="z-tk__in z-itemcard__in">
        <div className="z-itemcard__body">
          <h3 className="h4">{title}</h3>
          <p>{text}</p>
          {meta && <div className="z-meta" style={{ marginTop: 'var(--space-3)' }}>{meta}</div>}
        </div>
        <div className="z-itemcard__stub" aria-hidden="true">
          <span className="z-itemcard__ic"><Icon name={icon} /></span>
          <span className="z-itemcard__route" />
          <span className="z-itemcard__dot" />
        </div>
      </div>
    </article>
  )
}
