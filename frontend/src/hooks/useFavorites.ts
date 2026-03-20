'use client'
import { useState, useEffect, useCallback } from 'react'

const SLUGS_KEY  = 'zaleto_favorites'
const NAMES_KEY  = 'zaleto_favorite_names'
const EVENT_NAME = 'zaleto:favorites-change'

function readSlugs(): string[] {
  try { return JSON.parse(localStorage.getItem(SLUGS_KEY) || '[]') } catch { return [] }
}
function readNames(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(NAMES_KEY) || '{}') } catch { return {} }
}

export interface FavoriteHotel { slug: string; name: string }

export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>([])
  const [names,     setNames]     = useState<Record<string, string>>({})

  // Hydrate on mount + listen for changes from any component on the page
  useEffect(() => {
    const sync = () => { setFavorites(readSlugs()); setNames(readNames()) }
    sync()
    window.addEventListener(EVENT_NAME, sync)
    window.addEventListener('storage', sync) // cross-tab
    return () => {
      window.removeEventListener(EVENT_NAME, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const toggleFavorite = useCallback((slug: string, name?: string) => {
    const current = readSlugs()
    const adding  = !current.includes(slug)
    const nextSlugs = adding ? [...current, slug] : current.filter(s => s !== slug)

    localStorage.setItem(SLUGS_KEY, JSON.stringify(nextSlugs))

    if (name) {
      const currentNames = readNames()
      if (adding) currentNames[slug] = name
      else        delete currentNames[slug]
      localStorage.setItem(NAMES_KEY, JSON.stringify(currentNames))
    }

    // Update local state immediately (no waiting for event)
    setFavorites(nextSlugs)
    setNames(readNames())

    // Notify every other useFavorites instance on the page
    window.dispatchEvent(
      new CustomEvent(EVENT_NAME, { detail: { slug, name: name ?? readNames()[slug] ?? slug, added: adding } })
    )
  }, [])

  const isFavorite = useCallback((slug: string) => favorites.includes(slug), [favorites])

  const favoriteHotels: FavoriteHotel[] = favorites.map(slug => ({
    slug,
    name: names[slug] ?? slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
  }))

  return { favorites, favoriteHotels, toggleFavorite, isFavorite }
}
