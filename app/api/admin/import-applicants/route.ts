import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAdminProfile } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'

const SEASON = '2026-27'

function g(r: any, key: string) {
  return String(r?.[key] ?? '').trim()
}
function firstEmail(v: string) {
  return v.split(/[/,]/)[0].trim().toLowerCase()
}
function parseGrade(v: string) {
  const d = (v ?? '').replace(/[^\d]/g, '')
  return d ? parseInt(d, 10) : null
}
function parseDate(v: string) {
  const s = (v ?? '').trim()
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
  return null
}
const PROGRAM_LABEL: Record<string, string> = { vex_v5: 'VEX V5', vex_iq: 'VEX IQ', combat: 'Combat' }
// Detects ALL programs named in "Final Program" (fallback "Which programs…").
// Students may be approved for two programs at once; the first is the application's
// program_interest, any others are noted (a student_application holds one program).
function detectPrograms(finalP: string, interested: string): string[] {
  const u = ((finalP || '').trim() || (interested || '').trim()).toUpperCase()
  const out: string[] = []
  if (u.includes('V5')) out.push('vex_v5')
  if (u.includes('IQ')) out.push('vex_iq')
  if (u.includes('COMBAT')) out.push('combat')
  return out
}
function reviewAction(status: string) {
  const s = (status ?? '').trim().toLowerCase()
  if (s === 'approved') return 'invite'
  if (s === 'rejected' || s === 'declined') return 'skip'
  return 'hold'
}
// Best-effort "Street, City State ZIP" / "City, State ZIP". Falls back to
// placeholders for the NOT-NULL student.city/zip_code, flagged for review.
function parseAddress(raw: string) {
  const s = (raw ?? '').trim()
  const zip = (s.match(/\b(\d{5})(?:-\d{4})?\b/) || [])[1] || ''
  const state = (s.match(/\b([A-Za-z]{2})\b(?=\s*\d{5})/) || [])[1] || ''
  const parts = s.split(',').map((p) => p.trim()).filter(Boolean)
  let street = ''
  let city = ''
  if (parts.length >= 3) { street = parts[0]; city = parts[1] }
  else if (parts.length === 2) { city = parts[0] }
  else { street = s }
  const ok = !!city && !!zip
  return { street: street || s || null, city: city || 'Unknown', state: state || null, zip: zip || '00000', ok }
}

