import { fetchLandingList } from '@/lib/api'
import { MONTHS_IN } from '@/lib/seoContent'
import { seasonOf } from '@/lib/season'
import HeaderClient from './HeaderClient'

/**
 * Hlavní menu. Serverová obálka jen zjistí, jestli existuje přehled zájezdů pro aktuální měsíc
 * („Zájezdy v listopadu“), a předá ho klientskému menu. Bez přehledu se položka nezobrazí (žádný odkaz do prázdna).
 */
export default async function Header() {
  const month = new Date().getMonth() + 1
  const landing = (await fetchLandingList().catch(() => [])).find(l => l.type === 'month' && !l.country && Number(l.value) === month)
  const seasonal = landing ? { href: `/zajezdy/${landing.slug}`, label: `Zájezdy v ${MONTHS_IN[month - 1]}`, season: seasonOf(month) } : null
  return <HeaderClient seasonal={seasonal} />
}
