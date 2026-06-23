import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { FamilyShell } from '@/components/ui'
import { getCurrentVolunteer } from '@/lib/volunteer'
import QuizRunner from './quiz-runner'

const TYPE_MAP: Record<string, string> = { rc: 'lab_use', yp: 'youth_protection' }

export default async function VolunteerQuizPage({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params
  const quizType = TYPE_MAP[type]
  if (!quizType) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const vol = await getCurrentVolunteer()
  if (!vol) redirect('/volunteer')

  const db = createAdminClient()
  const { data: quiz } = await db.from('quiz').select('id, title, version, pass_threshold').eq('quiz_type', quizType).eq('active', true).order('version', { ascending: false }).limit(1).maybeSingle()
  if (!quiz) notFound()

  const { data: questions } = await db
    .from('quiz_question')
    .select('id, question_text, options, order_index')
    .eq('quiz_id', quiz.id)
    .order('order_index', { ascending: true })

  const safeQuestions = (questions ?? []).map((q: any) => ({
    id: q.id,
    question_text: q.question_text,
    options: Array.isArray(q.options) ? q.options : [],
  }))

  return (
    <FamilyShell familyName={vol.name || vol.email} maxWidth="md">
      <QuizRunner
        type={type}
        title={quiz.title}
        passPercent={Math.round(Number(quiz.pass_threshold) * 100)}
        questions={safeQuestions}
      />
    </FamilyShell>
  )
}
