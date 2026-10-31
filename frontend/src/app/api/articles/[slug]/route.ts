import { NextRequest } from 'next/server'
import { getArticle } from '@/server/content'
import { respond } from '@/server/http'
export const dynamic = 'force-dynamic'
export const GET = (_: NextRequest, { params }: { params: { slug: string } }) => respond(() => getArticle(decodeURIComponent(params.slug)))
