import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import Header from '@/components/Header'
import { fetchDestinations, fetchDestinationPhoto } from '@/lib/api'
import { slugify } from '@/lib/slugify'
import { getCountryFlag } from '@/lib/countryFlags'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Počasí na dovolené — kdy jet a kam? Průvodce klimatem destinací',
  description: 'Zjistěte, kdy je v dané destinaci nejlépe. Klimatické grafy, průměrné teploty vzduchu i moře, počet slunečních hodin a nejlepší měsíce pro dovolenou.',
  alternates: { canonical: 'https://zaleto.cz/pocasi' },
  openGraph: {
    title: 'Počasí na dovolené — kdy jet a kam?',
    description: 'Klimatické průvodce, teploty moře a nejlepší měsíce pro každou destinaci.',
    url: 'https://zaleto.cz/pocasi',
    type: 'website',
    siteName: 'Zaleto',
    locale: 'cs_CZ',
  },
}

interface Country {
  name: string
  slug: string
  flag: string | null
  hotelCount: number
  photo: string | null
}

async function getCountries(): Promise<Country[]> {
  const destinations = await fetchDestinations().catch(() => [])
  const map = new Map<string, { count: number }>()
  for (const d of destinations) {
    if (!d.country) continue
    const existing = map.get(d.country)
    if (existing) {
      existing.count += d.hotel_count ?? 0
    } else {
      map.set(d.country, { count: d.hotel_count ?? 0 })
    }
  }

  const countries = [...map.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .map(([name, { count }]) => ({
      name,
      slug: slugify(name),
      flag: getCountryFlag(name),
      hotelCount: count,
      photo: null as string | null,
    }))

  // Fetch photos in parallel (max 6 per batch to avoid overload)
  await Promise.all(
    countries.slice(0, 20).map(async (c) => {
      c.photo = await fetchDestinationPhoto(c.name).catch(() => null)
    })
  )

  return countries
}

export default async function PocasiPage() {
  const countries = await getCountries()

  return (
    <div className="min-h-screen">
      <Header />

      {/* Hero */}
      <div className="bg-gradient-to-br from-[#008afe]/8 via-white to-sky-50 border-b border-gray-100">
        <div className="max-w-[1680px] mx-auto px-4 sm:px-10 py-10 sm:py-14">
          <nav className="flex items-center gap-1 text-xs text-gray-400 mb-4">
            <Link href="/" className="hover:text-[#008afe] transition-colors">Zaleto</Link>
            <span className="text-gray-200">/</span>
            <span className="text-gray-700 font-medium">Počasí</span>
          </nav>
          <h1
            className="font-bold text-gray-900 mb-3 leading-tight tracking-tight"
            style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(28px, 4vw, 50px)' }}
          >
            Počasí v <em className="not-italic text-[#0093FF]">dovolenkových</em> destinacích
          </h1>
          <p className="text-gray-500 text-sm sm:text-base max-w-2xl leading-relaxed">
            Aktuální předpověď počasí, průměrné teploty vzduchu i moře, počet slunečních hodin
            a nejlepší měsíce pro dovolenou — vše na jednom místě.
          </p>
        </div>
      </div>

      <main className="max-w-[1680px] mx-auto px-4 sm:px-10 py-8 sm:py-10">
        <h2 className="text-lg font-semibold text-gray-800 mb-5">Vyberte zemi</h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {countries.map((c) => (
            <Link
              key={c.slug}
              href={`/pocasi/${c.slug}`}
              className="group relative glass-card rounded-2xl hover:shadow-[0_8px_32px_rgba(0,147,255,0.16)] transition-all duration-300 overflow-hidden"
            >
              {/* Photo */}
              <div className="relative h-36 bg-gradient-to-br from-sky-50 to-blue-50">
                {c.photo ? (
                  <Image
                    src={c.photo}
                    alt={c.name}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                   
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    {c.flag && <span className="text-5xl">{c.flag}</span>}
                  </div>
                )}
                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                {/* Flag on photo */}
                {c.photo && c.flag && (
                  <span className="absolute top-2 left-2 text-xl">{c.flag}</span>
                )}
              </div>

              {/* Info */}
              <div className="p-3">
                <p className="font-semibold text-gray-900 text-sm leading-snug group-hover:text-[#008afe] transition-colors">
                  {c.name}
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {c.hotelCount} {c.hotelCount === 1 ? 'hotel' : c.hotelCount < 5 ? 'hotely' : 'hotelů'}
                </p>
              </div>

              {/* Arrow */}
              <div className="absolute top-3 right-3 w-7 h-7 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
                <svg className="w-3.5 h-3.5 text-[#008afe]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
