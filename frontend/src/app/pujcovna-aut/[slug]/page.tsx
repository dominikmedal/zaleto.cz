import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import Header from '@/components/Header'
import JsonLd from '@/components/JsonLd'
import CarRentalSearchForm from '@/components/CarRentalSearchForm'
import {
  getCarDestination,
  mergeDestinations,
} from '@/lib/carRental'
import { fetchDestinationPhoto, fetchDynamicCarDestinations } from '@/lib/api'
import { Car, ChevronRight } from 'lucide-react'

export const revalidate = 86400
export const dynamicParams = true   // allow dynamic destinations from DB

export async function generateStaticParams() {
  const dynamic = await fetchDynamicCarDestinations().catch(() => [])
  return mergeDestinations(dynamic).map(d => ({ slug: d.slug }))
}

interface Props { params: { slug: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const dynamic = await fetchDynamicCarDestinations().catch(() => [])
  const dest = getCarDestination(params.slug, mergeDestinations(dynamic))
  if (!dest) return { title: 'Půjčovna aut | Zaleto' }

  const year = new Date().getFullYear()
  const title = `Půjčovna aut ${dest.name} ${year} – Aktuální ceny | Zaleto`
  const description =
    `Půjčte si auto v destinaci ${dest.name}. Porovnejte nabídky přes 500 půjčoven — garantovaná cena bez skrytých poplatků.`
  const canonical = `https://zaleto.cz/pujcovna-aut/${dest.slug}`

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title: `Půjčovna aut ${dest.name} ${year} | Zaleto`,
      description,
      url: canonical,
      type: 'website',
      siteName: 'Zaleto',
      locale: 'cs_CZ',
    },
    twitter: { card: 'summary_large_image', title, description },
  }
}


export default async function PujcovnaAutSlugPage({ params }: Props) {
  const dynamic = await fetchDynamicCarDestinations().catch(() => [])
  const dest = getCarDestination(params.slug, mergeDestinations(dynamic))
  if (!dest) notFound()

  const heroPhoto = await fetchDestinationPhoto(dest.name).catch(() => null)

  const year = new Date().getFullYear()

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Zaleto', item: 'https://zaleto.cz' },
      { '@type': 'ListItem', position: 2, name: 'Půjčovna aut', item: 'https://zaleto.cz/pujcovna-aut' },
      { '@type': 'ListItem', position: 3, name: `Půjčovna aut ${dest.name}`, item: `https://zaleto.cz/pujcovna-aut/${dest.slug}` },
    ],
  }

  return (
    <div className="min-h-screen">
      <JsonLd data={breadcrumbSchema} />
      <Header />

      {/* ── Hero with photo — fixed height so it never grows ─────────── */}
      {heroPhoto && (
        <div className="relative h-[260px] sm:h-[340px]">
          <Image
            src={heroPhoto}
            alt={`Půjčovna aut ${dest.name}`}
            fill
            className="object-cover"
            style={{ filter: 'brightness(1.05) saturate(1.1)' }}
            priority
          />
          <div className="absolute inset-0" style={{
            background: 'linear-gradient(to right, rgba(245,250,255,1) 0%, rgba(245,250,255,0.88) 32%, rgba(245,250,255,0.55) 60%, rgba(245,250,255,0.0) 100%)'
          }} />
          <div className="absolute inset-x-0 bottom-0 h-28" style={{
            background: 'linear-gradient(to top, rgba(245,250,255,1) 0%, rgba(245,250,255,0.5) 60%, transparent 100%)'
          }} />
          <div className="relative h-full flex items-center">
            <div className="max-w-[1680px] mx-auto px-4 sm:px-10 w-full">
              <BreadcrumbNav dest={dest} />
              <HeroTitle dest={dest} year={year} />
            </div>
          </div>
        </div>
      )}

      {/* ── No-photo header ───────────────────────────────────────────── */}
      {!heroPhoto && (
        <div className="max-w-[1680px] mx-auto px-4 sm:px-10 pt-8 pb-2">
          <BreadcrumbNav dest={dest} />
          <HeroTitle dest={dest} year={year} />
        </div>
      )}

      {/* ── Search form + results ─────────────────────────────────────── */}
      <main className="max-w-[1680px] mx-auto px-4 sm:px-8 py-8 pb-14">
        <CarRentalSearchForm destination={dest} />
      </main>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function BreadcrumbNav({ dest }: { dest: ReturnType<typeof getCarDestination> & {} }) {
  return (
    <nav className="flex items-center flex-wrap gap-1 text-xs text-gray-400 mb-4">
      <Link href="/" className="hover:text-[#0093FF] transition-colors">Zaleto</Link>
      <ChevronRight className="w-3 h-3" />
      <Link href="/pujcovna-aut" className="hover:text-[#0093FF] transition-colors">Půjčovna aut</Link>
      <ChevronRight className="w-3 h-3" />
      <span className="text-gray-700 font-medium">{dest.name}</span>
    </nav>
  )
}

function HeroTitle({ dest, year }: { dest: ReturnType<typeof getCarDestination> & {}; year: number }) {
  return (
    <>
      <div className="inline-flex items-center gap-2 glass-pill rounded-full px-3 py-1.5 text-xs font-semibold text-[#0068CC] mb-3">
        <Car className="w-3.5 h-3.5" />
        Půjčovna aut · {dest.country}
      </div>
      <h1
        className="font-bold text-gray-900 leading-tight tracking-tight mb-3"
        style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(26px, 4.5vw, 52px)' }}
      >
        Půjčovna aut {dest.name} {year}
      </h1>
      <p className="text-gray-600 text-sm sm:text-base leading-relaxed max-w-xl">
        Aktuální nabídky půjčoven aut — porovnání cen od více než{' '}
        <strong className="text-gray-800">500 půjčoven</strong>, garantovaná cena bez skrytých poplatků.
      </p>
    </>
  )
}
