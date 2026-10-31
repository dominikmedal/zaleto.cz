import { NextRequest } from 'next/server'
import { listArticles } from '@/server/content'
import { queryOf, respond } from '@/server/http'
export const dynamic = 'force-dynamic'
export const GET = (req: NextRequest) => respond(() => listArticles(queryOf(req)))
