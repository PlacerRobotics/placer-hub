import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fundraisingDeadline } from '@/lib/fundraising'
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
      'id, first_name, last_name, preferred_name, birthdate, grade, school_id, school_raw, tshirt_size, fusion_education_email, communication_email'
    )
    .eq('family_id', familyId)
    .order('created_at', { ascending: true })
  const list = students ?? []
  const student = (studentParam ? list.find((s) => s.id === studentParam) : null) ?? list[0]
  if (!student) redirect('/dashboard?notice=not_cleared')

  const { data: appn } = await supabase
    .from('student_application')
    .select('program_interest, reviewed_at')
    .eq('student_id', student.id)
    .eq('season', SEASON)
    .maybeSingle()
  const program: string = appn?.program_interest ?? 'vex_v5'

  // Primary enrollment (lowest created_at) — for a 'both' student there is no row
  // with program='both', so don't filter by program; the primary holds the ref code
  // and the consent flags we prefill on resume.
  const { data: enrollment } = await supabase
    .from('enrollment')
    .select('payment_reference_code, student_slack_consent, parent_email_access_certified, fundraising_methods')
    .eq('student_id', student.id)
    .eq('season', SEASON)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  // Prefill the emergency-contact step from any contact already on file.
  const { data: ecRow } = await supabase
    .from('emergency_contact')
    .select('first_name, last_name, relationship, phone')
    .eq('student_id', student.id)
    .eq('priority', 1)
    .maybeSingle()

  // Already-signed waivers (resume): show them read-only with the original date + names.
  const { data: sigRows } = await supabase
    .from('waiver_signature')
    .select('signed_at, typed_name, participant_typed_name')
    .eq('student_id', student.id)
    .eq('season', SEASON)
    .order('signed_at', { ascending: false })
  const signed = sigRows && sigRows.length
    ? { signedAt: sigRows[0].signed_at as string, parentName: (sigRows[0].typed_name as string) ?? '', studentName: (sigRows[0].participant_typed_name as string) ?? '' }
    : null

  // Already-chosen fundraising (resume): family-level, only meaningful once the family
  // has registered. employer_match_* / sponsor interest are admin-RLS, so read via the
  // service-role client (scoped to this family).
  const alreadyRegistered = fs.status === 'registered'
  let fundraising: {
    methods: string[]; employer_company: string; employer_pct: string; employer_portal: string
    sponsor_business: string; sponsor_contact: string; sponsor_amount: string
  } | null = null
  if (alreadyRegistered) {
    const adb = createAdminClient()
    const [{ data: famRow }, { data: spRow }] = await Promise.all([
      adb.from('family').select('employer_match_company, employer_match_pct, employer_match_portal').eq('id', familyId).maybeSingle(),
      adb.from('family_sponsor_interest').select('business_name, contact_name, estimated_amount').eq('family_id', familyId).eq('season', SEASON).eq('student_id', student.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ])
    fundraising = {
      methods: (enrollment?.fundraising_methods ?? []) as string[],
      employer_company: famRow?.employer_match_company ?? '',
      employer_pct: famRow?.employer_match_pct != null ? String(famRow.employer_match_pct) : '',
      employer_portal: famRow?.employer_match_portal ?? '',
      sponsor_business: spRow?.business_name ?? '',
      sponsor_contact: spRow?.contact_name ?? '',
      sponsor_amount: spRow?.estimated_amount != null ? String(spRow.estimated_amount) : '',
    }
  }

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
    .select('zeffy_student_url, one_program_fundraising_target')
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
      fundraisingTarget={config?.one_program_fundraising_target ?? 550}
      fundraisingDeadline={fundraisingDeadline(appn?.reviewed_at ?? null)}
      emergency={ecRow ? { first_name: ecRow.first_name ?? '', last_name: ecRow.last_name ?? '', relationship: ecRow.relationship ?? '', phone: ecRow.phone ?? '' } : null}
      consent={enrollment ? { slackConsent: !!enrollment.student_slack_consent, emailCertified: !!enrollment.parent_email_access_certified } : null}
      signed={signed}
      fundraising={fundraising}
    />
  )
}
