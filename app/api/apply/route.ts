import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const SEASON = '2026-27'

type Guardian = { first_name: string; last_name: string; email: string; phone: string }
type Payload = {
  program: 'vex_v5' | 'combat' | 'vex_iq' | 'not_sure'
  student: {
    first_name: string
    last_name: string
    grade: number
    school_id?: string | null
    school_raw?: string | null
  }
  guardian1: Guardian
  guardian2?: Partial<Guardian> | null
}

/**
 * Public application submission.
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

  const { program, student, guardian1, guardian2 } = body ?? ({} as Payload)

  if (!program || !student?.first_name || !student?.last_name || !student?.grade) {
    return NextResponse.json({ error: 'Please complete the program and student fields.' }, { status: 400 })
  }
  if (!guardian1?.first_name || !guardian1?.last_name || !guardian1?.email || !guardian1?.phone) {
    return NextResponse.json({ error: 'Please complete the guardian 1 fields.' }, { status: 400 })
  }

  const db = createAdminClient()
  const g1email = guardian1.email.trim().toLowerCase()

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

  // 2. Guardian(s) — upsert on the unique login_email.
  const guardianRows: Record<string, unknown>[] = [
    {
      family_id: familyId,
      role: 'primary',
      first_name: guardian1.first_name,
      last_name: guardian1.last_name,
      login_email: g1email,
      phone: guardian1.phone,
    },
  ]
  if (guardian2 && guardian2.email) {
    guardianRows.push({
      family_id: familyId,
      role: 'secondary',
      first_name: guardian2.first_name ?? '',
      last_name: guardian2.last_name ?? '',
      login_email: guardian2.email.trim().toLowerCase(),
      phone: guardian2.phone ?? '',
    })
  }
  const { error: gErr } = await db.from('guardian').upsert(guardianRows, { onConflict: 'login_email' })
  if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500 })

  // 3. Student. NOTE: student.city and student.zip_code are NOT NULL in the
  // schema but the application form does not collect address (that is gathered
  // at registration). We insert empty placeholders to satisfy the constraints.
  const { data: stu, error: sErr } = await db
    .from('student')
    .insert({
      family_id: familyId,
      first_name: student.first_name,
      last_name: student.last_name,
      grade: student.grade,
      school_id: student.school_id ?? null,
      school_raw: student.school_raw ?? null,
      city: '',
      zip_code: '',
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

  // 5. student_application — one per student per season.
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
      },
      { onConflict: 'student_id,season' }
    )
  if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, student_name: `${stu.first_name} ${stu.last_name}` })
}
