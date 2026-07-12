import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, studentApplicationReceivedHtml } from '@/lib/email'
import { cleanEmail } from '@/lib/email-input'

const SEASON = '2026-27'
const PROGRAM_LABELS: Record<string, string> = { vex_v5: 'VEX V5', combat: 'Combat', vex_iq: 'VEX IQ', both: 'VEX V5 & Combat', not_sure: 'Not sure yet' }

type Guardian = { first_name: string; last_name: string; email: string; phone: string }
type Guardian1 = Guardian & {
  occupation?: string | null
  volunteer_interests?: string[]
  volunteer_notes?: string | null
}
type Payload = {
  program: 'vex_v5' | 'combat' | 'both' | 'not_sure'
  student: {
    first_name: string
    last_name: string
    preferred_name?: string | null
    grade: number
    school_id?: string | null
    school_raw?: string | null
    city: string
    zip_code: string
    communication_email?: string | null
  }
  application: {
    gpa_overall?: string | null
    gpa_recent_term?: string | null
    referral_source?: string | null
    previous_experience?: string[]
    skills_interest?: string[]
    teammate_preference?: string | null
    motivation_background: string
    motivation_goals: string
    extracurriculars: string
    summer_availability: 'yes' | 'maybe' | 'no'
    additional_notes?: string | null
  }
  guardian1: Guardian1
  guardian2?: Partial<Guardian> | null
  data_certified: boolean
}

const PROGRAMS = new Set(['vex_v5', 'combat', 'both', 'not_sure'])
const SUMMER = new Set(['yes', 'maybe', 'no'])

function num(v: string | null | undefined): number | null {
  if (v == null || v.trim() === '') return null
  const n = parseFloat(v)
  return Number.isNaN(n) ? null : n
}

/**
 * Public application submission (PRD §5 canonical field set).
 * Uses the service-role admin client (bypasses RLS) because the applicant is
 * unauthenticated and there is no family/guardian row to satisfy owns_family()
 * yet. Creates family, guardian(s), student, family_season, student_application.
 */
