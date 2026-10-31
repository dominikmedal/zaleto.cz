import { NextRequest } from 'next/server'
import { enrichedCarDestinations } from '@/server/carRental'
import { respond } from '@/server/http'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
export const GET = () => respond(() => enrichedCarDestinations(), 'public, s-maxage=21600, stale-while-revalidate=3600')
