import SectionHead from '@/components/ui/SectionHead'
import WindowCard from '@/components/ui/WindowCard'
import { destinationPhoto } from '@/server/content'
import { nextWeekend, weekendStayLink } from '@/lib/booking'

/** Oblíbené víkendové cíle (hledání na Booking.com podle `ss`). Nabídka se po týdnech střídá. */
const POOL: { name: string; ss: string }[] = [
  { name: 'Vídeň', ss: 'Vídeň, Rakousko' },
  { name: 'Budapešť', ss: 'Budapešť, Maďarsko' },
  { name: 'Krakov', ss: 'Krakov, Polsko' },
  { name: 'Drážďany', ss: 'Drážďany, Německo' },
  { name: 'Salcburk', ss: 'Salcburk, Rakousko' },
  { name: 'Bratislava', ss: 'Bratislava, Slovensko' },
  { name: 'Vratislav', ss: 'Vratislav, Polsko' },
  { name: 'Mnichov', ss: 'Mnichov, Německo' },
  { name: 'Berlín', ss: 'Berlín, Německo' },
  { name: 'Norimberk', ss: 'Norimberk, Německo' },
  { name: 'Graz', ss: 'Štýrský Hradec, Rakousko' },
  { name: 'Lublaň', ss: 'Lublaň, Slovinsko' },
  { name: 'Řím', ss: 'Řím, Itálie' },
  { name: 'Paříž', ss: 'Paříž, Francie' },
  { name: 'Amsterdam', ss: 'Amsterdam, Nizozemsko' },
  { name: 'Barcelona', ss: 'Barcelona, Španělsko' },
  { name: 'Lisabon', ss: 'Lisabon, Portugalsko' },
  { name: 'Benátky', ss: 'Benátky, Itálie' },
  { name: 'Florencie', ss: 'Florencie, Itálie' },
  { name: 'Hamburk', ss: 'Hamburk, Německo' },
  { name: 'Linec', ss: 'Linec, Rakousko' },
  { name: 'Innsbruck', ss: 'Innsbruck, Rakousko' },
  { name: 'Kodaň', ss: 'Kodaň, Dánsko' },
  { name: 'Záhřeb', ss: 'Záhřeb, Chorvatsko' },
]
const SHOWN = 6
/** Fotky hotelů od CK jsou jen záloha – tady chceme skutečné fotky měst. */
const isHotelPhoto = (u: string | null) => !u || /content4travel\.com/.test(u)

/**
 * Tip na víkend: šest měst (střídají se po týdnech) a odkaz na nejlevnější ubytování na nejbližší víkend pátek–neděle.
 * Bez cen: Booking.com nemá veřejné API s cenami, karta vede přes affiliate na výsledky seřazené od nejlevnějšího.
 */
export default async function WeekendTips({ num, bare, placement = 'vikend' }: { num?: string; bare?: boolean; placement?: string }) {
  const w = nextWeekend()
  const start = (w.week * SHOWN) % POOL.length
  // z rotace vezmeme prvních několik měst a nechceme ta bez dobré fotky
  const order = [...POOL.slice(start), ...POOL.slice(0, start)]
  // přímo ze serveru (ne přes Data cache), ať se nedrží dřívější „bez fotky“
  // fotky stahujeme jen pro prvních deset v pořadí (šest zobrazených + rezerva pro města bez fotky)
  const candidates = order.slice(0, SHOWN + 4)
  const photos = await Promise.all(candidates.map(c => destinationPhoto(c.name).then(r => r.url).catch(() => null)))
  const picked = candidates.map((c, i) => ({ ...c, photo: photos[i] })).filter(c => !isHotelPhoto(c.photo)).slice(0, SHOWN)
  if (picked.length === 0) return null

  const body = (
    <>
      <SectionHead num={num} kicker="Tip na víkend" title="kam na víkend" />
      <p className="body" style={{ margin: '0 0 var(--space-5)' }}>Nejlevnější ubytování na nejbližší víkend, {w.label}.</p>
      <div className="z-grid-4 z-windows z-windows--sm">
        {picked.map(c => (
          <WindowCard key={c.name} href={weekendStayLink(c.ss, placement)} name={c.name} photo={c.photo} sub={w.label} external />
        ))}
      </div>
    </>
  )
  // `bare` = uvnitř stránky, která už má vlastní kontejner (např. /ubytovani)
  return (
    <section className="z-section z-section--tight">
      {bare ? body : <div className="z-container">{body}</div>}
    </section>
  )
}
