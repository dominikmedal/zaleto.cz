import { NextRequest } from 'next/server'
import { carQuote } from '@/server/carRental'
import { respond } from '@/server/http'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

/** Nejlevnější nabídka půjčovny pro banner (null = žádná/neznámá destinace). Cache 6 h na CDN. */
export const GET = (req: NextRequest) => respond(() => carQuote(req.nextUrl.searchParams.get('slug') ?? undefined), 'public, s-maxage=21600, stale-while-revalidate=3600')
