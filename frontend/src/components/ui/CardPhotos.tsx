'use client'
import { useEffect, useRef, useState } from 'react'

interface Props {
  photos: string[]
  alt: string
  priority?: boolean
}

/**
 * Fotka na kartě hotelu: po najetí myší kamkoliv na kartu se fotky hotelu automaticky střídají po 2 s,
 * dole jsou tečky s aktuální pozicí. Po opuštění karty se vrací první fotka.
 */
export default function CardPhotos({ photos, alt, priority }: Props) {
  const [idx, setIdx] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const n = photos.length

  useEffect(() => {
    const card = root.current?.closest('.z-tk') as HTMLElement | null
    if (!card || n < 2) return
    let timer: ReturnType<typeof setInterval> | undefined
    const enter = () => {
      photos.slice(1).forEach(src => { const i = new Image(); i.src = src })
      setIdx(i => (i + 1) % n)
      timer = setInterval(() => setIdx(i => (i + 1) % n), 2000)
    }
    const leave = () => { if (timer) clearInterval(timer); timer = undefined; setIdx(0) }
    card.addEventListener('mouseenter', enter)
    card.addEventListener('mouseleave', leave)
    return () => { card.removeEventListener('mouseenter', enter); card.removeEventListener('mouseleave', leave); if (timer) clearInterval(timer) }
  }, [n, photos])

  return (
    <div className="z-cardphotos" ref={root}>
      {n > 0 && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photos[idx]} alt={alt} loading={priority ? 'eager' : 'lazy'} />
      )}
      {n > 1 && (
        <span className="z-cardphotos__dots" aria-hidden="true">
          {photos.map((_, i) => <i key={i} data-on={i === idx || undefined} />)}
        </span>
      )}
    </div>
  )
}
