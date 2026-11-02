import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'

export const OG_SIZE = { width: 1200, height: 630 }
export const OG_TYPE = 'image/png'

/** Fotku si stáhneme sami: satori umí jen JPEG/PNG a při chybě zdroje by padl celý obrázek (pak jedeme bez fotky). */
async function loadPhoto(url: string | null | undefined): Promise<string | null> {
  if (!url || !/^https:\/\//.test(url)) return null
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(4000) })
    const type = r.headers.get('content-type') ?? ''
    if (!r.ok || !/image\/(jpeg|png)/.test(type)) return null
    const buf = await r.arrayBuffer()
    if (buf.byteLength > 3_000_000) return null
    return `data:${type};base64,${Buffer.from(buf).toString('base64')}`
  } catch { return null }
}

interface Card { kicker: string; title: string; meta?: string; price?: string; photo?: string | null }

/** Sdílený obrázek pro sdílení (Open Graph) v barvách webu; používají ho stránky hotelu a destinace. */
export async function ogCard({ kicker, title, meta, price, photo }: Card) {
  const [bold, regular, img] = await Promise.all([
    readFile(join(process.cwd(), 'src/app/fonts/Poppins-Bold.ttf')),
    readFile(join(process.cwd(), 'src/app/fonts/Poppins-Regular.ttf')),
    loadPhoto(photo),
  ])
  const fontSize = title.length > 60 ? 44 : title.length > 38 ? 54 : 68
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: '#faf6ee', color: '#0b1b33', fontFamily: 'Poppins' }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1, padding: '56px 56px 56px 64px' }}>
          <div style={{ display: 'flex', alignItems: 'center', fontSize: 34, fontWeight: 700 }}>
            Zaleto<span style={{ color: '#0068c2' }}>.</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 24, color: '#56627a', textTransform: 'uppercase', letterSpacing: 2 }}>{kicker}</div>
            <div style={{ fontSize, fontWeight: 700, lineHeight: 1.1, marginTop: 16, display: 'flex' }}>{title}</div>
            {meta && <div style={{ fontSize: 28, color: '#56627a', marginTop: 20, display: 'flex' }}>{meta}</div>}
          </div>
          <div style={{ display: 'flex' }}>
            {price && (
              <div style={{ display: 'flex', background: '#0068c2', color: '#fff', fontSize: 32, fontWeight: 700, padding: '12px 28px', borderRadius: 999 }}>{price}</div>
            )}
          </div>
        </div>
        {img && (
          <div style={{ display: 'flex', width: 440, padding: '56px 64px 56px 0' }}>
            {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
            <img src={img} width={376} height={518} style={{ objectFit: 'cover', borderRadius: 24 }} />
          </div>
        )}
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        { name: 'Poppins', data: bold, weight: 700, style: 'normal' },
        { name: 'Poppins', data: regular, weight: 400, style: 'normal' },
      ],
    },
  )
}
