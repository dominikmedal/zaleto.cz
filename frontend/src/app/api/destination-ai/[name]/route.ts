import { NextRequest } from 'next/server'
import { destinationAI } from '@/server/content'
import { respond } from '@/server/http'
export const dynamic = 'force-dynamic'
export const GET = (_: NextRequest, { params }: { params: { name: string } }) => respond(() => destinationAI(decodeURIComponent(params.name)), 'public, s-maxage=3600, stale-while-revalidate=600')
