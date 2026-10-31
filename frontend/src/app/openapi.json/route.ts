import { openapi } from '@/lib/openapi'

export const dynamic = 'force-static'

/** OpenAPI 3.1 specifikace veřejného API (https://zaleto.cz/openapi.json). */
export function GET() {
  return new Response(JSON.stringify(openapi, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
