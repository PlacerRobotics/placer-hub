import { redirect } from 'next/navigation'
import { sendMagicLinkEmail, sendEmail, apsReminderHtml } from '@/lib/email'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminProfile } from '@/lib/auth/admin'
import { AdminShell, PageHeader, AdminDetailPanel, StatusBadge } from '@/components/ui'
import { APS_VALID_THROUGH } from '@/lib/volunteer'
import { enrollApsTraining } from '@/lib/aps'
import { volunteerBucket, VOLUNTEER_BUCKET_META } from '@/lib/volunteer-buckets'

const SEASON = '2026-27'

const STEP_LABELS: Record<string, string> = {
  policy_acknowledgment: 'Policy Acknowledgment', background_check: 'Background Check', aps_youth_protection: 'APS Youth Protection',
  youth_protection_quiz: 'Youth Protection Quiz', lab_use_quiz: 'Lab Use Quiz', lab_orientation: 'Lab Orientation', custom: 'Additional requirement',
}
const STEP_VARIANT: Record<string, 'success' | 'warning' | 'error' | 'info' | 'neutral'> = { complete: 'success', in_progress: 'info', needs_review: 'warning', pending: 'neutral', waived: 'neutral' }

const smallBtn: React.CSSProperties = { padding: '6px 14px', backgroundColor: 'var(--color-navy-deep)', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'inherit' }
const ghostBtn: React.CSSProperties = { ...smallBtn, backgroundColor: 'transparent', color: 'var(--color-error)', border: '1px solid var(--color-error)' }
const outlineBtn: React.CSSProperties = { ...smallBtn, backgroundColor: 'transparent', color: 'var(--color-navy-deep)', border: '1px solid var(--color-border)' }

async function ensureClearanceId(db: any, volunteerId: string): Promise<string> {
  const found = (await db.from('volunteer_clearance').select('id').eq('volunteer_id', volunteerId).eq('season', SEASON).maybeSingle()).data
  if (found) return found.id
  const { data } = await db.from('volunteer_clearance').insert({ volunteer_id: volunteerId, season: SEASON, status: 'in_progress' }).select('id').single()
  return data.id
}

