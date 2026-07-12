import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { FamilyShell, PageHeader, StatusBadge, WarningAlert, SuccessAlert } from '@/components/ui'
import { supporterLevel } from '@/lib/supporter'
import { APS_VALID_THROUGH } from '@/lib/volunteer'
import { volunteerBucket, VOLUNTEER_BUCKET_META } from '@/lib/volunteer-buckets'
import { fundraisingDeadline } from '@/lib/fundraising'
import { getAdminAccess } from '@/lib/auth/admin-access'
import { adminHome } from '@/lib/auth/roles'
import { NEXT_PUBLIC_SLACK_MAIN_INVITE, NEXT_PUBLIC_SLACK_IQ_INVITE, FEATURE_FINANCIAL_AID } from '@/lib/env'
import { deriveStudentStatus, CHECK_META, BADGE_META, OWNER_LABELS, type Check, type StudentBadge } from '@/lib/dashboard-status'
import { resolveIqStatus, nonIqEnrollments } from '@/lib/iq-status'

const SEASON = '2026-27'

// Family/coach-facing team label — never surface the internal "TBD" placeholder
// name for a provisional team (e.g. an undefined Combat roster); soften it to
// read as normal in-progress process instead. Admin views show the real name.
function familyTeamLabel(t: { team_name?: string | null; team_number?: string | null; is_provisional?: boolean } | null | undefined, fallback = 'Assigned'): string {
  if (!t) return fallback
  if (t.is_provisional) return 'Final team placement in progress'
  return t.team_name || t.team_number || fallback
}

const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
function apsDisplay(state: string, expiry: string | null): { color: string; text: string } {
  if (state === 'valid') return { color: 'var(--color-success)', text: `Valid${expiry ? ` · expires ${fmtDate(expiry)}` : ''}` }
  if (state === 'expiring') return { color: '#C9971B', text: `Expires ${expiry ? fmtDate(expiry) : 'soon'} — renew soon` }
  if (state === 'expired') return { color: 'var(--color-error)', text: `Expired${expiry ? ` ${fmtDate(expiry)}` : ''} — renew` }
  return { color: 'var(--color-text-muted)', text: 'Not on file' }
}
// Fallback so "Pay Now via Zeffy" always works even if season_config is unset.
const ZEFFY_REGISTRATION_URL = 'https://www.zeffy.com/en-US/ticketing/2026-27-placer-robotics-mshs-registration'

// Family resources (account-agnostic links — no /u/N). Drives + IQ addendum are shown
// per the family's programs; the handbook is for everyone.
const RES_HANDBOOK = 'https://docs.google.com/document/d/1HXsC2LHMADf5a2svsOZLaGUPRkMhUH2JvzGBkGD38dc/edit'
const RES_IQ_ADDENDUM = 'https://docs.google.com/document/d/17MtNftPsKIWnS-_yn3xxZD3wGdX2tJTE/edit'
const RES_V5_DRIVE = 'https://drive.google.com/drive/folders/0AMHpvFT5atYCUk9PVA'
const RES_COMBAT_DRIVE = 'https://drive.google.com/drive/folders/0AJWmYed6tfyuUk9PVA'
const SLACK_MAIN = NEXT_PUBLIC_SLACK_MAIN_INVITE
const SLACK_IQ = NEXT_PUBLIC_SLACK_IQ_INVITE

type Variant = 'success' | 'warning' | 'error' | 'info' | 'neutral'
type StudentCard = { studentId: string; name: string; program: string; complete: boolean; badge: StudentBadge; checks: Check[]; attentionNotes: string[]; payTodo: boolean; detail: string; isIqKid: boolean; registered: boolean; paid: boolean; needsWizard: boolean; fundMethods: string[]; fundTarget: number; fundDeadline: string; fundReceivedAt: string | null; feeAmount: number; payUrl: string }
type KidTeam = { name: string; teamLabel: string; teamId: string; program: string; division: string; isIq: boolean; studentId: string; dropRequested: boolean }

