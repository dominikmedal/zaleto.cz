'use client'
import { useState } from 'react'
import Icon from '@/components/ui/Icon'
import { useFavorites } from '@/hooks/useFavorites'

interface Props {
  slug: string
  name?: string
  variant?: 'card' | 'detail'
  className?: string
}

export default function FavoriteButton({ slug, name, variant = 'card', className = '' }: Props) {
  const { isFavorite, toggleFavorite } = useFavorites()
  const [animKey, setAnimKey] = useState(0)
  const active = isFavorite(slug)

  const handle = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setAnimKey(k => k + 1)
    toggleFavorite(slug, name)
  }

  const heart = (
    <Icon
      key={animKey}
      name="srdce"
      size="sm"
      className={active ? 'animate-heart-pop' : undefined}
      style={active ? { fill: 'currentColor', color: 'var(--accent-strong)' } : undefined}
    />
  )

  if (variant === 'detail') {
    return (
      <button
        type="button"
        onClick={handle}
        aria-pressed={active}
        aria-label={active ? 'Odebrat z oblíbených' : 'Přidat do oblíbených'}
        className={`z-btn z-btn--line z-btn--sm ${className}`}
        style={{ justifyContent: 'center' }}
      >
        {heart}
        <span>{active ? 'Uloženo' : 'Uložit'}</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={handle}
      aria-pressed={active}
      aria-label={active ? 'Odebrat z oblíbených' : 'Přidat do oblíbených'}
      className={`z-heart ${className}`}
    >
      {heart}
    </button>
  )
}
