import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminProfile } from '@/lib/auth/admin'
import { hasAnyRole } from '@/lib/auth/roles'
import { AdminShell, PageHeader, EmptyState } from '@/components/ui'
import IqTeamsTable, { type IqRow } from './iq-teams-table'
import IqZeffySync from './zeffy-sync'

const SEASON = '2026-27'
const ROLES = ['iq_coordinator', 'super_admin', 'payment_admin', 'registration_admin']
const ORDER: Record<string, number> = { pending_payment: 0, pending_admin_confirmation: 1, active: 2 }
const STATUS: Record<string, [string, IqRow['statusVariant']]> = {
  pending_payment: ['Pending payment', 'warning'],
  pending_admin_confirmation: ['Pending approval', 'info'],
  active: ['Active', 'success'],
  suspended: ['Suspended', 'error'],
}

export default async function IqTeamsPage() {
  const supabase = await createClient()
  const admin = await getAdminProfile()
  // IQ Teams is role-scoped: only the IQ coordinator (and super/payment/registration
  // admins) may view it. Other admins are bounced — read-only viewing isn't allowed.
  const canAct = admin ? await hasAnyRole(createAdminClient(), admin.id, ROLES) : false
  if (!canAct) redirect('/admin')

  const { data: teamData } = await supabase
    .from('team')
    .select('id, team_name, team_number, status, team_fee_status, team_fee_amount, events_vex_com_registered, created_at, kit_number')
    .eq('season', SEASON).eq('program', 'vex_iq')
  const teams = (teamData ?? []) as any[]
  const teamIds = teams.map((t) => t.id)

  const coachMap: Record<string, string> = {}
  const coachEmailMap: Record<string, string> = {}
  const coachLoginMap: Record<string, boolean> = {}
  const countMap: Record<string, number> = {}
  const teamStudents: Record<string, string[]> = {}
  const signed = new Set<string>()
  if (teamIds.length) {
    const { data: coaches } = await supabase.from('team_member').select('team_id, guardian:guardian_id ( first_name, last_name, login_email, last_login_at )').in('team_id', teamIds).eq('team_role', 'coach').is('revoked_at', null)
    for (const c of (coaches ?? []) as any[]) {
      const g = Array.isArray(c.guardian) ? c.guardian[0] : c.guardian
      if (g) {
        coachMap[c.team_id] = `${g.first_name} ${g.last_name}`.trim()
        if (g.login_email) coachEmailMap[c.team_id] = g.login_email
        coachLoginMap[c.team_id] = !!g.last_login_at
      }
    }
    const { data: apps } = await supabase.from('student_application').select('triage_notes, student_id').eq('season', SEASON).ilike('triage_notes', '%iq_team:%')
    for (const a of (apps ?? []) as any[]) {
      const m = String(a.triage_notes ?? '').match(/iq_team:([0-9a-f-]{36})/i)
      if (m) { (teamStudents[m[1]] ??= []).push(a.student_id); countMap[m[1]] = (countMap[m[1]] ?? 0) + 1 }
    }
    const allSids = Object.values(teamStudents).flat()
    if (allSids.length) {
      const { data: sigs } = await supabase.from('waiver_signature').select('student_id').eq('season', SEASON).in('student_id', allSids)
      for (const s of (sigs ?? []) as any[]) signed.add(s.student_id)
    }
  }

  // Per-team fee payments (how the fee was paid + total), newest source first.
  const feeMap: Record<string, { amount: number; source: string }> = {}
  if (teamIds.length) {
    const { data: pays } = await createAdminClient()
      .from('payment_transaction').select('team_id, source, amount, received_at')
      .in('team_id', teamIds).order('received_at', { ascending: false })
    for (const p of (pays ?? []) as any[]) {
      const cur = feeMap[p.team_id] ?? { amount: 0, source: '' }
      cur.amount += Number(p.amount || 0)
      if (!cur.source) cur.source = p.source // first seen = most recent
      feeMap[p.team_id] = cur
    }
  }
  teams.sort((a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9) || String(a.created_at).localeCompare(String(b.created_at)))
  const counts = (s: string) => teams.filter((t) => t.status === s).length

  const rows: IqRow[] = teams.map((t) => {
    const [sl, sv] = STATUS[t.status] ?? ['—', 'neutral']
    const total = countMap[t.id] ?? 0
    const signedN = (teamStudents[t.id] ?? []).filter((sid) => signed.has(sid)).length
    return {
      id: t.id,
      label: t.team_name || (coachMap[t.id] ? `${coachMap[t.id]}’s team` : 'IQ team'),
      teamNumber: t.team_number ?? '',
      kit: t.kit_number ?? '',
      coach: coachMap[t.id] || '—',
      coachEmail: coachEmailMap[t.id] || '',
      coachLoggedIn: !!coachLoginMap[t.id],
      students: total,
      waivers: `${signedN}/${total}`,
      status: t.status,
      statusLabel: sl, statusVariant: sv,
      fee: t.team_fee_status ?? 'unpaid',
      feeState: t.team_fee_status === 'paid' ? 'paid' : (feeMap[t.id]?.amount ?? 0) > 0 ? 'partial' : (t.team_fee_status ?? 'unpaid'),
      feeAmount: feeMap[t.id]?.amount ?? 0,
      feeTotal: Number(t.team_fee_amount) || 1200,
      feeSource: feeMap[t.id]?.source ?? '',
      events: !!t.events_vex_com_registered,
      created: new Date(t.created_at).toLocaleDateString(),
      createdRaw: String(t.created_at),
    }
  })

  return (
    <AdminShell>
      <PageHeader title="IQ Teams" subtitle={`${teams.length} teams · ${counts('pending_payment')} pending payment · ${counts('pending_admin_confirmation')} pending approval · ${counts('active')} active`} />
      {canAct && <IqZeffySync />}
      {teams.length === 0 ? (
        <EmptyState title="No IQ teams yet" description="Teams appear here when a coach creates one at /iq/team." />
      ) : (
        <IqTeamsTable rows={rows} canAct={canAct} />
      )}
    </AdminShell>
  )
}
