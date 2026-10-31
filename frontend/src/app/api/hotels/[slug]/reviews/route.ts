import { NextRequest } from 'next/server'
import { hotelReviews } from '@/server/hotels'
import { respond } from '@/server/http'
export const dynamic = 'force-dynamic'
export const maxDuration = 30
export const GET = (_: NextRequest, { params }: { params: { slug: string } }) => respond(() => hotelReviews(decodeURIComponent(params.slug)))
