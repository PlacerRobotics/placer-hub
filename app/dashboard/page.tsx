import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { FamilyShell, PageHeader, ActionCard, StatusBadge, WarningAlert, SuccessAlert } from '@/components/ui'
import { supporterLevel } from '@/lib/supporter'

const ADMIN_EMAIL = 'kevin.miller@placerrobotics.org'
const SEASON = '2026-27'

type Variant = 'success' | 'warning' | 'error' | 'info' | 'neutral'
type CheckState = 'done' | 'todo' | 'na'
type StudentCard = { name: string; program: string; complete: boolean; checks: { cap: string; val: string; state: CheckState }[]; detail: string }
type KidTeam = { name: string; teamLabel: string; teamId: string; program: string; division: string; isIq: boolean; studentId: string; dropRequested: boolean }

const PROGRAM_LABELS: Record<string, string> = { vex_v5: 'VEX V5', combat: 'Combat', vex_iq: 'VEX IQ', not_sure: 'Not sure', both: 'VEX V5 & Combat' }
const DIVISION_LABELS: Record<string, string> = { ES: 'Elementary', MS: 'Middle school', HS: 'High school' }
const TSHIRT_LABELS: Record<string, string> = { ym: 'Youth Medium', yl: 'Youth Large', xs: 'Adult XS', s: 'Adult Small', m: 'Adult Medium', l: 'Adult Large', xl: 'Adult XL', xxl: 'Adult 2XL', xxxl: 'Adult 3XL' }
const AID_DISPLAY: Record<string, [string, Variant]> = { not_requested: ['Not requested', 'neutral'], pending: ['Requested', 'info'], approved: ['Approved', 'success'], denied: ['Denied', 'error'], withdrawn: ['Withdrawn', 'neutral'] }
const IQ_STATUS: Record<string, [string, Variant]> = { pending_payment: ['Awaiting payment', 'warning'], pending_admin_confirmation: ['Under review', 'info'], active: ['Active', 'success'], suspended: ['Suspended', 'error'], pending: ['Pending', 'warning'] }
const VOL_STATUS: Record<string, [string, Variant]> = { pending: ['Pending', 'warning'], in_progress: ['In progress', 'info'], cleared: ['Cleared', 'success'], expired: ['Expired', 'error'], suspended: ['Suspended', 'error'], withdrawn: ['Withdrawn', 'neutral'] }

