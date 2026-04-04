import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { PiMapPin, PiClock, PiArrowRight } from 'react-icons/pi'
import Header from '@/components/Header'
import { fetchArticles, fetchDestinationPhoto } from '@/lib/api'

export const metadata: Metadata = {
  title: 'Cestovní inspirace — Tipy, průvodce a destinace | Zaleto',
  description: 'Cestovní tipy, průvodce po destinacích a inspirace pro vaši dovolenou. Vše na jednom místě.',
  alternates: { canonical: 'https://zaleto.cz/clanky' },
}

export default async function ClankyPage() {
  const articles = await fetchArticles(50).catch(() => [])

  const locations = [...new Set(articles.map(a => a.location).filter(Boolean) as string[])]
  const photoResults = await Promise.all(
    locations.map(loc => fetchDestinationPhoto(loc).catch(() => null))
  )
  const imageMap: Record<string, string | null> = {}
  locations.forEach((loc, i) => { imageMap[loc] = photoResults[i] })

  return (
    <div className="min-h-screen">
      <Header />
      <main className="max-w-[1280px] mx-auto px-4 sm:px-8 py-10 sm:py-14">

        <div className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mb-2">
            Cestovní inspirace
          </h1>
          <p className="text-gray-400">Tipy, průvodce a zajímavosti ze světa cestování</p>
        </div>

        {articles.length === 0 ? (
          <p className="text-gray-400 text-center py-20">Články se připravují…</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {articles.map((article) => {
              const photo = imageMap[article.location ?? ''] ?? null
              return (
                <Link key={article.slug} href={`/clanky/${article.slug}`} className="group flex flex-col">
                  <div className="relative rounded-2xl overflow-hidden bg-gray-100 flex-shrink-0" style={{ aspectRatio: '16/9' }}>
                    {photo ? (
                      <Image src={photo} alt={article.title} fill className="object-cover transition-transform duration-500 group-hover:scale-105" unoptimized />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-[#0093FF]/80 to-blue-700" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                    {article.category && (
                      <div className="absolute top-3 left-3">
                        <span className="inline-block px-3 py-1 rounded-full text-[11px] font-semibold text-gray-800 bg-white/90 backdrop-blur-sm">
                          {article.category}
                        </span>
                      </div>
                    )}
                    <div className="absolute bottom-3 left-3 flex items-center gap-3">
                      {article.location && (
                        <span className="flex items-center gap-1 text-[11px] text-white/80">
                          <PiMapPin className="w-3 h-3" />{article.location}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-[11px] text-white/80">
                        <PiClock className="w-3 h-3" />{article.reading_time} min
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-col flex-1">
                    <h2 className="font-bold text-gray-900 text-base leading-snug mb-2 group-hover:text-[#0093FF] transition-colors">
                      {article.title}
                    </h2>
                    {article.excerpt && (
                      <p className="text-[#0093FF] text-sm leading-relaxed line-clamp-2 mb-3">{article.excerpt}</p>
                    )}
                    <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-semibold text-gray-700 group-hover:text-[#0093FF] transition-colors">
                      Číst článek <PiArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
