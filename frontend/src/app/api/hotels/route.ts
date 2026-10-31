import { NextRequest } from 'next/server'
import { listHotels } from '@/server/hotels'
import { queryOf, respond } from '@/server/http'
export const dynamic = 'force-dynamic'
export const GET = (req: NextRequest) => respond(() => listHotels(queryOf(req)))
