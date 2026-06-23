import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminProfile } from '@/lib/auth/admin'
import { hasAnyRole } from '@/lib/auth/roles'
import { AdminShell, PageHeader, EmptyState, StatusBadge } from '@/components/ui'
import IqApproveButton from './iq-approve-button'

const SEASON = '2026-27'

const smallBtn: React.CSSProperties = { padding: '5px 12px', backgroundColor: 'var(--color-navy-deep)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'inherit' }
const numInput: React.CSSProperties = { padding: '5px 8px', fontSize: '0.8125rem', border: '1.5px solid var(--color-border)', borderRadius: 6, fontFamily: 'inherit', width: 110, boxSizing: 'border-box' }
const card: React.CSSProperties = { border: '1px solid var(--color-border)', borderRadius: 10, padding: '1rem 1.25rem' }
const muted: React.CSSProperties = { fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }

export default async function IqTeamsPage() {
  const supabase = await createClient()
  const admin = await getAdminProfile()
  const canApprove = admin ? await hasAnyRole(createAdminClient(), admin.id, ['iq_coordinator', 'super_admin']) : false

  const { data: teamData } = await supabase
    .from('team')
    .select('id, team_name, team_number, status, team_fee_status, team_payment_reference_code, events_vex_com_registered, notes, created_at')
    .eq('season', SEASON)
    .eq('program', 'vex_iq')
    .order('created_at', { ascending: true })
  const teams = (teamData ?? []) as any[]
  const teamIds = teams.map((t) => t.id)

  const coachMap: Record<string, { name: string; email: string; guardianId: string }> = {}
  const rosterMap: Record<string, { name: string; parentEmail: string }[]> = {}
  const clearanceByGuardian: Record<string, string> = {}

  if (teamIds.length) {
    const { data: coaches } = await supabase
      .from('team_member')
      .select('team_id, guardian_id, guardian:guardian_id ( first_name, last_name, login_email )')
      .in('team_id', teamIds).eq('team_role', 'coach').is('revoked_at', null)
    for (const c of (coaches ?? []) as any[]) {
      const g = Array.isArray(c.guardian) ? c.guardian[0] : c.guardian
      if (g) coachMap[c.team_id] = { name: `${g.first_name} ${g.last_name}`.trim(), email: g.login_email ?? '', guardianId: c.guardian_id }
    }
    // Coach volunteer-clearance status.
    const guardianIds = Object.values(coachMap).map((c) => c.guardianId)
    if (guardianIds.length) {
      const { data: vps } = await supabase.from('volunteer_profile').select('guardian_id, status').in('guardian_id', guardianIds)
      for (const v of (vps ?? []) as any[]) clearanceByGuardian[v.guardian_id] = v.status
    }
    // Roster: applications carry the team in triage_notes; resolve student name + a parent email.
    const { data: apps } = await supabase.from('student_application').select('family_id, triage_notes, student:student_id ( first_name, last_name )').eq('season', SEASON).ilike('triage_notes', '%iq_team:%')
    const famIds = [...new Set((apps ?? []).map((a: any) => a.family_id))]
    const emailByFam: Record<string, string> = {}
    if (famIds.length) {
      const { data: gs } = await supabase.from('guardian').select('family_id, login_email').in('family_id', famIds)
      for (const g of (gs ?? []) as any[]) if (!emailByFam[g.family_id]) emailByFam[g.family_id] = g.login_email ?? ''
    }
    for (const a of (apps ?? []) as any[]) {
      const m = String(a.triage_notes ?? '').match(/iq_team:([0-9a-f-]{36})/i)
      if (!m) continue
      const st = Array.isArray(a.student) ? a.student[0] : a.student
      ;(rosterMap[m[1]] ??= []).push({ name: st ? `${st.first_name} ${st.last_name}`.trim() : '—', parentEmail: emailByFam[a.family_id] ?? '' })
    }
  }

  // ---- Server actions (admin-gated) ----
  async function setTeamNumber(formData: FormData) {
    'use server'
    if (!(await getAdminProfile())) return
    const teamId = String(formData.get('teamId') ?? '')
    const num = String(formData.get('team_number') ?? '').trim()
    if (teamId) await createAdminClient().from('team').update({ team_number: num || null }).eq('id', teamId)
    redirect('/admin/iq-teams')
  }
  async function toggleEvents(formData: FormData) {
    'use server'
    if (!(await getAdminProfile())) return
    const teamId = String(formData.get('teamId') ?? '')
    const value = formData.get('value') === 'true'
    if (teamId) await createAdminClient().from('team').update({ events_vex_com_registered: value }).eq('id', teamId)
    redirect('/admin/iq-teams')
  }

  const pendingPayment = teams.filter((t) => t.status === 'pending_payment')
  const pendingApproval = teams.filter((t) => t.status === 'pending_admin_confirmation')
  const active = teams.filter((t) => t.status === 'active')

  return (
    <AdminShell>
      <PageHeader title="IQ Teams" subtitle="VEX IQ teams move through payment → IQ Coordinator approval → active." />
      {teams.length === 0 ? (
        <EmptyState title="No IQ teams yet" description="Teams appear here when a coach creates one at /iq/team." />
      ) : (
        <>
          {/* Pending Payment */}
          <Tab label={`Pending Payment (${pendingPayment.length})`}>
            {pendingPayment.map((t) => (
              <div key={t.id} style={card}>
                <div style={{ fontWeight: 600 }}>{t.team_name || 'Unnamed team'}</div>
                <div style={muted}>Coach: {coachMap[t.id]?.name || '—'} · {coachMap[t.id]?.email || '—'}</div>
                <div style={muted}>{(rosterMap[t.id]?.length ?? 0)} students · created {new Date(t.created_at).toLocaleDateString()}</div>
                <div style={muted}>Payment ref: <strong>{t.team_payment_reference_code || '—'}</strong> · awaiting payment</div>
              </div>
            ))}
          </Tab>

          {/* Pending Approval */}
          <Tab label={`Pending Approval (${pendingApproval.length})`}>
            {pendingApproval.map((t) => (
              <div key={t.id} style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{t.team_name || 'Unnamed team'}</div>
                    <div style={muted}>Coach: {coachMap[t.id]?.name || '—'} · <span style={{ color: 'var(--color-success)' }}>Fee paid</span></div>
                  </div>
                  <IqApproveButton teamId={t.id} canApprove={canApprove} />
                </div>
                <div style={{ marginTop: '0.625rem', borderTop: '1px solid var(--color-border)', paddingTop: '0.5rem' }}>
                  {(rosterMap[t.id] ?? []).map((s, i) => (
                    <div key={i} style={{ fontSize: '0.8125rem', display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                      <span>{s.name}</span><span style={{ color: 'var(--color-text-muted)' }}>{s.parentEmail}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </Tab>

          {/* Active */}
          <Tab label={`Active (${active.length})`}>
            {active.map((t) => {
              const cs = coachMap[t.id]?.guardianId ? clearanceByGuardian[coachMap[t.id].guardianId] : undefined
              return (
                <div key={t.id} style={card}>
                  <div style={{ fontWeight: 600 }}>{t.team_name || 'Unnamed team'}</div>
                  <div style={muted}>Coach: {coachMap[t.id]?.name || '—'} · clearance: <StatusBadge label={cs ? cs.replace(/_/g, ' ') : 'none'} variant={cs === 'cleared' ? 'success' : cs ? 'warning' : 'neutral'} /></div>
                  <div style={muted}>{(rosterMap[t.id]?.length ?? 0)} students · {SEASON}</div>
                  <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '0.625rem' }}>
                    <form action={setTeamNumber} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      <input type="hidden" name="teamId" value={t.id} />
                      <label style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Team #</label>
                      <input name="team_number" defaultValue={t.team_number ?? ''} placeholder="e.g. 295Y" style={numInput} />
                      <button style={smallBtn}>Save</button>
                    </form>
                    <form action={toggleEvents}>
                      <input type="hidden" name="teamId" value={t.id} />
                      <input type="hidden" name="value" value={(!t.events_vex_com_registered).toString()} />
                      <label style={{ fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                        <input type="checkbox" checked={!!t.events_vex_com_registered} readOnly />
                        <button type="submit" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8125rem', color: 'var(--color-navy-deep)', fontWeight: 600, padding: 0 }}>
                          events.vex.com registered{t.events_vex_com_registered ? ' ✓' : ' — mark'}
                        </button>
                      </label>
                    </form>
                  </div>
                </div>
              )
            })}
          </Tab>
        </>
      )}
    </AdminShell>
  )
}

function Tab({ label, children }: { label: string; children: React.ReactNode }) {
  const arr = Array.isArray(children) ? children : [children]
  const has = arr.some(Boolean) && arr.flat().length > 0
  return (
    <div style={{ marginBottom: '2rem' }}>
      <h3 style={{ fontSize: '0.875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>{label}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {has ? children : <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>None.</div>}
      </div>
    </div>
  )
}
