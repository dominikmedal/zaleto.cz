import { NextRequest } from 'next/server'
import { hotelDetail } from '@/server/hotels'
import { respond } from '@/server/http'
export const dynamic = 'force-dynamic'
export const GET = (_: NextRequest, { params }: { params: { slug: string } }) => respond(() => hotelDetail(decodeURIComponent(params.slug)))
