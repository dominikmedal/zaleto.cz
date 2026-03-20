'use client'
import { useState } from 'react'
import { PiHeart, PiHeartFill } from 'react-icons/pi'
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
    setAnimKey(k => k + 1)   // re-trigger animation on each click
    toggleFavorite(slug, name)
  }

  if (variant === 'detail') {
    return (
      <button
        type="button"
        onClick={handle}
        aria-label={active ? 'Odebrat z oblíbených' : 'Přidat do oblíbených'}
        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-sm font-medium transition-all ${
          active
            ? 'bg-red-50 border-red-200 text-red-500 hover:bg-red-100'
            : 'bg-white border-gray-200 text-gray-500 hover:border-red-200 hover:text-red-400'
        } ${className}`}
      >
        {active
          ? <PiHeartFill key={animKey} className="w-4 h-4 text-red-500 animate-heart-pop" />
          : <PiHeart key={animKey} className="w-4 h-4" />
        }
        <span>{active ? 'Uloženo' : 'Uložit'}</span>
      </button>
    )
  }

  // Card variant — circle button over image
  return (
    <button
      type="button"
      onClick={handle}
      aria-label={active ? 'Odebrat z oblíbených' : 'Přidat do oblíbených'}
      className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
        active
          ? 'bg-white shadow-md'
          : 'bg-black/25 backdrop-blur-sm hover:bg-white/90'
      } ${className}`}
    >
      {active
        ? <PiHeartFill key={animKey} className="w-4 h-4 text-red-500 animate-heart-pop" />
        : <PiHeart key={animKey} className="w-4 h-4 text-white" />
      }
    </button>
  )
}
