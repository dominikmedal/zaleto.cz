/**
 * Zmenšování fotek pro telefon i desktop. Zdroje fotek (CK, Unsplash, Pexels) posílají originály o stovkách kB až MB,
 * proto se každá fotka žádá v šířce, kterou skutečně potřebuje.
 * - Unsplash a Pexels umí zmenšení přímo v URL.
 * - Ostatní vzdálené zdroje (CDN cestovních kanceláří) jdou přes vlastní route /api/thumb (sharp, WebP, neměnná CDN cache; bez placeného optimalizátoru).
 *   Šířky musí být v seznamu WIDTHS v app/api/thumb/route.ts.
 * - Lokální soubory (/img/…) se nemění.
 */
export function sizedImage(src: string, width: number, quality = 72): string {
  if (!src || src.startsWith('/') || src.startsWith('data:') || src.startsWith('blob:') || src.includes('localhost')) return src
  let u: URL
  try { u = new URL(src) } catch { return src }
  const w = Math.max(64, Math.round(width))
  if (u.hostname === 'images.unsplash.com') {
    u.searchParams.set('w', String(w))
    u.searchParams.set('q', String(quality))
    u.searchParams.set('fit', 'max')
    u.searchParams.set('fm', 'webp')
    u.searchParams.delete('h')
    return u.toString()
  }
  if (u.hostname === 'images.pexels.com') {
    u.searchParams.set('auto', 'compress')
    u.searchParams.set('cs', 'tinysrgb')
    u.searchParams.set('w', String(w))
    u.searchParams.delete('h')
    u.searchParams.delete('dpr')
    return u.toString()
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return src
  return `/api/thumb?u=${encodeURIComponent(src)}&w=${w}&q=${quality}`
}

/** `srcset` pro více šířek (např. [320, 640] = 1× a 2× displej). */
export function imageSrcSet(src: string, widths: number[]): string | undefined {
  if (!src || src.startsWith('/') || src.startsWith('data:') || src.startsWith('blob:')) return undefined
  return widths.map(w => `${sizedImage(src, w)} ${w}w`).join(', ')
}

/** Loader pro next/image (next.config → images.loader = 'custom'). */
export default function imageLoader({ src, width, quality }: { src: string; width: number; quality?: number }): string {
  return sizedImage(src, width, quality ?? 72)
}
