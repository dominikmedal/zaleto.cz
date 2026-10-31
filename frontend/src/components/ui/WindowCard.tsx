import Link from 'next/link'
import Icon from './Icon'

interface Props {
  href: string
  name: string
  photo?: string | null
  /** Např. „od 18 990 Kč“ nebo „Last minute“ – razítko přes okénko. */
  stamp?: string | null
  count?: number
  countLabel?: string
}

/** Destinace v okénku letadla (`radius-window`, bílý rámeček, 4:5). */
export default function WindowCard({ href, name, photo, stamp, count, countLabel = 'zájezdů' }: Props) {
  return (
    <Link className="z-window" href={href}>
      <div className="z-window__frame">
        <div className="z-window__glass">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {photo && <img src={photo} alt="" loading="lazy" />}
        </div>
        {stamp && <span className="z-stamp z-stamp--fill">{stamp}</span>}
      </div>
      <div className="z-window__cap">
        <h3 className="z-window__name">{name}</h3>
        {count != null && count > 0 && <span className="z-window__count"><Icon name="plaz" />{count} {countLabel}</span>}
      </div>
    </Link>
  )
}
