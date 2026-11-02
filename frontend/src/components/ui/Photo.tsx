import type { ImgHTMLAttributes } from 'react'
import { sizedImage, imageSrcSet } from '@/lib/imageLoader'

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'srcSet'> & {
  src: string
  /** Šířky v px, které se mají nabídnout prohlížeči (první = nejmenší). */
  widths?: number[]
}

/** Obyčejné <img> s automaticky zmenšenou fotkou a srcset; lazy loading a async dekódování ve výchozím stavu. */
export default function Photo({ src, widths = [360, 720], sizes = '100vw', alt = '', loading = 'lazy', ...rest }: Props) {
  const last = widths[widths.length - 1]
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img {...rest} alt={alt} loading={loading} decoding="async" src={sizedImage(src, last)} srcSet={imageSrcSet(src, widths)} sizes={sizes} />
  )
}
