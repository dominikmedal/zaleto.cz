import { NextRequest } from 'next/server'
import { listDestinations } from '@/server/tours'
import { respond } from '@/server/http'
export const dynamic = 'force-dynamic'
export const GET = () => respond(() => listDestinations(), 'public, s-maxage=3600, stale-while-revalidate=600')
