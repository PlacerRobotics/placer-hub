import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentVolunteer, ensureClearance, VOLUNTEER_SEASON } from '@/lib/volunteer'

const TYPE_MAP: Record<string, string> = { rc: 'lab_use', yp: 'youth_protection' }

export async function POST(req: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params
  const quizType = TYPE_MAP[type]
  if (!quizType) return NextResponse.json({ error: 'Unknown quiz.' }, { status: 404 })

  const vol = await getCurrentVolunteer()
  if (!vol) return NextResponse.json({ error: 'Not authorized.' }, { status: 401 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body.' }, { status: 400 }) }
  const answers: Record<string, number> = body.answers ?? {}

  const db = createAdminClient()
  const { data: quiz } = await db.from('quiz').select('id, version, pass_threshold').eq('quiz_type', quizType).eq('active', true).order('version', { ascending: false }).limit(1).maybeSingle()
  if (!quiz) return NextResponse.json({ error: 'Quiz not found.' }, { status: 404 })

  const { data: questions } = await db.from('quiz_question').select('id, correct_answers').eq('quiz_id', quiz.id)
  const qs = questions ?? []
  if (!qs.length) return NextResponse.json({ error: 'Quiz has no questions.' }, { status: 400 })

  let correct = 0
  const wrong: { id: string; correctIndex: number }[] = []
  for (const q of qs) {
    const ca = Array.isArray(q.correct_answers) ? q.correct_answers : []
    const correctIndex = Number(ca[0])
    if (answers[q.id] === correctIndex) correct++
    else wrong.push({ id: q.id, correctIndex })
  }
  const total = qs.length
  const fraction = correct / total
  const percent = Math.round(fraction * 100)
  const passed = fraction >= Number(quiz.pass_threshold)

  // Record the attempt (season-scoped).
  await db.from('quiz_attempt').insert({
    volunteer_id: vol.profileId,
    quiz_id: quiz.id,
    quiz_version: quiz.version,
    answers,
    score: fraction,
    passed,
    season: VOLUNTEER_SEASON,
  })

  if (passed) {
    const clearance = await ensureClearance(db, vol.profileId)
    const today = new Date().toISOString().slice(0, 10)
    const patch: Record<string, unknown> = type === 'rc'
      ? { rc_quiz_passed: true, rc_quiz_score: percent, rc_quiz_passed_date: today }
      : { yp_quiz_passed: true, yp_quiz_score: percent, yp_quiz_passed_date: today }
    if ((clearance?.status ?? 'pending') === 'pending') patch.status = 'in_progress'
    patch.updated_at = new Date().toISOString()
    await db.from('volunteer_clearance').update(patch).eq('id', clearance.id)
  }

  return NextResponse.json({ score: percent, passed, total, correct, wrong })
}