const CHECK_COLOR: Record<CheckState, string> = { done: 'var(--color-success)', todo: '#C9971B', na: 'var(--color-text-muted)' }
const CHECK_GLYPH: Record<CheckState, string> = { done: '✓', todo: '✗', na: '–' }

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { notice } = await searchParams
  const email = user.email ?? 'your account'
  const isAdmin = user.email === ADMIN_EMAIL

  const { data: guardian } = await supabase.from('guardian').select('id, family_id, first_name, last_name').ilike('login_email', user.email ?? '').maybeSingle()
  const familyLabel = guardian?.last_name ? `${guardian.last_name} Family` : email

  let aidStatus = 'not_requested'
  let fsStatus = ''
  let guardian2: { name: string; email: string } | null = null
  const studentCards: StudentCard[] = []
  const kidTeams: KidTeam[] = []
  let firstUnregisteredName = ''
  let guardianHasSigned = false
  let hasActiveWaivers = false
  let coachTeams: any[] = []
  const teamCount: Record<string, number> = {}
  let zeffyIqUrl: string | null = null
  let volunteer: { label: string; variant: Variant } | null = null

  if (guardian) {
    const familyId = guardian.family_id

    const { data: fs } = await supabase.from('family_season').select('status').eq('family_id', familyId).eq('season', SEASON).maybeSingle()
    fsStatus = fs?.status ?? ''

    const { data: aid } = await supabase.from('financial_aid').select('status').eq('family_id', familyId).eq('season', SEASON).order('requested_at', { ascending: false }).limit(1).maybeSingle()
    if (aid) aidStatus = aid.status

    const { data: gAll } = await supabase.from('guardian').select('id, first_name, last_name, login_email, communication_email').eq('family_id', familyId).order('created_at', { ascending: true })
    const g2 = (gAll ?? []).find((g: any) => g.id !== guardian.id)
    guardian2 = g2 ? { name: `${g2.first_name} ${g2.last_name}`.trim(), email: g2.communication_email || g2.login_email || '' } : null

    const { data: studs } = await supabase.from('student').select('id, first_name, last_name, preferred_name, tshirt_size').eq('family_id', familyId).order('created_at', { ascending: true })
    const students = studs ?? []
    const studentIds = students.map((s: any) => s.id)

    if (studentIds.length) {
      const { data: enrollments } = await supabase.from('enrollment').select('id, student_id, program, registration_fee_status, submitted_at').eq('season', SEASON).in('student_id', studentIds)
      const { data: apps } = await supabase.from('student_application').select('student_id, program_interest, triage_notes').eq('season', SEASON).in('student_id', studentIds)
      const { data: sigs } = await supabase.from('waiver_signature').select('student_id').eq('season', SEASON).in('student_id', studentIds)
      const { data: tms } = await supabase.from('team_member').select('student_id, team_id').eq('season', SEASON).eq('team_role', 'student').is('revoked_at', null).in('student_id', studentIds)
      const { data: ecs } = await supabase.from('emergency_contact').select('student_id, first_name, last_name, phone').eq('priority', 1).in('student_id', studentIds)
      const { data: pays } = await supabase.from('payment_transaction').select('enrollment_id, amount, received_at, raw_payload').eq('family_id', familyId).eq('season', SEASON).eq('payment_type', 'registration_fee')

      const teamIds = [...new Set((tms ?? []).map((t: any) => t.team_id).filter(Boolean))]
      const { data: teams } = teamIds.length ? await supabase.from('team').select('id, team_number, team_name, program, division').in('id', teamIds) : { data: [] as any[] }
      const teamById: Record<string, any> = Object.fromEntries((teams ?? []).map((t: any) => [t.id, t]))

      const enrByStudent: Record<string, any[]> = {}
      for (const e of enrollments ?? []) (enrByStudent[e.student_id] ??= []).push(e)
      const progByStudent: Record<string, string> = Object.fromEntries((apps ?? []).map((a: any) => [a.student_id, a.program_interest]))
      const tnByStudent: Record<string, string> = Object.fromEntries((apps ?? []).map((a: any) => [a.student_id, a.triage_notes ?? '']))
      const signed = new Set((sigs ?? []).map((s: any) => s.student_id))
      const teamByStudent: Record<string, any> = {}
      for (const t of tms ?? []) if (!teamByStudent[t.student_id]) teamByStudent[t.student_id] = teamById[t.team_id]
      const ecByStudent: Record<string, any> = Object.fromEntries((ecs ?? []).map((e: any) => [e.student_id, e]))
      const payByEnrollment: Record<string, any> = Object.fromEntries((pays ?? []).map((p: any) => [p.enrollment_id, p]))

      // IQ team membership lives in triage_notes (iq_team:<uuid>); resolve the team for "My teams".
      const iqKids = students.map((s: any) => {
        const tn = String(tnByStudent[s.id] ?? '')
        const m = tn.match(/iq_team:([0-9a-f-]{36})/i)
        return m ? { studentId: s.id, name: `${s.first_name} ${s.last_name}`.trim(), dropRequested: tn.includes('drop_requested'), teamId: m[1] } : null
      }).filter(Boolean) as { studentId: string; name: string; dropRequested: boolean; teamId: string }[]
      const iqTeamById: Record<string, any> = {}
      if (iqKids.length) {
        const { data: iqT } = await supabase.from('team').select('id, team_name, team_number, division').in('id', [...new Set(iqKids.map((k) => k.teamId))])
        for (const t of iqT ?? []) iqTeamById[t.id] = t
      }
      const iqLabelByStudent: Record<string, string> = {}
      const iqTeamIdByStudent: Record<string, string> = {}
      const iqDivisionByStudent: Record<string, string> = {}
      for (const k of iqKids) {
        const t = iqTeamById[k.teamId]
        iqLabelByStudent[k.studentId] = t ? (t.team_name || t.team_number || 'IQ team') : 'IQ team'
        iqTeamIdByStudent[k.studentId] = k.teamId
        iqDivisionByStudent[k.studentId] = t?.division ?? 'ES'
      }

      for (const s of students) {
        const enrs = enrByStudent[s.id] ?? []
        const registered = enrs.some((e: any) => e.submitted_at)
        const programVal = enrs.length > 1 ? 'both' : (enrs[0]?.program ?? progByStudent[s.id] ?? 'not_sure')
        const feeStatuses = enrs.map((e: any) => e.registration_fee_status)
        const paid = enrs.length > 0 && !feeStatuses.includes('unpaid')
        const isSigned = signed.has(s.id)
        const team = teamByStudent[s.id]
        const hasTeam = !!team
        const ec = ecByStudent[s.id]
        const pay = enrs.map((e: any) => payByEnrollment[e.id]).find(Boolean)
        const level = pay ? supporterLevel(Number(pay.amount)) : null

        const iqLabel = iqLabelByStudent[s.id]
        const isIqKid = !!iqLabel
        const name = `${s.first_name} ${s.last_name}`.trim()

        let payVal: string, payState: CheckState
        if (!enrs.length) { payVal = '—'; payState = 'na' }
        else if (feeStatuses.includes('unpaid')) { payVal = 'Not paid'; payState = 'todo' }
        else if (feeStatuses.includes('waived')) { payVal = 'Waived'; payState = 'done' }
        else { payVal = level ? `Paid · ${level}` : 'Paid'; payState = 'done' }

        // IQ kids join through the coach flow — registration + fee are team-level, not per-student.
        const checks: StudentCard['checks'] = isIqKid
          ? [
              { cap: 'Registration', val: 'Team-managed', state: 'na' },
              { cap: 'Waivers', val: isSigned ? 'Signed' : 'Not signed', state: isSigned ? 'done' : 'todo' },
              { cap: 'Payment', val: 'Team fee', state: 'na' },
              { cap: 'Team', val: iqLabel, state: 'done' },
            ]
          : [
              { cap: 'Registration', val: registered ? 'Complete' : 'Not started', state: registered ? 'done' : 'todo' },
              { cap: 'Waivers', val: isSigned ? 'Signed' : 'Not signed', state: isSigned ? 'done' : 'todo' },
              { cap: 'Payment', val: payVal, state: payState },
              { cap: 'Team', val: hasTeam ? (team.team_name || team.team_number || 'Assigned') : 'Pending', state: hasTeam ? 'done' : 'todo' },
            ]
        const complete = isIqKid ? isSigned : (registered && isSigned && paid && hasTeam)
        if (!isIqKid && !registered && !firstUnregisteredName) firstUnregisteredName = name
        studentCards.push({
          name,
          program: isIqKid ? 'VEX IQ' : (PROGRAM_LABELS[programVal] ?? programVal),
          complete,
          checks,
          detail: `Emergency contact ${ec ? 'added' : 'missing'} · T-shirt ${s.tshirt_size ? (TSHIRT_LABELS[s.tshirt_size] ?? s.tshirt_size) : 'not set'}`,
        })

        if (isIqKid) kidTeams.push({ name, teamLabel: iqLabel, teamId: iqTeamIdByStudent[s.id], program: 'VEX IQ', division: iqDivisionByStudent[s.id] ?? 'ES', isIq: true, studentId: s.id, dropRequested: String(tnByStudent[s.id] ?? '').includes('drop_requested') })
        else if (hasTeam) kidTeams.push({ name, teamLabel: team.team_name || team.team_number || 'Assigned', teamId: team.id, program: PROGRAM_LABELS[team.program] ?? team.program, division: team.division, isIq: false, studentId: s.id, dropRequested: false })
      }

    }

    const { data: mySig } = await supabase.from('waiver_signature').select('id').eq('guardian_id', guardian.id).eq('season', SEASON).limit(1)
    guardianHasSigned = (mySig ?? []).length > 0
    const { data: activeW } = await supabase.from('waiver_template').select('id').eq('active', true).limit(1)
    hasActiveWaivers = (activeW ?? []).length > 0

    // Teams this guardian coaches (any program). Coach team_member rows have
    // student_id NULL, which the RLS select policy hides from non-admins — so read
    // these with the service-role client, scoped to this guardian.
    const adb = createAdminClient()
    const { data: coachTms } = await adb.from('team_member').select('team:team_id ( id, team_name, team_number, program, division, status )').eq('guardian_id', guardian.id).eq('season', SEASON).eq('team_role', 'coach').is('revoked_at', null)
    coachTeams = (coachTms ?? []).map((c: any) => (Array.isArray(c.team) ? c.team[0] : c.team)).filter(Boolean)
    if (coachTeams.length) {
      const ids = coachTeams.map((t: any) => t.id)
      const { data: rosters } = await adb.from('team_member').select('team_id').eq('season', SEASON).eq('team_role', 'student').is('revoked_at', null).in('team_id', ids)
      for (const r of rosters ?? []) teamCount[r.team_id] = (teamCount[r.team_id] ?? 0) + 1
      const { data: iqApps } = await adb.from('student_application').select('triage_notes').eq('season', SEASON).ilike('triage_notes', '%iq_team:%')
      for (const a of iqApps ?? []) { const m = String(a.triage_notes ?? '').match(/iq_team:([0-9a-f-]{36})/i); if (m && ids.includes(m[1])) teamCount[m[1]] = (teamCount[m[1]] ?? 0) + 1 }
    }
    const { data: cfg } = await supabase.from('season_config').select('zeffy_iq_team_url').eq('season', SEASON).maybeSingle()
    zeffyIqUrl = cfg?.zeffy_iq_team_url ?? null

    // Volunteer clearance for the logged-in guardian.
    const { data: vp } = await supabase.from('volunteer_profile').select('id, status').eq('guardian_id', guardian.id).maybeSingle()
    if (vp) {
      const { data: vc } = await supabase.from('volunteer_clearance').select('status').eq('volunteer_id', vp.id).eq('season', SEASON).maybeSingle()
      const st = vc?.status ?? vp.status
      const [label, variant] = VOL_STATUS[st] ?? [st, 'neutral']
      volunteer = { label, variant }
    }
  }

  async function requestDrop(formData: FormData) {
    'use server'
    const sb = await createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user?.email) return
    const adb = createAdminClient()
    const { data: g } = await adb.from('guardian').select('family_id').ilike('login_email', user.email).maybeSingle()
    if (!g) return
    const studentId = String(formData.get('studentId') ?? '')
    const { data: stu } = await adb.from('student').select('family_id').eq('id', studentId).maybeSingle()
    if (!stu || stu.family_id !== g.family_id) return
    const { data: app } = await adb.from('student_application').select('id, triage_notes').eq('student_id', studentId).eq('season', SEASON).maybeSingle()
    if (app && !String(app.triage_notes ?? '').includes('drop_requested')) {
      await adb.from('student_application').update({ triage_notes: `${app.triage_notes ?? ''} drop_requested`.trim() }).eq('id', app.id)
    }
    redirect('/dashboard')
  }

  const [aidLabel, aidVariant] = AID_DISPLAY[aidStatus] ?? AID_DISPLAY.not_requested
  const fullyComplete = studentCards.length > 0 && fsStatus === 'registered' && studentCards.every((c) => c.complete)
  const anyRegistered = studentCards.some((c) => c.checks[0].state === 'done')
  const showSignPrompt = !!guardian && !guardianHasSigned && anyRegistered && hasActiveWaivers
  const readyCount = studentCards.filter((c) => c.complete).length

  // Team-centric "My teams": one row per team, grouping my kids onto their team and
  // merging with any team I coach (a team can be both).
  type TeamRow = { id: string; label: string; programLabel: string; divisionLabel: string; isIq: boolean; coached: boolean; status?: string; count: number; kids: { studentId: string; name: string; dropRequested: boolean }[] }
  const teamRowMap: Record<string, TeamRow> = {}
  for (const t of coachTeams) {
    teamRowMap[t.id] = { id: t.id, label: t.team_name || t.team_number || 'Team', programLabel: PROGRAM_LABELS[t.program] ?? t.program, divisionLabel: DIVISION_LABELS[t.division] ?? t.division, isIq: t.program === 'vex_iq', coached: true, status: t.status, count: teamCount[t.id] ?? 0, kids: [] }
  }
  for (const k of kidTeams) {
    const row = (teamRowMap[k.teamId] ??= { id: k.teamId, label: k.teamLabel, programLabel: k.program, divisionLabel: DIVISION_LABELS[k.division] ?? k.division, isIq: k.isIq, coached: false, count: 0, kids: [] })
    row.kids.push({ studentId: k.studentId, name: k.name, dropRequested: k.dropRequested })
  }
  const coachedTeams = Object.values(teamRowMap).filter((t) => t.coached)
  const kidOnlyTeams = Object.values(teamRowMap).filter((t) => !t.coached)

  const nextSteps: { title: string; desc: string; cta: string; href: string }[] = []
  if (firstUnregisteredName) nextSteps.push({ title: `Complete registration for ${firstUnregisteredName}`, desc: 'Finish the form and submit payment to secure the 2026–27 spot.', cta: 'Continue registration', href: '/register' })
  if (showSignPrompt) nextSteps.push({ title: 'Sign your agreements', desc: 'Review and sign this season’s participation and policy agreements from your account.', cta: 'Review & sign', href: '/waivers' })

  const panel: React.CSSProperties = { backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden' }
  const rowFlex: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.875rem 1.25rem' }
  const smallLink: React.CSSProperties = { fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-navy-deep)' }
  const subhead: React.CSSProperties = { fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)', fontWeight: 700, margin: '0 0 0.5rem' }
  const sectionTitle: React.CSSProperties = { margin: '0 0 0.75rem' }
  const section: React.CSSProperties = { marginTop: '2rem' }

  return (
    <FamilyShell familyName={familyLabel} maxWidth="lg">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        {isAdmin ? <Link href="/admin" style={smallLink}>Admin dashboard →</Link> : <span />}
        <Link href="/dashboard/edit" style={smallLink}>My Account →</Link>
      </div>

      {notice === 'not_cleared' && <div style={{ marginBottom: '1rem' }}><WarningAlert title="Not cleared to register yet">You need to be accepted before registering.</WarningAlert></div>}
      {notice === 'registered' && <div style={{ marginBottom: '1rem' }}><SuccessAlert title="Registration submitted">We received your registration. Complete payment to secure the spot.</SuccessAlert></div>}
      {notice === 'signed' && <div style={{ marginBottom: '1rem' }}><SuccessAlert title="Agreements signed">Thank you — your signatures were recorded.</SuccessAlert></div>}

      <PageHeader title="Your Dashboard" subtitle={`Signed in as ${email}.`} />

      {studentCards.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '0.4rem' }}>{SEASON} season · {readyCount} of {studentCards.length} {studentCards.length === 1 ? 'student' : 'students'} ready</div>
          <div style={{ height: 6, borderRadius: 999, background: 'var(--color-border)', overflow: 'hidden' }}>
            <div style={{ width: `${studentCards.length ? (readyCount / studentCards.length) * 100 : 0}%`, height: '100%', background: 'var(--color-success)' }} />
          </div>
        </div>
      )}

      {/* NEXT STEPS */}
      {nextSteps.length > 0 && (
        <section style={{ marginBottom: '0.5rem' }}>
          <ActionCard title={nextSteps[0].title} description={nextSteps[0].desc} ctaLabel={nextSteps[0].cta} href={nextSteps[0].href} />
          {nextSteps.length > 1 && (
            <div style={{ ...panel, marginTop: '0.75rem' }}>
              {nextSteps.slice(1).map((a) => (
                <div key={a.title} style={rowFlex}>
                  <span style={{ fontSize: '0.9375rem' }}>{a.title}</span>
                  <Link href={a.href} style={smallLink}>{a.cta} →</Link>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
      {nextSteps.length === 0 && fullyComplete && (
        <div style={{ marginBottom: '0.5rem' }}><SuccessAlert title="You're all set">Every student is registered, signed, paid, and assigned to a team for {SEASON}.</SuccessAlert></div>
      )}

      {/* MY CHILDREN */}
      {studentCards.length === 0 ? (
        <WarningAlert title="No students yet">We don&apos;t have a student on your account for {SEASON} yet. If you applied, an admin will clear you to register soon.</WarningAlert>
      ) : (
        <section style={section}>
          <h2 className="text-section-title" style={sectionTitle}>My children</h2>
          {studentCards.map((card) => (
            <div key={card.name} style={{ ...panel, padding: '1rem 1.25rem', marginBottom: '0.875rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
                <div style={{ fontSize: '1.0625rem', fontWeight: 700 }}>{card.name} <span style={{ fontSize: '0.8125rem', fontWeight: 400, color: 'var(--color-text-muted)' }}>· {card.program}</span></div>
                <StatusBadge label={card.complete ? 'Ready' : 'In progress'} variant={card.complete ? 'success' : 'warning'} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
                {card.checks.map((c) => (
                  <div key={c.cap} style={{ textAlign: 'center', padding: '0.5rem 0.375rem', border: '1px solid var(--color-border)', borderRadius: 8 }}>
                    <div style={{ fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--color-text-muted)', marginBottom: 3 }}>{c.cap}</div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: CHECK_COLOR[c.state] }}>{CHECK_GLYPH[c.state]} {c.val}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                <span>{card.detail}</span>
                <Link href="/dashboard/edit" style={smallLink}>Edit details</Link>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* MY TEAMS */}
      {guardian && (
        <section style={section}>
          <h2 className="text-section-title" style={sectionTitle}>My teams</h2>
          {coachedTeams.length === 0 && kidOnlyTeams.length === 0 ? (
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: '0 0 0.75rem' }}>No team assignments yet.</p>
          ) : (
            <>
              {coachedTeams.length > 0 && (
                <div style={{ marginBottom: kidOnlyTeams.length > 0 ? '1.25rem' : 0 }}>
                  <div style={subhead}>Teams I coach</div>
                  <div style={panel}>
                    {coachedTeams.map((tm, i) => {
                      const [lbl, variant] = IQ_STATUS[tm.status ?? ''] ?? [String(tm.status ?? '').replace(/_/g, ' '), 'neutral' as Variant]
                      return (
                        <div key={tm.id} style={{ ...rowFlex, borderBottom: i < coachedTeams.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                          <div>
                            {tm.isIq
                              ? <Link href={`/iq/team/${tm.id}`} style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--color-navy-deep)' }}>{tm.label}</Link>
                              : <span style={{ fontSize: '0.9375rem', fontWeight: 600 }}>{tm.label}</span>}
                            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>{tm.programLabel} · {tm.divisionLabel} · {tm.count} {tm.count === 1 ? 'student' : 'students'}</div>
                          </div>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            {tm.status ? <StatusBadge label={lbl} variant={variant} /> : null}
                            {tm.isIq && tm.status === 'pending_payment' && zeffyIqUrl && <Link href={zeffyIqUrl} target="_blank" style={smallLink}>Pay $1,200 →</Link>}
                            {tm.isIq && <Link href={`/iq/team/${tm.id}`} style={smallLink}>Manage →</Link>}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              {kidOnlyTeams.length > 0 && (
                <div>
                  <div style={subhead}>My children’s teams</div>
                  <div style={panel}>
                    {kidOnlyTeams.map((tm, i) => (
                      <div key={tm.id} style={{ padding: '0.875rem 1.25rem', borderBottom: i < kidOnlyTeams.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                        <div>
                          <span style={{ fontSize: '0.9375rem', fontWeight: 600 }}>{tm.label}</span>
                          <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>{tm.programLabel} · {tm.divisionLabel} · {tm.kids.length} of your {tm.kids.length === 1 ? 'student' : 'students'}</div>
                        </div>
                        <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--color-border)' }}>
                          {tm.kids.map((k) => (
                            <div key={k.studentId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.2rem 0', fontSize: '0.8125rem' }}>
                              <span style={{ color: 'var(--color-text-muted)' }}>{k.name}</span>
                              {tm.isIq && (k.dropRequested
                                ? <span style={{ color: '#C9971B', fontWeight: 600 }}>Drop requested</span>
                                : <form action={requestDrop}><input type="hidden" name="studentId" value={k.studentId} /><button style={{ background: 'none', border: 'none', color: 'var(--color-error)', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Request to drop</button></form>)}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
          {coachTeams.length === 0 && (
            <div style={{ ...panel, marginTop: '0.75rem' }}>
              <div style={rowFlex}>
                <span style={{ fontSize: '0.9375rem' }}>Coaching a VEX IQ team this season?</span>
                <Link href="/iq/team" style={smallLink}>Create a team →</Link>
              </div>
            </div>
          )}
        </section>
      )}

      {/* MY VOLUNTEER INFO */}
      {guardian && (
        <section style={section}>
          <h2 className="text-section-title" style={sectionTitle}>My volunteer info</h2>
          <div style={panel}>
            <div style={rowFlex}>
              <span style={{ fontSize: '0.9375rem', fontWeight: 500 }}>Registered Volunteer status</span>
              {volunteer
                ? <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}><StatusBadge label={volunteer.label} variant={volunteer.variant} /><Link href="/volunteer" style={smallLink}>View →</Link></span>
                : <Link href="/volunteer/apply" style={smallLink}>Become a Registered Volunteer →</Link>}
            </div>
          </div>
        </section>
      )}

      {/* MY HOUSEHOLD */}
      {guardian && (
        <section style={section}>
          <h2 className="text-section-title" style={sectionTitle}>My household</h2>
          <div style={panel}>
            <div style={{ ...rowFlex, borderBottom: '1px solid var(--color-border)' }}>
              <span style={{ fontSize: '0.9375rem', fontWeight: 500 }}>Second guardian</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>{guardian2 ? `${guardian2.name}${guardian2.email ? ` · ${guardian2.email}` : ''}` : 'Not added'}</span>
                <Link href="/dashboard/edit" style={smallLink}>{guardian2 ? 'Edit' : 'Add'}</Link>
              </span>
            </div>
            <div style={rowFlex}>
              <span style={{ fontSize: '0.9375rem', fontWeight: 500 }}>Financial aid</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <StatusBadge label={aidLabel} variant={aidVariant} />
                {aidStatus === 'not_requested' && <Link href="/financial-aid" style={smallLink}>Request</Link>}
              </span>
            </div>
          </div>
        </section>
      )}
    </FamilyShell>
  )
}
