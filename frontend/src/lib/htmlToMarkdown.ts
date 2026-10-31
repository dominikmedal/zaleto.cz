import { NodeHtmlMarkdown } from 'node-html-markdown'

const nhm = new NodeHtmlMarkdown(
  {
    ignore: ['script', 'style', 'noscript', 'svg', 'form', 'button', 'iframe', 'template', 'select', 'input', 'img'],
    maxConsecutiveNewlines: 2,
    useInlineLinks: true,
  },
  undefined,
  undefined,
)

const decode = (s: string) =>
  s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&nbsp;/g, ' ')

/**
 * Převede HTML stránky na Markdown: použije obsah `<main>` (bez hlavičky, zápatí, chatu), odkazy udělá absolutní
 * a přidá nadpis a zdrojovou adresu. Vrací prázdný řetězec, když na stránce není žádný text.
 */
export function htmlToMarkdown(html: string, pageUrl: string): string {
  const origin = new URL(pageUrl).origin
  const title = decode((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').trim())
  const main = html.match(/<main[\s\S]*?<\/main>/i)?.[0] ?? html.match(/<body[\s\S]*?<\/body>/i)?.[0] ?? html

  let md = nhm.translate(main).trim()
  // odkazy: relativní → absolutní, bez „/_next“ a kotev
  md = md.replace(/\]\((\/[^)\s]*)\)/g, (_, p: string) => `](${origin}${p})`)
  md = md.replace(/\n{3,}/g, '\n\n')
  if (!md) return ''
  if (!/^#\s/.test(md) && title) md = `# ${title}\n\n${md}`
  return `${md}\n\n---\nZdroj: ${pageUrl}\n`
}
