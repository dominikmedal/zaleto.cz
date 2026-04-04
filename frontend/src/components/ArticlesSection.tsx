import Image from 'next/image'
import Link from 'next/link'
import { PiMapPin, PiClock, PiArrowRight } from 'react-icons/pi'
import type { Article } from '@/lib/api'

interface Props {
  articles: Article[]
  imageMap: Record<string, string | null>
  label?: string
}

export default function ArticlesSection({ articles, imageMap, label = 'Cestovní inspirace' }: Props) {
  if (articles.length === 0) return null

  return (
    <section>
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
          {label}
        </p>
        <Link
          href="/clanky"
          className="hidden sm:flex items-center gap-1 text-xs font-semibold text-gray-400 hover:text-gray-700 transition-colors"
        >
          Všechny články <PiArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
        {articles.map((article) => {
          const photo = imageMap[article.location ?? ''] ?? null
          return (
            <Link
              key={article.slug}
              href={`/clanky/${article.slug}`}
              className="group flex flex-col"
            >
              {/* Image */}
              <div className="relative rounded-2xl overflow-hidden bg-gray-100 flex-shrink-0" style={{ aspectRatio: '16/9' }}>
                {photo ? (
                  <Image
                    src={photo}
                    alt={article.title}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    unoptimized
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-[#0093FF]/80 to-blue-700" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />

                {/* Category badge */}
                {article.category && (
                  <div className="absolute top-3 left-3">
                    <span className="inline-block px-3 py-1 rounded-full text-[11px] font-semibold text-gray-800 bg-white/90 backdrop-blur-sm">
                      {article.category}
                    </span>
                  </div>
                )}

                {/* Meta bottom of image */}
                <div className="absolute bottom-3 left-3 flex items-center gap-3">
                  {article.location && (
                    <span className="flex items-center gap-1 text-[11px] text-white/80">
                      <PiMapPin className="w-3 h-3" />
                      {article.location}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-[11px] text-white/80">
                    <PiClock className="w-3 h-3" />
                    {article.reading_time} min
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="mt-4 flex flex-col flex-1">
                <h3 className="font-bold text-gray-900 text-base leading-snug mb-2 group-hover:text-[#0093FF] transition-colors">
                  {article.title}
                </h3>
                {article.excerpt && (
                  <p className="text-gray-400 text-sm leading-relaxed line-clamp-2 mb-3">
                    {article.excerpt}
                  </p>
                )}
                <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-semibold text-gray-700 group-hover:text-[#0093FF] transition-colors">
                  Číst článek
                  <PiArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Mobile "show all" link */}
      <div className="sm:hidden mt-5 text-center">
        <Link href="/clanky" className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-900">
          Zobrazit všechny články <PiArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </section>
  )
}
