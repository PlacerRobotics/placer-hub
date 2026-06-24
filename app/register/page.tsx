import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import RegisterWizard from './register-wizard'

const SEASON = '2026-27'

function makePaymentRef(first: string, last: string) {
  const initials = `${first?.[0] ?? 'X'}${last?.[0] ?? 'X'}`.toUpperCase()
  const digits = Math.floor(1000 + Math.random() * 9000)
  return `PART-${SEASON.replace('-', '')}-${initials}-${digits}`
}

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ student?: string }> }) {
  const { student: studentParam } = await searchParams
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

  if (!fs || (fs.status !== 'cleared_to_register' && fs.status !== 'registered')) {
    redirect('/dashboard?notice=not_cleared')
  }

  // Load the student being registered — a specific one via ?student=<id> so a
  // multi-student family can register each child; otherwise the first on the family.
  const { data: students } = await supabase
    .from('student')
    .select(
      'id, first_name, last_name, preferred_name, birthdate, grade, school_id, school_raw, tshirt_size, fusion_education_email'
    )
    .eq('family_id', familyId)
    .order('created_at', { ascending: true })
  const list = students ?? []
  const student = (studentParam ? list.find((s) => s.id === studentParam) : null) ?? list[0]
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
    .select('id, name, grade_min, grade_max')
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

  // If an imported student has a free-text school_raw but no school_id, match it
  // to a canonical school so the dropdown pre-selects the real school instead of
  // falling back to "Other (not listed)".
  const schoolList = schools ?? []
  let resolvedStudent = student
  if (!student.school_id && student.school_raw) {
    const raw = student.school_raw.trim().toLowerCase()
    const match = schoolList.find((sch) => {
      const n = sch.name.toLowerCase()
      return n === raw || n.startsWith(raw) || raw.startsWith(n)
    })
    if (match) resolvedStudent = { ...student, school_id: match.id, school_raw: null }
  }

  const paymentRef =
    enrollment?.payment_reference_code ?? makePaymentRef(student.first_name, student.last_name)

  return (
    <RegisterWizard
      season={SEASON}
      studentId={student.id}
      program={program}
      student={resolvedStudent}
      schools={schoolList}
      waivers={waivers ?? []}
      paymentReferenceCode={paymentRef}
      guardianName={`${guardian.first_name} ${guardian.last_name}`}
      zeffyUrl={config?.zeffy_student_url ?? null}
    />
  )
}
