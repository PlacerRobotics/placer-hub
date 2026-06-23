import { redirect } from 'next/navigation'
import { createClient as createSupa } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminProfile } from '@/lib/auth/admin'
import { AdminShell, PageHeader, AdminDetailPanel, StatusBadge } from '@/components/ui'
import { APS_VALID_THROUGH } from '@/lib/volunteer'

const SEASON = '2026-27'

const STEP_LABELS: Record<string, string> = {
  policy_acknowledgment: 'Policy Acknowledgment', background_check: 'Background Check', aps_youth_protection: 'APS Youth Protection',
  youth_protection_quiz: 'Youth Protection Quiz', lab_use_quiz: 'Lab Use Quiz', lab_orientation: 'Lab Orientation', custom: 'Additional requirement',
}
const STEP_VARIANT: Record<string, 'success' | 'warning' | 'error' | 'info' | 'neutral'> = { complete: 'success', in_progress: 'info', pending: 'neutral', waived: 'neutral' }
const VOL_VARIANT: Record<string, 'success' | 'warning' | 'error' | 'info' | 'neutral'> = { pending: 'warning', in_progress: 'info', cleared: 'success', expired: 'warning', suspended: 'error', withdrawn: 'neutral' }

const smallBtn: React.CSSProperties = { padding: '6px 14px', backgroundColor: 'var(--color-navy-deep)', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'inherit' }
const ghostBtn: React.CSSProperties = { ...smallBtn, backgroundColor: 'transparent', color: 'var(--color-error)', border: '1px solid var(--color-error)' }

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
    supabase.from('youth_protection_cert').select('expiration_date, cert_url').eq('volunteer_id', id).order('expiration_date', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('quiz_attempt').select('quiz_id, score, passed, attempted_at, season').eq('volunteer_id', id).order('attempted_at', { ascending: false }).limit(10),
  ])

  const guardian = vp.guardian
  const volunteerName = guardian ? `${guardian.first_name} ${guardian.last_name}` : 'Unknown volunteer'

  // ---- Server actions (admin-gated) ----
  async function markStepComplete(formData: FormData) {
    'use server'
    if (!(await getAdminProfile())) return
    const stepId = String(formData.get('stepId') ?? ''); if (!stepId) return
    await createAdminClient().from('volunteer_step').update({ status: 'complete', completed_at: new Date().toISOString() }).eq('id', stepId)
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
    const patch = to === 'suspended' ? { status: 'suspended', suspended_at: new Date().toISOString() } : to === 'cleared' ? { status: 'cleared', cleared_at: new Date().toISOString() } : { status: 'in_progress', suspended_at: null }
    await createAdminClient().from('volunteer_profile').update(patch).eq('id', id)
    redirect(`/admin/volunteers/${id}`)
  }
  async function sendMagicLink() {
    'use server'
    if (!(await getAdminProfile())) return
    const db = createAdminClient()
    const { data: row } = await db.from('volunteer_profile').select('guardian:guardian_id ( login_email )').eq('id', id).maybeSingle()
    const gg: any = row ? (Array.isArray((row as any).guardian) ? (row as any).guardian[0] : (row as any).guardian) : null
    if (gg?.login_email) {
      const sender = createSupa(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
      await sender.auth.signInWithOtp({ email: gg.login_email, options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/api/auth/callback?redirectTo=/volunteer` } })
    }
    redirect(`/admin/volunteers/${id}`)
  }

  const apsLabel = cert?.expiration_date ? (cert.expiration_date >= APS_VALID_THROUGH ? `Valid through ${cert.expiration_date}` : `Expires ${cert.expiration_date} (renew)`) : 'Not on file'
  const fields = [
    { label: 'Volunteer', value: volunteerName },
    { label: 'Email', value: guardian?.login_email ?? '—' },
    { label: 'Phone', value: guardian?.phone ?? '—' },
    { label: 'Status', value: <StatusBadge label={vp.status} variant={VOL_VARIANT[vp.status] ?? 'neutral'} /> },
  ]

  const ClearRow = ({ label, ok, detail, action }: { label: string; ok: boolean; detail: string; action?: React.ReactNode }) => (
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
          <ClearRow label="APS Training" ok={!!cert?.expiration_date && cert.expiration_date >= APS_VALID_THROUGH} detail={apsLabel} action={<form action={setAps} style={{ display: 'flex', gap: '0.4rem' }}><input type="date" name="expiry" style={{ padding: '5px 8px', fontSize: '0.8125rem', border: '1.5px solid var(--color-border)', borderRadius: 6, fontFamily: 'inherit' }} /><button style={smallBtn}>Set</button></form>} />
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
              {s.status !== 'complete' && <form action={markStepComplete}><input type="hidden" name="stepId" value={s.id} /><button type="submit" style={smallBtn}>Mark complete</button></form>}
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
          {vp.status === 'suspended'
            ? <form action={setStatus}><input type="hidden" name="to" value="reinstate" /><button style={smallBtn}>Reinstate</button></form>
            : <form action={setStatus}><input type="hidden" name="to" value="suspended" /><button style={ghostBtn}>Suspend</button></form>}
        </div>
      </AdminDetailPanel>
    </AdminShell>
  )
}
