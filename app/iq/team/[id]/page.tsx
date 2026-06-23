import { redirect, notFound, unstable_rethrow } from 'next/navigation'
import Link from 'next/link'
import { createClient as createSupa } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { FamilyShell, PageHeader, FormSection, FormField, TextInput, PrimaryButton, StatusBadge, InfoAlert } from '@/components/ui'

const SEASON = '2026-27'
const STATUS: Record<string, [string, 'success' | 'warning' | 'info' | 'error' | 'neutral']> = {
  pending_payment: ['Awaiting payment', 'warning'],
  pending_admin_confirmation: ['Under review', 'info'],
  active: ['Active', 'success'],
  suspended: ['Suspended', 'error'],
}
const cell: React.CSSProperties = { padding: '0.5rem 0.75rem', fontSize: '0.8125rem', borderBottom: '1px solid var(--color-border)', textAlign: 'left' }
const selectStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', fontSize: '0.875rem', border: '1.5px solid var(--color-border)', borderRadius: 6, fontFamily: 'inherit', boxSizing: 'border-box', backgroundColor: 'var(--color-surface)' }
const lbl: React.CSSProperties = { display: 'block', fontSize: '0.8125rem', fontWeight: 500, marginBottom: '0.25rem' }

// Resolve the signed-in coach for this team. Returns the coach's guardian id +
// family id, or null if they aren't this team's coach.
async function coachFor(teamId: string): Promise<{ gid: string; famId: string } | null> {
  const s = await createClient()
  const { data: { user } } = await s.auth.getUser()
  if (!user?.email) return null
  const adb = createAdminClient()
  const { data: g } = await adb.from('guardian').select('id, family_id').ilike('login_email', user.email).maybeSingle()
  if (!g) return null
  const { data: tm } = await adb.from('team_member').select('id').eq('team_id', teamId).eq('guardian_id', g.id).eq('team_role', 'coach').is('revoked_at', null).maybeSingle()
  return tm ? { gid: g.id, famId: g.family_id } : null
}

export default async function CoachTeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    return await CoachTeamView(id)
  } catch (e) {
    unstable_rethrow(e) // let redirect() / notFound() pass through
    console.error('[iq/team detail] load failed:', e)
    return (
      <FamilyShell familyName="IQ team" maxWidth="md">
        <PageHeader title="Couldn’t load this team" subtitle="Something went wrong loading your team." />
        <div style={{ border: '1px solid var(--color-border)', borderRadius: 10, padding: '1rem 1.25rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
          <p style={{ margin: '0 0 0.5rem' }}>Please try again. If it keeps happening, send this detail to the IQ Coordinator:</p>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '0.75rem', color: 'var(--color-error)' }}>{String((e as { message?: string })?.message ?? e)}</pre>
        </div>
        <Link href="/dashboard" style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-navy-deep)' }}>← Back to dashboard</Link>
      </FamilyShell>
    )
  }
}

