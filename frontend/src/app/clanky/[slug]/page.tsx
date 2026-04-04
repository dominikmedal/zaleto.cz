import type React from 'react'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PiMapPin, PiClock, PiArrowLeft } from 'react-icons/pi'
import Header from '@/components/Header'
import { FeaturedHotelsBarVertical } from '@/components/FeaturedHotelCard'
import { fetchArticle, fetchDestinationPhoto, fetchHotels } from '@/lib/api'

interface Props {
  params: { slug: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = await fetchArticle(params.slug).catch(() => null)
  if (!article) return { title: 'Článek nenalezen | Zaleto' }
  return {
    title: `${article.title} | Zaleto`,
    description: article.excerpt ?? undefined,
    alternates: { canonical: `https://zaleto.cz/clanky/${params.slug}` },
    openGraph: {
      title: article.title,
      description: article.excerpt ?? undefined,
      type: 'article',
    },
  }
}

// ── Inline markdown parser (bold, plain text) ────────────────────────────────
function parseInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  if (parts.length === 1) return text
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**')
          ? <strong key={i} className="font-semibold text-gray-800">{part.slice(2, -2)}</strong>
          : part
      )}
    </>
  )
}

// ── Block content renderer ───────────────────────────────────────────────────
function renderContent(content: string): React.ReactNode[] {
  const lines = content.split('\n')
  const elements: React.ReactNode[] = []
  let key = 0
  let i = 0

  while (i < lines.length) {
    const trimmed = lines[i].trim()

    if (!trimmed) { i++; continue }

    if (trimmed.startsWith('## ')) {
      elements.push(
        <h2 key={key++} className="text-xl font-bold text-gray-900 mt-8 mb-3 tracking-tight">
          {trimmed.slice(3)}
        </h2>
      )
      i++
    } else if (trimmed.startsWith('# ')) {
      elements.push(
        <h1 key={key++} className="text-2xl font-bold text-gray-900 mt-8 mb-3 tracking-tight">
          {trimmed.slice(2)}
        </h1>
      )
      i++
    } else if (trimmed.startsWith('* ')) {
      // Collect consecutive list items into a <ul>
      const items: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('* ')) {
        items.push(lines[i].trim().slice(2))
        i++
      }
      elements.push(
        <ul key={key++} className="my-4 space-y-1.5 pl-4">
          {items.map((item, j) => (
            <li key={j} className="text-gray-600 leading-relaxed text-sm flex gap-2">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#0093FF] flex-shrink-0" />
              <span>{parseInline(item)}</span>
            </li>
          ))}
        </ul>
      )
    } else {
      elements.push(
        <p key={key++} className="text-gray-600 leading-relaxed mb-4 text-sm sm:text-base">
          {parseInline(trimmed)}
        </p>
      )
      i++
    }
  }

  return elements
}

export default async function ArticlePage({ params }: Props) {
  const article = await fetchArticle(params.slug).catch(() => null)
  if (!article) notFound()

  const [photo, byDestResult, fallbackResult] = await Promise.all([
    article.location
      ? fetchDestinationPhoto(article.location).catch(() => null)
      : Promise.resolve(null),
    article.location
      ? fetchHotels({ destination: article.location, limit: 3, sort: 'price_asc' }).catch(() => null)
      : Promise.resolve(null),
    fetchHotels({ limit: 3, sort: 'price_asc' }).catch(() => null),
  ])

  const featuredHotels =
    (byDestResult?.hotels?.length ?? 0) > 0
      ? byDestResult!.hotels
      : (fallbackResult?.hotels ?? [])

  return (
    <div className="min-h-screen">
      <Header />

      <div className="max-w-[1680px] mx-auto px-4 sm:px-8 py-8 sm:py-12">
        <div className="flex gap-16 items-start">

          {/* ── Main article column ── */}
          <main className="flex-1 min-w-0 max-w-[960px]">

            {/* Back */}
            <Link href="/clanky" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors mb-8">
              <PiArrowLeft className="w-4 h-4" /> Všechny články
            </Link>

            {/* Category + meta */}
            <div className="flex items-center gap-3 mb-4">
              {article.category && (
                <span className="px-3 py-1 rounded-full text-xs font-semibold text-[#0093FF] bg-blue-50">
                  {article.category}
                </span>
              )}
              {article.location && (
                <span className="flex items-center gap-1 text-sm text-gray-400">
                  <PiMapPin className="w-3.5 h-3.5" />{article.location}
                </span>
              )}
              <span className="flex items-center gap-1 text-sm text-gray-400">
                <PiClock className="w-3.5 h-3.5" />{article.reading_time} min čtení
              </span>
            </div>

            {/* Title */}
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight leading-tight mb-4">
              {article.title}
            </h1>

            {/* Excerpt */}
            {article.excerpt && (
              <p className="text-lg text-[#0093FF] leading-relaxed mb-8">
                {article.excerpt}
              </p>
            )}

            {/* Hero image */}
            {photo && (
              <div className="relative rounded-2xl overflow-hidden mb-10" style={{ aspectRatio: '16/7' }}>
                <Image src={photo} alt={article.title} fill className="object-cover" unoptimized priority />
              </div>
            )}

            {/* Content */}
            {article.content && (
              <article className="max-w-none">
                {renderContent(article.content)}
              </article>
            )}

            {/* CTA */}
            <div className="mt-12 pt-8 border-t border-gray-100">
              <p className="text-gray-500 text-sm mb-4">Hledáte zájezd do {article.location ?? 'této destinace'}?</p>
              <Link
                href={article.location ? `/?destination=${encodeURIComponent(article.location)}` : '/'}
                className="inline-flex items-center gap-2 px-5 py-3 bg-[#0093FF] text-white text-sm font-semibold rounded-xl hover:bg-[#0080e0] transition-colors"
              >
                Porovnat zájezdy {article.location ? `— ${article.location}` : ''}
              </Link>
            </div>

          </main>

          {/* ── Sticky sidebar ── */}
          {featuredHotels.length > 0 && (
            <aside className="hidden xl:block w-64 flex-shrink-0 sticky top-24">
              <FeaturedHotelsBarVertical hotels={featuredHotels} />
            </aside>
          )}

        </div>
      </div>
    </div>
  )
}
