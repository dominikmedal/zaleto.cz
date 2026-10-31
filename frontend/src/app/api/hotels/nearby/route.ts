import { NextRequest } from 'next/server'
import { nearbyHotels } from '@/server/hotels'
import { queryOf, respond } from '@/server/http'
export const dynamic = 'force-dynamic'
export const GET = (req: NextRequest) => respond(() => nearbyHotels(queryOf(req)))
