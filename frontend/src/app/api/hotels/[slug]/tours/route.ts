import { NextRequest } from 'next/server'
import { hotelTours } from '@/server/tours'
import { queryOf, respond } from '@/server/http'
export const dynamic = 'force-dynamic'
export const GET = (req: NextRequest, { params }: { params: { slug: string } }) => respond(() => hotelTours(decodeURIComponent(params.slug), queryOf(req)))
