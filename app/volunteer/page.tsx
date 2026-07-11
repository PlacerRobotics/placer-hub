import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { FamilyShell, PageHeader, EmptyState, InfoAlert } from '@/components/ui'
import { getCurrentVolunteer, VOLUNTEER_SEASON, APS_VALID_THROUGH } from '@/lib/volunteer'
import { volunteerBucket, VOLUNTEER_BUCKET_META, stepDisplay, seasonalStepStatus, type StepDisplay } from '@/lib/volunteer-buckets'
import { OWNER_LABELS } from '@/lib/dashboard-status'

// 'pending' = the volunteer must act; 'waiting' = in process at Placer Robotics
// (submitted / being verified — never the same red dot as not-started);
// 'attention' = admin-flagged exception with a contact path.
type Tone = 'complete' | 'warn' | 'pending' | 'waiting' | 'attention'
const DOT: Record<Tone, string> = { complete: 'var(--color-success)', warn: '#C9971B', pending: 'var(--color-error)', waiting: 'var(--color-info, #1E40AF)', attention: 'var(--color-error)' }
const ICON: Record<Tone, string> = { complete: '✓', warn: '!', pending: '○', waiting: '◷', attention: '!' }
const TONE_OF: Record<StepDisplay, Tone> = { complete: 'complete', action: 'pending', waiting: 'waiting', attention: 'attention' }

// Shared plain-language help path for admin-flagged rows — no internal terms.
const Contact = () => (
  <>We&apos;ll reach out, or you can email <a href="mailto:registrar@placerrobotics.org" style={{ fontWeight: 600, color: 'var(--color-navy-deep)' }}>registrar@placerrobotics.org</a> — happy to help.</>
)

const APS_SIGN_IN = 'https://safetysystem.abusepreventionsystems.com/auth/sign_in'
const APS_TRAINING = 'https://safetysystem.abusepreventionsystems.com/training_assignments/overview/california'

type Action = { label: string; href: string; external?: boolean; variant?: 'primary' | 'link' }

function ActionEl({ a }: { a: Action }) {
  const style: React.CSSProperties = a.variant === 'link'
    ? { fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-navy-deep)', textDecoration: 'none', whiteSpace: 'nowrap' }
    : { fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-navy-deep)', background: 'var(--color-gold)', padding: '7px 14px', borderRadius: 6, textDecoration: 'none', whiteSpace: 'nowrap' }
  return a.external
    ? <a href={a.href} target="_blank" rel="noopener noreferrer" style={style}>{a.label}</a>
    : <Link href={a.href} style={style}>{a.label}</Link>
}

function Row({ tone, label, detail, actions }: { tone: Tone; label: string; detail: React.ReactNode; actions?: Action[] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem', padding: '0.875rem 0', borderBottom: '1px solid var(--color-border)' }}>
      <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: '50%', background: DOT[tone], color: '#fff', fontSize: 13, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>{ICON[tone]}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{label}</div>
        <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{detail}</div>
      </div>
      {actions?.length ? (
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          {actions.map((a, i) => <ActionEl key={i} a={a} />)}
        </div>
      ) : null}
    </div>
  )
}