export default async function VolunteerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: vp } = await supabase
    .from('volunteer_profile')
    .select('*, guardian:guardian_id ( first_name, last_name, login_email, phone )')
    .eq('id', id)
    .maybeSingle()

  if (!vp) {
    return (
      <AdminShell activePath="/admin/volunteers">
        <PageHeader title="Volunteer not found" breadcrumb={[{ label: 'Volunteers', href: '/admin/volunteers' }, { label: 'Not found' }]} />
      </AdminShell>
    )
  }

  const [{ data: steps }, { data: clearance }, { data: cert }, { data: attempts }] = await Promise.all([
    supabase.from('volunteer_step').select('id, step, status, completed_at, sort_order').eq('volunteer_id', id).order('sort_order', { ascending: true }),
    supabase.from('volunteer_clearance').select('*').eq('volunteer_id', id).eq('season', SEASON).maybeSingle(),
    supabase.from('youth_protection_cert').select('expiration_date, cert_url, aps_cert_id').eq('volunteer_id', id).order('expiration_date', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('quiz_attempt').select('quiz_id, score, passed, attempted_at, season').eq('volunteer_id', id).order('attempted_at', { ascending: false }).limit(10),
  ])

  const guardian = vp.guardian
  const volunteerName = guardian ? `${guardian.first_name} ${guardian.last_name}` : 'Unknown volunteer'

  // ---- Server actions (admin-gated) ----
  async function setStepStatus(formData: FormData) {
    'use server'
    if (!(await getAdminProfile())) return
    const stepId = String(formData.get('stepId') ?? '')
    const to = String(formData.get('to') ?? '')
    if (!stepId || !['pending', 'in_progress', 'needs_review', 'complete'].includes(to)) return
    await createAdminClient().from('volunteer_step').update({ status: to, completed_at: to === 'complete' ? new Date().toISOString() : null }).eq('id', stepId)
    redirect(`/admin/volunteers/${id}`)
  }
  async function setAps(formData: FormData) {
    'use server'
    if (!(await getAdminProfile())) return
    const exp = String(formData.get('expiry') ?? '').trim()
    if (!exp) return
    // Admin-verified APS certificate — the only trusted path for cert expiry.
    await createAdminClient().from('youth_protection_cert').insert({ volunteer_id: id, expiration_date: exp, issued_date: exp })
    redirect(`/admin/volunteers/${id}`)
  }
  async function markQuiz(formData: FormData) {
    'use server'
    if (!(await getAdminProfile())) return
    const which = String(formData.get('which') ?? '')
    const db = createAdminClient()
    const cid = await ensureClearanceId(db, id)
    const today = new Date().toISOString().slice(0, 10)
    const patch = which === 'rc' ? { rc_quiz_passed: true, rc_quiz_passed_date: today } : { yp_quiz_passed: true, yp_quiz_passed_date: today }
    await db.from('volunteer_clearance').update(patch).eq('id', cid)
    redirect(`/admin/volunteers/${id}`)
  }
  async function setAccess(formData: FormData) {
    'use server'
    if (!(await getAdminProfile())) return
    const type = String(formData.get('type') ?? '')
    const db = createAdminClient()
    const cid = await ensureClearanceId(db, id)
    if (type === 'revoke') await db.from('volunteer_clearance').update({ key_access_granted: false, key_access_type: 'none' }).eq('id', cid)
    else await db.from('volunteer_clearance').update({ key_access_granted: true, key_access_type: type, key_access_requested: type, key_access_granted_date: new Date().toISOString().slice(0, 10) }).eq('id', cid)
    redirect(`/admin/volunteers/${id}`)
  }
  async function setStatus(formData: FormData) {
    'use server'
    if (!(await getAdminProfile())) return
    const to = String(formData.get('to') ?? '')
    const now = new Date().toISOString()
    const db = createAdminClient()
    const patch: Record<string, unknown> =
      to === 'denied' ? { status: 'denied' }
      : to === 'deactivated' ? { status: 'deactivated' }
      : to === 'cleared' ? { status: 'cleared', cleared_at: now }
      : { status: 'in_progress', suspended_at: null } // reactivate
    await db.from('volunteer_profile').update(patch).eq('id', id)
    // Keep this season's clearance row in sync so other views match.
    await db.from('volunteer_clearance').update({ status: patch.status }).eq('volunteer_id', id).eq('season', SEASON)
    redirect(`/admin/volunteers/${id}`)
  }
  async function sendMagicLink() {
    'use server'
    if (!(await getAdminProfile())) return
    const db = createAdminClient()
    const { data: row } = await db.from('volunteer_profile').select('guardian:guardian_id ( login_email )').eq('id', id).maybeSingle()
    const gg: any = row ? (Array.isArray((row as any).guardian) ? (row as any).guardian[0] : (row as any).guardian) : null
    if (gg?.login_email) {
      await sendMagicLinkEmail({
        email: gg.login_email,
        redirectPath: '/volunteer',
        subject: 'Your volunteer sign-in link — Placer Robotics Hub',
        heading: 'Your sign-in link',
        intro: 'Click below to sign in and continue your Registered Volunteer steps.',
        buttonLabel: 'Sign in to continue →',
        preheader: 'Sign in to continue your volunteer clearance.',
      })
    }
    redirect(`/admin/volunteers/${id}`)
  }
  async function enrollAps() {
    'use server'
    if (!(await getAdminProfile())) return
    const db = createAdminClient()
    const { data: row } = await db.from('volunteer_profile').select('guardian:guardian_id ( first_name, login_email )').eq('id', id).maybeSingle()
    const gg: any = row ? (Array.isArray((row as any).guardian) ? (row as any).guardian[0] : (row as any).guardian) : null
    if (!gg?.login_email) redirect(`/admin/volunteers/${id}`)
    const { data: c } = await db.from('youth_protection_cert').select('expiration_date').eq('volunteer_id', id).order('expiration_date', { ascending: false }).limit(1).maybeSingle()
    const exp = c?.expiration_date ?? ''
    const days = exp ? Math.max(0, Math.round((new Date(exp).getTime() - Date.now()) / 86400000)) : undefined
    // Enroll via the APS API (creates the APS user if needed) → personal training link.
    const apiKey = process.env.APS_API_KEY
    const r = apiKey ? await enrollApsTraining(db, apiKey, id) : { ok: false, url: undefined as string | undefined }
    await sendEmail({ to: [gg.login_email], subject: 'Your APS Mandated Reporter training — Placer Robotics', html: apsReminderHtml({ name: gg.first_name ?? '', expiry: exp, days, enrollUrl: r.url }) })
    redirect(`/admin/volunteers/${id}`)
  }

  const apsCertLink = cert?.aps_cert_id
    ? <> · {cert.cert_url
        ? <a href={cert.cert_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-navy-deep)', fontWeight: 600 }}>Cert #{cert.aps_cert_id}</a>
        : <>Cert #{cert.aps_cert_id}</>}</>
    : null
  const apsLabel: React.ReactNode = cert?.expiration_date
    ? <>{cert.expiration_date >= APS_VALID_THROUGH ? `Valid through ${cert.expiration_date}` : `Expires ${cert.expiration_date} (renew)`}{apsCertLink}</>
    : 'Not on file'
  // Derived bucket (matches the volunteers dashboard) — not the drifting stored status.
  const apsState = cert?.expiration_date
    ? (cert.expiration_date >= APS_VALID_THROUGH ? 'valid' : cert.expiration_date >= new Date().toISOString().slice(0, 10) ? 'expiring' : 'expired')
    : 'none'
  const bucket = volunteerBucket({
    profileStatus: vp.status,
    doj: (steps ?? []).some((s: any) => s.step === 'background_check' && s.status === 'complete'),
    apsState,
    rc: !!clearance?.rc_quiz_passed,
    yp: !!clearance?.yp_quiz_passed,
    waiver: !!clearance?.waiver_signed_date,
  })
  const bucketMeta = VOLUNTEER_BUCKET_META[bucket]
  const fields = [
    { label: 'Volunteer', value: volunteerName },
    { label: 'Email', value: guardian?.login_email ?? '—' },
    { label: 'Phone', value: guardian?.phone ?? '—' },
    { label: 'Status', value: <StatusBadge label={bucketMeta.label} variant={bucketMeta.variant} /> },
  ]

  const ClearRow = ({ label, ok, detail, action }: { label: string; ok: boolean; detail: React.ReactNode; action?: React.ReactNode }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.75rem 1rem', border: '1px solid var(--color-border)', borderRadius: '8px' }}>
      <div><span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{label}</span> <StatusBadge label={ok ? 'done' : 'pending'} variant={ok ? 'success' : 'neutral'} /><div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{detail}</div></div>
      {action}
    </div>
  )

  return (
    <AdminShell activePath="/admin/volunteers">
      <PageHeader title="Volunteer review" subtitle={volunteerName} breadcrumb={[{ label: 'Volunteers', href: '/admin/volunteers' }, { label: 'Review' }]} />

      <AdminDetailPanel title="Volunteer details" fields={fields}>
        <h3 className="text-card-title" style={{ marginBottom: '0.875rem' }}>{SEASON} clearance</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', marginBottom: '1.5rem' }}>
          <ClearRow label="DOJ Background Check" ok={(steps ?? []).some((s: any) => s.step === 'background_check' && s.status === 'complete')} detail="One-time background clearance" />
          <ClearRow label="APS Training" ok={!!cert?.expiration_date && cert.expiration_date >= APS_VALID_THROUGH} detail={apsLabel} action={
            <span style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <form action={enrollAps}><button style={{ ...smallBtn, backgroundColor: 'transparent', color: 'var(--color-navy-deep)', border: '1px solid var(--color-border)' }}>Enroll &amp; email training</button></form>
              <form action={setAps} style={{ display: 'flex', gap: '0.4rem' }}><input type="date" name="expiry" style={{ padding: '5px 8px', fontSize: '0.8125rem', border: '1.5px solid var(--color-border)', borderRadius: 6, fontFamily: 'inherit' }} /><button style={smallBtn}>Set</button></form>
            </span>} />
          <ClearRow label="Robotics Center Quiz" ok={!!clearance?.rc_quiz_passed} detail={clearance?.rc_quiz_passed ? `Passed ${clearance.rc_quiz_passed_date ?? ''}` : 'Not passed this season'} action={!clearance?.rc_quiz_passed ? <form action={markQuiz}><input type="hidden" name="which" value="rc" /><button style={smallBtn}>Mark passed</button></form> : undefined} />
          <ClearRow label="Youth Protection Quiz" ok={!!clearance?.yp_quiz_passed} detail={clearance?.yp_quiz_passed ? `Passed ${clearance.yp_quiz_passed_date ?? ''}` : 'Not passed this season'} action={!clearance?.yp_quiz_passed ? <form action={markQuiz}><input type="hidden" name="which" value="yp" /><button style={smallBtn}>Mark passed</button></form> : undefined} />
          <ClearRow label="Annual Waiver" ok={!!clearance?.waiver_signed_date} detail={clearance?.waiver_signed_date ? `Signed — ${clearance.waiver_signature_text ?? ''}` : 'Not signed this season'} />
          <ClearRow label="Key Access" ok={!!clearance?.key_access_granted} detail={clearance?.key_access_granted ? `Granted (${clearance.key_access_type})` : `Requested: ${clearance?.key_access_requested ?? 'none'}`} action={clearance?.key_access_granted
            ? <form action={setAccess}><input type="hidden" name="type" value="revoke" /><button style={ghostBtn}>Revoke</button></form>
            : <form action={setAccess}><input type="hidden" name="type" value="card" /><button style={smallBtn}>Grant card</button></form>} />
        </div>

        <h3 className="text-card-title" style={{ marginBottom: '0.875rem' }}>Profile steps</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', marginBottom: '1.5rem' }}>
          {(steps ?? []).map((s: any) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.75rem 1rem', border: '1px solid var(--color-border)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}><span style={{ fontSize: '0.9375rem', fontWeight: 500 }}>{STEP_LABELS[s.step] ?? s.step}</span><StatusBadge label={s.status} variant={STEP_VARIANT[s.status] ?? 'neutral'} /></div>
              <span style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {s.status !== 'complete' && s.status !== 'waived' && <form action={setStepStatus}><input type="hidden" name="stepId" value={s.id} /><input type="hidden" name="to" value="complete" /><button type="submit" style={smallBtn}>Mark complete</button></form>}
                {(s.status === 'pending' || s.status === 'needs_review') && <form action={setStepStatus}><input type="hidden" name="stepId" value={s.id} /><input type="hidden" name="to" value="in_progress" /><button type="submit" style={outlineBtn}>Mark submitted</button></form>}
                {(s.status === 'pending' || s.status === 'in_progress') && <form action={setStepStatus}><input type="hidden" name="stepId" value={s.id} /><input type="hidden" name="to" value="needs_review" /><button type="submit" style={outlineBtn}>Flag for attention</button></form>}
                {s.status !== 'pending' && <form action={setStepStatus}><input type="hidden" name="stepId" value={s.id} /><input type="hidden" name="to" value="pending" /><button type="submit" style={outlineBtn}>Reset to pending</button></form>}
              </span>
            </div>
          ))}
          {(steps ?? []).length === 0 && <p className="text-help" style={{ margin: 0 }}>No clearance steps on this profile.</p>}
        </div>

        {attempts && attempts.length > 0 && (
          <>
            <h3 className="text-card-title" style={{ marginBottom: '0.875rem' }}>Quiz attempts</h3>
            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>
              {attempts.map((a: any, i: number) => <div key={i}>{a.season ?? '—'} · {Math.round(Number(a.score) * 100)}% · {a.passed ? 'passed' : 'failed'} · {new Date(a.attempted_at).toLocaleDateString()}</div>)}
            </div>
          </>
        )}

        <div style={{ paddingTop: '1.25rem', borderTop: '1px solid var(--color-border)', display: 'flex', gap: '0.625rem', flexWrap: 'wrap' }}>
          <form action={sendMagicLink}><button style={smallBtn}>Send magic link</button></form>
          {vp.status !== 'cleared' && <form action={setStatus}><input type="hidden" name="to" value="cleared" /><button style={smallBtn}>Mark cleared</button></form>}
          {(vp.status === 'denied' || vp.status === 'deactivated' || vp.status === 'suspended' || vp.status === 'withdrawn')
            ? <form action={setStatus}><input type="hidden" name="to" value="reactivate" /><button style={smallBtn}>Reactivate</button></form>
            : <>
                <form action={setStatus}><input type="hidden" name="to" value="denied" /><button style={ghostBtn}>Deny</button></form>
                <form action={setStatus}><input type="hidden" name="to" value="deactivated" /><button style={ghostBtn}>Deactivate</button></form>
              </>}
        </div>
      </AdminDetailPanel>
    </AdminShell>
  )
}
