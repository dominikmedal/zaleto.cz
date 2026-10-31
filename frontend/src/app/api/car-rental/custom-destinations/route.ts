import { NextRequest } from 'next/server'
import { customCarDestinations } from '@/server/carRental'
import { respond } from '@/server/http'
export const dynamic = 'force-dynamic'
export const GET = () => respond(() => customCarDestinations(), 'public, s-maxage=600, stale-while-revalidate=300')
