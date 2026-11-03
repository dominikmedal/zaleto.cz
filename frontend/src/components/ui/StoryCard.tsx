import Photo from '@/components/ui/Photo'
import Link from 'next/link'
import Icon from './Icon'
import { formatLongDate, readingTime } from './format'
import type { Article } from '@/lib/api'
import { cleanLocation } from '@/lib/articleImages'

/** Obsah (články) lístek není: karta s fotkou 4:3, nadtitulkem a titulkem s podtržením při najetí. */
export default function StoryCard({ article, lead, image }: { article: Article; lead?: boolean; image?: string | null }) {
  const src = article.custom_image_url ?? image ?? null
  return (
    <Link className={`z-story${lead ? ' z-story--lead' : ''}`} href={`/clanky/${article.slug}`}>
      <div className="z-story__media">
        {src && (
          // eslint-disable-next-line @next/next/no-img-element
          <Photo widths={[240, 480, 800]} sizes="(max-width: 767px) 110px, 420px" src={src} alt="" loading={lead ? 'eager' : 'lazy'} />
        )}
        {article.category && <span className="z-chip"><Icon name="clanek" />{article.category}</span>}
      </div>
      <div>
        {cleanLocation(article.location) && <div className="z-kicker">{cleanLocation(article.location)}</div>}
        <h3 className="z-story__title" style={lead ? { margin: '12px 0 16px' } : undefined}><span>{article.title}</span></h3>
        {lead && article.excerpt && <p className="z-story__text">{article.excerpt}</p>}
        <div className="z-data" style={lead ? { marginTop: 20 } : undefined}>
          {readingTime(article.reading_time)}{lead && article.published_at ? ` · ${formatLongDate(article.published_at)}` : ''}
        </div>
      </div>
    </Link>
  )
}
