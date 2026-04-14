export default function imageLoader({
  src,
  width,
  quality,
}: {
  src: string
  width: number
  quality?: number
}): string {
  // Relative URLs (Railway uploads) and localhost → passthrough
  if (!src || src.startsWith('/') || src.includes('localhost') || src.startsWith('blob:')) {
    return src
  }

  // Strip protocol — weserv always fetches over HTTPS
  const clean = src.replace(/^https?:\/\//, '')
  const q = quality ?? 75

  return `https://images.weserv.nl/?url=${encodeURIComponent(clean)}&w=${width}&output=webp&q=${q}&we=1`
}