export async function POST(request: NextRequest) {
  let body: Payload
  try {
    body = (await request.json()) as Payload
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const { program, student, application, guardian1, guardian2, data_certified } = body ?? ({} as Payload)

  if (!program || !PROGRAMS.has(program)) {
    return NextResponse.json({ error: 'Please choose a program.' }, { status: 400 })
  }
  if (!student?.first_name || !student?.last_name || !student?.grade || !student?.city || !student?.zip_code) {
    return NextResponse.json({ error: 'Please complete the student information fields.' }, { status: 400 })
  }
  if (
    !application?.motivation_background ||
    !application?.motivation_goals ||
    !application?.extracurriculars ||
    !application?.summer_availability ||
    !SUMMER.has(application.summer_availability)
  ) {
    return NextResponse.json({ error: 'Please complete the “About you” questions.' }, { status: 400 })
  }
  if (!guardian1?.first_name || !guardian1?.last_name || !guardian1?.email || !guardian1?.phone) {
    return NextResponse.json({ error: 'Please complete the guardian 1 fields.' }, { status: 400 })
  }
  if (!data_certified) {
    return NextResponse.json({ error: 'Please confirm the parent/guardian certification.' }, { status: 400 })
  }

  const db = createAdminClient()
  const g1email = cleanEmail(guardian1.email)

  // 1. Resolve or create the family (matched by guardian 1 email).
  let familyId: string | null = null
  const { data: existingGuardian } = await db
    .from('guardian')
    .select('family_id')
    .eq('login_email', g1email)
    .maybeSingle()

  if (existingGuardian) {
    familyId = existingGuardian.family_id
  } else {
    const { data: fam, error: famErr } = await db
      .from('family')
      .insert({ primary_email: g1email, display_name: `${guardian1.last_name} Family` })
      .select('id')
      .single()
    if (famErr) return NextResponse.json({ error: famErr.message }, { status: 500 })
    familyId = fam.id
  }

  // 2. Guardian(s) — upsert on the unique login_email. Volunteer interest,
  //    profession, and notes (PRD §4) are stored on the primary guardian.
  const guardianRows: Record<string, unknown>[] = [
    {
      family_id: familyId,
      role: 'primary',
      first_name: guardian1.first_name,
      last_name: guardian1.last_name,
      login_email: g1email,
      phone: guardian1.phone,
      occupation: guardian1.occupation ?? null,
      volunteer_interests: guardian1.volunteer_interests ?? [],
      volunteer_notes: guardian1.volunteer_notes ?? null,
    },
  ]
  if (guardian2 && guardian2.email) {
    guardianRows.push({
      family_id: familyId,
      role: 'secondary',
      first_name: guardian2.first_name ?? '',
      last_name: guardian2.last_name ?? '',
      login_email: cleanEmail(guardian2.email),
      phone: guardian2.phone ?? '',
    })
  }
  const { error: gErr } = await db.from('guardian').upsert(guardianRows, { onConflict: 'login_email' })
  if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500 })

  // 3. Student (PRD §1). City and ZIP are collected on the form.
  const { data: stu, error: sErr } = await db
    .from('student')
    .insert({
      family_id: familyId,
      first_name: student.first_name,
      last_name: student.last_name,
      preferred_name: student.preferred_name ?? null,
      grade: student.grade,
      school_id: student.school_id ?? null,
      school_raw: student.school_raw ?? null,
      city: student.city,
      zip_code: student.zip_code,
      communication_email: student.communication_email ?? null,
      status: 'pending',
    })
    .select('id, first_name, last_name')
    .single()
  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 })

  // 4. family_season — mark the family as having applied this season.
  const { error: fsErr } = await db
    .from('family_season')
    .upsert({ family_id: familyId, season: SEASON, status: 'applied' }, { onConflict: 'family_id,season' })
  if (fsErr) return NextResponse.json({ error: fsErr.message }, { status: 500 })

  // 5. GPA flag — flag if either GPA is below the season's threshold (admin still
  //    makes the final call; the system never auto-declines). PRD §5 Admin GPA Flag.
  const gpaOverall = num(application.gpa_overall)
  const gpaRecent = num(application.gpa_recent_term)
  let gpaFlagged = false
  const { data: cfg } = await db
    .from('season_config')
    .select('min_gpa_threshold')
    .eq('season', SEASON)
    .maybeSingle()
  const threshold = cfg?.min_gpa_threshold ?? null
  if (threshold != null) {
    if ((gpaOverall != null && gpaOverall < threshold) || (gpaRecent != null && gpaRecent < threshold)) {
      gpaFlagged = true
    }
  }

  // 6. student_application — one per student per season (PRD §5 field set).
  const { error: aErr } = await db
    .from('student_application')
    .upsert(
      {
        family_id: familyId,
        student_id: stu.id,
        season: SEASON,
        program_interest: program,
        status: 'submitted',
        source: 'platform',
        gpa_overall: gpaOverall,
        gpa_recent_term: gpaRecent,
        gpa_flagged: gpaFlagged,
        referral_source: application.referral_source ?? null,
        previous_experience: application.previous_experience ?? [],
        skills_interest: application.skills_interest ?? [],
        teammate_preference: application.teammate_preference ?? null,
        motivation_background: application.motivation_background,
        motivation_goals: application.motivation_goals,
        extracurriculars: application.extracurriculars,
        summer_availability: application.summer_availability,
        additional_notes: application.additional_notes ?? null,
      },
      { onConflict: 'student_id,season' }
    )
  if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 })

  // Confirmation to guardian 1 — best-effort; sendEmail no-ops if email isn't configured.
  try {
    await sendEmail({
      to: [g1email],
      subject: `Application received — ${stu.first_name} ${stu.last_name} (Placer Robotics ${SEASON})`,
      html: studentApplicationReceivedHtml({
        guardianName: guardian1.first_name,
        studentName: `${stu.first_name} ${stu.last_name}`.trim(),
        programLabel: PROGRAM_LABELS[program] ?? program,
        season: SEASON,
      }),
    })
  } catch (e) { console.error('[apply] confirmation email failed:', e) }

  return NextResponse.json({ ok: true, student_name: `${stu.first_name} ${stu.last_name}` })
}
