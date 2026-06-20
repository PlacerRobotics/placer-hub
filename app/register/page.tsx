import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import RegisterWizard from './register-wizard'

const SEASON = '2026-27'

function makePaymentRef(first: string, last: string) {
  const initials = `${first?.[0] ?? 'X'}${last?.[0] ?? 'X'}`.toUpperCase()
  const digits = Math.floor(1000 + Math.random() * 9000)
  return `PART-${SEASON.replace('-', '')}-${initials}-${digits}`
}

export default async function RegisterPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Resolve the family via the logged-in guardian's email.
  const { data: guardian } = await supabase
    .from('guardian')
    .select('id, family_id, first_name, last_name')
    .ilike('login_email', user.email ?? '')
    .maybeSingle()

  if (!guardian) redirect('/dashboard?notice=not_cleared')
  const familyId: string = guardian.family_id

  // Gate: the family must be cleared to register this season.
  const { data: fs } = await supabase
    .from('family_season')
    .select('status')
    .eq('family_id', familyId)
    .eq('season', SEASON)
    .maybeSingle()

  if (!fs || fs.status !== 'cleared_to_register') {
    redirect('/dashboard?notice=not_cleared')
  }

  // Load the student being registered (first student on the family).
  const { data: students } = await supabase
    .from('student')
    .select(
      'id, first_name, last_name, preferred_name, birthdate, grade, school_id, school_raw, tshirt_size, fusion_education_email'
    )
    .eq('family_id', familyId)
    .order('created_at', { ascending: true })
    .limit(1)
  const student = students?.[0]
  if (!student) redirect('/dashboard?notice=not_cleared')

  const { data: appn } = await supabase
    .from('student_application')
    .select('program_interest')
    .eq('student_id', student.id)
    .eq('season', SEASON)
    .maybeSingle()
  const program: string = appn?.program_interest ?? 'vex_v5'

  const { data: enrollment } = await supabase
    .from('enrollment')
    .select('payment_reference_code')
    .eq('student_id', student.id)
    .eq('season', SEASON)
    .eq('program', program)
    .maybeSingle()

  const { data: schools } = await supabase
    .from('school')
    .select('id, name')
    .eq('active', true)
    .order('name', { ascending: true })

  const { data: waivers } = await supabase
    .from('waiver_template')
    .select('id, waiver_type, version, title, body_markdown, body_hash')
    .eq('active', true)
    .order('waiver_type', { ascending: true })

  const { data: config } = await supabase
    .from('season_config')
    .select('zeffy_student_url')
    .eq('season', SEASON)
    .maybeSingle()

  const paymentRef =
    enrollment?.payment_reference_code ?? makePaymentRef(student.first_name, student.last_name)

  return (
    <RegisterWizard
      season={SEASON}
      studentId={student.id}
      program={program}
      student={student}
      schools={schools ?? []}
      waivers={waivers ?? []}
      paymentReferenceCode={paymentRef}
      guardianName={`${guardian.first_name} ${guardian.last_name}`}
      zeffyUrl={config?.zeffy_student_url ?? null}
    />
  )
}