async function CoachTeamView(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?redirectTo=/iq/team/${id}`)

  const coach = await coachFor(id)
  if (!coach) redirect('/dashboard') // not this team's coach

  const db = createAdminClient()
  const { data: team } = await db.from('team').select('id, team_name, team_number, status, program').eq('id', id).maybeSingle()
  if (!team || team.program !== 'vex_iq') notFound()

  const { data: apps } = await db.from('student_application').select('family_id, student_id, student:student_id ( first_name, last_name, grade )').eq('season', SEASON).ilike('triage_notes', `%iq_team:${id}%`)
  const famIds = [...new Set((apps ?? []).map((a: any) => a.family_id))]
  const emailByFam: Record<string, string> = {}
  if (famIds.length) {
    const { data: gs } = await db.from('guardian').select('family_id, login_email').in('family_id', famIds)
    for (const g of (gs ?? []) as any[]) if (!emailByFam[g.family_id]) emailByFam[g.family_id] = g.login_email ?? ''
  }
  const sids = (apps ?? []).map((a: any) => a.student_id).filter(Boolean)
  const signedSet = new Set<string>()
  if (sids.length) {
    const { data: sigs } = await db.from('waiver_signature').select('student_id').eq('season', SEASON).in('student_id', sids)
    for (const s of (sigs ?? []) as any[]) signedSet.add(s.student_id)
  }
  const roster = (apps ?? []).map((a: any) => {
    const s = Array.isArray(a.student) ? a.student[0] : a.student
    return { studentId: a.student_id, name: s ? `${s.first_name} ${s.last_name}`.trim() : '—', grade: s?.grade, parentEmail: emailByFam[a.family_id] ?? '', registered: signedSet.has(a.student_id) }
  })
  const teamLabel = team.team_name || 'Your IQ team'
  const [sl, sv] = STATUS[team.status] ?? ['—', 'neutral']

  // ---- Coach server actions ----
  async function addMember(formData: FormData) {
    'use server'
    const c = await coachFor(id); if (!c) return
    const sFirst = String(formData.get('student_first') ?? '').trim()
    const sLast = String(formData.get('student_last') ?? '').trim()
    const grade = Number(formData.get('grade'))
    const pEmail = String(formData.get('parent_email') ?? '').trim().toLowerCase()
    const pLast = String(formData.get('parent_last') ?? '').trim() || sLast
    const pFirst = String(formData.get('parent_first') ?? '').trim()
    if (!sFirst || !sLast || !pEmail) return
    const adb = createAdminClient()
    const { data: teamRow } = await adb.from('team').select('status').eq('id', id).maybeSingle()
    // Parent family.
    let familyId: string
    const pg = (await adb.from('guardian').select('id, family_id').ilike('login_email', pEmail).maybeSingle()).data
    if (pg) familyId = pg.family_id
    else {
      const fam = (await adb.from('family').insert({ primary_email: pEmail, display_name: pLast }).select('id').single()).data
      familyId = fam!.id
      await adb.from('guardian').insert({ family_id: familyId, first_name: pFirst || pLast, last_name: pLast, login_email: pEmail, phone: '', role: 'primary' })
    }
    // Student + application linked to the team.
    let stu = (await adb.from('student').select('id').eq('family_id', familyId).ilike('first_name', sFirst).ilike('last_name', sLast).maybeSingle()).data
    if (!stu) stu = (await adb.from('student').insert({ family_id: familyId, first_name: sFirst, last_name: sLast, city: 'Unknown', zip_code: '00000', grade: grade > 0 ? grade : 0, status: 'active' }).select('id').single()).data!
    const { data: fsRow } = await adb.from('family_season').select('id').eq('family_id', familyId).eq('season', SEASON).maybeSingle()
    if (!fsRow) await adb.from('family_season').insert({ family_id: familyId, season: SEASON, status: teamRow?.status === 'active' ? 'cleared_to_register' : 'applied' })
    await adb.from('student_application').upsert({ family_id: familyId, student_id: stu.id, season: SEASON, program_interest: 'vex_iq', status: 'accepted', source: 'admin_import', triage_notes: `iq_team:${id}` }, { onConflict: 'student_id,season' })
    // If the team is already active, clear + invite the new family now.
    if (teamRow?.status === 'active') {
      await adb.from('family_season').update({ status: 'cleared_to_register', magic_link_sent: true }).eq('family_id', familyId).eq('season', SEASON)
      try {
        const sender = createSupa(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
        await sender.auth.signInWithOtp({ email: pEmail, options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/api/auth/callback?redirectTo=/register` } })
      } catch (e) { console.error('[iq coach add] invite failed:', e) }
    }
    redirect(`/iq/team/${id}`)
  }
  async function dropMember(formData: FormData) {
    'use server'
    const c = await coachFor(id); if (!c) return
    const studentId = String(formData.get('studentId') ?? '')
    if (!studentId) return
    const adb = createAdminClient()
    await adb.from('student_application').update({ status: 'withdrawn', triage_notes: `iq_team_dropped:${id}` }).eq('student_id', studentId).eq('season', SEASON)
    await adb.from('team_member').update({ revoked_at: new Date().toISOString() }).eq('team_id', id).eq('student_id', studentId).eq('team_role', 'student').is('revoked_at', null)
    redirect(`/iq/team/${id}`)
  }
  async function renameTeam(formData: FormData) {
    'use server'
    const c = await coachFor(id); if (!c) return
    const adb = createAdminClient()
    await adb.from('team').update({ team_name: String(formData.get('team_name') ?? '').trim() || null }).eq('id', id)
    redirect(`/iq/team/${id}`)
  }

  return (
    <FamilyShell familyName={teamLabel} maxWidth="md">
      <PageHeader title={teamLabel} subtitle={`VEX IQ${team.team_number ? ` · ${team.team_number}` : ''} · ${SEASON}`} />
      <div style={{ marginBottom: '1.25rem' }}><StatusBadge label={sl} variant={sv} /></div>

      <FormSection title="Team name" description="Your team’s display name. Renaming here does not update events.vex.com — change it there too.">
        <form action={renameTeam} style={{ display: 'flex', gap: '0.625rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 240px' }}><TextInput name="team_name" defaultValue={team.team_name ?? ''} placeholder="e.g. Robo Raptors" /></div>
          <PrimaryButton type="submit">Save name</PrimaryButton>
        </form>
      </FormSection>

      <FormSection title={`Team members (${roster.length})`} description="Add or drop students. Dropping a student removes them from your team.">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={cell}>Student</th><th style={cell}>Grade</th><th style={cell}>Parent</th><th style={cell}>Registered</th><th style={cell}></th></tr></thead>
          <tbody>{roster.map((r) => (
            <tr key={r.studentId}>
              <td style={cell}>{r.name}</td>
              <td style={cell}>{r.grade || '—'}</td>
              <td style={cell}>{r.parentEmail || '—'}</td>
              <td style={{ ...cell, color: r.registered ? 'var(--color-success)' : 'var(--color-text-muted)', fontWeight: 600 }}>{r.registered ? '✓' : 'pending'}</td>
              <td style={cell}><form action={dropMember}><input type="hidden" name="studentId" value={r.studentId} /><button style={{ background: 'none', border: 'none', color: 'var(--color-error)', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>Drop</button></form></td>
            </tr>
          ))}</tbody>
        </table>
      </FormSection>

      <FormSection title="Add a member" description="They’ll get a registration invite once your team is approved (or right away if it’s already active).">
        <form action={addMember}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.625rem' }}>
            <FormField label="Student first" htmlFor="sf" required><TextInput id="sf" name="student_first" /></FormField>
            <FormField label="Student last" htmlFor="sln" required><TextInput id="sln" name="student_last" /></FormField>
            <div><label style={lbl}>Grade</label><select name="grade" style={selectStyle} defaultValue=""><option value="">—</option>{[3, 4, 5, 6].map((g) => <option key={g} value={g}>{g}</option>)}</select></div>
            <FormField label="Parent first" htmlFor="pf"><TextInput id="pf" name="parent_first" /></FormField>
            <FormField label="Parent last" htmlFor="pl"><TextInput id="pl" name="parent_last" /></FormField>
            <FormField label="Parent email" htmlFor="pe" required><TextInput id="pe" name="parent_email" type="email" /></FormField>
          </div>
          <div style={{ marginTop: '0.75rem' }}><PrimaryButton type="submit">Add member</PrimaryButton></div>
        </form>
      </FormSection>

      <div style={{ marginBottom: '1rem' }}><InfoAlert title="Need other changes?">For your team number or anything else, contact the IQ Coordinator at registrar@placerrobotics.org.</InfoAlert></div>
      <Link href="/dashboard" style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-navy-deep)' }}>← Back to dashboard</Link>
    </FamilyShell>
  )
}
