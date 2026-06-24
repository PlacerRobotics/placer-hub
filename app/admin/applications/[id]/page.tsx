import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, applicationAcceptedHtml, sendMagicLinkEmail } from '@/lib/email'
import { AdminShell, PageHeader, AdminDetailPanel, StatusBadge } from '@/components/ui'

const SEASON = '2026-27'

const PROGRAM_LABELS: Record<string, string> = {
  vex_v5: 'VEX V5 Robotics',
  combat: 'Combat Robotics',
  both: 'VEX V5 & Combat',
  vex_iq: 'VEX IQ Robotics',
  not_sure: 'Not sure',
}

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'error' | 'info' | 'neutral'> = {
  submitted: 'info',
  accepted: 'success',
  declined: 'error',
  needs_follow_up: 'warning',
  program_pending: 'warning',
  withdrawn: 'neutral',
  admin_waived: 'neutral',
}

const FS_VARIANT: Record<string, 'success' | 'warning' | 'error' | 'info' | 'neutral'> = {
  prospect: 'neutral',
  applied: 'info',
  accepted: 'success',
  cleared_to_register: 'success',
  registered: 'success',
  declined: 'error',
  suspended: 'error',
}

const acceptBtn: React.CSSProperties = {
  padding: '10px 20px',
  backgroundColor: 'var(--color-gold)',
  color: 'var(--color-navy-darker)',
  border: 'none',
  borderRadius: '6px',
  fontWeight: 600,
  fontSize: '0.9375rem',
  cursor: 'pointer',
  fontFamily: 'inherit',
  minHeight: '44px',
}
const navyBtn: React.CSSProperties = { ...acceptBtn, backgroundColor: 'var(--color-navy-deep)', color: '#fff' }
const dangerBtn: React.CSSProperties = { ...acceptBtn, backgroundColor: 'var(--color-error)', color: '#fff', alignSelf: 'flex-start' }

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: app } = await supabase
    .from('student_application')
    .select(
      '*, student:student_id ( first_name, last_name, grade, school_raw, school:school_id ( name ) ), family:family_id ( id, primary_email )'
    )
    .eq('id', id)
    .maybeSingle()

  if (!app) {
    return (
      <AdminShell activePath="/admin/applications">
        <PageHeader
          title="Application not found"
          breadcrumb={[{ label: 'Applications', href: '/admin/applications' }, { label: 'Not found' }]}
        />
      </AdminShell>
    )
  }

  const familyId: string = app.family_id
  const student = app.student
  const studentName = student ? `${student.first_name} ${student.last_name}` : 'Unknown applicant'

  const { data: familySeason } = await supabase
    .from('family_season')
    .select('status')
    .eq('family_id', familyId)
    .eq('season', SEASON)
    .maybeSingle()
  const fsStatus: string = familySeason?.status ?? 'prospect'
  const isCleared = fsStatus === 'cleared_to_register' || fsStatus === 'registered'

  // ---- Server actions ----
  async function acceptApplication() {
    'use server'
    const db = await createClient()
    await db
      .from('student_application')
      .update({ status: 'accepted', reviewed_at: new Date().toISOString() })
      .eq('id', id)
    await db
      .from('family_season')
      .upsert({ family_id: familyId, season: SEASON, status: 'accepted' }, { onConflict: 'family_id,season' })
    // Notify the family (best-effort; no-ops if email isn't configured).
    try {
      const adb = createAdminClient()
      const { data: g } = await adb.from('guardian').select('first_name, login_email').eq('family_id', familyId).eq('role', 'primary').maybeSingle()
      const { data: a } = await adb.from('student_application').select('student:student_id ( first_name, last_name )').eq('id', id).maybeSingle()
      const s: any = a?.student ? (Array.isArray(a.student) ? a.student[0] : a.student) : null
      if (g?.login_email) {
        await sendEmail({
          to: [g.login_email],
          subject: `Application accepted — Placer Robotics ${SEASON}`,
          html: applicationAcceptedHtml({ guardianName: g.first_name ?? '', studentName: s ? `${s.first_name} ${s.last_name}`.trim() : 'your student', season: SEASON }),
        })
      }
    } catch (e) { console.error('[accept] email failed:', e) }
    redirect(`/admin/applications/${id}`)
  }

  async function declineApplication(formData: FormData) {
    'use server'
    const reason = String(formData.get('reason') ?? '').trim()
    if (!reason) return
    const db = await createClient()
    await db
      .from('student_application')
      .update({ status: 'declined', review_notes: reason, reviewed_at: new Date().toISOString() })
      .eq('id', id)
    redirect('/admin/applications')
  }

  async function clearToRegister() {
    'use server'
    const db = await createClient()
    await db
      .from('family_season')
      .upsert(
        { family_id: familyId, season: SEASON, status: 'cleared_to_register' },
        { onConflict: 'family_id,season' }
      )
    // Notify the family with a sign-in link (best-effort).
    try {
      const adb = createAdminClient()
      const { data: g } = await adb.from('guardian').select('first_name, login_email').eq('family_id', familyId).eq('role', 'primary').maybeSingle()
      if (g?.login_email) {
        await sendMagicLinkEmail({
          email: g.login_email,
          redirectPath: '/register',
          subject: `You're cleared to register — Placer Robotics ${SEASON}`,
          heading: 'You’re cleared to register',
          intro: `Hi ${g.first_name ?? 'there'}, you're cleared to register for the ${SEASON} Placer Robotics season. Click below to sign in and complete your student's registration — details, waivers, and payment.`,
          buttonLabel: 'Sign in to register →',
          preheader: `You're cleared to register for the ${SEASON} season.`,
        })
        await adb.from('family_season').update({ magic_link_sent: true }).eq('family_id', familyId).eq('season', SEASON)
      }
    } catch (e) { console.error('[clear] email failed:', e) }
    redirect(`/admin/applications/${id}`)
  }

  const fields = [
    { label: 'Student', value: studentName },
    { label: 'Grade', value: student?.grade ?? '—' },
    { label: 'Program interest', value: PROGRAM_LABELS[app.program_interest] ?? app.program_interest },
    { label: 'School', value: student?.school?.name ?? student?.school_raw ?? '—' },
    { label: 'Family email', value: app.family?.primary_email ?? '—' },
    { label: 'Source', value: app.source },
    {
      label: 'Application status',
      value: <StatusBadge label={app.status} variant={STATUS_VARIANT[app.status] ?? 'neutral'} />,
    },
    {
      label: 'Family season',
      value: <StatusBadge label={fsStatus} variant={FS_VARIANT[fsStatus] ?? 'neutral'} />,
    },
    {
      label: 'Submitted',
      value: app.submitted_at ? new Date(app.submitted_at).toLocaleString() : '—',
    },
  ]

  return (
    <AdminShell activePath="/admin/applications">
      <PageHeader
        title="Application review"
        subtitle={studentName}
        breadcrumb={[{ label: 'Applications', href: '/admin/applications' }, { label: 'Review' }]}
      />

      <AdminDetailPanel title="Application details" fields={fields}>
        {app.status === 'submitted' ? (
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <form action={acceptApplication}>
              <button type="submit" style={acceptBtn}>Accept</button>
            </form>
            <form action={declineApplication} style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', flex: 1, minWidth: '260px' }}>
              <textarea
                name="reason"
                required
                placeholder="Reason for declining (required)"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  fontSize: '0.9375rem',
                  color: 'var(--color-text-primary)',
                  backgroundColor: 'var(--color-surface)',
                  border: '1.5px solid var(--color-border)',
                  borderRadius: '6px',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  minHeight: '80px',
                  boxSizing: 'border-box',
                }}
              />
              <button type="submit" style={dangerBtn}>Decline</button>
            </form>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p className="text-help" style={{ margin: 0 }}>
              This application has been {app.status}.
            </p>
            {app.status === 'accepted' && !isCleared && (
              <div>
                <form action={clearToRegister}>
                  <button type="submit" style={navyBtn}>Clear family to register</button>
                </form>
                <p className="text-help" style={{ marginTop: '0.5rem' }}>
                  This opens the registration wizard for the family (sets the family to{' '}
                  <code>cleared_to_register</code>).
                </p>
              </div>
            )}
            {isCleared && (
              <p style={{ margin: 0, fontSize: '0.9375rem', color: 'var(--color-success)', fontWeight: 600 }}>
                ✓ Family is cleared to register.
              </p>
            )}
          </div>
        )}
      </AdminDetailPanel>
    </AdminShell>
  )
}
