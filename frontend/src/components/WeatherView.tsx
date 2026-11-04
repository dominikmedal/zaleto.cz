import Photo from '@/components/ui/Photo'
import Link from 'next/link'
import Icon, { type IconName } from '@/components/ui/Icon'
import { LinkList } from '@/components/ui/SeoBlocks'
import { Linked, type AutoLink } from '@/lib/autolink'
import Crumbs from '@/components/ui/Crumbs'
import TourCard from '@/components/ui/TourCard'
import TourAd from '@/components/ui/TourAd'
import OfferStrip, { pickOffers } from '@/components/ui/OfferStrip'
import CarRentalBanner from '@/components/CarRentalBanner'
import { buildBookingUrl, bookingClick, defaultStay } from '@/lib/booking'
import WeatherWidget from '@/components/WeatherWidget'
import ClimateChart from '@/components/ClimateChart'
import WeatherBarsChart from '@/components/WeatherBarsChart'
import WeatherPageNav from '@/components/WeatherPageNav'
import type { WeatherAIData } from '@/lib/api'
import type { Hotel } from '@/lib/types'

const MONTH_NAMES = ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec']
const MONTH_SHORT = ['Led', 'Únr', 'Bře', 'Dub', 'Kvě', 'Čer', 'Čvc', 'Srp', 'Zář', 'Říj', 'Lis', 'Pro']

const SEASONS: { key: 'spring' | 'summer' | 'autumn' | 'winter'; label: string; months: string; icon: IconName }[] = [
  { key: 'spring', label: 'Jaro', months: 'březen – květen', icon: 'flower' },
  { key: 'summer', label: 'Léto', months: 'červen – srpen', icon: 'slunce' },
  { key: 'autumn', label: 'Podzim', months: 'září – listopad', icon: 'leaf' },
  { key: 'winter', label: 'Zima', months: 'prosinec – únor', icon: 'snowflake' },
]

interface Props {
  name: string
  crumbs: { label: string; href?: string }[]
  weather: WeatherAIData
  location: { lat: number | null; lon: number | null }
  heroPhoto: string | null
  hotels: Hotel[]
  /** Země pro odkaz na půjčovnu aut (jinak se použije název). */
  country?: string
  /** Odkaz „Všechny zájezdy“ pod nabídkou. */
  toursHref: string
  subDestinations?: { name: string; slug: string; hotelCount: number }[]
  /** Základ URL pro odkazy na podoblasti, např. /pocasi/recko. */
  subBase?: string
  /** Související stránky pod nabídkou (průvodce, přehledy zájezdů …). */
  /** Cíle pro automatické odkazy v textech (střediska, oblasti → průvodci). */
  textLinks?: AutoLink[]
  linkGroups?: { title: string; links: { href: string; label: string; hint?: string }[] }[]
}

