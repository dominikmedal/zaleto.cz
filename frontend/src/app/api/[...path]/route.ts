import { apiError } from '@/lib/apiError'

export const dynamic = 'force-dynamic'

/**
 * Záchytná route pro neexistující adresy pod /api: místo HTML stránky 404 vrací strukturovanou JSON chybu.
 * (Konkrétní route handlery mají přednost, tahle se použije jen tam, kde žádný jiný nesedí.)
 */
const notFound = (req: Request) => apiError(404, `Endpoint ${new URL(req.url).pathname} neexistuje.`)
const notAllowed = () => apiError(405, 'Tato metoda není u tohoto endpointu podporovaná.', undefined, { Allow: 'GET, HEAD, OPTIONS' })

export const GET = notFound
export const HEAD = notFound
export const POST = notAllowed
export const PUT = notAllowed
export const PATCH = notAllowed
export const DELETE = notAllowed
export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS', Allow: 'GET, HEAD, OPTIONS' },
  })
}