export async function POST(request: NextRequest) {
  const admin = await getAdminProfile()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: any
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body.' }, { status: 400 }) }
  const rows: any[] = Array.isArray(body.rows) ? body.rows : []
  const db = createAdminClient()

  let familiesCreated = 0, studentsCreated = 0, recordsCreated = 0, skipped = 0
  const errors: { row: number; message: string }[] = []
  const results: { row: number; student: string; action: string; status: string }[] = []

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const rowNo = i + 1
    const studentName = `${g(r, 'Student First Name')} ${g(r, 'Student Last Name')}`.trim() || 'Unknown'
    const action = reviewAction(g(r, 'Review Status'))

    if (action === 'skip') {
      skipped++
      results.push({ row: rowNo, student: studentName, action: 'skip', status: 'skipped (rejected)' })
      continue
    }

    try {
      // Guardian email: Parent/Guardian Email (first if multiple), else "Email Address".
      const pgEmailRaw = g(r, 'Parent/Guardian Email')
      const gEmail = pgEmailRaw ? firstEmail(pgEmailRaw) : g(r, 'Email Address').toLowerCase()
      if (!gEmail) throw new Error('missing guardian email')
      const gLast = g(r, 'Parent/Guardian Last Name')

      // family
      let familyId: string
      const { data: fam0 } = await db.from('family').select('id').eq('primary_email', gEmail).maybeSingle()
      if (fam0) familyId = fam0.id
      else {
        const { data: fam, error } = await db.from('family').insert({ primary_email: gEmail, display_name: gLast ? `${gLast} Family` : null }).select('id').single()
        if (error) throw new Error(error.message)
        familyId = fam.id; familiesCreated++
      }

      // guardian
      await db.from('guardian').upsert({
        family_id: familyId, role: 'primary',
        first_name: g(r, 'Parent/Guardian First Name'), last_name: gLast,
        login_email: gEmail, phone: g(r, 'Parent/Guardian Phone Number') || '',
      }, { onConflict: 'login_email' })

      // student
      const grade = parseGrade(g(r, 'Grade Entering (Fall 2026)'))
      if (grade == null) throw new Error('missing/invalid grade')
      const addr = parseAddress(g(r, 'Home Address (City, State, ZIP)'))
      const studentEmail = g(r, 'Student Email').toLowerCase() || null
      const studentFields = {
        first_name: g(r, 'Student First Name'), last_name: g(r, 'Student Last Name'),
        communication_email: studentEmail, phone: g(r, 'Student Phone Number') || null,
        birthdate: parseDate(g(r, 'Date of Birth (required for age group cut offs)')),
        street_address: addr.street, city: addr.city, state: addr.state, zip_code: addr.zip,
        grade, school_raw: g(r, 'School Attending (Fall 2026)') || null, status: 'active',
      }
      let studentId: string
      let found: any = null
      if (studentEmail) found = (await db.from('student').select('id').eq('family_id', familyId).eq('communication_email', studentEmail).maybeSingle()).data
      if (!found) found = (await db.from('student').select('id').eq('family_id', familyId).ilike('first_name', studentFields.first_name).ilike('last_name', studentFields.last_name).maybeSingle()).data
      if (found) { studentId = found.id; await db.from('student').update(studentFields).eq('id', studentId) }
      else {
        const { data: stu, error } = await db.from('student').insert({ family_id: familyId, ...studentFields }).select('id').single()
        if (error) throw new Error(error.message)
        studentId = stu.id; studentsCreated++
      }

      // dedup
      const { data: existingApp } = await db.from('student_application').select('id').eq('student_id', studentId).eq('season', SEASON).maybeSingle()
      if (existingApp) { skipped++; results.push({ row: rowNo, student: studentName, action, status: 'already exists' }); continue }

      const progs = detectPrograms(g(r, 'Final Program'), g(r, 'Which programs are you interested in?'))
      const program = progs[0] ?? 'not_sure'
      const extraPrograms = progs.slice(1)
      const team = g(r, '26-27 Team')
      const noteParts = [
        extraPrograms.length ? `Also approved: ${extraPrograms.map((p) => PROGRAM_LABEL[p]).join(', ')}` : null,
        team ? `Team: ${team}` : null,
        g(r, 'Review Comments') || null,
      ].filter(Boolean)

      await db.from('student_application').insert({
        family_id: familyId, student_id: studentId, season: SEASON,
        program_interest: program, status: action === 'invite' ? 'accepted' : 'submitted',
        source: 'platform', triage_notes: noteParts.join(' · ') || null,
      })

      // 'pending' is NOT a valid family_season_status; held/un-reviewed applicants
      // map to 'applied' (they applied via Google Form, awaiting admin review).
      await db.from('family_season').upsert({
        family_id: familyId, season: SEASON,
        status: action === 'invite' ? 'cleared_to_register' : 'applied',
        magic_link_sent: false, current_season_notes: g(r, 'Review Comments') || null,
      }, { onConflict: 'family_id,season' })

      recordsCreated++
      results.push({ row: rowNo, student: studentName, action, status: addr.ok ? 'created' : 'created (address needs review)' })
    } catch (exc: any) {
      errors.push({ row: rowNo, message: exc?.message ?? 'unknown' })
      results.push({ row: rowNo, student: studentName, action, status: `error: ${exc?.message ?? 'unknown'}` })
    }
  }

  return NextResponse.json({ ok: true, summary: { familiesCreated, studentsCreated, recordsCreated, skipped, errors: errors.length }, errors, results })
}