export default function WeatherView({ name, crumbs, weather, location, heroPhoto, hotels, toursHref, subDestinations = [], subBase, country, linkGroups = [], textLinks = [] }: Props) {
  const hasCharts = !!(weather.monthly_air && weather.monthly_air.length === 12)
  const peakSea = weather.monthly_sea ? Math.max(...weather.monthly_sea) : null
  const bestNames = weather.best_months.map(m => MONTH_SHORT[m - 1])
  const hasWeather = !!(location.lat && location.lon)
  const hasSun = !!(weather.monthly_sun_hours || weather.monthly_rain_days)
  const hasSeasons = SEASONS.some(s => weather[s.key])
  const hasWind = !!(weather.wind_info || weather.sea_info)
  // stránka sama na sebe (průvodce téhož místa) se z textu neodkazuje
  const textExclude = toursHref ? [toursHref] : []
  const intro = weather.description?.split(/\n\n+/) ?? []
  const withPhoto = hotels.filter(h => h.thumbnail_url)
  const offers = pickOffers(hotels)
  const adHotel = withPhoto.find(h => !offers.includes(h)) ?? withPhoto[0] ?? null
  const carAd = <div style={{ margin: '0' }}><CarRentalBanner place={name} country={country ?? name} /></div>

  const nav = [
    hasWeather || weather.best_months.length > 0 ? { id: 'pocasi', label: 'Počasí' } : null,
    hasCharts ? { id: 'teploty', label: 'Teploty' } : null,
    hasSun ? { id: 'slunce', label: 'Slunce a déšť' } : null,
    hasSeasons ? { id: 'obdobi', label: 'Roční období' } : null,
    hasWind ? { id: 'vitr', label: 'Vítr a moře' } : null,
    subDestinations.length > 0 ? { id: 'oblasti', label: 'Oblasti' } : null,
    { id: 'zajezdy', label: 'Zájezdy' },
    { id: 'ubytovani', label: 'Ubytování', href: bookingClick(buildBookingUrl({ ss: country && country !== name ? `${name}, ${country}` : name, ...defaultStay() }), 'pocasi') },
  ].filter(Boolean) as { id: string; label: string; href?: string }[]

  return (
    <main className="z-container" style={{ paddingTop: 'var(--space-6)' }}>
      <Crumbs items={crumbs} />

      <div className="z-cardest">
        <div>
          <div className="z-kicker" style={{ marginTop: 'var(--space-5)' }}>Klima a počasí</div>
          <h1 className="h1" style={{ margin: 'var(--space-3) 0 var(--space-4)' }}>počasí — {name}<span className="z-dot">.</span></h1>
          {intro[0] && <p className="lead" style={{ margin: 0 }}><Linked text={intro[0]} links={textLinks} exclude={textExclude} /></p>}
          {(peakSea || bestNames.length > 0) && (
            <div className="z-meta" style={{ marginTop: 'var(--space-5)', fontSize: 15 }}>
              {peakSea ? <span><Icon name="more" />Moře až {peakSea} °C</span> : null}
              {bestNames.length > 0 ? <span><Icon name="slunce" />Nejlepší: {bestNames.slice(0, 4).join(', ')}</span> : null}
            </div>
          )}
        </div>
        {heroPhoto && (
          <div className="z-cardest__photo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <Photo widths={[640, 1200]} sizes="(max-width: 767px) 100vw, 600px" src={heroPhoto} alt={name} />
          </div>
        )}
      </div>

      <WeatherPageNav items={nav} />

      <div className="z-stripwrap"><OfferStrip hotels={offers} /></div>

      <div className="z-cardest__grid">
      <div className="z-cardest__main" style={{ gap: 'var(--space-9)' }}>
        {(hasWeather || weather.best_months.length > 0) && (
          <Section id="pocasi" kicker="Předpověď" title="počasí teď">
            <div className="z-weathergrid">
              {hasWeather && <WeatherWidget lat={location.lat!} lon={location.lon!} location={name} />}
              {weather.best_months.length > 0 && (
                <div className="z-info" style={{ padding: 'var(--space-5)' }}>
                  <div className="z-kicker" style={{ marginBottom: 'var(--space-3)' }}>Nejlepší měsíce pro dovolenou</div>
                  <div className="z-monthpills">
                    {MONTH_SHORT.map((m, i) => <span key={m} className="z-monthpill" data-best={weather.best_months.includes(i + 1)}>{m}</span>)}
                  </div>
                  <p style={{ margin: 'var(--space-4) 0 0' }}>Ideální termíny: {weather.best_months.map(m => MONTH_NAMES[m - 1]).join(', ')}.</p>
                  {intro[1] && <p style={{ margin: 'var(--space-4) 0 0', color: 'var(--ink-muted)' }}><Linked text={intro[1]} links={textLinks} exclude={textExclude} /></p>}
                </div>
              )}
            </div>
          </Section>
        )}

        {hasCharts && (
          <Section id="teploty" kicker="Teploty" title={`průměrné teploty — ${name}`}>
            <ClimateChart name={name} air={weather.monthly_air!} sea={weather.monthly_sea ?? undefined} />
          </Section>
        )}

        {hasSun && (
          <Section id="slunce" kicker="Slunce a srážky" title="slunce a déšť">
            <div className="z-grid-2">
              {weather.monthly_sun_hours && (
                <WeatherBarsChart title="Hodiny slunce za den" values={weather.monthly_sun_hours} color="var(--accent)" unit="hod / den" highlightMonths={weather.best_months} />
              )}
              {weather.monthly_rain_days && (
                <WeatherBarsChart title="Dny s deštěm" values={weather.monthly_rain_days} color="var(--brand)" unit="dní / měsíc" />
              )}
            </div>
          </Section>
        )}

        {carAd}

        {hasSeasons && (
          <Section id="obdobi" kicker="Roční období" title="počasí během roku">
            <div className="z-seasons">
              {SEASONS.map(s => weather[s.key] && (
                <div key={s.key} className="z-season">
                  <div className="z-season__top">
                    <Icon name={s.icon} />
                    <div><h3 className="h4" style={{ lineHeight: 1 }}>{s.label}</h3><span className="z-data">{s.months.toUpperCase()}</span></div>
                  </div>
                  <p style={{ margin: 0, color: 'var(--ink-muted)' }}>{weather[s.key]}</p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {hasWind && (
          <Section id="vitr" kicker="Vítr a moře" title="vítr a koupání">
            <div className="z-grid-2">
              {weather.wind_info && (
                <div className="z-tk"><div className="z-tk__in" style={{ padding: 'var(--space-5)', height: '100%' }}>
                  <Icon name="wind" size="lg" /><h3 className="h4" style={{ margin: 'var(--space-3) 0' }}>Vítr</h3>
                  <p style={{ margin: 0, color: 'var(--ink-muted)' }}><Linked text={weather.wind_info} links={textLinks} exclude={textExclude} /></p>
                </div></div>
              )}
              {weather.sea_info && (
                <div className="z-tk"><div className="z-tk__in" style={{ padding: 'var(--space-5)', height: '100%' }}>
                  <Icon name="more" size="lg" /><h3 className="h4" style={{ margin: 'var(--space-3) 0' }}>Teplota moře</h3>
                  <p style={{ margin: 0, color: 'var(--ink-muted)' }}><Linked text={weather.sea_info} links={textLinks} exclude={textExclude} /></p>
                </div></div>
              )}
            </div>
          </Section>
        )}

        {subDestinations.length > 0 && subBase && (
          <Section id="oblasti" kicker="Oblasti" title="oblasti a letoviska">
            <div className="z-chips">
              {subDestinations.map(d => (
                <Link key={d.slug} href={`${subBase}/${d.slug}`} className="z-chip" style={{ textDecoration: 'none', height: 40, padding: '0 var(--space-4)' }}>
                  {d.name}
                </Link>
              ))}
            </div>
          </Section>
        )}

        <Section id="zajezdy" kicker="Zájezdy" title={`zájezdy: ${name}`} more={{ href: toursHref, label: 'Všechny zájezdy' }}>
          {hotels.length === 0 ? (
            <p className="body">Teď tu nemáme žádný volný termín.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-5)', alignItems: 'stretch' }}>
              {hotels.slice(0, 6).map((h, i) => <TourCard key={h.slug} hotel={h} priority={i < 3} />)}
            </div>
          )}
        </Section>

        {linkGroups.map(g => <LinkList key={g.title} title={g.title} links={g.links} />)}
      </div>

      <aside className="z-cardest__side">
        {adHotel && <TourAd hotel={adHotel} sticky kicker="Dnešní tip pro Tebe" />}
      </aside>
      </div>
    </main>
  )
}

function Section({ id, kicker, title, more, children }: { id: string; kicker: string; title: string; more?: { href: string; label: string }; children: React.ReactNode }) {
  return (
    <section id={id} data-rail={kicker} style={{ scrollMarginTop: 'calc(var(--header-height) + 16px)' }}>
      <div className="z-shead">
        <div>
          <div className="z-kicker">{kicker}</div>
          <h2>{title}<span className="z-dot">.</span></h2>
        </div>
        {more && <Link className="z-more" href={more.href}>{more.label}</Link>}
      </div>
      {children}
    </section>
  )
}
