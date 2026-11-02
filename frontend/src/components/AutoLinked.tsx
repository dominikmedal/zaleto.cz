import { cache } from 'react'
import { fetchLinkTargets } from '@/lib/api'
import { Linked } from '@/lib/autolink'

// jedno načtení cílů odkazů na požadavek, i když je text na stránce desítky
const targets = cache(() => fetchLinkTargets())

/**
 * Text s automatickými odkazy na průvodce míst (první výskyt každého názvu). Server komponenta:
 * cíle si načte sama, takže ji jde vložit i do podkomponent, které nedostávají seznam odkazů.
 */
export default async function AutoLinked({ text, exclude, max }: { text: string; exclude?: string[]; max?: number }) {
  const links = await targets().catch(() => [])
  return <Linked text={text} links={links} exclude={exclude} max={max} />
}
