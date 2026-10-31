import { NextRequest } from 'next/server'
import { calendarPrices } from '@/server/tours'
import { queryOf, respond } from '@/server/http'
export const dynamic = 'force-dynamic'
export const GET = (req: NextRequest) => respond(() => calendarPrices(queryOf(req)))