const PROGRAM_LABELS: Record<string, string> = { vex_v5: 'VEX V5', combat: 'Combat', vex_iq: 'VEX IQ', not_sure: 'Not sure', both: 'VEX V5 & Combat' }
const DIVISION_LABELS: Record<string, string> = { ES: 'Elementary', MS: 'Middle school', HS: 'High school' }
const TSHIRT_LABELS: Record<string, string> = { ym: 'Youth Medium', yl: 'Youth Large', xs: 'Adult XS', s: 'Adult Small', m: 'Adult Medium', l: 'Adult Large', xl: 'Adult XL', xxl: 'Adult 2XL', xxxl: 'Adult 3XL' }
const AID_DISPLAY: Record<string, [string, Variant]> = { not_requested: ['Not requested', 'neutral'], pending: ['Requested', 'info'], approved: ['Approved', 'success'], denied: ['Denied', 'error'], withdrawn: ['Withdrawn', 'neutral'] }
const IQ_STATUS: Record<string, [string, Variant]> = { pending_payment: ['Awaiting payment', 'warning'], pending_admin_confirmation: ['In process', 'info'], active: ['Active', 'success'], suspended: ['Suspended', 'error'], pending: ['Pending', 'warning'] }

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { notice } = await searchParams
  const email = user.email ?? 'your account'
  // Any provisioned admin (by role, not just the bootstrap email) gets an entry into
  // the admin area, landing on the home their roles permit (e.g. an IQ coordinator
  // goes straight to IQ Teams).
  const adminAccess = await getAdminAccess()
  const isAdmin = !!adminAccess
  const adminHref = adminAccess ? adminHome(adminAccess.roles, adminAccess.isSuper) : '/admin'

  const { data: guardian } = await supabase.from('guardian').select('id, family_id, first_name, last_name').ilike('login_email', user.email ?? '').maybeSingle()
  const familyLabel = guardian?.last_name ? `${guardian.last_name} Family` : email

  let aidStatus = 'not_requested'
  let fsStatus = ''
  let guardian2: { name: string; email: string } | null = null
  const studentCards: StudentCard[] = []
  const kidTeams: KidTeam[] = []
  // Plain-language lines for the muted "In process at Placer Robotics" group —
  // items no family action can move; deliberately kept out of "What's next".
  const waitingNotes: string[] = []
  let guardianHasSigned = false
  let hasActiveWaivers = false
  let coachTeams: any[] = []
  const teamCount: Record<string, number> = {}
  let zeffyIqUrl: string | null = null
  let zeffyStudentUrl: string | null = null
  let zeffyCavittUrl: string | null = null
  let employerCompany = ''
  let volunteer: { label: string; variant: Variant; apsExpiry: string | null; apsState: 'valid' | 'expiring' | 'expired' | 'none'; bgCheck: boolean; waiver: boolean } | null = null

  if (guardian) {
    const familyId = guardian.family_id

    const { data: fs } = await supabase.from('family_season').select('status').eq('family_id', familyId).eq('season', SEASON).maybeSingle()
    fsStatus = fs?.status ?? ''

    // Zeffy URLs early — the per-student cards below pick a payment link per enrollment.
    const { data: zcfg } = await supabase.from('season_config').select('zeffy_iq_team_url, zeffy_student_url, zeffy_cavitt_url').eq('season', SEASON).maybeSingle()
    zeffyIqUrl = zcfg?.zeffy_iq_team_url ?? null
    zeffyStudentUrl = zcfg?.zeffy_student_url ?? null
    zeffyCavittUrl = zcfg?.zeffy_cavitt_url ?? null

    const { data: aid } = await supabase.from('financial_aid').select('status').eq('family_id', familyId).eq('season', SEASON).order('requested_at', { ascending: false }).limit(1).maybeSingle()
    if (aid) aidStatus = aid.status

    const { data: gAll } = await supabase.from('guardian').select('id, first_name, last_name, login_email, communication_email').eq('family_id', familyId).order('created_at', { ascending: true })
    const g2 = (gAll ?? []).find((g: any) => g.id !== guardian.id)
    guardian2 = g2 ? { name: `${g2.first_name} ${g2.last_name}`.trim(), email: g2.communication_email || g2.login_email || '' } : null

    const { data: studs } = await supabase.from('student').select('id, first_name, last_name, preferred_name, tshirt_size, school_id').eq('family_id', familyId).order('created_at', { ascending: true })
    const students = studs ?? []
    const studentIds = students.map((s: any) => s.id)

    if (studentIds.length) {
      const { data: enrollments } = await supabase.from('enrollment').select('id, student_id, program, registration_fee_amount, registration_fee_status, waiver_status, submitted_at, fundraising_methods, fundraising_target, fundraising_received_at').eq('season', SEASON).in('student_id', studentIds)
      const { data: apps } = await supabase.from('student_application').select('student_id, program_interest, application_status, triage_notes, reviewed_at').eq('season', SEASON).in('student_id', studentIds)
      const { data: sigs } = await supabase.from('waiver_signature').select('student_id').eq('season', SEASON).in('student_id', studentIds)
      const { data: tms } = await supabase.from('team_member').select('student_id, team_id').eq('season', SEASON).eq('team_role', 'student').is('revoked_at', null).in('student_id', studentIds)
      const { data: ecs } = await supabase.from('emergency_contact').select('student_id, first_name, last_name, phone').eq('priority', 1).in('student_id', studentIds)
      const { data: pays } = await supabase.from('payment_transaction').select('enrollment_id, amount, received_at, matched_status, raw_payload').eq('family_id', familyId).eq('season', SEASON).eq('payment_type', 'registration_fee')

      // School fee tiers (Cavitt partnership) — picks the fee + Zeffy campaign per student.
      const schoolIds = [...new Set(students.map((s: any) => s.school_id).filter(Boolean))]
      const { data: schs } = schoolIds.length ? await supabase.from('school').select('id, fee_tier').in('id', schoolIds) : { data: [] as any[] }
      const tierBySchool: Record<string, string> = Object.fromEntries((schs ?? []).map((x: any) => [x.id, x.fee_tier]))

      const teamIds = [...new Set((tms ?? []).map((t: any) => t.team_id).filter(Boolean))]
      const { data: teams } = teamIds.length ? await supabase.from('team').select('id, team_number, team_name, program, division, is_provisional').in('id', teamIds) : { data: [] as any[] }
      const teamById: Record<string, any> = Object.fromEntries((teams ?? []).map((t: any) => [t.id, t]))

      const enrByStudent: Record<string, any[]> = {}
      for (const e of enrollments ?? []) (enrByStudent[e.student_id] ??= []).push(e)
      const progByStudent: Record<string, string> = Object.fromEntries((apps ?? []).map((a: any) => [a.student_id, a.program_interest]))
      const appStatusByStudent: Record<string, string> = Object.fromEntries((apps ?? []).map((a: any) => [a.student_id, a.application_status]))
      const reviewedByStudent: Record<string, string | null> = Object.fromEntries((apps ?? []).map((a: any) => [a.student_id, a.reviewed_at ?? null]))
      const tnByStudent: Record<string, string> = Object.fromEntries((apps ?? []).map((a: any) => [a.student_id, a.triage_notes ?? '']))
      const signed = new Set((sigs ?? []).map((s: any) => s.student_id))
      const teamByStudent: Record<string, any> = {}
      for (const t of tms ?? []) if (!teamByStudent[t.student_id]) teamByStudent[t.student_id] = teamById[t.team_id]
      const ecByStudent: Record<string, any> = Object.fromEntries((ecs ?? []).map((e: any) => [e.student_id, e]))
      const payByEnrollment: Record<string, any> = Object.fromEntries((pays ?? []).map((p: any) => [p.enrollment_id, p]))
      // Family-level payment signals: a captured-but-unreconciled payment means the
      // family already paid and is waiting on us; needs_review is an admin flag.
      const hasUnreconciledPayment = (pays ?? []).some((p: any) => p.matched_status === 'unmatched')
      const hasFlaggedPayment = (pays ?? []).some((p: any) => p.matched_status === 'needs_review')
      const familyCleared = fsStatus === 'cleared_to_register' || fsStatus === 'registered'

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
        const team = teamByStudent[s.id]
        const hasTeam = !!team
        // See lib/iq-status.ts — isIqKid must never hinge on triage_notes alone
        // (production incident: a desync there showed a still-rostered IQ camper a
        // live V5/Combat payment demand she was never billed for).
        const iq = resolveIqStatus({ triageLabel: iqLabelByStudent[s.id], triageTeamId: iqTeamIdByStudent[s.id], triageDivision: iqDivisionByStudent[s.id], team })
        const { isIqKid, label: iqLabel, teamId: iqTeamId, division: iqDivision } = iq
        const enrs = nonIqEnrollments(enrByStudent[s.id] ?? [])
        const registered = enrs.some((e: any) => e.submitted_at)
        const programVal = enrs.length > 1 ? 'both' : (enrs[0]?.program ?? progByStudent[s.id] ?? 'not_sure')
        const feeStatuses = enrs.map((e: any) => e.registration_fee_status)
        const paid = enrs.length > 0 && !feeStatuses.includes('unpaid')
        const isSigned = signed.has(s.id)
        const ec = ecByStudent[s.id]
        const pay = enrs.map((e: any) => payByEnrollment[e.id]).find(Boolean)
        const level = pay ? supporterLevel(Number(pay.amount)) : null

        const name = `${s.first_name} ${s.last_name}`.trim()

        const st = deriveStudentStatus({
          firstName: s.first_name.trim(),
          isIqKid,
          familyCleared,
          hasApplication: appStatusByStudent[s.id] !== undefined,
          applicationFlagged: appStatusByStudent[s.id] === 'needs_follow_up',
          registered,
          signed: isSigned,
          hasEnrollment: enrs.length > 0,
          feeUnpaid: feeStatuses.includes('unpaid'),
          feeWaived: feeStatuses.includes('waived'),
          waiverFlagged: enrs.some((e: any) => e.waiver_status === 'needs_review'),
          hasTeam,
          teamProvisional: !!team?.is_provisional,
          teamLabel: isIqKid ? (iqLabel as string) : familyTeamLabel(team),
          paymentPendingReconciliation: hasUnreconciledPayment,
          paymentFlagged: hasFlaggedPayment,
          paidLabel: level ? `Paid · ${level}` : 'Paid',
        })
        waitingNotes.push(...st.waitingItems)
        studentCards.push({
          studentId: s.id,
          name,
          program: isIqKid ? 'VEX IQ' : (PROGRAM_LABELS[programVal] ?? programVal),
          complete: st.ready,
          badge: st.badge,
          checks: st.checks,
          attentionNotes: st.attentionItems,
          payTodo: st.familyActions.payment,
          detail: `Emergency contact ${ec ? 'added' : 'missing'} · T-shirt ${s.tshirt_size ? (TSHIRT_LABELS[s.tshirt_size] ?? s.tshirt_size) : 'not set'}`,
          isIqKid,
          registered,
          paid,
          // Wizard still has something for the family to do: register (non-IQ, only once
          // cleared — an under-review application is waiting on us) or sign waivers (IQ).
          needsWizard: isIqKid ? !isSigned : st.familyActions.registration,
          // Per-student fundraising (from the student's enrollment(s)).
          fundMethods: [...new Set(enrs.flatMap((e: any) => (e.fundraising_methods ?? []) as string[]))],
          fundTarget: Math.max(0, ...enrs.map((e: any) => Number(e.fundraising_target) || 0)),
          fundDeadline: fundraisingDeadline(reviewedByStudent[s.id] ?? null),
          fundReceivedAt: (enrs.map((e: any) => e.fundraising_received_at).find(Boolean) ?? null) as string | null,
          // Fee from the enrollment snapshot (set at registration); Cavitt V5-only
          // students pay through the Cavitt campaign so prices are never side-by-side.
          feeAmount: Number(enrs.find((e: any) => Number(e.registration_fee_amount) > 0)?.registration_fee_amount ?? 40),
          payUrl: ((s.school_id && tierBySchool[s.school_id] === 'cavitt' && enrs.length === 1 && enrs[0]?.program === 'vex_v5' ? zeffyCavittUrl || zeffyStudentUrl : zeffyStudentUrl) || ZEFFY_REGISTRATION_URL),
        })

        if (isIqKid && iqTeamId) kidTeams.push({ name, teamLabel: iqLabel as string, teamId: iqTeamId, program: 'VEX IQ', division: iqDivision ?? 'ES', isIq: true, studentId: s.id, dropRequested: String(tnByStudent[s.id] ?? '').includes('drop_requested') })
        else if (hasTeam) kidTeams.push({ name, teamLabel: familyTeamLabel(team), teamId: team.id, program: PROGRAM_LABELS[team.program] ?? team.program, division: team.division, isIq: false, studentId: s.id, dropRequested: false })
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
    const { data: famRow } = await adb.from('family').select('employer_match_company').eq('id', familyId).maybeSingle()
    employerCompany = famRow?.employer_match_company ?? ''
    const { data: coachTms } = await adb.from('team_member').select('team:team_id ( id, team_name, team_number, program, division, status, team_fee_status, team_fee_amount, team_payment_reference_code, is_provisional )').eq('guardian_id', guardian.id).eq('season', SEASON).eq('team_role', 'coach').is('revoked_at', null)
    coachTeams = (coachTms ?? []).map((c: any) => (Array.isArray(c.team) ? c.team[0] : c.team)).filter(Boolean)
    if (coachTeams.length) {
      const ids = coachTeams.map((t: any) => t.id)
      // Distinct students per team across both sources: materialized team_member rows
      // (registered) AND the application pointer (not yet registered). A registered
      // student has BOTH, so dedupe by student_id instead of summing the two counts.
      const memberIds: Record<string, Set<string>> = {}
      const addMember = (tid: string, sid: string | null) => { if (sid) (memberIds[tid] ??= new Set<string>()).add(sid) }
      const { data: rosters } = await adb.from('team_member').select('team_id, student_id').eq('season', SEASON).eq('team_role', 'student').is('revoked_at', null).in('team_id', ids)
      for (const r of rosters ?? []) addMember(r.team_id, r.student_id)
      const { data: iqApps } = await adb.from('student_application').select('student_id, triage_notes').eq('season', SEASON).ilike('triage_notes', '%iq_team:%')
      for (const a of iqApps ?? []) { const m = String(a.triage_notes ?? '').match(/iq_team:([0-9a-f-]{36})/i); if (m && ids.includes(m[1])) addMember(m[1], a.student_id) }
      for (const tid of ids) teamCount[tid] = memberIds[tid]?.size ?? 0
    }

    // Volunteer clearance for the logged-in guardian.
    const { data: vp } = await supabase.from('volunteer_profile').select('id, status').eq('guardian_id', guardian.id).maybeSingle()
    if (vp) {
      // Read clearance/cert/step via service role (some are admin-RLS) scoped to this volunteer.
      const { data: vc } = await adb.from('volunteer_clearance').select('status, waiver_signed_date, rc_quiz_passed, yp_quiz_passed').eq('volunteer_id', vp.id).eq('season', SEASON).maybeSingle()
      const { data: cert } = await adb.from('youth_protection_cert').select('expiration_date').eq('volunteer_id', vp.id).order('expiration_date', { ascending: false }).limit(1).maybeSingle()
      const { data: bg } = await adb.from('volunteer_step').select('status').eq('volunteer_id', vp.id).eq('step', 'background_check').maybeSingle()
      const exp = cert?.expiration_date ?? null
      const today = new Date().toISOString().slice(0, 10)
      const apsState: 'valid' | 'expiring' | 'expired' | 'none' = exp ? (exp >= APS_VALID_THROUGH ? 'valid' : exp >= today ? 'expiring' : 'expired') : 'none'
      const bgCheck = bg?.status === 'complete'
      const waiver = !!vc?.waiver_signed_date
      // Show the same bucket the admin dashboard uses, not the raw clearance status.
      const bucket = volunteerBucket({ profileStatus: vp.status, doj: bgCheck, apsState, rc: !!vc?.rc_quiz_passed, yp: !!vc?.yp_quiz_passed, waiver })
      const meta = VOLUNTEER_BUCKET_META[bucket]
      volunteer = { label: meta.label, variant: meta.variant, apsExpiry: exp, apsState, bgCheck, waiver }
      // A submitted background check being verified is in process at Placer Robotics.
      if (bg?.status === 'in_progress') waitingNotes.push('Your volunteer background check is being verified — nothing needed from you')
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

  // Fundraising display — per-student method(s) (the parent's employer applies when matched).
  const fundLabel = (m: string) => {
    switch (m) {
      case 'direct_donation': return 'Via Zeffy contribution'
      case 'corporate_match': return `Employer match${employerCompany ? ` — ${employerCompany}` : ''}`
      case 'sponsored': return 'Business sponsorship — pending'
      case 'paper_check': return 'Paper check'
      case 'pending': return 'Financial aid — pending review'
      default: return m
    }
  }

  // Team-centric "My teams": one row per team, grouping my kids onto their team and
  // merging with any team I coach (a team can be both).
  type TeamRow = { id: string; label: string; programLabel: string; divisionLabel: string; isIq: boolean; coached: boolean; status?: string; feeStatus?: string; feeAmount?: number; payRef?: string; count: number; kids: { studentId: string; name: string; dropRequested: boolean }[] }
  const teamRowMap: Record<string, TeamRow> = {}
  for (const t of coachTeams) {
    teamRowMap[t.id] = { id: t.id, label: familyTeamLabel(t, 'Team'), programLabel: PROGRAM_LABELS[t.program] ?? t.program, divisionLabel: DIVISION_LABELS[t.division] ?? t.division, isIq: t.program === 'vex_iq', coached: true, status: t.status, feeStatus: t.team_fee_status ?? undefined, feeAmount: t.team_fee_amount != null ? Number(t.team_fee_amount) : undefined, payRef: t.team_payment_reference_code ?? undefined, count: teamCount[t.id] ?? 0, kids: [] }
  }
  for (const k of kidTeams) {
    const row = (teamRowMap[k.teamId] ??= { id: k.teamId, label: k.teamLabel, programLabel: k.program, divisionLabel: DIVISION_LABELS[k.division] ?? k.division, isIq: k.isIq, coached: false, count: 0, kids: [] })
    row.kids.push({ studentId: k.studentId, name: k.name, dropRequested: k.dropRequested })
  }
  const coachedTeams = Object.values(teamRowMap).filter((t) => t.coached)
  const kidOnlyTeams = Object.values(teamRowMap).filter((t) => !t.coached)

  // Consolidated to-do — every outstanding action across all kids + the parent, in one list.
  type Todo = { label: string; cta: string; href?: string; external?: string }
  const todos: Todo[] = []
  for (const c of studentCards) {
    const fn = c.name.split(' ')[0]
    if (c.needsWizard) todos.push({ label: `Finish registration for ${fn}`, cta: 'Continue', href: `/register?student=${c.studentId}` })
    // payTodo excludes payments that are processing or admin-flagged — those are
    // waiting on Placer Robotics and must not read as a family to-do.
    else if (!c.isIqKid && c.payTodo) todos.push({ label: c.fundReceivedAt ? `Pay ${fn}’s $${c.feeAmount} registration fee` : `Pay ${fn}’s $${c.feeAmount} fee + $${c.fundTarget || 550} fundraising commitment (due ${c.fundDeadline})`, cta: 'Pay via Zeffy', external: c.payUrl })
  }
  // IQ coach — get your team registered: build the roster (3+ members), pay the
  // $1,200 fee, then the IQ Coordinator approves it. Each open step is its own to-do.
  for (const t of coachedTeams) {
    if (!t.isIq) continue
    if (t.status !== 'active' && t.count < 3) {
      const need = 3 - t.count
      todos.push({ label: `Add your ${t.label} roster — ${t.count === 0 ? 'add your team members' : `${need} more member${need === 1 ? '' : 's'}`} (3+ needed)`, cta: 'Set up team', href: `/iq/team/${t.id}` })
    }
    if (t.feeStatus !== 'paid' && t.feeStatus !== 'not_applicable') {
      todos.push({ label: `Pay your VEX IQ team fee — $${(t.feeAmount || 1200).toLocaleString()}${t.payRef ? ` (ref ${t.payRef})` : ''}`, cta: 'Pay via Zeffy', external: zeffyIqUrl ?? undefined, href: zeffyIqUrl ? undefined : '/dashboard' })
    }
    if (t.status !== 'active' && t.count >= 3 && (t.feeStatus === 'paid' || t.feeStatus === 'not_applicable')) {
      todos.push({ label: `${t.label} is awaiting IQ Coordinator approval`, cta: 'View team', href: `/iq/team/${t.id}` })
    }
  }
  if (showSignPrompt) todos.push({ label: 'Sign your family agreements', cta: 'Review & sign', href: '/waivers' })
  if (volunteer && (volunteer.apsState === 'expired' || volunteer.apsState === 'expiring')) {
    todos.push({ label: `Renew your Abuse Prevention (APS) — ${volunteer.apsState === 'expired' ? 'expired' : 'expiring soon'}`, cta: 'View', href: '/volunteer' })
  }

  const panel: React.CSSProperties = { backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden' }
  const rowFlex: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.875rem 1.25rem' }
  const smallLink: React.CSSProperties = { fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-navy-deep)' }
  const subhead: React.CSSProperties = { fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)', fontWeight: 700, margin: '0 0 0.5rem' }
  const sectionTitle: React.CSSProperties = { margin: '0 0 0.75rem' }
  const section: React.CSSProperties = { marginTop: '2rem' }

  return (
    <FamilyShell familyName={familyLabel} maxWidth="lg">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        {isAdmin ? <Link href={adminHref} style={smallLink}>Admin dashboard →</Link> : <span />}
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

      {/* WHAT'S NEXT — one consolidated to-do across all kids */}
      {todos.length > 0 ? (
        <section style={{ marginBottom: '0.5rem' }}>
          <div style={panel}>
            <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-navy-deep)' }}>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.9375rem' }}>What’s next · {todos.length} {todos.length === 1 ? 'item' : 'items'}</span>
            </div>
            {todos.map((t, i) => (
              <div key={i} style={{ ...rowFlex, borderBottom: i < todos.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                <span style={{ fontSize: '0.9375rem' }}>{t.label}</span>
                {t.external
                  ? <a href={t.external} target="_blank" rel="noopener noreferrer" style={{ ...smallLink, color: 'var(--color-gold-dark)', whiteSpace: 'nowrap' }}>{t.cta} →</a>
                  : <Link href={t.href!} style={{ ...smallLink, color: 'var(--color-gold-dark)', whiteSpace: 'nowrap' }}>{t.cta} →</Link>}
              </div>
            ))}
          </div>
        </section>
      ) : studentCards.length > 0 && fullyComplete ? (
        <div style={{ marginBottom: '0.5rem' }}><SuccessAlert title="You're all set">Every student is registered, signed, paid, and on a team for {SEASON}.</SuccessAlert></div>
      ) : null}

      {/* IN PROCESS AT PLACER ROBOTICS — items no family action can move. Muted on
          purpose: visually and verbally distinct from the "What's next" to-dos. */}
      {waitingNotes.length > 0 && (
        <section style={{ marginTop: '0.875rem', marginBottom: '0.5rem' }}>
          <div style={{ ...panel, backgroundColor: 'var(--color-bg-light)' }}>
            <div style={{ padding: '0.625rem 1.25rem', borderBottom: '1px solid var(--color-border)' }}>
              <span style={{ color: 'var(--color-text-muted)', fontWeight: 700, fontSize: '0.8125rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>In process at Placer Robotics</span>
              <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem', marginLeft: '0.5rem' }}>— nothing needed from you</span>
            </div>
            {waitingNotes.map((n, i) => (
              <div key={i} style={{ display: 'flex', gap: '0.625rem', alignItems: 'baseline', padding: '0.625rem 1.25rem', borderBottom: i < waitingNotes.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                <span aria-hidden style={{ color: 'var(--color-text-muted)' }}>◷</span>
                <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>{n}</span>
              </div>
            ))}
          </div>
        </section>
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
                <StatusBadge label={BADGE_META[card.badge].label} variant={BADGE_META[card.badge].variant} />
              </div>
              {/* Admin-flagged exception — plain language with a help path. */}
              {card.attentionNotes.length > 0 && (
                <div style={{ marginBottom: '0.75rem', backgroundColor: 'rgba(198,40,40,0.06)', border: '1px solid rgba(198,40,40,0.25)', borderRadius: 8, padding: '0.75rem 0.875rem' }}>
                  {card.attentionNotes.map((n, i) => (
                    <div key={i} style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)', marginBottom: 2 }}>{n}</div>
                  ))}
                  <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                    We&apos;ll reach out, or you can email <a href="mailto:registrar@placerrobotics.org" style={{ fontWeight: 600, color: 'var(--color-navy-deep)' }}>registrar@placerrobotics.org</a> — happy to help.
                  </div>
                </div>
              )}
              {card.needsWizard && (
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: '0 0 0.625rem' }}>
                  {card.isIqKid ? `Sign the waivers to finish ${card.name.split(' ')[0]}’s setup.` : `Complete these steps to secure ${card.name.split(' ')[0]}’s spot:`}
                </p>
              )}
              <div className="student-checks" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
                {card.checks.map((c, i) => (
                  <div key={c.cap} style={{ textAlign: 'center', padding: '0.5rem 0.375rem', border: '1px solid var(--color-border)', borderRadius: 8 }}>
                    <div style={{ fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--color-text-muted)', marginBottom: 3 }}>{i + 1} · {c.cap}</div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: CHECK_META[c.state].color }}>{CHECK_META[c.state].glyph} {c.val}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                <span>{card.detail}</span>
                <span style={{ display: 'flex', gap: '0.875rem' }}>
                  {card.needsWizard && <Link href={`/register?student=${card.studentId}`} style={{ ...smallLink, color: 'var(--color-gold-dark)' }}>Continue registration →</Link>}
                  <Link href={`/dashboard/edit#student-${card.studentId}`} style={smallLink}>Edit {card.name.split(' ')[0]}’s details</Link>
                </span>
              </div>

              {/* Payment callout (non-IQ) — fee is the $40 registration fee (Part 4). */}
              {!card.isIqKid && card.registered && card.payTodo && fsStatus === 'registered' && (
                <div style={{ marginTop: '0.75rem', backgroundColor: '#FFF8E6', border: '1px solid var(--color-gold)', borderRadius: 8, padding: '0.75rem 0.875rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#8a6d1a' }}>Registration fee not yet received</div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: 2 }}>Pay the ${card.feeAmount} registration fee via Zeffy to secure {card.name}’s spot.</div>
                  <a href={card.payUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: '0.5rem', padding: '7px 14px', backgroundColor: 'var(--color-gold)', color: 'var(--color-navy-darker)', fontWeight: 700, fontSize: '0.8125rem', borderRadius: 6, textDecoration: 'none' }}>Pay Now via Zeffy →</a>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>Already paid? It can take up to a day to show here — please don’t pay again.</div>
                </div>
              )}
              {/* Fundraising commitment — per student. The $40 fee is separate (above). */}
              {!card.isIqKid && card.registered && (
                <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Fundraising commitment{card.fundTarget ? ` · $${card.fundTarget}` : ''}{card.fundReceivedAt ? '' : ` · due ${card.fundDeadline}`}</span>
                  <span style={{ display: 'flex', gap: '0.625rem', alignItems: 'center' }}>
                    {card.fundReceivedAt ? (
                      <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>✓ Received {new Date(card.fundReceivedAt).toLocaleDateString()}</span>
                    ) : (
                      <>
                        <span style={{ color: card.fundMethods.length ? 'var(--color-text-primary)' : '#C9971B', fontWeight: 600 }}>{card.fundMethods.length ? card.fundMethods.map(fundLabel).join(', ') : 'Not selected'}</span>
                        <Link href={`/dashboard/edit#student-${card.studentId}`} style={smallLink}>{card.fundMethods.length ? 'Change' : 'Set'}</Link>
                      </>
                    )}
                  </span>
                </div>
              )}
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
                            <Link href={tm.isIq ? `/iq/team/${tm.id}` : '/coach'} style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--color-navy-deep)' }}>{tm.label}</Link>
                            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>{tm.programLabel} · {tm.divisionLabel} · {tm.count} {tm.count === 1 ? 'student' : 'students'}</div>
                            {tm.isIq && tm.status !== 'active' && (
                              <div style={{ fontSize: '0.8125rem', color: '#C9971B', fontWeight: 600, marginTop: '0.25rem' }}>
                                To register your team: {tm.count < 3 ? 'add your roster (3+), ' : ''}{tm.feeStatus !== 'paid' && tm.feeStatus !== 'not_applicable' ? 'pay the $1,200 fee, ' : ''}then coordinator approval.
                              </div>
                            )}
                          </div>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            {tm.status ? <StatusBadge label={lbl} variant={variant} /> : null}
                            {tm.isIq && tm.feeStatus === 'paid' && <StatusBadge label="Paid" variant="success" />}
                            {tm.isIq && tm.feeStatus === 'not_applicable' && <StatusBadge label="Fee waived" variant="neutral" />}
                            {tm.isIq && tm.feeStatus !== 'paid' && tm.feeStatus !== 'not_applicable' && zeffyIqUrl && <Link href={zeffyIqUrl} target="_blank" style={smallLink}>Pay ${(tm.feeAmount || 1200).toLocaleString()} →</Link>}
                            {tm.isIq
                              ? <Link href={`/iq/team/${tm.id}`} style={smallLink}>{tm.status === 'active' ? 'Manage →' : 'Set up team →'}</Link>
                              : <Link href="/coach" style={smallLink}>Coach dashboard →</Link>}
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
                <Link href="/iq/team" style={smallLink}>Set up your team →</Link>
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
            <div style={{ ...rowFlex, borderBottom: volunteer ? '1px solid var(--color-border)' : 'none' }}>
              <span style={{ fontSize: '0.9375rem', fontWeight: 500 }}>Registered Volunteer status</span>
              {volunteer
                ? <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}><StatusBadge label={volunteer.label} variant={volunteer.variant} /><Link href="/volunteer" style={smallLink}>View →</Link></span>
                : <Link href="/volunteer/apply" style={smallLink}>Become a Registered Volunteer →</Link>}
            </div>
            {volunteer && (() => {
              const aps = apsDisplay(volunteer.apsState, volunteer.apsExpiry)
              return (
                <>
                  <div style={{ ...rowFlex, borderBottom: '1px solid var(--color-border)' }}>
                    <span style={{ fontSize: '0.9375rem', fontWeight: 500 }}>Abuse Prevention (APS)</span>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: aps.color }}>{aps.text}</span>
                  </div>
                  <div style={{ ...rowFlex, borderBottom: '1px solid var(--color-border)' }}>
                    <span style={{ fontSize: '0.9375rem', fontWeight: 500 }}>Background check</span>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: volunteer.bgCheck ? 'var(--color-success)' : '#C9971B' }}>{volunteer.bgCheck ? '✓ Complete' : '✗ Not complete'}</span>
                  </div>
                  <div style={rowFlex}>
                    <span style={{ fontSize: '0.9375rem', fontWeight: 500 }}>Volunteer waiver</span>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: volunteer.waiver ? 'var(--color-success)' : '#C9971B' }}>{volunteer.waiver ? '✓ Signed' : '✗ Not signed'}</span>
                  </div>
                </>
              )
            })()}
          </div>
        </section>
      )}

      {/* LAB CALENDAR & EVENTS */}
      <section style={section}>
        <h2 className="text-section-title" style={sectionTitle}>Lab calendar &amp; events</h2>
        <div style={panel}>
          <div style={{ ...rowFlex, borderBottom: '1px solid var(--color-border)' }}>
            <span style={{ fontSize: '0.9375rem', fontWeight: 500 }}>Lab hours, practices &amp; camps</span>
            <Link href="/calendar" style={smallLink}>View calendar →</Link>
          </div>
          <div style={rowFlex}>
            <span style={{ fontSize: '0.9375rem', fontWeight: 500 }}>Competition events we’re attending</span>
            <a href="https://placerrobotics.org/events" target="_blank" rel="noopener noreferrer" style={smallLink}>placerrobotics.org/events →</a>
          </div>
        </div>
      </section>

      {/* RESOURCES */}
      {(() => {
        const hasV5 = studentCards.some((c) => /v5/i.test(c.program))
        const hasCombat = studentCards.some((c) => /combat/i.test(c.program))
        const hasIq = studentCards.some((c) => c.isIqKid)
        const res = [
          { label: 'Parent Handbook', href: RES_HANDBOOK, show: true },
          { label: 'IQ Parent Handbook — Addendum A', href: RES_IQ_ADDENDUM, show: hasIq },
          { label: 'V5 Members Drive', href: RES_V5_DRIVE, show: hasV5 || !studentCards.length },
          { label: 'Combat Members Drive', href: RES_COMBAT_DRIVE, show: hasCombat || !studentCards.length },
          { label: 'Join our Slack (V5 & Combat)', href: SLACK_MAIN, show: !!SLACK_MAIN && (hasV5 || hasCombat || !studentCards.length) },
          { label: 'Join the VEX IQ Slack', href: SLACK_IQ, show: !!SLACK_IQ && hasIq },
        ].filter((r): r is { label: string; href: string; show: boolean } => r.show && !!r.href)
        return (
          <section style={section}>
            <h2 className="text-section-title" style={sectionTitle}>Resources</h2>
            <div style={panel}>
              {res.map((r, i) => (
                <div key={r.href} style={{ ...rowFlex, borderBottom: i < res.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                  <span style={{ fontSize: '0.9375rem', fontWeight: 500 }}>{r.label}</span>
                  <a href={r.href} target="_blank" rel="noopener noreferrer" style={smallLink}>Open →</a>
                </div>
              ))}
            </div>
          </section>
        )
      })()}

      {/* MY HOUSEHOLD */}
      {guardian && (
        <section style={section}>
          <h2 className="text-section-title" style={sectionTitle}>My household</h2>
          <div style={panel}>
            <div style={{ ...rowFlex, borderBottom: FEATURE_FINANCIAL_AID ? '1px solid var(--color-border)' : 'none' }}>
              <span style={{ fontSize: '0.9375rem', fontWeight: 500 }}>Second guardian</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>{guardian2 ? `${guardian2.name}${guardian2.email ? ` · ${guardian2.email}` : ''}` : 'Not added'}</span>
                <Link href="/dashboard/edit" style={smallLink}>{guardian2 ? 'Edit' : 'Add'}</Link>
              </span>
            </div>
            {/* Financial aid — hidden from families behind FEATURE_FINANCIAL_AID (admin views unaffected). */}
            {FEATURE_FINANCIAL_AID && (
            <div style={rowFlex}>
              <span style={{ fontSize: '0.9375rem', fontWeight: 500 }}>Financial aid</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <StatusBadge label={aidLabel} variant={aidVariant} />
                {aidStatus === 'not_requested' && <Link href="/financial-aid" style={smallLink}>Request</Link>}
              </span>
            </div>
            )}
          </div>
        </section>
      )}
    </FamilyShell>
  )
}
