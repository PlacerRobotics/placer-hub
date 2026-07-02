import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminProfile } from '@/lib/auth/admin'
import { hasAnyRole } from '@/lib/auth/roles'
import { AdminShell, PageHeader, EmptyState } from '@/components/ui'
import IqMembersManager, { type IqMemberRow, type TeamOpt } from './iq-members-manager'

const SEASON = '2026-27'
const ROLES = ['iq_coordinator', 'super_admin', 'payment_admin', 'registration_admin']
const one = (v: any) => (Array.isArray(v) ? v[0] : v)

export default async function IqMembersPage() {
  const admin = await getAdminProfile()
  const db = createAdminClient()
  if (!admin || !(await hasAnyRole(db, admin.id, ROLES))) redirect('/admin')

  // IQ roster = applications that point at an IQ team (exclude dropped).
  const { data: apps } = await db.from('student_application')
    .select('student_id, family_id, status, triage_notes, student:student_id ( first_name, last_name, preferred_name, grade, birthdate, tshirt_size, phone, communication_email, fusion_education_email, slack_email, street_address, city, state, zip_code, school_raw, school:school_id ( name ) )')
    .eq('season', SEASON).ilike('triage_notes', '%iq_team:%')
  const roster = (apps ?? []).filter((a: any) => /iq_team:[0-9a-f-]{36}/i.test(String(a.triage_notes)) && !String(a.triage_notes).includes('dropped'))

  const teamIdByApp: Record<string, string> = {}
  for (const a of roster) { const m = String(a.triage_notes).match(/iq_team:([0-9a-f-]{36})/i); if (m) teamIdByApp[a.student_id] = m[1] }
  const teamIds = [...new Set(Object.values(teamIdByApp))]
  const familyIds = [...new Set(roster.map((a: any) => a.family_id).filter(Boolean))]
  const studentIds = roster.map((a: any) => a.student_id).filter(Boolean)

  const { data: teams } = teamIds.length ? await db.from('team').select('id, team_number, team_name').in('id', teamIds) : { data: [] as any[] }
  const teamById: Record<string, any> = Object.fromEntries((teams ?? []).map((t: any) => [t.id, t]))

  const { data: coachTms } = teamIds.length ? await db.from('team_member').select('team_id, guardian:guardian_id ( first_name, last_name, login_email )').eq('team_role', 'coach').is('revoked_at', null).in('team_id', teamIds) : { data: [] as any[] }
  const coachByTeam: Record<string, { name: string; email: string }> = {}
  for (const t of (coachTms ?? []) as any[]) { const g = one(t.guardian); if (g) coachByTeam[t.team_id] = { name: `${g.first_name ?? ''} ${g.last_name ?? ''}`.trim(), email: g.login_email ?? '' } }

  const { data: guardians } = familyIds.length ? await db.from('guardian').select('family_id, first_name, last_name, relationship, role, login_email, communication_email, phone, street_address, city, state, zip_code').in('family_id', familyIds) : { data: [] as any[] }
  const gByFam: Record<string, any[]> = {}
  for (const g of (guardians ?? []) as any[]) (gByFam[g.family_id] ??= []).push(g)
  for (const fid of Object.keys(gByFam)) gByFam[fid].sort((a, b) => (a.role === 'primary' ? -1 : 0) - (b.role === 'primary' ? -1 : 0))

  const { data: ecs } = studentIds.length ? await db.from('emergency_contact').select('student_id, first_name, last_name, phone, relationship, priority').in('student_id', studentIds) : { data: [] as any[] }
  const ecByStudent: Record<string, any> = {}
  for (const e of (ecs ?? []) as any[]) if (!ecByStudent[e.student_id] || e.priority === 1) ecByStudent[e.student_id] = e

  const signed = new Set<string>()
  const registered = new Set<string>()
  if (studentIds.length) {
    const { data: sigs } = await db.from('waiver_signature').select('student_id').eq('season', SEASON).in('student_id', studentIds)
    for (const s of (sigs ?? []) as any[]) signed.add(s.student_id)
    const { data: enrs } = await db.from('enrollment').select('student_id, submitted_at').eq('season', SEASON).in('student_id', studentIds)
    for (const e of (enrs ?? []) as any[]) if (e.submitted_at) registered.add(e.student_id)
  }

  const rows: IqMemberRow[] = roster.map((a: any) => {
    const s = one(a.student) ?? {}
    const tid = teamIdByApp[a.student_id]
    const team = tid ? teamById[tid] : null
    const coach = tid ? coachByTeam[tid] : undefined
    const gs = gByFam[a.family_id] ?? []
    const p1 = gs[0], p2 = gs[1]
    const ec = ecByStudent[a.student_id]
    const isSigned = signed.has(a.student_id)
    const isReg = registered.has(a.student_id)
    const dropRequested = String(a.triage_notes).includes('drop_requested')
    const regStatus: IqMemberRow['regStatus'] = isSigned && isReg ? 'complete' : isReg ? 'waiver_pending' : isSigned ? 'form_pending' : 'not_started'
    const schoolName = one(s.school)?.name ?? s.school_raw ?? ''
    const teamLabel = team ? `${team.team_number || team.team_name || '—'}` : '—'
    return {
      studentId: a.student_id,
      name: `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim(),
      lastFirst: `${s.last_name ?? ''} ${s.first_name ?? ''}`.trim().toLowerCase(),
      grade: s.grade ?? null,
      school: schoolName || '—',
      teamId: tid ?? '',
      teamLabel,
      coach: coach?.name ?? '—',
      parentName: p1 ? `${p1.first_name ?? ''} ${p1.last_name ?? ''}`.trim() : '—',
      parentEmail: p1?.login_email ?? '—',
      regStatus,
      signed: isSigned,
      registered: isReg,
      dropRequested,
      master: {
        teamNumber: team?.team_number ?? '', teamName: team?.team_name ?? '', coach: coach?.name ?? '', coachEmail: coach?.email ?? '',
        studentFirst: s.first_name ?? '', studentLast: s.last_name ?? '', preferredName: s.preferred_name ?? '',
        grade: s.grade != null ? String(s.grade) : '', birthdate: s.birthdate ?? '', tshirt: s.tshirt_size ?? '', school: schoolName,
        studentPhone: s.phone ?? '', studentCommEmail: s.communication_email ?? '', studentFusionEmail: s.fusion_education_email ?? '', studentSlackEmail: s.slack_email ?? '',
        studentStreet: s.street_address ?? '', studentCity: s.city ?? '', studentState: s.state ?? '', studentZip: s.zip_code ?? '',
        parent1Name: p1 ? `${p1.first_name ?? ''} ${p1.last_name ?? ''}`.trim() : '', parent1Rel: p1?.relationship ?? '', parent1Login: p1?.login_email ?? '', parent1Comm: p1?.communication_email ?? '', parent1Phone: p1?.phone ?? '',
        parent2Name: p2 ? `${p2.first_name ?? ''} ${p2.last_name ?? ''}`.trim() : '', parent2Login: p2?.login_email ?? '', parent2Phone: p2?.phone ?? '',
        address: [p1?.street_address || s.street_address, p1?.city || s.city, p1?.state || s.state, p1?.zip_code || s.zip_code].filter(Boolean).join(', '),
        emergencyName: ec ? `${ec.first_name ?? ''} ${ec.last_name ?? ''}`.trim() : '', emergencyPhone: ec?.phone ?? '', emergencyRel: ec?.relationship ?? '',
        regStatus, waiver: isSigned ? 'signed' : 'not signed', registered: isReg ? 'yes' : 'no', appStatus: a.status ?? '', dropRequested: dropRequested ? 'yes' : '',
      },
    }
  }).sort((a, b) => a.teamLabel.localeCompare(b.teamLabel) || a.name.localeCompare(b.name))

  const teamOpts: TeamOpt[] = (teams ?? []).map((t: any) => ({ id: t.id, label: t.team_number || t.team_name || t.id })).sort((a, b) => a.label.localeCompare(b.label))

  return (
    <AdminShell activePath="/admin/iq-teams">
      <PageHeader title="IQ Member Registrations" subtitle={`Individual VEX IQ team members — registration & waiver status for ${SEASON}.`} breadcrumb={[{ label: 'IQ Teams', href: '/admin/iq-teams' }, { label: 'Member registrations' }]} />
      {rows.length === 0 ? (
        <EmptyState title="No IQ members yet" description="Students appear here once coaches add them to their IQ teams." />
      ) : (
        <IqMembersManager rows={rows} teams={teamOpts} />
      )}
    </AdminShell>
  )
}
