import { NextRequest } from 'next/server'
import { destinationPhoto } from '@/server/content'
import { respond } from '@/server/http'
export const dynamic = 'force-dynamic'
export const GET = (_: NextRequest, { params }: { params: { name: string } }) => respond(() => destinationPhoto(decodeURIComponent(params.name)), 'public, s-maxage=86400, stale-while-revalidate=3600')
