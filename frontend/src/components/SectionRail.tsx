'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

interface Mark { el: HTMLElement; label: string; at: number }

/**
 * „Virtuální posuvník“ na desktopu: svislá lišta u pravého okraje zobrazuje polohu na stránce a vizuálně naznačuje
 * sekce (značky s popiskem). Sekce se hledají podle atributu `data-rail="Název"`. Značky i lištu lze klikat a tahat.
 * Na menších displejích a na stránkách s méně než dvěma sekcemi se nezobrazuje.
 */
export default function SectionRail() {
  const pathname = usePathname()
  const [marks, setMarks] = useState<Mark[]>([])
  const [progress, setProgress] = useState(0)
  const [active, setActive] = useState(0)
  const [drag, setDrag] = useState(false)
  const track = useRef<HTMLDivElement>(null)

  const measure = useCallback(() => {
    const range = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-rail]'))
    const next = els
      .map(el => ({ el, label: el.dataset.rail || '', at: Math.min(1, Math.max(0, (el.getBoundingClientRect().top + window.scrollY - 120) / range)) }))
      .filter(m => m.label)
      .sort((a, b) => a.at - b.at)
    setMarks(prev => (prev.length === next.length && prev.every((p, i) => p.el === next[i].el && Math.abs(p.at - next[i].at) < 0.002) ? prev : next))
  }, [])

  // hledání sekcí po změně stránky a při změně výšky obsahu (načítání obrázků, rozbalení sekcí…)
  useEffect(() => {
    setMarks([])
    const t = setTimeout(measure, 300)
    const ro = new ResizeObserver(() => measure())
    ro.observe(document.body)
    window.addEventListener('resize', measure)
    return () => { clearTimeout(t); ro.disconnect(); window.removeEventListener('resize', measure) }
  }, [pathname, measure])

  useEffect(() => {
    const onScroll = () => {
      const range = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
      setProgress(Math.min(1, Math.max(0, window.scrollY / range)))
      let cur = -1
      document.querySelectorAll<HTMLElement>('[data-rail]').forEach((el, i, all) => {
        void all
        if (el.getBoundingClientRect().top <= 160) cur = i
      })
      setActive(cur)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [marks])

  const scrollToFraction = (clientY: number) => {
    const r = track.current?.getBoundingClientRect()
    if (!r) return
    const f = Math.min(1, Math.max(0, (clientY - r.top) / r.height))
    window.scrollTo({ top: f * (document.documentElement.scrollHeight - window.innerHeight) })
  }

  useEffect(() => {
    if (!drag) return
    const move = (e: PointerEvent) => scrollToFraction(e.clientY)
    const up = () => setDrag(false)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
  }, [drag])

  if (marks.length < 2) return null

  // aktivní značka = poslední sekce, kterou jsme už minuli (podle pořadí v dokumentu)
  const ordered = Array.from(document.querySelectorAll<HTMLElement>('[data-rail]'))
  const activeEl = active >= 0 ? ordered[active] : null

  return (
    <nav className="z-rail" aria-label="Sekce stránky" data-dragging={drag || undefined}>
      <div
        ref={track}
        className="z-rail__track"
        onPointerDown={e => { if ((e.target as HTMLElement).closest('.z-rail__mark')) return; setDrag(true); scrollToFraction(e.clientY) }}
      >
        <span className="z-rail__fill" style={{ height: `${progress * 100}%` }} />
        <span className="z-rail__thumb" style={{ top: `${progress * 100}%` }} />
        {marks.map(m => (
          <button
            key={m.label + m.at}
            type="button"
            className="z-rail__mark"
            style={{ top: `${m.at * 100}%` }}
            data-active={m.el === activeEl || undefined}
            data-passed={m.at <= progress + 0.001 || undefined}
            aria-label={m.label}
            aria-current={m.el === activeEl ? 'true' : undefined}
            onClick={() => m.el.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })}
          >
            <span className="z-rail__label">{m.label}</span>
            <i />
          </button>
        ))}
      </div>
    </nav>
  )
}
