'use client'
import { useEffect } from 'react'

/**
 * Celé políčko vyhledávání (`.z-sfield`) je klikatelné: klik kamkoli do políčka (popisek, podtitul, okraj)
 * aktivuje jeho vstup – textové pole se zaostří, výběr se rozbalí, kalendář se otevře.
 * Jeden obsluhovač na dokumentu, takže funguje na všech formulářích (homepage, /zajezdy, auta).
 */
export default function FieldClicks() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      const field = target?.closest<HTMLElement>('.z-sfield')
      if (!field) return
      // klik přímo na ovládací prvek obslouží prvek sám
      if (target!.closest('input, select, textarea, button, a, [role="option"]')) return
      // otevřené nabídky (kalendář, našeptávač) nechceme hned znovu přepínat
      if (document.querySelector('.z-calpop, .z-dsuggest, .z-suggest')) return

      const control = field.querySelector<HTMLElement>('select:not([disabled]), input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), .z-datetrigger__btn')
      if (!control) return
      if (control instanceof HTMLSelectElement) {
        control.focus()
        try { control.showPicker?.() } catch { /* showPicker vyžaduje uživatelskou akci */ }
      } else if (control.classList.contains('z-datetrigger__btn')) {
        control.click()
      } else {
        control.focus()
      }
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  return null
}
