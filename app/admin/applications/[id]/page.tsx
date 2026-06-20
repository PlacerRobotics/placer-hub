import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminShell, PageHeader, AdminDetailPanel, StatusBadge } from '@/components/ui'

const SEASON = '2026-27'

const PROGRAM_LABELS: Record<string, string> = {
  vex_v5: 'VEX V5 Robotics',
  combat: 'Combat Robotics',
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
      '*, student:student_id ( first_name, last_name, preferred_name, birthdate, communication_email, phone, street_address, city, state, zip_code, grade, school_raw, school:school_id ( name ) ), family:family_id ( id, primary_email )'
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

  // ---- Full application responses (mirrors the apply form field set) ----
  const list = (a: unknown): string => (Array.isArray(a) && a.length ? a.join(', ') : '—')
  const longText = (v: unknown): React.ReactNode =>
    v && String(v).trim() ? <span style={{ whiteSpace: 'pre-wrap' }}>{String(v)}</span> : '—'
  const plain = (v: unknown): string => (v != null && String(v).trim() ? String(v) : '—')
  const addr =
    student?.street_address ||
    [student?.city, student?.state, student?.zip_code].filter(Boolean).join(', ') ||
    '—'

  const contactFields = [
    { label: 'Preferred name', value: plain(student?.preferred_name) },
    { label: 'Date of birth', value: plain(student?.birthdate) },
    { label: 'Student email', value: plain(student?.communication_email) },
    { label: 'Student phone', value: plain(student?.phone) },
    { label: 'Home address', value: addr },
    {
      label: 'Overall GPA',
      value: (
        <>
          {plain(app.gpa_overall)}
          {app.gpa_flagged && (
            <span style={{ marginLeft: 8 }}>
              <StatusBadge label="below threshold" variant="warning" />
            </span>
          )}
        </>
      ),
    },
    { label: 'Recent term GPA', value: plain(app.gpa_recent_term) },
    { label: 'Referral', value: plain(app.referral_source) },
    { label: 'Programs interested', value: list(app.program_interests) },
    { label: 'Previous experience', value: list(app.previous_experience) },
    { label: 'Skills', value: list(app.skills_interest) },
    { label: 'Teammate preference', value: longText(app.teammate_preference) },
  ]

  const responseFields = [
    { label: 'Background', value: longText(app.motivation_background) },
    { label: 'Why join', value: longText(app.motivation_why_join) },
    { label: 'Why competitive', value: longText(app.motivation_why_competitive) },
    { label: 'Season goals', value: longText(app.motivation_goals) },
    { label: 'Commitment / hours', value: longText(app.commitment_level) },
    { label: 'Other extracurriculars', value: longText(app.extracurriculars) },
    { label: 'Hours on those', value: plain(app.extracurricular_hours) },
    { label: 'Summer availability', value: plain(app.summer_availability) },
    { label: 'Anything else', value: longText(app.additional_notes) },
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

      <AdminDetailPanel title="Student contact & profile" fields={contactFields} />
      <AdminDetailPanel title="Application responses" fields={responseFields} />
    </AdminShell>
  )
}
