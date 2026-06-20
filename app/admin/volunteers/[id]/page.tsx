import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminShell, PageHeader, AdminDetailPanel, StatusBadge } from '@/components/ui'

const STEP_LABELS: Record<string, string> = {
  policy_acknowledgment: 'Policy Acknowledgment',
  background_check: 'Background Check',
  aps_youth_protection: 'APS Youth Protection',
  youth_protection_quiz: 'Youth Protection Quiz',
  lab_use_quiz: 'Lab Use Quiz',
  lab_orientation: 'Lab Orientation',
  custom: 'Additional requirement',
}

const STEP_VARIANT: Record<string, 'success' | 'warning' | 'error' | 'info' | 'neutral'> = {
  complete: 'success',
  in_progress: 'info',
  pending: 'neutral',
  waived: 'neutral',
}

const VOL_VARIANT: Record<string, 'success' | 'warning' | 'error' | 'info' | 'neutral'> = {
  pending: 'warning',
  in_progress: 'info',
  cleared: 'success',
  expired: 'warning',
  suspended: 'error',
  withdrawn: 'neutral',
}

const smallBtn: React.CSSProperties = {
  padding: '6px 14px',
  backgroundColor: 'var(--color-navy-deep)',
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  fontWeight: 600,
  fontSize: '0.8125rem',
  cursor: 'pointer',
  fontFamily: 'inherit',
}
const goldBtn: React.CSSProperties = {
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

export default async function VolunteerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: vp } = await supabase
    .from('volunteer_profile')
    .select(
      '*, guardian:guardian_id ( first_name, last_name, login_email, phone ), family:family_id ( primary_email )'
    )
    .eq('id', id)
    .maybeSingle()

  if (!vp) {
    return (
      <AdminShell activePath="/admin/volunteers">
        <PageHeader
          title="Volunteer not found"
          breadcrumb={[{ label: 'Volunteers', href: '/admin/volunteers' }, { label: 'Not found' }]}
        />
      </AdminShell>
    )
  }

  const { data: steps } = await supabase
    .from('volunteer_step')
    .select('id, step, status, completed_at, sort_order')
    .eq('volunteer_id', id)
    .order('sort_order', { ascending: true })

  const allComplete = (steps ?? []).length > 0 && (steps ?? []).every((s: any) => s.status === 'complete')
  const guardian = vp.guardian
  const volunteerName = guardian ? `${guardian.first_name} ${guardian.last_name}` : 'Unknown volunteer'

  // ---- Server actions ----
  async function markStepComplete(formData: FormData) {
    'use server'
    const stepId = String(formData.get('stepId') ?? '')
    if (!stepId) return
    const db = await createClient()
    await db
      .from('volunteer_step')
      .update({ status: 'complete', completed_at: new Date().toISOString() })
      .eq('id', stepId)
    redirect(`/admin/volunteers/${id}`)
  }

  async function clearVolunteer() {
    'use server'
    const db = await createClient()
    await db
      .from('volunteer_profile')
      .update({ status: 'cleared', cleared_at: new Date().toISOString() })
      .eq('id', id)
    redirect(`/admin/volunteers/${id}`)
  }

  const fields = [
    { label: 'Volunteer', value: volunteerName },
    { label: 'Email', value: guardian?.login_email ?? '—' },
    { label: 'Phone', value: guardian?.phone ?? '—' },
    {
      label: 'Status',
      value: <StatusBadge label={vp.status} variant={VOL_VARIANT[vp.status] ?? 'neutral'} />,
    },
  ]

  return (
    <AdminShell activePath="/admin/volunteers">
      <PageHeader
        title="Volunteer review"
        subtitle={volunteerName}
        breadcrumb={[{ label: 'Volunteers', href: '/admin/volunteers' }, { label: 'Review' }]}
      />

      <AdminDetailPanel title="Volunteer details" fields={fields}>
        <h3 className="text-card-title" style={{ marginBottom: '0.875rem' }}>Clearance steps</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
          {(steps ?? []).map((s: any) => (
            <div
              key={s.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
                padding: '0.75rem 1rem',
                border: '1px solid var(--color-border)',
                borderRadius: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.9375rem', fontWeight: 500 }}>{STEP_LABELS[s.step] ?? s.step}</span>
                <StatusBadge label={s.status} variant={STEP_VARIANT[s.status] ?? 'neutral'} />
              </div>
              {s.status !== 'complete' && (
                <form action={markStepComplete}>
                  <input type="hidden" name="stepId" value={s.id} />
                  <button type="submit" style={smallBtn}>Mark complete</button>
                </form>
              )}
            </div>
          ))}
          {(steps ?? []).length === 0 && <p className="text-help" style={{ margin: 0 }}>No clearance steps on this profile.</p>}
        </div>

        <div style={{ paddingTop: '1.25rem', borderTop: '1px solid var(--color-border)' }}>
          {vp.status === 'cleared' ? (
            <p style={{ margin: 0, fontSize: '0.9375rem', color: 'var(--color-success)', fontWeight: 600 }}>
              ✓ This volunteer is cleared.
            </p>
          ) : (
            <form action={clearVolunteer}>
              <button type="submit" style={goldBtn}>Mark volunteer cleared</button>
              {!allComplete && (
                <p className="text-help" style={{ marginTop: '0.5rem' }}>
                  Note: not all steps are marked complete yet.
                </p>
              )}
            </form>
          )}
        </div>
      </AdminDetailPanel>
    </AdminShell>
  )
}
