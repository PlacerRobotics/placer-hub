import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAdminProfile } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'

const SEASON = '2026-27'

// Accepts both abbreviations and full words (the export uses "Small"/"Medium"/"Large").
const TSHIRT: Record<string, string> = {
  xs: 'xs', xsmall: 'xs', 'x-small': 'xs', 'extra small': 'xs',
  s: 's', small: 's',
  m: 'm', med: 'm', medium: 'm',
  l: 'l', large: 'l',
  xl: 'xl', xlarge: 'xl', 'x-large': 'xl', 'extra large': 'xl',
  xxl: 'xxl', '2xl': 'xxl', 'xx-large': 'xxl', 'extra extra large': 'xxl',
}
function parseTshirt(v: unknown) {
  return TSHIRT[String(v ?? '').trim().toLowerCase()] ?? null
}
function parseGrade(v: string) {
  const d = String(v ?? '').replace(/[^\d]/g, '')
  return d ? parseInt(d, 10) : null
}

/**
 * Bulk import — CREATES RECORDS ONLY. Never sends magic links.
 * Reconciliation note: the spec's "family_season per (student,season,program)"
 * is split in this schema into student_application (program intent, source=
 * admin_import) + the family-level family_season (status + magic_link_sent).
 * Address/phone/grade/tshirt live on student; employer fields on guardian.
 */
