/**
 * Pomocné funkce pro AI agenty: vyjednávání Markdownu (hlavička Accept) a chybové stránky v Markdownu.
 * Bez importů přes alias `@/`, aby šly spustit i v testech (`node --test`).
 */

export const SITE = 'https://zaleto.cz'

interface Range { type: string; q: number }

/** Rozparsuje hlavičku Accept na seznam typů s váhou q (výchozí 1). */
export function parseAccept(accept: string | null | undefined): Range[] {
  if (!accept) return []
  return accept
    .split(',')
    .map(part => {
      const [type, ...params] = part.trim().split(';').map(s => s.trim())
      const qParam = params.find(p => p.toLowerCase().startsWith('q='))
      const q = qParam ? Number.parseFloat(qParam.slice(2)) : 1
      return { type: (type || '').toLowerCase(), q: Number.isFinite(q) ? q : 1 }
    })
    .filter(r => r.type)
}

/**
 * Chce klient Markdown? Ano, když text/markdown vyjmenuje výslovně a jeho váha je alespoň taková jako u HTML.
 * Samotné `*` ani `* / *` Markdown nevyvolá, prohlížeče tak dál dostávají HTML.
 */
export function prefersMarkdown(accept: string | null | undefined): boolean {
  const ranges = parseAccept(accept)
  const best = (types: string[]) => Math.max(0, ...ranges.filter(r => types.includes(r.type)).map(r => r.q))
  const md = best(['text/markdown', 'text/x-markdown'])
  const html = best(['text/html', 'application/xhtml+xml'])
  return md > 0 && md >= html
}

/** Markdown tělo chyby pro agenty: stručné vysvětlení + odkazy na llms.txt, sitemapu a hlavní rozcestníky. */
export function markdownError(path: string, status: number): string {
  const safePath = path.replace(/[\r\n`]/g, '').slice(0, 200)
  const title = status === 404 ? '404 – Stránka nenalezena' : `${status} – Chyba`
  const what = status === 404
    ? `Adresa \`${safePath}\` na zaleto.cz neexistuje nebo byla přesunuta.`
    : `Adresu \`${safePath}\` se teď nepodařilo načíst (HTTP ${status}). Zkus to prosím za chvíli.`
  return [
    `# ${title}`,
    '',
    what,
    '',
    '## Kam dál',
    `- [Pokyny pro agenty a přehled webu (llms.txt)](${SITE}/llms.txt)`,
    `- [Mapa webu (sitemap.xml)](${SITE}/sitemap.xml)`,
    `- [Hledání zájezdů](${SITE}/zajezdy)`,
    `- [Destinace](${SITE}/destinace)`,
    `- [Půjčovna aut](${SITE}/pujcovna-aut)`,
    `- [Hledání na webu](${SITE}/hledat)`,
    `- [Domovská stránka](${SITE}/)`,
    '',
  ].join('\n')
}
