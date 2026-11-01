import Link from 'next/link'
import Icon from './Icon'
import { formatLongDate } from './format'
import type { Travelogue } from '@/server/travelogues'

const excerpt = (body: string) => {
  const t = body.replace(/[#*>\-]/g, '').replace(/\s+/g, ' ').trim()
  return t.length > 190 ? `${t.slice(0, 187).replace(/\s+\S*$/, '')}…` : t
}

/** Cestopis od čtenáře: lístek s destinací, perexem a autorem. */
export default function TravelogueCard({ t }: { t: Pick<Travelogue, 'slug' | 'title' | 'body' | 'author_name' | 'destination' | 'approved_at'> }) {
  return (
    <Link href={`/cestopisy/${t.slug}`} className="z-tk z-trip">
      <div className="z-tk__in">
        <span className="z-trip__ic"><Icon name="trasa" /></span>
        <div className="z-kicker">{t.destination}</div>
        <h3 className="z-trip__title"><span>{t.title}</span></h3>
        <p>{excerpt(t.body)}</p>
        <div className="z-data z-trip__by">
          <Icon name="ucet" size="sm" />{t.author_name}{t.approved_at ? ` · ${formatLongDate(t.approved_at)}` : ''}
        </div>
      </div>
    </Link>
  )
}
