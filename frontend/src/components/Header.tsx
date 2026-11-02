import { fetchLandingList } from '@/lib/api'
import HeaderClient from './HeaderClient'

/**
 * Hlavní menu. Serverová obálka zjistí, pro které měsíce existuje přehled zájezdů („Zájezdy v listopadu“),
 * a předá je klientskému menu; to podle skutečného data vybere aktuální měsíc (funguje i na staticky předrenderovaných
 * stránkách a po přelomu měsíce bez nového nasazení). Bez přehledu pro aktuální měsíc se položka nezobrazí.
 */
export default async function Header() {
  const landings = await fetchLandingList().catch(() => [])
  const months = landings.filter(l => l.type === 'month' && !l.country).map(l => ({ month: Number(l.value), href: `/zajezdy/${l.slug}` }))
  return <HeaderClient months={months} serverMonth={new Date().getMonth() + 1} />
}
