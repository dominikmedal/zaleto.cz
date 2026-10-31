import { NextRequest } from 'next/server'
import { carRentalAI } from '@/server/content'
import { respond } from '@/server/http'
export const dynamic = 'force-dynamic'
export const GET = (_: NextRequest, { params }: { params: { slug: string } }) => respond(() => carRentalAI(decodeURIComponent(params.slug)), 'public, s-maxage=86400, stale-while-revalidate=3600')
