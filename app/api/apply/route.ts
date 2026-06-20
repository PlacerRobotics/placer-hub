import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const SEASON = '2026-27'

type Payload = {
  programs: string[] // multi-select: 'VEX V5' | 'Combat Robotics' | 'Not Sure'
  student: {
    first_name: string
    last_name: string
    preferred_name?: string | null
    communication_email: string
    phone: string
    birthdate?: string | null
    home_address: string
    grade: number
    school_id?: string | null
    school_raw?: string | null
  }
  application: {
    gpa_overall?: string | null
    gpa_recent_term?: string | null
    referral_source?: string | null
    previous_experience?: string[]
    skills_interest?: string[]
    teammate_preference?: string | null
    motivation_background: string
    motivation_why_join: string
    motivation_why_competitive: string
    motivation_goals: string
    commitment_level: string
    extracurriculars: string
    extracurricular_hours: string
    summer_availability: 'yes' | 'maybe' | 'no'
    additional_notes?: string | null
  }
  guardian: {
    first_name: string
    last_name: string
    email: string
    phone: string
    occupation?: string | null
    volunteer_interests?: string[]
    volunteer_notes?: string | null
  }
  data_certified: boolean
}

const SUMMER = new Set(['yes', 'maybe', 'no'])

function num(v: string | null | undefined): number | null {
  if (v == null || v.trim() === '') return null
  const n = parseFloat(v)
  return Number.isNaN(n) ? null : n
}

// Best-effort split of a single "City, State, ZIP" string. city/zip are NOT NULL
// in the schema, so unparseable parts fall back to '' (the raw string is always
// kept in street_address).
function parseAddress(raw: string): { street: string; city: string; state: string; zip: string } {
  const parts = raw.split(',').map((s) => s.trim()).filter(Boolean)
  let city = parts[0] ?? ''
  let state = ''
  let zip = ''
  const tail = parts.slice(1).join(' ')
  const m = tail.match(/([A-Za-z]{2})?\s*(\d{5})/)
  if (m) {
    if (m[1]) state = m[1].toUpperCase()
    zip = m[2]
  } else if (parts[1]) {
    state = parts[1]
  }
  if (parts.length === 1) city = parts[0] ?? ''
  return { street: raw, city, state, zip }
}

// Map the multi-select program checkboxes onto the single program_interest enum
// used by the pipeline. One concrete program → that program; "Not Sure" or
// multiple → not_sure. The raw selections are preserved in program_interests[].
function deriveProgramInterest(programs: string[]): 'vex_v5' | 'combat' | 'not_sure' {
  const concrete = programs.filter((p) => p === 'VEX V5' || p === 'Combat Robotics')
  if (programs.includes('Not Sure') || concrete.length !== 1) return 'not_sure'
  return concrete[0] === 'VEX V5' ? 'vex_v5' : 'combat'
}

/**
 * Public application submission — mirrors the live Google Form field set.
 * Uses the service-role admin client (bypasses RLS) because the applicant is
 * unauthenticated. Creates family, guardian, student, family_season, application.
 */
export async function POST(request: NextRequest) {
  let body: Payload
  try {
    body = (await request.json()) as Payload
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const { programs, student, application, guardian, data_certified } = body ?? ({} as Payload)

  if (!Array.isArray(programs) || programs.length === 0) {
    return NextResponse.json({ error: 'Please choose at least one program.' }, { status: 400 })
  }
  if (
    !student?.first_name ||
    !student?.last_name ||
    !student?.communication_email ||
    !student?.phone ||
    !student?.home_address ||
    !student?.grade
  ) {
    return NextResponse.json({ error: 'Please complete the student information fields.' }, { status: 400 })
  }
  if (
    !application?.motivation_background ||
    !application?.motivation_why_join ||
    !application?.motivation_why_competitive ||
    !application?.motivation_goals ||
    !application?.commitment_level ||
    !application?.extracurriculars ||
    !application?.extracurricular_hours ||
    !application?.summer_availability ||
    !SUMMER.has(application.summer_availability)
  ) {
    return NextResponse.json({ error: 'Please complete the motivation & goals questions.' }, { status: 400 })
  }
  if (!guardian?.first_name || !guardian?.last_name || !guardian?.email || !guardian?.phone) {
    return NextResponse.json({ error: 'Please complete the parent/guardian fields.' }, { status: 400 })
  }
  if (!data_certified) {
    return NextResponse.json({ error: 'Please confirm the parent/guardian certification.' }, { status: 400 })
  }

  const db = createAdminClient()
  const gEmail = guardian.email.trim().toLowerCase()

  // 1. Resolve or create the family (matched by guardian email).
  let familyId: string | null = null
  const { data: existingGuardian } = await db
    .from('guardian')
    .select('family_id')
    .eq('login_email', gEmail)
    .maybeSingle()

  if (existingGuardian) {
    familyId = existingGuardian.family_id
  } else {
    const { data: fam, error: famErr } = await db
      .from('family')
      .insert({ primary_email: gEmail, display_name: `${guardian.last_name} Family` })
      .select('id')
      .single()
    if (famErr) return NextResponse.json({ error: famErr.message }, { status: 500 })
    familyId = fam.id
  }

  // 2. Guardian — upsert on the unique login_email.
  const { error: gErr } = await db.from('guardian').upsert(
    {
      family_id: familyId,
      role: 'primary',
      first_name: guardian.first_name,
      last_name: guardian.last_name,
      login_email: gEmail,
      phone: guardian.phone,
      occupation: guardian.occupation ?? null,
      volunteer_interests: guardian.volunteer_interests ?? [],
      volunteer_notes: guardian.volunteer_notes ?? null,
    },
    { onConflict: 'login_email' }
  )
  if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500 })

  // 3. Student.
  const addr = parseAddress(student.home_address)
  const { data: stu, error: sErr } = await db
    .from('student')
    .insert({
      family_id: familyId,
      first_name: student.first_name,
      last_name: student.last_name,
      preferred_name: student.preferred_name ?? null,
      communication_email: student.communication_email,
      phone: student.phone,
      birthdate: student.birthdate ?? null,
      street_address: addr.street,
      city: addr.city,
      state: addr.state || null,
      zip_code: addr.zip,
      grade: student.grade,
      school_id: student.school_id ?? null,
      school_raw: student.school_raw ?? null,
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

  // 5. GPA flag — flag if either GPA is below the season threshold (admin still
  //    decides; the system never auto-declines). GPAs are optional on the form.
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

  // 6. student_application — one per student per season.
  const { error: aErr } = await db.from('student_application').upsert(
    {
      family_id: familyId,
      student_id: stu.id,
      season: SEASON,
      program_interest: deriveProgramInterest(programs),
      program_interests: programs,
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
      motivation_why_join: application.motivation_why_join,
      motivation_why_competitive: application.motivation_why_competitive,
      motivation_goals: application.motivation_goals,
      commitment_level: application.commitment_level,
      extracurriculars: application.extracurriculars,
      extracurricular_hours: application.extracurricular_hours,
      summer_availability: application.summer_availability,
      additional_notes: application.additional_notes ?? null,
    },
    { onConflict: 'student_id,season' }
  )
  if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, student_name: `${stu.first_name} ${stu.last_name}` })
}
