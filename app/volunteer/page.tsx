import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { FamilyShell, PageHeader, EmptyState, InfoAlert } from '@/components/ui'
import { getCurrentVolunteer, VOLUNTEER_SEASON, APS_VALID_THROUGH } from '@/lib/volunteer'

type Tone = 'complete' | 'warn' | 'pending'
const DOT: Record<Tone, string> = { complete: 'var(--color-success)', warn: '#C9971B', pending: 'var(--color-error)' }
const ICON: Record<Tone, string> = { complete: '✓', warn: '!', pending: '○' }

function Row({ tone, label, detail, action }: { tone: Tone; label: string; detail: string; action?: { label: string; href: string } }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem', padding: '0.875rem 0', borderBottom: '1px solid var(--color-border)' }}>
      <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: '50%', background: DOT[tone], color: '#fff', fontSize: 13, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>{ICON[tone]}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{label}</div>
        <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{detail}</div>
      </div>
      {action && (
        <Link href={action.href} style={{ flexShrink: 0, fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-navy-deep)', background: 'var(--color-gold)', padding: '7px 14px', borderRadius: 6, textDecoration: 'none' }}>{action.label}</Link>
      )}
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
  const [{ data: clearance }, { data: cert }, { data: bgStep }, { data: teamRows }] = await Promise.all([
    db.from('volunteer_clearance').select('*').eq('volunteer_id', vol.profileId).eq('season', VOLUNTEER_SEASON).maybeSingle(),
    db.from('youth_protection_cert').select('expiration_date, cert_url').eq('volunteer_id', vol.profileId).order('expiration_date', { ascending: false }).limit(1).maybeSingle(),
    db.from('volunteer_step').select('status').eq('volunteer_id', vol.profileId).eq('step', 'background_check').maybeSingle(),
    db.from('team_member').select('team_role, team:team_id(team_name, team_number, program)').eq('guardian_id', vol.guardianId).is('revoked_at', null),
  ])

  // APS status.
  let apsTone: Tone = 'pending'
  let apsDetail = 'Required — complete CA Mandated Reporter training. Enroll at abusepreventionsystems.com'
  if (cert?.expiration_date) {
    if (cert.expiration_date >= APS_VALID_THROUGH) { apsTone = 'complete'; apsDetail = `Valid through ${cert.expiration_date}.` }
    else { apsTone = 'warn'; apsDetail = `Renewal required — expires ${cert.expiration_date} (must be valid through ${APS_VALID_THROUGH}). Renew at abusepreventionsystems.com` }
  }

  const dojDone = bgStep?.status === 'complete'
  const rc = clearance?.rc_quiz_passed
  const yp = clearance?.yp_quiz_passed
  const waiver = !!clearance?.waiver_signed_date
  const teams = (teamRows ?? []).map((t: any) => (Array.isArray(t.team) ? t.team[0] : t.team)).filter(Boolean)

  return (
    <FamilyShell familyName={vol.name || vol.email} maxWidth="md">
      <PageHeader title="Volunteer Portal" subtitle={`Registered Volunteer clearance · ${VOLUNTEER_SEASON}`} />

      <div style={{ marginBottom: '1.5rem' }}>
        <InfoAlert title={`Status: ${(clearance?.status ?? vol.status).replace(/_/g, ' ')}`}>
          Complete each step below to be cleared for the season. Both quizzes and the annual waiver must be renewed each season.
        </InfoAlert>
      </div>

      <div style={{ border: '1px solid var(--color-border)', borderRadius: 10, padding: '0.5rem 1.25rem 1rem' }}>
        <h3 style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', margin: '1rem 0 0.25rem' }}>Clearance checklist</h3>
        <Row tone={'complete'} label="Application" detail={clearance?.application_submitted_at ? `Submitted ${new Date(clearance.application_submitted_at).toLocaleDateString()}` : 'On file'} />
        <Row tone={dojDone ? 'complete' : 'pending'} label="DOJ Background Check" detail={dojDone ? 'Cleared' : 'Required (one-time) — coordinated with the registrar.'} />
        <Row tone={apsTone} label="APS Mandated Reporter Training" detail={apsDetail} />
        <Row tone={rc ? 'complete' : 'pending'} label="Robotics Center Use Quiz" detail={rc ? `Passed ${clearance?.rc_quiz_passed_date ?? ''} · ${clearance?.rc_quiz_score ?? ''}%` : 'Not passed this season (90% to pass).'} action={rc ? undefined : { label: 'Take Quiz', href: '/volunteer/quiz/rc' }} />
        <Row tone={yp ? 'complete' : 'pending'} label="Youth Protection Quiz" detail={yp ? `Passed ${clearance?.yp_quiz_passed_date ?? ''} · ${clearance?.yp_quiz_score ?? ''}%` : 'Not passed this season (90% to pass).'} action={yp ? undefined : { label: 'Take Quiz', href: '/volunteer/quiz/yp' }} />
        <Row tone={waiver ? 'complete' : 'pending'} label="Annual Waiver" detail={waiver ? `Signed ${new Date(clearance!.waiver_signed_date).toLocaleDateString()} — ${clearance?.waiver_signature_text ?? ''}` : 'Not signed this season.'} action={waiver ? undefined : { label: 'Sign Waiver', href: '/volunteer/waiver' }} />
        <Row tone={clearance?.key_access_granted ? 'complete' : 'warn'} label="Key Access" detail={clearance?.key_access_granted ? `Granted (${clearance.key_access_type ?? 'card'})` : clearance?.key_access_requested && clearance.key_access_requested !== 'none' ? `Requested (${clearance.key_access_requested}) — pending admin approval.` : 'No access requested.'} />
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
