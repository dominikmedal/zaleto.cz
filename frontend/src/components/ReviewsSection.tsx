'use client'
import { useEffect, useState } from 'react'
import { Star, ThumbsUp, Globe } from 'lucide-react'
import { API } from '@/lib/api'

interface Review {
  id: number
  author_name: string
  author_photo: string | null
  rating: number        // 1-5
  text: string
  review_date: string | null
  language: string | null
}

interface ReviewsData {
  reviews: Review[]
  overall_rating: number | null  // 1-5 Google scale
  total_ratings: number | null
  source: string
}

function StarRating({ rating, max = 5, size = 'sm' }: { rating: number; max?: number; size?: 'sm' | 'lg' }) {
  const sz = size === 'lg' ? 'w-5 h-5' : 'w-3.5 h-3.5'
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          className={`${sz} ${i < Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'fill-gray-200 text-gray-200'}`}
        />
      ))}
    </div>
  )
}

function InitialsAvatar({ name }: { name: string }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-rose-500', 'bg-amber-500', 'bg-cyan-500']
  const color  = colors[name.charCodeAt(0) % colors.length]
  return (
    <div className={`w-10 h-10 rounded-full ${color} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>
      {initials || '?'}
    </div>
  )
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' })
  } catch { return dateStr }
}

export default function ReviewsSection({ slug }: { slug: string }) {
  const [data, setData]       = useState<ReviewsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})

  useEffect(() => {
    fetch(`${API}/api/hotels/${slug}/reviews`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [slug])

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="w-10 h-10 rounded-full bg-gray-200 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-gray-200 rounded w-32" />
              <div className="h-3 bg-gray-200 rounded w-full" />
              <div className="h-3 bg-gray-200 rounded w-3/4" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  const reviews = data?.reviews ?? []
  const hasReviews = reviews.length > 0

  return (
    <div>
      {/* Summary bar */}
      {data?.overall_rating && (
        <div className="flex items-center gap-4 mb-6 p-4 bg-amber-50 rounded-2xl border border-amber-100">
          <div className="text-center">
            <div className="text-4xl font-bold text-gray-900">{data.overall_rating.toFixed(1)}</div>
            <div className="text-xs text-gray-500 mt-0.5">z 5</div>
          </div>
          <div>
            <StarRating rating={data.overall_rating} size="lg" />
            {data.total_ratings && (
              <p className="text-sm text-gray-500 mt-1">
                Na základě {data.total_ratings.toLocaleString('cs-CZ')} hodnocení · Google
              </p>
            )}
          </div>
        </div>
      )}

      {/* Review cards */}
      {hasReviews ? (
        <div className="space-y-5">
          {reviews.map(review => {
            const isLong    = review.text.length > 280
            const isExpanded = expanded[review.id]
            const displayText = isLong && !isExpanded ? review.text.slice(0, 280) + '…' : review.text

            return (
              <div key={review.id} className="flex gap-3.5">
                {/* Avatar */}
                {review.author_photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={review.author_photo}
                    alt={review.author_name}
                    className="w-10 h-10 rounded-full object-cover flex-shrink-0 border border-gray-200"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <InitialsAvatar name={review.author_name} />
                )}

                <div className="flex-1 min-w-0">
                  {/* Author + meta */}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mb-1.5">
                    <span className="font-semibold text-sm text-gray-900">{review.author_name}</span>
                    {review.review_date && (
                      <span className="text-xs text-gray-400">{formatDate(review.review_date)}</span>
                    )}
                    {review.language && review.language !== 'cs' && (
                      <span className="flex items-center gap-1 text-[11px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                        <Globe className="w-3 h-3" />{review.language.toUpperCase()}
                      </span>
                    )}
                  </div>

                  {/* Stars */}
                  <div className="mb-2">
                    <StarRating rating={review.rating} />
                  </div>

                  {/* Text */}
                  {review.text ? (
                    <div>
                      <p className="text-sm text-gray-700 leading-relaxed">{displayText}</p>
                      {isLong && (
                        <button
                          onClick={() => setExpanded(p => ({ ...p, [review.id]: !p[review.id] }))}
                          className="text-xs text-blue-500 hover:text-blue-700 mt-1 font-medium transition-colors"
                        >
                          {isExpanded ? 'Zobrazit méně' : 'Číst více'}
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 italic">Bez textového hodnocení</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-10 text-gray-400">
          <ThumbsUp className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">
            {data?.source === 'none'
              ? 'Pro zobrazení recenzí nastavte Google Places API klíč.'
              : 'Pro tento hotel zatím nejsou k dispozici recenze.'}
          </p>
        </div>
      )}

      {/* Source attribution */}
      {hasReviews && data?.source !== 'cache' && (
        <p className="text-xs text-gray-400 mt-5 flex items-center gap-1.5">
          Recenze poskytuje Google Maps
        </p>
      )}
    </div>
  )
}
