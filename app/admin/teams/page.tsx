import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireSection } from '@/lib/auth/admin-access'
import { AdminShell, PageHeader, EmptyState } from '@/components/ui'
import { TeamRows } from './team-rows'

const SEASON = '2026-27'
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', fontSize: '0.9375rem', border: '1.5px solid var(--color-border)', borderRadius: '6px', fontFamily: 'inherit', boxSizing: 'border-box', backgroundColor: 'var(--color-surface)' }

export default async function TeamsPage() {
  await requireSection('/admin/teams')
  const supabase = await createClient()
  const { data } = await supabase
    .from('team')
    .select('id, team_name, team_number, program, division, season, school_org, active, notes, kit_number, kit_checkout_date, kit_return_date, kit_return_verified')
    .eq('season', SEASON)
    .order('created_at', { ascending: true })
  const teams = (data ?? []) as any[]

  async function createTeam(formData: FormData) {
    'use server'
    const program = String(formData.get('program') ?? '')
    const division = String(formData.get('division') ?? '')
    const school_org = String(formData.get('school_org') ?? '').trim()
    if (!['vex_v5', 'vex_iq', 'combat'].includes(program)) return
    if (!['ES', 'MS', 'HS'].includes(division)) return
    if (!school_org) return
    const db = await createClient()
    await db.from('team').insert({
      season: SEASON,
      program,
      division,
      team_name: String(formData.get('team_name') ?? '').trim() || null,
      team_number: String(formData.get('team_number') ?? '').trim() || null,
      school_org,
      active: true,
    })
    redirect('/admin/teams')
  }

  return (
    <AdminShell activePath="/admin/teams">
      <PageHeader title="Teams" subtitle={`VEX V5, VEX IQ and Combat teams for ${SEASON}.`} />

      <form action={createTeam} style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '1.25rem', marginBottom: '1.5rem', maxWidth: '640px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.875rem', alignItems: 'end' }}>
        <div><label style={labelStyle}>Program</label><select name="program" style={inputStyle}><option value="vex_v5">VEX V5</option><option value="vex_iq">VEX IQ</option><option value="combat">Combat</option></select></div>
        <div><label style={labelStyle}>Division</label><select name="division" defaultValue="HS" style={inputStyle}><option value="ES">Elementary</option><option value="MS">Middle</option><option value="HS">High</option></select></div>
        <div><label style={labelStyle}>Team name</label><input name="team_name" style={inputStyle} /></div>
        <div><label style={labelStyle}>Team number</label><input name="team_number" style={inputStyle} placeholder="95070X" /></div>
        <div><label style={labelStyle}>School / org *</label><input name="school_org" required style={inputStyle} /></div>
        <button type="submit" style={{ padding: '10px 18px', backgroundColor: 'var(--color-navy-deep)', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, fontSize: '0.9375rem', cursor: 'pointer', fontFamily: 'inherit', minHeight: '40px' }}>Create team</button>
      </form>

      {teams.length === 0 ? (
        <EmptyState title="No teams yet" description="Create a team above to get started." />
      ) : (
        <TeamRows teams={teams} />
      )}
    </AdminShell>
  )
}
