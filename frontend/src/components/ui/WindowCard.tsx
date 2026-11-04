import Photo from '@/components/ui/Photo'
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
  /** Affiliate odkaz mimo web: nová karta, rel sponsored. */
  external?: boolean
  /** Vlastní popisek pod názvem (místo počtu), např. termín. */
  sub?: string
}

/** Destinace v okénku letadla (`radius-window`, bílý rámeček, 4:5). */
export default function WindowCard({ href, name, photo, stamp, count, countLabel = 'zájezdů', external, sub }: Props) {
  const Wrap = (p: { children: React.ReactNode }) => external
    ? <a className="z-window" href={href} target="_blank" rel="noopener noreferrer sponsored">{p.children}</a>
    : <Link className="z-window" href={href}>{p.children}</Link>
  return (
    <Wrap>
      <div className="z-window__frame">
        <div className="z-window__glass">
                    {photo && <Photo widths={[240, 480]} sizes="(max-width: 767px) 45vw, 300px" src={photo} alt="" loading="lazy" />}
        </div>
        {stamp && <span className="z-stamp z-stamp--fill">{stamp}</span>}
      </div>
      <div className="z-window__cap">
        <h3 className="z-window__name">{name}</h3>
        {sub ? <span className="z-window__count"><Icon name="kalendar" />{sub}</span>
          : count != null && count > 0 && <span className="z-window__count"><Icon name="hotel" />{count} {countLabel}</span>}
      </div>
    </Wrap>
  )
}