export default async function VolunteerPortal() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const vol = await getCurrentVolunteer()
  if (!vol) {
    return (
      <FamilyShell familyName={user.email ?? 'Volunteer'} maxWidth="md">
        <PageHeader title="Volunteer Portal" subtitle="Get cleared to work with students at events and practices." />
        <EmptyState title="You haven’t applied to volunteer yet" description="Volunteer clearance includes a background check, youth-protection training, and two short quizzes." action={{ label: 'Apply to volunteer', href: '/volunteer/apply' }} />
      </FamilyShell>
    )
  }

  const db = createAdminClient()
  const [{ data: clearance }, { data: cert }, { data: stepRows }, { data: teamRows }, { data: apsProfile }] = await Promise.all([
    db.from('volunteer_clearance').select('*').eq('volunteer_id', vol.profileId).eq('season', VOLUNTEER_SEASON).maybeSingle(),
    db.from('youth_protection_cert').select('issued_date, expiration_date, cert_url, aps_cert_id').eq('volunteer_id', vol.profileId).order('expiration_date', { ascending: false }).limit(1).maybeSingle(),
    db.from('volunteer_step').select('step, status').eq('volunteer_id', vol.profileId),
    db.from('team_member').select('team_role, team:team_id(team_name, team_number, program)').eq('guardian_id', vol.guardianId).is('revoked_at', null),
    db.from('volunteer_profile').select('aps_user_id, aps_training_url').eq('id', vol.profileId).maybeSingle(),
  ])
  // step type → status ('pending' not started · 'in_progress' submitted/processing ·
  // 'needs_review' admin flag · 'complete'/'waived' done)
  const steps: Record<string, string> = Object.fromEntries((stepRows ?? []).map((s: any) => [s.step, s.status]))

  // APS: completed date + expiry + a link to the cert and the APS system. Expiry syncs
  // automatically from APS, so there's no manual entry here.
  let apsTone: Tone = 'pending'
  let apsDetail: React.ReactNode
  const apsActions: Action[] = []
  // Enrolled via the APS API (bulk or 1:1 admin enroll) → they have a personal
  // one-click training link; prefer it over the generic self-enroll page.
  const apsEnrolled = !!apsProfile?.aps_user_id
  const trainingUrl = apsProfile?.aps_training_url || APS_TRAINING
  if (cert?.expiration_date) {
    const completed = cert.issued_date ? `Completed ${cert.issued_date} · ` : ''
    if (cert.expiration_date >= APS_VALID_THROUGH) {
      apsTone = 'complete'
      apsDetail = `${completed}Valid through ${cert.expiration_date}.`
    } else {
      apsTone = 'warn'
      apsDetail = apsEnrolled
        ? `${completed}Expires ${cert.expiration_date} — you’ve been enrolled for renewal; complete your training (must be valid through ${APS_VALID_THROUGH}).`
        : `${completed}Expires ${cert.expiration_date} — renewal required (must be valid through ${APS_VALID_THROUGH}).`
      apsActions.push({ label: apsEnrolled ? 'Complete my training' : 'Start training', href: trainingUrl, external: true })
    }
    if (cert.cert_url) apsActions.push({ label: cert.aps_cert_id ? `Cert #${cert.aps_cert_id}` : 'View certificate', href: cert.cert_url, external: true, variant: apsTone === 'complete' ? undefined : 'link' })
    apsActions.push({ label: 'APS system', href: APS_SIGN_IN, external: true, variant: 'link' })
  } else {
    // No cert on file: the cert table is authoritative for completion, so only the
    // submitted / admin-flag signals from the step row apply here.
    const apsDisp = stepDisplay({ done: false, stepStatus: seasonalStepStatus(steps.aps_youth_protection) })
    if (apsDisp === 'waiting') {
      apsTone = 'waiting'
      apsDetail = `Submitted — ${OWNER_LABELS.placer_robotics.toLowerCase()}. We’re verifying your training certificate; nothing needed from you.`
      apsActions.push({ label: 'APS system', href: APS_SIGN_IN, external: true, variant: 'link' })
    } else if (apsDisp === 'attention') {
      apsTone = 'attention'
      apsDetail = <>We need to take another look at your training certificate. <Contact /></>
      apsActions.push({ label: 'APS system', href: APS_SIGN_IN, external: true, variant: 'link' })
    } else if (apsEnrolled) {
      // Enrolled but no completed training this season — direct link, not the
      // generic "required" copy.
      apsDetail = 'You’ve been enrolled — complete your training. Your certificate syncs to the Hub automatically when you finish.'
      apsActions.push({ label: 'Complete my training', href: trainingUrl, external: true })
      apsActions.push({ label: 'APS system', href: APS_SIGN_IN, external: true, variant: 'link' })
    } else {
      apsDetail = 'Required — complete CA Mandated Reporter (AB 506) training. Your expiry syncs automatically from APS once complete.'
      apsActions.push({ label: 'Start training', href: APS_TRAINING, external: true })
      apsActions.push({ label: 'APS system', href: APS_SIGN_IN, external: true, variant: 'link' })
    }
  }

  const dojDone = steps.background_check === 'complete'
  const rc = clearance?.rc_quiz_passed
  const yp = clearance?.yp_quiz_passed
  const waiver = !!clearance?.waiver_signed_date

  // Per-step display: not-started ('pending' → volunteer acts) vs submitted
  // ('in_progress' → waiting on Placer Robotics) vs admin flag ('needs_review').
  // DOJ is one-time so its step status is fully authoritative; the seasonal items
  // (quizzes, agreements) complete only via this season's clearance booleans.
  const dojDisp = stepDisplay({ done: dojDone, stepStatus: steps.background_check })
  const rcDisp = stepDisplay({ done: !!rc, stepStatus: seasonalStepStatus(steps.lab_use_quiz) })
  const ypDisp = stepDisplay({ done: !!yp, stepStatus: seasonalStepStatus(steps.youth_protection_quiz) })
  const waiverDisp = stepDisplay({ done: waiver, stepStatus: seasonalStepStatus(steps.policy_acknowledgment) })
  const teams = (teamRows ?? []).map((t: any) => (Array.isArray(t.team) ? t.team[0] : t.team)).filter(Boolean)

  // Derived bucket — the stored clearance/profile status drifts, so compute it.
  const apsState = cert?.expiration_date
    ? (cert.expiration_date >= APS_VALID_THROUGH ? 'valid' : cert.expiration_date >= new Date().toISOString().slice(0, 10) ? 'expiring' : 'expired')
    : 'none'
  const bucket = volunteerBucket({ profileStatus: vol.status, doj: dojDone, apsState, rc: !!rc, yp: !!yp, waiver })
  const bucketMeta = VOLUNTEER_BUCKET_META[bucket]

  return (
    <FamilyShell familyName={vol.name || vol.email} maxWidth="md">
      <PageHeader title="Volunteer Portal" subtitle={`Registered Volunteer clearance · ${VOLUNTEER_SEASON}`} />

      <div style={{ marginBottom: '1.5rem' }}>
        <InfoAlert title={`Status: ${bucketMeta.label}`}>
          {bucket === 'cleared'
            ? 'You’re cleared for the 2026-27 season — thank you for volunteering! Both quizzes and the annual agreements renew each season.'
            : 'Complete each step below to be cleared for the season. Both quizzes and the annual agreements must be renewed each season.'}
        </InfoAlert>
      </div>

      <div style={{ border: '1px solid var(--color-border)', borderRadius: 10, padding: '0.5rem 1.25rem 1rem' }}>
        <h3 style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', margin: '1rem 0 0.25rem' }}>Clearance checklist</h3>
        <Row tone={'complete'} label="Application" detail={clearance?.application_submitted_at ? `Submitted ${new Date(clearance.application_submitted_at).toLocaleDateString()}` : 'On file'} />
        <Row
          tone={TONE_OF[dojDisp]}
          label="DOJ Background Check"
          detail={
            dojDisp === 'complete' ? 'Cleared'
            : dojDisp === 'waiting' ? 'Submitted — waiting on Placer Robotics. We’re coordinating this with the DOJ; nothing needed from you.'
            : dojDisp === 'attention' ? <>We need to double-check something on your background check. <Contact /></>
            : 'Required (one-time) — please start; the registrar will coordinate it with you.'
          }
        />
        <Row tone={apsTone} label="APS Mandated Reporter Training" detail={apsDetail} actions={apsActions} />
        <Row
          tone={TONE_OF[rcDisp]}
          label="Robotics Center Use Quiz"
          detail={
            rcDisp === 'complete' ? `Passed ${clearance?.rc_quiz_passed_date ?? ''}${clearance?.rc_quiz_score != null ? ` · ${clearance.rc_quiz_score}%` : ''}`
            : rcDisp === 'waiting' ? 'Submitted — waiting on Placer Robotics to verify your result.'
            : rcDisp === 'attention' ? <>We need to take another look at your quiz result. <Contact /></>
            : 'Not passed this season (90% to pass).'
          }
          actions={rcDisp === 'action' ? [{ label: 'Take Quiz', href: '/volunteer/quiz/rc' }] : undefined}
        />
        <Row
          tone={TONE_OF[ypDisp]}
          label="Youth Protection Quiz"
          detail={
            ypDisp === 'complete' ? `Passed ${clearance?.yp_quiz_passed_date ?? ''}${clearance?.yp_quiz_score != null ? ` · ${clearance.yp_quiz_score}%` : ''}`
            : ypDisp === 'waiting' ? 'Submitted — waiting on Placer Robotics to verify your result.'
            : ypDisp === 'attention' ? <>We need to take another look at your quiz result. <Contact /></>
            : 'Not passed this season (90% to pass).'
          }
          actions={ypDisp === 'action' ? [{ label: 'Take Quiz', href: '/volunteer/quiz/yp' }] : undefined}
        />
        <Row
          tone={TONE_OF[waiverDisp]}
          label="Annual Agreements"
          detail={
            waiverDisp === 'complete' && waiver ? `Signed ${new Date(clearance!.waiver_signed_date).toLocaleDateString()} — ${clearance?.waiver_signature_text ?? ''}`
            : waiverDisp === 'waiting' ? 'Submitted — waiting on Placer Robotics to verify your signatures.'
            : waiverDisp === 'attention' ? <>We need another look at your signed agreements. <Contact /></>
            : 'Release of Liability, Center Use, Youth Protection + volunteer policy — not signed this season.'
          }
          actions={waiverDisp === 'complete' && waiver ? [{ label: 'View signed', href: '/volunteer/agreements' }] : waiverDisp === 'action' ? [{ label: 'Sign', href: '/volunteer/waiver' }] : undefined}
        />
        <Row
          tone={clearance?.key_access_granted ? 'complete' : clearance?.key_access_requested && clearance.key_access_requested !== 'none' ? 'waiting' : 'warn'}
          label="Key Access"
          detail={clearance?.key_access_granted ? `Granted (${clearance.key_access_type ?? 'card'})` : clearance?.key_access_requested && clearance.key_access_requested !== 'none' ? `Requested (${clearance.key_access_requested}) — waiting on Placer Robotics to approve; nothing needed from you.` : 'No access requested.'}
        />
      </div>

      <div style={{ marginTop: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <div style={{ border: '1px solid var(--color-border)', borderRadius: 10, padding: '1rem 1.25rem' }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.5rem' }}>My Teams</h3>
          {teams.length ? teams.map((t: any, i: number) => (
            <div key={i} style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>{t.team_name || 'Team'} {t.team_number ? `· ${t.team_number}` : ''} <span style={{ color: 'var(--color-text-muted)' }}>({t.program})</span></div>
          )) : <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>No team assignments yet.</div>}
        </div>
        <div style={{ border: '1px solid var(--color-border)', borderRadius: 10, padding: '1rem 1.25rem' }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.5rem' }}>Resources</h3>
          <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>Program guides &amp; Drive links are shared via your team channel.</div>
          <div style={{ marginTop: '0.625rem', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>Expense reports — coming soon.</div>
        </div>
      </div>
    </FamilyShell>
  )
}
