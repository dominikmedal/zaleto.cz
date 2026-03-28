/**
 * Converts a Czech destination name to a URL-safe slug.
 * Strips diacritics, lowercases, replaces spaces/special chars with hyphens.
 */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Reverse-maps a slug back to an approximate destination name for API queries.
 * Since we store the original name in generateStaticParams, we pass it through
 * as a query param on the page. This is a fallback for display.
 */
export function deslugify(slug: string): string {
  return slug.replace(/-/g, ' ')
}
