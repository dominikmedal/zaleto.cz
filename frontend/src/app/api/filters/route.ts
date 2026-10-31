import { NextRequest } from 'next/server'
import { listFilters } from '@/server/tours'
import { respond } from '@/server/http'
export const dynamic = 'force-dynamic'
export const GET = () => respond(() => listFilters(), 'public, s-maxage=3600, stale-while-revalidate=600')
