import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminProfile } from '@/lib/auth/admin'
import { hasAnyRole } from '@/lib/auth/roles'
import { AdminShell, PageHeader, StatusBadge } from '@/components/ui'
import { sendMagicLinkEmail } from '@/lib/email'
import IqApproveButton from '../iq-approve-button'

const SEASON = '2026-27'
const ROLES = ['iq_coordinator', 'super_admin', 'payment_admin', 'registration_admin']

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

  const { data: apps } = await db.from('student_application').select('family_id, student_id, triage_notes, student:student_id ( first_name, last_name, grade, school_raw )').eq('season', SEASON).ilike('triage_notes', `%iq_team:${id}%`)
  const famIds = [...new Set((apps ?? []).map((a: any) => a.family_id))]
  const emailByFam: Record<string, string> = {}
  if (famIds.length) {
    const { data: gs } = await db.from('guardian').select('family_id, login_email').in('family_id', famIds)
    for (const g of (gs ?? []) as any[]) if (!emailByFam[g.family_id]) emailByFam[g.family_id] = g.login_email ?? ''
  }
  const sids = (apps ?? []).map((a: any) => a.student_id).filter(Boolean)
  const signedSet = new Set<string>()
  const registeredSet = new Set<string>()
  if (sids.length) {
    const { data: sigs } = await db.from('waiver_signature').select('student_id').eq('season', SEASON).in('student_id', sids)
    for (const s of (sigs ?? []) as any[]) signedSet.add(s.student_id)
    // Registration form submitted = an enrollment row with a submitted_at this season.
    const { data: enrs } = await db.from('enrollment').select('student_id, submitted_at').eq('season', SEASON).in('student_id', sids)
    for (const e of (enrs ?? []) as any[]) if (e.submitted_at) registeredSet.add(e.student_id)
  }
  const roster = (apps ?? []).map((a: any) => {
    const s = Array.isArray(a.student) ? a.student[0] : a.student
    const signed = signedSet.has(a.student_id)
    const registered = registeredSet.has(a.student_id)
    return { studentId: a.student_id, name: s ? `${s.first_name} ${s.last_name}`.trim() : '—', grade: s?.grade, school: s?.school_raw, parentEmail: emailByFam[a.family_id] ?? '', signed, registered, regComplete: signed && registered, dropRequested: String(a.triage_notes ?? '').includes('drop_requested') }
  })
  const signedCount = roster.filter((r) => r.signed).length
  const completeCount = roster.filter((r) => r.regComplete).length

  const { data: numRows } = await db.from('team').select('team_number').eq('program', 'vex_iq').eq('division', 'ES').not('team_number', 'is', null)
  const existingNumbers = [...new Set((numRows ?? []).map((r: any) => r.team_number).filter(Boolean))].sort()

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
  async function assignCoach(formData: FormData) {
    'use server'
    const a = await getAdminProfile(); if (!a) return
    const adb = createAdminClient()
    if (!(await hasAnyRole(adb, a.id, ROLES))) return
    const first = String(formData.get('first') ?? '').trim()
    const last = String(formData.get('last') ?? '').trim()
    const em = String(formData.get('email') ?? '').trim().toLowerCase()
    if (!first || !last || !em.includes('@')) return
    // Find or create the coach's account (stub), then attach as coach + invite.
    let gg = (await adb.from('guardian').select('id, family_id').ilike('login_email', em).maybeSingle()).data
    if (!gg) {
      const { data: fam } = await adb.from('family').insert({ primary_email: em, display_name: last }).select('id').single()
      gg = (await adb.from('guardian').insert({ family_id: fam!.id, first_name: first, last_name: last, login_email: em, phone: '', role: 'primary' }).select('id, family_id').single()).data!
    } else {
      await adb.from('guardian').update({ first_name: first, last_name: last }).eq('id', gg.id)
    }
    const existing = (await adb.from('team_member').select('id').eq('team_id', id).eq('guardian_id', gg.id).eq('team_role', 'coach').is('revoked_at', null).maybeSingle()).data
    if (!existing) await adb.from('team_member').insert({ team_id: id, guardian_id: gg.id, season: SEASON, team_role: 'coach', program: 'vex_iq' })
    try {
      await sendMagicLinkEmail({
        email: em, redirectPath: '/dashboard',
        subject: 'Set up your VEX IQ team — Placer Robotics',
        heading: 'Welcome — set up your VEX IQ team',
        intro: `You've been assigned as the coach of ${teamLabel}. Click below to sign in and finish setting up your team — add your roster and complete the steps to get it registered for the ${SEASON} season.`,
        buttonLabel: 'Sign in to set up my team →',
        preheader: 'Sign in to set up your VEX IQ team.',
      })
    } catch (e) { console.error('[iq assign coach] invite failed:', e) }
    redirect(`/admin/iq-teams/${id}`)
  }
  async function updateKit(formData: FormData) {
    'use server'
    const a = await getAdminProfile(); if (!a) return
    const adb = createAdminClient()
    if (!(await hasAnyRole(adb, a.id, ROLES))) return
    await adb.from('team').update({
      kit_number: String(formData.get('kit_number') ?? '').trim() || null,
      kit_checkout_date: String(formData.get('kit_checkout_date') ?? '').trim() || null,
      kit_return_date: String(formData.get('kit_return_date') ?? '').trim() || null,
      kit_return_verified: formData.get('kit_return_verified') === 'on',
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
    const { data: t } = await adb.from('team').select('status, team_payment_reference_code, team_fee_amount').eq('id', id).maybeSingle()
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
    // Mark paid only once the cumulative total covers the full team fee.
    const { data: pays } = await adb.from('payment_transaction').select('amount').eq('team_id', id)
    const total = (pays ?? []).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0)
    const fee = Number(t?.team_fee_amount) || 1200
    const fullyPaid = total >= fee
    const newStatus = fullyPaid && t?.status === 'pending_payment' ? 'pending_admin_confirmation' : t?.status
    await adb.from('team').update({ team_fee_status: fullyPaid ? 'paid' : 'unpaid', status: newStatus }).eq('id', id)
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
  async function voidPayment(formData: FormData) {
    'use server'
    const a = await getAdminProfile(); if (!a) return
    const adb = createAdminClient()
    if (!(await hasAnyRole(adb, a.id, ROLES))) return
    await adb.from('payment_transaction').delete().eq('id', String(formData.get('paymentId') ?? '')).eq('team_id', id)
    // Recompute against the full fee — voiding a payment can drop a team back to unpaid.
    const { data: tf } = await adb.from('team').select('team_fee_amount').eq('id', id).maybeSingle()
    const { data: remaining } = await adb.from('payment_transaction').select('amount').eq('team_id', id)
    const total = (remaining ?? []).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0)
    const fee = Number(tf?.team_fee_amount) || 1200
    await adb.from('team').update({ team_fee_status: total >= fee ? 'paid' : 'unpaid' }).eq('id', id)
    redirect(`/admin/iq-teams/${id}`)
  }
  async function dropStudent(formData: FormData) {
    'use server'
    const a = await getAdminProfile(); if (!a) return
    const adb = createAdminClient()
    if (!(await hasAnyRole(adb, a.id, ROLES))) return
    const studentId = String(formData.get('studentId') ?? '')
    if (!studentId) return
    await adb.from('student_application').update({ status: 'withdrawn', triage_notes: `iq_team_dropped:${id}` }).eq('student_id', studentId).eq('season', SEASON)
    await adb.from('team_member').update({ revoked_at: new Date().toISOString() }).eq('team_id', id).eq('student_id', studentId).eq('team_role', 'student').is('revoked_at', null)
    redirect(`/admin/iq-teams/${id}`)
  }
  async function cancelDropRequest(formData: FormData) {
    'use server'
    const a = await getAdminProfile(); if (!a) return
    const adb = createAdminClient()
    if (!(await hasAnyRole(adb, a.id, ROLES))) return
    const studentId = String(formData.get('studentId') ?? '')
    if (!studentId) return
    // Clear the drop_requested flag — student stays on the team.
    await adb.from('student_application').update({ triage_notes: `iq_team:${id}` }).eq('student_id', studentId).eq('season', SEASON)
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
        {canAct && !coach && (
          <form action={assignCoach} style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '0.875rem', padding: '0.875rem 1rem', background: 'var(--color-bg-light)', borderRadius: 8 }}>
            <div style={{ flexBasis: '100%', fontSize: '0.8125rem', fontWeight: 700 }}>Assign a coach</div>
            <div><label style={lbl}>First name</label><input name="first" required style={{ ...input, width: 130 }} /></div>
            <div><label style={lbl}>Last name</label><input name="last" required style={{ ...input, width: 130 }} /></div>
            <div><label style={lbl}>Email</label><input name="email" type="email" required style={{ ...input, width: 220 }} /></div>
            <button style={btn}>Assign &amp; invite</button>
            <p style={{ flexBasis: '100%', fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '0.25rem 0 0' }}>Creates the coach&apos;s account if they don&apos;t have one and emails them a sign-in invite to set up this team.</p>
          </form>
        )}
        {canAct ? (
          <>
          <form action={updateTeam} style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div><label style={lbl}>Team name</label><input name="team_name" defaultValue={team.team_name ?? ''} placeholder="(unnamed)" style={{ ...input, width: 200 }} /></div>
            <div><label style={lbl}>Team number</label><input name="team_number" defaultValue={team.team_number ?? ''} list="iq-numbers" placeholder="pick or type" style={{ ...input, width: 140 }} /><datalist id="iq-numbers">{existingNumbers.map((n) => <option key={n} value={n} />)}</datalist></div>
            <label style={{ fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><input type="checkbox" name="events" defaultChecked={!!team.events_vex_com_registered} /> events.vex.com registered</label>
            <button style={btn}>Save</button>
          </form>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '0.625rem 0 0' }}>Renaming the team here does <strong>not</strong> change it on events.vex.com — update the team name there too.</p>
          </>
        ) : <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>Team #: {team.team_number || 'TBD'} · events.vex.com: {team.events_vex_com_registered ? 'yes' : 'no'}</div>}
        {team.notes && <pre style={{ marginTop: '0.875rem', fontSize: '0.75rem', color: 'var(--color-text-muted)', whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{team.notes}</pre>}
      </div>

      {/* Season kit */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', margin: '0 0 0.75rem' }}>
          <h3 style={{ ...h3, margin: 0 }}>Season kit</h3>
          {team.kit_return_verified && <StatusBadge label="Returned & verified" variant="success" />}
        </div>
        {canAct ? (
          <form action={updateKit} style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div><label style={lbl}>Kit number</label><input name="kit_number" defaultValue={team.kit_number ?? ''} placeholder="e.g. IQ-0042" style={{ ...input, width: 160 }} /></div>
            <div><label style={lbl}>Checked out</label><input name="kit_checkout_date" type="date" defaultValue={team.kit_checkout_date ?? ''} style={input} /></div>
            <div><label style={lbl}>Returned</label><input name="kit_return_date" type="date" defaultValue={team.kit_return_date ?? ''} style={input} /></div>
            <label style={{ fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><input type="checkbox" name="kit_return_verified" defaultChecked={!!team.kit_return_verified} /> Returned &amp; verified (close out)</label>
            <button style={btn}>Save kit</button>
          </form>
        ) : (
          <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
            Kit #: {team.kit_number || 'not issued'} · Out: {team.kit_checkout_date ? new Date(team.kit_checkout_date).toLocaleDateString() : '—'} · Back: {team.kit_return_date ? new Date(team.kit_return_date).toLocaleDateString() : '—'} · {team.kit_return_verified ? 'verified' : 'not verified'}
          </div>
        )}
      </div>

      {/* Roster */}
      <div style={card}>
        <h3 style={h3}>Roster ({roster.length}) · {completeCount}/{roster.length} fully registered · {signedCount} waivers signed</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={cell}>Student</th><th style={cell}>Grade</th><th style={cell}>School</th><th style={cell}>Parent email</th><th style={cell}>Reg complete</th><th style={cell}>Waivers</th><th style={cell}>Actions</th></tr></thead>
          <tbody>{roster.map((r, i) => <tr key={i}><td style={cell}>{r.name}{r.dropRequested && <span style={{ color: '#C9971B', fontWeight: 700, fontSize: '0.6875rem' }}> ⚠ DROP REQUESTED</span>}</td><td style={cell}>{r.grade || '—'}</td><td style={cell}>{r.school || '—'}</td><td style={cell}>{r.parentEmail || '—'}</td><td style={{ ...cell, fontWeight: 700 }}>{r.regComplete ? <span style={{ color: 'var(--color-success)' }}>✓ Complete</span> : r.registered ? <span style={{ color: '#C9971B' }}>Waiver pending</span> : r.signed ? <span style={{ color: '#C9971B' }}>Form pending</span> : <span style={{ color: 'var(--color-text-muted)' }}>Not started</span>}</td><td style={{ ...cell, color: r.signed ? 'var(--color-success)' : 'var(--color-text-muted)', fontWeight: 600 }}>{r.signed ? '✓ signed' : 'not yet'}</td><td style={cell}>{canAct && (r.dropRequested ? (
              <span style={{ display: 'flex', gap: '0.625rem', whiteSpace: 'nowrap' }}>
                <form action={dropStudent}><input type="hidden" name="studentId" value={r.studentId} /><button style={{ background: 'none', border: 'none', color: 'var(--color-error)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>Confirm drop</button></form>
                <form action={cancelDropRequest}><input type="hidden" name="studentId" value={r.studentId} /><button style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>Cancel request</button></form>
              </span>
            ) : (
              <form action={dropStudent}><input type="hidden" name="studentId" value={r.studentId} /><button style={{ background: 'none', border: 'none', color: 'var(--color-error)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>Drop</button></form>
            ))}</td></tr>)}</tbody>
        </table>
      </div>

      {/* Payments */}
      <div style={card}>
        <h3 style={h3}>Payments · ${totalPaid.toFixed(2)} of ${Number(team.team_fee_amount ?? 1200).toFixed(2)}</h3>
        {(payments ?? []).length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' }}>
            <thead><tr><th style={cell}>Source</th><th style={cell}>Ref / check #</th><th style={cell}>Amount</th><th style={cell}>Received</th><th style={cell}>Deposited</th><th style={cell}>Actions</th></tr></thead>
            <tbody>{(payments ?? []).map((p: any) => (
              <tr key={p.id}>
                <td style={cell}>{p.source}</td>
                <td style={cell}>{p.source_payment_id || '—'}</td>
                <td style={cell}>${Number(p.amount).toFixed(2)}</td>
                <td style={cell}>{p.received_at ? new Date(p.received_at).toLocaleDateString() : '—'}</td>
                <td style={cell}>{p.deposited_at ? new Date(p.deposited_at).toLocaleDateString() : (canAct ? <form action={markDeposited}><input type="hidden" name="paymentId" value={p.id} /><button style={{ ...btn, padding: '3px 10px' }}>Mark deposited</button></form> : 'no')}</td>
                <td style={cell}>{canAct && <form action={voidPayment}><input type="hidden" name="paymentId" value={p.id} /><button style={{ background: 'none', border: 'none', color: 'var(--color-error)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>Void</button></form>}</td>
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
