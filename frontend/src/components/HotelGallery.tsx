'use client'
import { useState, useCallback } from 'react'
import Image from 'next/image'
import { X, ChevronLeft, ChevronRight, Grid2x2 } from 'lucide-react'

interface Props {
  photos: string[]
  name: string
}

export default function HotelGallery({ photos, name }: Props) {
  const [lightbox, setLightbox] = useState<number | null>(null)

  const open  = (i: number) => setLightbox(i)
  const close = () => setLightbox(null)
  const prev  = useCallback(() => setLightbox(i => i != null ? (i - 1 + photos.length) % photos.length : 0), [photos.length])
  const next  = useCallback(() => setLightbox(i => i != null ? (i + 1) % photos.length : 0), [photos.length])

  const main   = photos[0]
  const thumbs = photos.slice(1, 5)
  const hidden = photos.length - 5

  if (photos.length === 0) return null

  return (
    <>
      {/* Gallery grid */}
      <div className="grid grid-cols-4 grid-rows-2 gap-2 h-[420px] sm:h-[520px] rounded-2xl overflow-hidden mb-8">
        {/* Main large photo */}
        <div
          className="col-span-2 row-span-2 relative cursor-pointer group"
          onClick={() => open(0)}
        >
          <Image src={main} alt={name} fill className="object-cover transition-transform duration-500 group-hover:scale-[1.02]" sizes="50vw" priority />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
        </div>

        {/* 4 smaller photos */}
        {thumbs.map((photo, i) => (
          <div
            key={photo}
            className="relative cursor-pointer group overflow-hidden"
            onClick={() => open(i + 1)}
          >
            <Image src={photo} alt={`${name} ${i + 2}`} fill className="object-cover transition-transform duration-500 group-hover:scale-[1.05]" sizes="25vw" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />

            {/* "Show all" overlay on last visible thumb */}
            {i === 3 && hidden > 0 && (
              <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-1">
                <Grid2x2 className="w-6 h-6 text-white" />
                <span className="text-white font-semibold text-sm">+{hidden} fotek</span>
              </div>
            )}
          </div>
        ))}

        {/* Fewer than 5 photos — fill empty slots */}
        {thumbs.length < 4 && Array.from({ length: 4 - thumbs.length }).map((_, i) => (
          <div key={`empty-${i}`} className="bg-gray-100" />
        ))}
      </div>


      {/* Lightbox */}
      {lightbox !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={close}
        >
          {/* Close */}
          <button
            onClick={close}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Counter */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/70 text-sm font-medium">
            {lightbox + 1} / {photos.length}
          </div>

          {/* Prev */}
          <button
            onClick={e => { e.stopPropagation(); prev() }}
            className="absolute left-4 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          {/* Image */}
          <div
            className="relative w-full max-w-5xl max-h-[85vh] mx-16"
            style={{ aspectRatio: '16/10' }}
            onClick={e => e.stopPropagation()}
          >
            <Image
              src={photos[lightbox]}
              alt={`${name} ${lightbox + 1}`}
              fill
              className="object-contain"
              sizes="90vw"
              priority
            />
          </div>

          {/* Next */}
          <button
            onClick={e => { e.stopPropagation(); next() }}
            className="absolute right-4 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <ChevronRight className="w-6 h-6" />
          </button>

          {/* Thumbnail strip */}
          {photos.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 max-w-[80vw] overflow-x-auto px-2 pb-1">
              {photos.map((p, i) => (
                <button
                  key={p}
                  onClick={e => { e.stopPropagation(); setLightbox(i) }}
                  className={`relative flex-shrink-0 w-14 h-10 rounded-lg overflow-hidden border-2 transition-all ${
                    i === lightbox ? 'border-white' : 'border-transparent opacity-60 hover:opacity-90'
                  }`}
                >
                  <Image src={p} alt="" fill className="object-cover" sizes="56px" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}
