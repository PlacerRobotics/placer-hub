import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminProfile } from '@/lib/auth/admin'
import { hasAnyRole } from '@/lib/auth/roles'
import { AdminShell, PageHeader, StatusBadge } from '@/components/ui'
import IqApproveButton from '../iq-approve-button'

const SEASON = '2026-27'
const ROLES = ['iq_coordinator', 'super_admin', 'payment_admin']

const STATUS: Record<string, [string, 'success' | 'warning' | 'info' | 'error' | 'neutral']> = {
  pending_payment: ['Pending payment', 'warning'],
  pending_admin_confirmation: ['Pending approval', 'info'],
  active: ['Active', 'success'],
  suspended: ['Suspended', 'error'],
}
const input: React.CSSProperties = { padding: '7px 10px', fontSize: '0.875rem', border: '1.5px solid var(--color-border)', borderRadius: 6, fontFamily: 'inherit', boxSizing: 'border-box', backgroundColor: 'var(--color-surface)' }
const btn: React.CSSProperties = { padding: '7px 14px', backgroundColor: 'var(--color-navy-deep)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'inherit' }
const lbl: React.CSSProperties = { display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 3 }
const cell: React.CSSProperties = { padding: '0.5rem 0.75rem', fontSize: '0.8125rem', borderBottom: '1px solid var(--color-border)', textAlign: 'left' }
const card: React.CSSProperties = { border: '1px solid var(--color-border)', borderRadius: 10, padding: '1.25rem 1.5rem', marginBottom: '1.25rem' }
const h3: React.CSSProperties = { fontSize: '1rem', fontWeight: 700, margin: '0 0 0.75rem' }

export default async function IqTeamDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = await getAdminProfile()
  const db = createAdminClient()
  const canAct = admin ? await hasAnyRole(db, admin.id, ROLES) : false

  const { data: team } = await db.from('team').select('*').eq('id', id).maybeSingle()
  if (!team || team.program !== 'vex_iq') notFound()

  const { data: coachTm } = await db.from('team_member').select('guardian:guardian_id ( first_name, last_name, login_email, phone )').eq('team_id', id).eq('team_role', 'coach').is('revoked_at', null).maybeSingle()
  const coach: any = coachTm ? (Array.isArray((coachTm as any).guardian) ? (coachTm as any).guardian[0] : (coachTm as any).guardian) : null

  const { data: apps } = await db.from('student_application').select('family_id, student:student_id ( first_name, last_name, grade, school_raw )').eq('season', SEASON).ilike('triage_notes', `%iq_team:${id}%`)
  const famIds = [...new Set((apps ?? []).map((a: any) => a.family_id))]
  const emailByFam: Record<string, string> = {}
  if (famIds.length) {
    const { data: gs } = await db.from('guardian').select('family_id, login_email').in('family_id', famIds)
    for (const g of (gs ?? []) as any[]) if (!emailByFam[g.family_id]) emailByFam[g.family_id] = g.login_email ?? ''
  }
  const roster = (apps ?? []).map((a: any) => {
    const s = Array.isArray(a.student) ? a.student[0] : a.student
    return { name: s ? `${s.first_name} ${s.last_name}`.trim() : '—', grade: s?.grade, school: s?.school_raw, parentEmail: emailByFam[a.family_id] ?? '' }
  })

  const { data: payments } = await db.from('payment_transaction').select('id, source, source_payment_id, amount, received_at, deposited_at, matched_status, notes').eq('team_id', id).order('received_at', { ascending: false })
  const totalPaid = (payments ?? []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0)
  const coachName = coach ? `${coach.first_name} ${coach.last_name}`.trim() : ''
  const teamLabel = team.team_name || (coachName ? `${coachName}’s team` : 'IQ team')
  const [statusLabel, statusVariant] = STATUS[team.status] ?? ['—', 'neutral']

  // ---- Server actions (admin-gated) ----
  async function updateTeam(formData: FormData) {
    'use server'
    const a = await getAdminProfile(); if (!a) return
    const adb = createAdminClient()
    if (!(await hasAnyRole(adb, a.id, ROLES))) return
    await adb.from('team').update({
      team_name: String(formData.get('team_name') ?? '').trim() || null,
      team_number: String(formData.get('team_number') ?? '').trim() || null,
      events_vex_com_registered: formData.get('events') === 'on',
    }).eq('id', id)
    redirect(`/admin/iq-teams/${id}`)
  }
  async function recordPayment(formData: FormData) {
    'use server'
    const a = await getAdminProfile(); if (!a) return
    const adb = createAdminClient()
    if (!(await hasAnyRole(adb, a.id, ROLES))) return
    const amount = Number(formData.get('amount'))
    if (!(amount > 0)) return
    const received = String(formData.get('received') ?? '').trim()
    const deposited = String(formData.get('deposited') ?? '').trim()
    const { data: t } = await adb.from('team').select('status, team_payment_reference_code').eq('id', id).maybeSingle()
    await adb.from('payment_transaction').insert({
      team_id: id, season: SEASON,
      source: String(formData.get('source') ?? 'check'),
      source_payment_id: String(formData.get('ref') ?? '').trim() || null,
      amount, payment_type: 'iq_team_fee',
      payment_reference_code: t?.team_payment_reference_code ?? null,
      matched_status: 'manually_matched', matched_by: a.id, matched_at: new Date().toISOString(),
      received_at: received ? new Date(received).toISOString() : new Date().toISOString(),
      deposited_at: deposited ? new Date(deposited).toISOString() : null,
      notes: String(formData.get('note') ?? '').trim() || 'IQ team fee', created_by: a.id,
    })
    const newStatus = t?.status === 'pending_payment' ? 'pending_admin_confirmation' : t?.status
    await adb.from('team').update({ team_fee_status: 'paid', status: newStatus }).eq('id', id)
    redirect(`/admin/iq-teams/${id}`)
  }
  async function markDeposited(formData: FormData) {
    'use server'
    const a = await getAdminProfile(); if (!a) return
    const adb = createAdminClient()
    if (!(await hasAnyRole(adb, a.id, ROLES))) return
    await adb.from('payment_transaction').update({ deposited_at: new Date().toISOString() }).eq('id', String(formData.get('paymentId') ?? ''))
    redirect(`/admin/iq-teams/${id}`)
  }

  return (
    <AdminShell activePath="/admin/iq-teams">
      <PageHeader title={teamLabel} subtitle={`VEX IQ · ${SEASON}`} breadcrumb={[{ label: 'IQ Teams', href: '/admin/iq-teams' }, { label: 'Team' }]} />
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        <StatusBadge label={statusLabel} variant={statusVariant} />
        <StatusBadge label={`fee ${team.team_fee_status ?? 'unpaid'}`} variant={team.team_fee_status === 'paid' ? 'success' : 'warning'} />
        {canAct && team.status !== 'active' && <IqApproveButton teamId={id} canApprove={canAct} feePaid={team.team_fee_status === 'paid'} />}
      </div>

      {/* Team info + edit */}
      <div style={card}>
        <h3 style={h3}>Team</h3>
        <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '0.875rem' }}>
          Coach: {coachName || '—'} · {coach?.login_email || '—'} · {coach?.phone || 'no phone'} · ref {team.team_payment_reference_code || '—'}
        </div>
        {canAct ? (
          <form action={updateTeam} style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div><label style={lbl}>Team name</label><input name="team_name" defaultValue={team.team_name ?? ''} placeholder="(unnamed)" style={{ ...input, width: 200 }} /></div>
            <div><label style={lbl}>Team number</label><input name="team_number" defaultValue={team.team_number ?? ''} placeholder="e.g. 295E" style={{ ...input, width: 120 }} /></div>
            <label style={{ fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><input type="checkbox" name="events" defaultChecked={!!team.events_vex_com_registered} /> events.vex.com registered</label>
            <button style={btn}>Save</button>
          </form>
        ) : <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>Team #: {team.team_number || 'TBD'} · events.vex.com: {team.events_vex_com_registered ? 'yes' : 'no'}</div>}
        {team.notes && <pre style={{ marginTop: '0.875rem', fontSize: '0.75rem', color: 'var(--color-text-muted)', whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{team.notes}</pre>}
      </div>

      {/* Roster */}
      <div style={card}>
        <h3 style={h3}>Roster ({roster.length})</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={cell}>Student</th><th style={cell}>Grade</th><th style={cell}>School</th><th style={cell}>Parent email</th></tr></thead>
          <tbody>{roster.map((r, i) => <tr key={i}><td style={cell}>{r.name}</td><td style={cell}>{r.grade || '—'}</td><td style={cell}>{r.school || '—'}</td><td style={cell}>{r.parentEmail || '—'}</td></tr>)}</tbody>
        </table>
      </div>

      {/* Payments */}
      <div style={card}>
        <h3 style={h3}>Payments · ${totalPaid.toFixed(2)} of ${Number(team.team_fee_amount ?? 1200).toFixed(2)}</h3>
        {(payments ?? []).length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' }}>
            <thead><tr><th style={cell}>Source</th><th style={cell}>Ref / check #</th><th style={cell}>Amount</th><th style={cell}>Received</th><th style={cell}>Deposited</th></tr></thead>
            <tbody>{(payments ?? []).map((p: any) => (
              <tr key={p.id}>
                <td style={cell}>{p.source}</td>
                <td style={cell}>{p.source_payment_id || '—'}</td>
                <td style={cell}>${Number(p.amount).toFixed(2)}</td>
                <td style={cell}>{p.received_at ? new Date(p.received_at).toLocaleDateString() : '—'}</td>
                <td style={cell}>{p.deposited_at ? new Date(p.deposited_at).toLocaleDateString() : (canAct ? <form action={markDeposited}><input type="hidden" name="paymentId" value={p.id} /><button style={{ ...btn, padding: '3px 10px' }}>Mark deposited</button></form> : 'no')}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
        {canAct && (
          <form action={recordPayment} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div><label style={lbl}>Source</label><select name="source" style={input} defaultValue="check"><option value="check">Check</option><option value="zeffy">Zeffy</option><option value="cash">Cash</option><option value="manual_adjustment">Manual</option><option value="other">Other</option></select></div>
            <div><label style={lbl}>Ref / check #</label><input name="ref" style={{ ...input, width: 130 }} /></div>
            <div><label style={lbl}>Amount</label><input name="amount" type="number" step="0.01" defaultValue={Number(team.team_fee_amount ?? 1200)} style={{ ...input, width: 100 }} /></div>
            <div><label style={lbl}>Received</label><input name="received" type="date" style={input} /></div>
            <div><label style={lbl}>Deposited (optional)</label><input name="deposited" type="date" style={input} /></div>
            <div style={{ flexBasis: '100%' }} /><div><label style={lbl}>Note (where it came from)</label><input name="note" style={{ ...input, width: 320 }} placeholder="e.g. check from Smith family" /></div>
            <button style={btn}>Record payment</button>
          </form>
        )}
      </div>

      <Link href="/admin/iq-teams" style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-navy-deep)' }}>← All IQ teams</Link>
    </AdminShell>
  )
}
