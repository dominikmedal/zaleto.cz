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
      <div className="flex items-center justify-between mb-5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">{label}</p>
        <Link href="/clanky" className="hidden sm:flex items-center gap-1 text-xs font-semibold text-gray-400 hover:text-gray-700 transition-colors">
          Všechny články <PiArrowRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7">
        {articles.map((article) => {
          const photo = article.custom_image_url ?? imageMap[article.location ?? ''] ?? null
          return (
            <Link key={article.slug} href={`/clanky/${article.slug}`} className="group block">
              <article>

                {/* Photo — borderless, same as HotelCard */}
                <div
                  className="relative rounded-2xl overflow-hidden bg-gray-200 mb-3 shadow-[0_2px_8px_rgba(0,0,0,0.10)] group-hover:shadow-[0_8px_28px_rgba(0,0,0,0.16)] transition-shadow duration-300"
                  style={{ aspectRatio: '16/9' }}
                >
                  {photo ? (
                    <Image
                      src={photo}
                      alt={article.title}
                      fill
                      className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]"
                     
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-[#0093FF]/60 to-blue-700" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />

                  {/* Category — top left */}
                  {article.category && (
                    <span
                      className="absolute top-3 left-3 text-[10px] font-semibold text-gray-800 px-2.5 py-1 rounded-full"
                      style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)' }}
                    >
                      {article.category}
                    </span>
                  )}

                  {/* Reading time — bottom right */}
                  <span
                    className="absolute bottom-3 right-3 inline-flex items-center gap-1 text-[10px] font-medium text-white/90 px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(6px)' }}
                  >
                    <PiClock className="w-2.5 h-2.5" />
                    {article.reading_time} min
                  </span>
                </div>

                {/* Info strip — on page background, no box */}
                <div className="px-0.5">

                  {/* Location */}
                  {article.location && (
                    <div className="flex items-center gap-1 mb-1.5">
                      <PiMapPin className="w-3 h-3 text-[#0093FF] flex-shrink-0" />
                      <span className="text-[11px] text-gray-500 truncate">{article.location}</span>
                    </div>
                  )}

                  {/* Title — Playfair Display, same treatment as hotel name */}
                  <h3
                    className="font-bold text-gray-900 leading-snug line-clamp-2 mb-2 group-hover:text-[#0093FF] transition-colors duration-200"
                    style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '1.1rem' }}
                  >
                    {article.title}
                  </h3>

                  {/* Excerpt — muted, optional */}
                  {article.excerpt && (
                    <p className="text-[12px] text-gray-400 leading-relaxed line-clamp-2 mb-3">
                      {article.excerpt}
                    </p>
                  )}

                  {/* CTA — expanding pill, same as HotelCard */}
                  <div className="flex items-center gap-1.5 rounded-full border border-[#C8E3FF] bg-[#EDF6FF] group-hover:bg-[#0093FF] group-hover:border-[#0093FF] transition-all duration-200 overflow-hidden w-fit px-2.5 py-[7px] group-hover:px-3.5">
                    <span className="text-[11px] font-semibold text-[#0093FF] group-hover:text-white transition-colors duration-200 max-w-0 group-hover:max-w-[40px] overflow-hidden whitespace-nowrap">
                      Číst
                    </span>
                    <PiArrowRight className="w-3.5 h-3.5 text-[#0093FF] group-hover:text-white transition-all duration-200 group-hover:translate-x-0.5 flex-shrink-0" />
                  </div>
                </div>
              </article>
            </Link>
          )
        })}
      </div>

      <div className="sm:hidden mt-5 text-center">
        <Link href="/clanky" className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-900">
          Zobrazit všechny články <PiArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </section>
  )
}
