/** Zapamatuje poslední hledání (termín, odkud, počet osob) pro detail hotelu – čte ho TourDatesList. */
export function rememberFilters(patch: Record<string, string | undefined | null>) {
  try {
    const p = new URLSearchParams(sessionStorage.getItem('zaleto-filters') ?? '')
    for (const [k, v] of Object.entries(patch)) {
      if (v) p.set(k, v); else p.delete(k)
    }
    sessionStorage.setItem('zaleto-filters', p.toString())
  } catch { /* soukromý režim */ }
}
