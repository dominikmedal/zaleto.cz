import Link from 'next/link'

interface Props {
  /** Číslo kapitoly deníku, např. „01“. */
  num?: string
  kicker?: string
  /** Titulek malými písmeny; tečka se doplní automaticky. */
  title: string
  moreHref?: string
  moreLabel?: string
  as?: 'h1' | 'h2'
  /** Nadtitulek se jinak skrývá; zobrazí se jen u údajů (např. počet hotelů). */
  keepKicker?: boolean
}

export default function SectionHead({ num, kicker, title, moreHref, moreLabel, as: Tag = 'h2', keepKicker }: Props) {
  return (
    <div className="z-shead">
      <div>
        <div className={`z-kicker${keepKicker ? ' z-kicker--keep' : ''}`}>
          {num && <><span className="z-shead__num">{num}</span> — </>}{kicker}
        </div>
        <Tag>{title}<span className="z-dot">.</span></Tag>
      </div>
      {moreHref && moreLabel && <Link className="z-more" href={moreHref}>{moreLabel}</Link>}
    </div>
  )
}
