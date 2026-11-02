import Photo from '@/components/ui/Photo'
import Link from 'next/link'
import { Linked, type AutoLink } from '@/lib/autolink'
import Icon, { type IconName } from './Icon'
import { PhotoCredit } from './PhotoCredit'
import { slugify } from '@/lib/slugify'
import type { GuidePlace } from '@/lib/guide'

/**
 * Místa průvodce jako palubní lístky: fotka v okénku, razítko s typem, ústřižek s tlačítkem.
 * První položka je větší. Klik vede na vlastní stránku položky; bez fotky vznikne ikonová dlaždice.
 */
export default function PlaceCards({ items, icon, base, textLinks, exclude }: { items: GuidePlace[]; icon: IconName; base: string; textLinks?: AutoLink[]; exclude?: string[] }) {
  return (
    <div className="z-places">
      {items.map((it, i) => (
        <article key={it.name} className="z-tk z-tk--h z-place" data-lead={(i === 0 && items.length > 2) || undefined} style={{ ['--cut' as string]: '68px' }}>
          <div className="z-tk__in">
            <div className="z-place__media" data-tilt={i % 2}>
              {it.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <Photo widths={[400, 800]} sizes="(max-width: 767px) 90vw, 400px" src={it.image.url} alt={it.name} loading="lazy" />
              ) : <span className="z-place__ph" aria-hidden="true"><Icon name={icon} size="lg" /></span>}
              {it.kind && <span className="z-stamp z-place__stamp">{it.kind}</span>}
              {it.image && <PhotoCredit photo={it.image} className="z-place__credit" />}
            </div>
            <div className="z-place__body">
              {it.location && <div className="z-kicker">{it.location}</div>}
              <h3 className="z-place__title"><Link className="z-gcard__hit" href={`${base}/${slugify(it.name)}`}>{it.name}</Link></h3>
              <p><Linked text={it.description} links={textLinks} exclude={exclude} /></p>
            </div>
            <div className="z-place__stub">
              <span className="z-place__nr">Podrobnosti</span>
              <span className="z-place__go" aria-hidden="true"><Icon name="sipka" /></span>
            </div>
          </div>
        </article>
      ))}
    </div>
  )
}
