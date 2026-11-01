import { NextResponse } from 'next/server'
import { checkCron } from '@/server/cronAuth'
import { apiError } from '@/lib/apiError'
import { pickForToday, processArticle, generateCover, moveToDraft, updateDecision } from '@/server/autoArticles'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // jeden krok = jedno volání Gemini; limit funkcí na Vercelu

/** Kroky denní automatiky (volá je .github/workflows/auto-publish.yml): pick → process → image. */
export async function POST(req: Request, { params }: { params: { step: string } }) {
  const denied = checkCron(req)
  if (denied) return denied
  const body = await req.json().catch(() => ({})) as { url?: string; scheduledAt?: string; runId?: number | null; articleId?: number }
  const runId = body.runId ?? undefined

  try {
    if (params.step === 'pick') return NextResponse.json(await pickForToday())

    if (params.step === 'process') {
      if (!body.url || !body.scheduledAt) return apiError(400, 'Chybí url nebo scheduledAt.')
      try {
        return NextResponse.json(await processArticle(body.url, new Date(body.scheduledAt), runId))
      } catch (e) {
        await updateDecision(runId, body.url, { error: e instanceof Error ? e.message : String(e) })
        throw e
      }
    }

    if (params.step === 'image') {
      if (!body.articleId) return apiError(400, 'Chybí articleId.')
      try {
        return NextResponse.json(await generateCover(body.articleId))
      } catch (e) {
        await moveToDraft(body.articleId) // bez titulního obrázku se nezveřejňuje
        throw e
      }
    }
    return apiError(404, `Neznámý krok ${params.step}.`)
  } catch (e) {
    console.error('[auto-publish]', params.step, e)
    return apiError(500, e instanceof Error ? e.message : 'Chyba')
  }
}
