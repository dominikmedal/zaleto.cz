import { NextRequest } from 'next/server'
import { weatherLocation } from '@/server/content'
import { respond } from '@/server/http'
export const dynamic = 'force-dynamic'
export const GET = (_: NextRequest, { params }: { params: { name: string } }) => respond(() => weatherLocation(decodeURIComponent(params.name)), 'public, s-maxage=86400, stale-while-revalidate=3600')
