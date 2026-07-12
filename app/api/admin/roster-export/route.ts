import { getAdminAccess } from '@/lib/auth/admin-access'
import { createAdminClient } from '@/lib/supabase/admin'
import { programScopeFor } from '@/lib/auth/roles'
import { formatPhoneDisplay } from '@/lib/phone-input'

const SEASON = '2026-27'

const PROGRAM_LABELS: Record<string, string> = {
  vex_v5: 'VEX V5',
  combat: 'Combat',
  vex_iq: 'VEX IQ',
  not_sure: 'Not sure',
}

const HEADER = [
  'Student Last Name',
  'Student First Name',
  'Grade',
  'School',
  'Program',
  'Team',
  'T-Shirt Size',
  'Guardian 1 Name',
  'Guardian 1 Email',
  'Guardian 1 Phone',
  'Guardian 2 Name',
  'Guardian 2 Email',
  'Payment Status',
  'Payment Reference Code',
  'Registration Date',
]

function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export async function GET() {
  const access = await getAdminAccess()
  if (!access) {
    return new Response('Forbidden', { status: 403 })
  }
  // The export is the /admin/registrations table in CSV form — a program-scoped
  // lead's download carries only their program's rows (D5).
  const scope = programScopeFor(access, '/admin/registrations')

  const db = createAdminClient()

  // Confirmed registrations = enrollments that have been submitted this season.
  let eq = db
    .from('enrollment')
    .select(
      'id, family_id, student_id, program, payment_reference_code, registration_fee_status, submitted_at, created_at, student:student_id ( first_name, last_name, grade, tshirt_size, school_raw, school:school_id ( name ) )'
    )
    .eq('season', SEASON)
    .not('submitted_at', 'is', null)
    .order('submitted_at', { ascending: true })
  if (scope) eq = eq.in('program', scope)
  const { data: enrollments, error } = await eq

  if (error) {
    return new Response(`Failed to build roster: ${error.message}`, { status: 500 })
  }

  const allRows = (enrollments ?? []) as any[]
  const allFamilyIds = [...new Set(allRows.map((e) => e.family_id).filter(Boolean))]

  // Exclude students whose family registration for this season is cancelled —
  // a cancelled family must not appear on the official roster.
  const cancelledFamilies = new Set<string>()
  if (allFamilyIds.length) {
    const { data: fseasons } = await db
      .from('family_season')
      .select('family_id, status')
      .eq('season', SEASON)
      .eq('status', 'cancelled')
      .in('family_id', allFamilyIds)
    for (const fs of (fseasons ?? []) as any[]) cancelledFamilies.add(fs.family_id)
  }

  const rows = allRows.filter((e) => !cancelledFamilies.has(e.family_id))
  const familyIds = [...new Set(rows.map((e) => e.family_id).filter(Boolean))]
  const enrollmentIds = rows.map((e) => e.id)

  // Guardians by family.
  const guardiansByFamily = new Map<string, any[]>()
  if (familyIds.length) {
    const { data: guardians } = await db
      .from('guardian')
      .select('family_id, first_name, last_name, login_email, phone, role')
      .in('family_id', familyIds)
    for (const g of (guardians ?? []) as any[]) {
      const list = guardiansByFamily.get(g.family_id) ?? []
      list.push(g)
      guardiansByFamily.set(g.family_id, list)
    }
  }

  // Team assignment by enrollment.
  const teamByEnrollment = new Map<string, any>()
  if (enrollmentIds.length) {
    const { data: members } = await db
      .from('team_member')
      .select('enrollment_id, program, team:team_id ( team_name, team_number )')
      .in('enrollment_id', enrollmentIds)
    for (const m of (members ?? []) as any[]) {
      if (m.enrollment_id && !teamByEnrollment.has(m.enrollment_id)) {
        teamByEnrollment.set(m.enrollment_id, m)
      }
    }
  }

  const lines = [HEADER.map(csvCell).join(',')]
  for (const e of rows) {
    const stu = e.student ?? {}
    const guardians = guardiansByFamily.get(e.family_id) ?? []
    const g1 =
      guardians.find((g) => g.role === 'primary' || g.role === 'single_guardian') ?? guardians[0]
    const g2 =
      guardians.find((g) => g !== g1 && g.role === 'secondary') ?? guardians.find((g) => g !== g1)

    const tm = teamByEnrollment.get(e.id)
    const team = tm?.team ? tm.team.team_name || tm.team.team_number || '' : ''
    const school = stu.school?.name ?? stu.school_raw ?? ''
    const regDate = e.submitted_at ? new Date(e.submitted_at).toLocaleDateString('en-US') : ''

    lines.push(
      [
        stu.last_name ?? '',
        stu.first_name ?? '',
        stu.grade ?? '',
        school,
        PROGRAM_LABELS[e.program] ?? e.program ?? '',
        team,
        (stu.tshirt_size ?? '').toString().toUpperCase(),
        g1 ? `${g1.first_name} ${g1.last_name}` : '',
        g1?.login_email ?? '',
        formatPhoneDisplay(g1?.phone),
        g2 ? `${g2.first_name} ${g2.last_name}` : '',
        g2?.login_email ?? '',
        e.registration_fee_status ?? '',
        e.payment_reference_code ?? '',
        regDate,
      ]
        .map(csvCell)
        .join(',')
    )
  }

  const date = new Date().toISOString().slice(0, 10)
  const csv = '﻿' + lines.join('\r\n') // BOM for Excel

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="PART-roster-2026-27-${date}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
