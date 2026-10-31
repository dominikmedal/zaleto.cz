import { NextRequest } from 'next/server'
import { articleSlugs } from '@/server/content'
import { respond } from '@/server/http'
export const dynamic = 'force-dynamic'
export const GET = () => respond(() => articleSlugs())