export async function POST(request: NextRequest) {
  const admin = await getAdminProfile()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }
  const rows: any[] = Array.isArray(body.rows) ? body.rows : []
  const db = createAdminClient()

  let familiesCreated = 0
  let studentsCreated = 0
  let recordsCreated = 0
  let skipped = 0
  const errors: { row: number; message: string }[] = []
  const results: { row: number; student: string; action: string; status: string }[] = []

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const rowNo = i + 1
    const studentName = `${(r.student_first_name ?? '').trim()} ${(r.student_last_name ?? '').trim()}`.trim() || 'Unknown'
    const action = String(r.import_action ?? 'invite').trim().toLowerCase()

    if (action === 'skip') {
      skipped++
      results.push({ row: rowNo, student: studentName, action: 'skip', status: 'skipped' })
      continue
    }

    try {
      const g1email = String(r.guardian1_email ?? '').trim().toLowerCase()
      if (!g1email) throw new Error('missing guardian1_email')
      const g1last = String(r.guardian1_last ?? '').trim()

      // 1. family (by guardian1 email)
      let familyId: string
      const { data: existingFam } = await db.from('family').select('id').eq('primary_email', g1email).maybeSingle()
      if (existingFam) {
        familyId = existingFam.id
      } else {
        const { data: fam, error } = await db
          .from('family')
          .insert({ primary_email: g1email, display_name: g1last ? `${g1last} Family` : null })
          .select('id')
          .single()
        if (error) throw new Error(error.message)
        familyId = fam.id
        familiesCreated++
      }

      // 2. guardians (employer fields on guardian1)
      const employerMatch = String(r.employer_match ?? '').trim().toLowerCase() === 'yes'
      const g1: Record<string, unknown> = {
        family_id: familyId,
        role: 'primary',
        first_name: String(r.guardian1_first ?? '').trim(),
        last_name: g1last,
        login_email: g1email,
        phone: String(r.guardian1_phone ?? '').trim() || '',
      }
      if (employerMatch) {
        g1.employer = String(r.employer_match_company ?? '').trim() || null
        const pct = String(r.employer_match_pct ?? '').trim()
        g1.employer_match_pct = pct ? Number(pct) : null
      }
      const guardianRows: Record<string, unknown>[] = [g1]
      const g2email = String(r.guardian2_email ?? '').trim().toLowerCase()
      if (g2email) {
        guardianRows.push({
          family_id: familyId,
          role: 'secondary',
          first_name: String(r.guardian2_first ?? '').trim(),
          last_name: String(r.guardian2_last ?? '').trim(),
          login_email: g2email,
          phone: String(r.guardian2_phone ?? '').trim() || '',
        })
      }
      await db.from('guardian').upsert(guardianRows, { onConflict: 'login_email' })

      // 3. student (city/zip_code are NOT NULL)
      const city = String(r.city ?? '').trim()
      const zip = String(r.zip ?? '').trim()
      const grade = parseGrade(r.grade_fall_2026)
      if (!city || !zip) throw new Error('missing city or zip (required for student)')
      if (grade == null) throw new Error('missing/invalid grade_fall_2026')
      const studentEmail = String(r.student_email ?? '').trim().toLowerCase() || null
      const street = [String(r.street_address ?? '').trim(), String(r.street_address_2 ?? '').trim()].filter(Boolean).join(' ') || null
      const studentFields = {
        first_name: String(r.student_first_name ?? '').trim(),
        last_name: String(r.student_last_name ?? '').trim(),
        communication_email: studentEmail,
        phone: String(r.student_phone ?? '').trim() || null,
        street_address: street,
        city,
        state: String(r.state ?? '').trim() || null,
        zip_code: zip,
        grade,
        school_raw: String(r.school ?? '').trim() || null,
        tshirt_size: parseTshirt(r.tshirt_size),
        status: 'active',
      }

      let studentId: string
      let foundStudent: any = null
      if (studentEmail) {
        const res = await db.from('student').select('id').eq('family_id', familyId).eq('communication_email', studentEmail).maybeSingle()
        foundStudent = res.data
      }
      if (!foundStudent) {
        const res = await db.from('student').select('id').eq('family_id', familyId).ilike('first_name', studentFields.first_name).ilike('last_name', studentFields.last_name).maybeSingle()
        foundStudent = res.data
      }
      if (foundStudent) {
        studentId = foundStudent.id
        await db.from('student').update(studentFields).eq('id', studentId)
      } else {
        const { data: stu, error } = await db.from('student').insert({ family_id: familyId, ...studentFields }).select('id').single()
        if (error) throw new Error(error.message)
        studentId = stu.id
        studentsCreated++
      }

      // Dedup: skip if this student already has a 2026-27 application.
      const { data: existingApp } = await db.from('student_application').select('id').eq('student_id', studentId).eq('season', SEASON).maybeSingle()
      if (existingApp) {
        skipped++
        results.push({ row: rowNo, student: studentName, action, status: 'already exists' })
        continue
      }

      const program = String(r.program_26_27 ?? '').trim().toLowerCase()
      const validProgram = ['vex_v5', 'combat', 'vex_iq', 'both'].includes(program) ? program : 'not_sure'
      const noteParts = [r.team_26_27 ? `Team: ${String(r.team_26_27).trim()}` : null, String(r.notes ?? '').trim() || null].filter(Boolean)

      // student_application (program intent, admin_import source)
      await db.from('student_application').insert({
        family_id: familyId,
        student_id: studentId,
        season: SEASON,
        program_interest: validProgram,
        status: 'accepted',
        source: 'admin_import',
        triage_notes: noteParts.join(' · ') || null,
      })

      // family_season (family-level gate + invite tracking). NEVER sends magic link.
      await db.from('family_season').upsert(
        {
          family_id: familyId,
          season: SEASON,
          // 'pending' is not a valid family_season_status; held rows map to 'applied'.
          status: action === 'invite' ? 'cleared_to_register' : 'applied',
          magic_link_sent: false,
          current_season_notes: String(r.notes ?? '').trim() || null,
        },
        { onConflict: 'family_id,season' }
      )

      recordsCreated++
      results.push({ row: rowNo, student: studentName, action, status: 'created' })
    } catch (exc: any) {
      errors.push({ row: rowNo, message: exc?.message ?? 'unknown error' })
      results.push({ row: rowNo, student: studentName, action, status: `error: ${exc?.message ?? 'unknown'}` })
    }
  }

  return NextResponse.json({
    ok: true,
    summary: { familiesCreated, studentsCreated, recordsCreated, skipped, errors: errors.length },
    errors,
    results,
  })
}
