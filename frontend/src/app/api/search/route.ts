import { NextRequest } from 'next/server'
import { siteSearch } from '@/server/search'
import { queryOf, respond } from '@/server/http'
export const dynamic = 'force-dynamic'
export const GET = (req: NextRequest) => respond(() => siteSearch(queryOf(req)))
