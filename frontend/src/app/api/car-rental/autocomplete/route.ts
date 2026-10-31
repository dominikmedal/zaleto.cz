import { NextRequest } from 'next/server'
import { carAutocomplete } from '@/server/carRental'
import { queryOf, respond } from '@/server/http'
export const dynamic = 'force-dynamic'
export const GET = (req: NextRequest) => respond(() => carAutocomplete(queryOf(req)), 'public, s-maxage=3600, stale-while-revalidate=600')
