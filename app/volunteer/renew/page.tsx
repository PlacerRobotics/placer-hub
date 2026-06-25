import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { FamilyShell, PageHeader, InfoAlert, SuccessAlert } from '@/components/ui'
import { getCurrentVolunteer, VOLUNTEER_SEASON, APS_VALID_THROUGH } from '@/lib/volunteer'

const input: React.CSSProperties = { width: '100%', maxWidth: 320, padding: '9px 12px', fontSize: '0.9375rem', border: '1.5px solid var(--color-border)', borderRadius: 6, fontFamily: 'inherit', boxSizing: 'border-box', backgroundColor: 'var(--color-surface)' }
const btn: React.CSSProperties = { padding: '9px 18px', backgroundColor: 'var(--color-navy-deep)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit' }
const card: React.CSSProperties = { border: '1px solid var(--color-border)', borderRadius: 10, padding: '1.25rem 1.5rem', marginBottom: '1.25rem' }
const h3: React.CSSProperties = { fontSize: '1rem', fontWeight: 700, margin: '0 0 0.5rem' }

function StepBadge({ ok }: { ok: boolean }) {
  return <span style={{ fontSize: '0.75rem', fontWeight: 700, color: ok ? 'var(--color-success)' : '#C9971B' }}>{ok ? '✓ Done' : 'Action needed'}</span>
}

export default async function VolunteerRenewPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const vol = await getCurrentVolunteer()
  if (!vol) redirect('/volunteer')

  const db = createAdminClient()
  const [{ data: clearance }, { data: cert }, { data: guardian }, { data: bgStep }] = await Promise.all([
    db.from('volunteer_clearance').select('*').eq('volunteer_id', vol.profileId).eq('season', VOLUNTEER_SEASON).maybeSingle(),
    db.from('youth_protection_cert').select('expiration_date').eq('volunteer_id', vol.profileId).order('expiration_date', { ascending: false }).limit(1).maybeSingle(),
    db.from('guardian').select('phone').eq('id', vol.guardianId).maybeSingle(),
    db.from('volunteer_step').select('status').eq('volunteer_id', vol.profileId).eq('step', 'background_check').maybeSingle(),
  ])

  const apsValid = !!cert?.expiration_date && cert.expiration_date >= APS_VALID_THROUGH
  const rc = !!clearance?.rc_quiz_passed
  const yp = !!clearance?.yp_quiz_passed
  const waiver = !!clearance?.waiver_signed_date
  const doj = bgStep?.status === 'complete'
  const allDone = apsValid && rc && yp && waiver

  // ---- Server actions (volunteer edits their own record) ----
  async function savePhone(formData: FormData) {
    'use server'
    const v = await getCurrentVolunteer(); if (!v) return
    await createAdminClient().from('guardian').update({ phone: String(formData.get('phone') ?? '').trim() }).eq('id', v.guardianId)
    redirect('/volunteer/renew')
  }
  return (
    <FamilyShell familyName={vol.name || vol.email} maxWidth="md">
      <PageHeader title="Renew your volunteer status" subtitle={`Registered Volunteer renewal · ${VOLUNTEER_SEASON}`} />

      {allDone ? (
        <div style={{ marginBottom: '1.25rem' }}><SuccessAlert title="You're all set for the season">Your APS certificate, both quizzes, and the annual waiver are complete. Thank you for volunteering!</SuccessAlert></div>
      ) : (
        <div style={{ marginBottom: '1.25rem' }}><InfoAlert title="A few steps to renew">Both quizzes and the annual waiver must be completed each season. Finish the items marked “Action needed” below.</InfoAlert></div>
      )}

      {/* Step 1 — confirm info */}
      <div style={card}>
        <h3 style={h3}>1. Confirm your info</h3>
        <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>{vol.name} · {vol.email}</div>
        <form action={savePhone} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input name="phone" defaultValue={guardian?.phone ?? ''} placeholder="Phone" style={input} />
          <button style={btn}>Save</button>
        </form>
      </div>

      {/* Step 2 — APS */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><h3 style={h3}>2. APS Mandated Reporter training</h3><StepBadge ok={apsValid} /></div>
        {apsValid ? (
          <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>Valid through {cert!.expiration_date}. Nothing to do.</div>
        ) : (
          <>
            <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '0.625rem' }}>
              {cert?.expiration_date ? `Your certificate expires ${cert.expiration_date}` : 'No certificate on file'} — it must be valid through {APS_VALID_THROUGH}. Renew the course at <a href="https://safetysystem.abusepreventionsystems.com/training_assignments/overview/california" target="_blank" rel="noreferrer" style={{ color: 'var(--color-navy-deep)', fontWeight: 600 }}>APS (CA Mandated Reporter)</a>, then record your new expiry on the <Link href="/volunteer" style={{ color: 'var(--color-navy-deep)', fontWeight: 600 }}>Volunteer Portal</Link>.
            </div>
            <div style={{ fontSize: '0.8125rem', color: '#C9971B', fontWeight: 600 }}>Your APS training status is pending admin verification. You may complete the other renewal steps now.</div>
          </>
        )}
      </div>

      {/* Step 3 — quizzes */}
      <div style={card}>
        <h3 style={h3}>3. Annual quizzes (90% to pass)</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.9375rem' }}>Robotics Center Use Quiz</span>
            {rc ? <StepBadge ok /> : <Link href="/volunteer/quiz/rc" style={{ ...btn, textDecoration: 'none' }}>Take quiz</Link>}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.9375rem' }}>Youth Protection Quiz</span>
            {yp ? <StepBadge ok /> : <Link href="/volunteer/quiz/yp" style={{ ...btn, textDecoration: 'none' }}>Take quiz</Link>}
          </div>
        </div>
      </div>

      {/* Step 4 — waiver */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><h3 style={h3}>4. Annual waiver</h3><StepBadge ok={waiver} /></div>
        {waiver ? (
          <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>Signed — {clearance?.waiver_signature_text}.</div>
        ) : (
          <>
            <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '0.625rem' }}>
              Review and sign the full Placer Robotics Youth Protection &amp; Abuse Prevention Agreement for the {VOLUNTEER_SEASON} season. Your signed copy (name, date, and version) is retained on file.
            </div>
            <Link href="/volunteer/waiver" style={{ ...btn, textDecoration: 'none' }}>Read &amp; sign the agreement →</Link>
          </>
        )}
      </div>

      {!doj && <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>Note: your one-time DOJ background check is coordinated with the registrar.</div>}
      <Link href="/volunteer" style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-navy-deep)' }}>← Back to portal</Link>
    </FamilyShell>
  )
}
