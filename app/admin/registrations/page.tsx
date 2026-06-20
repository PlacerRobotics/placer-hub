import { createClient } from '@/lib/supabase/server'
import { AdminShell, PageHeader, StatusBadge, EmptyState } from '@/components/ui'
import RosterDownload from './roster-download'

const SEASON = '2026-27'

const PROGRAM_LABELS: Record<string, string> = {
  vex_v5: 'VEX V5',
  combat: 'Combat',
  vex_iq: 'VEX IQ',
  not_sure: 'Not sure',
}

const FEE_VARIANT: Record<string, 'success' | 'warning' | 'neutral'> = {
  paid: 'success',
  unpaid: 'warning',
  waived: 'neutral',
}

export default async function AdminRegistrationsPage() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('enrollment')
    .select(
      'id, program, payment_reference_code, registration_fee_status, submitted_at, student:student_id ( first_name, last_name, grade )'
    )
    .eq('season', SEASON)
    .not('submitted_at', 'is', null)
    .order('submitted_at', { ascending: false })

  const rows = (data ?? []) as any[]

  return (
    <AdminShell activePath="/admin/registrations">
      <PageHeader
        title="Registrations"
        subtitle={`Confirmed registrations for the ${SEASON} season.`}
        actions={<RosterDownload />}
      />

      {error ? (
        <p style={{ color: 'var(--color-error)' }}>Couldn’t load registrations: {error.message}</p>
      ) : rows.length === 0 ? (
        <EmptyState
          title="No confirmed registrations yet"
          description="Students appear here once families complete the registration wizard. You can still download an (empty) roster."
        />
      ) : (
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '10px',
            overflow: 'hidden',
          }}
        >
          {rows.map((r, i) => {
            const stu = r.student ?? {}
            return (
              <div
                key={r.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  padding: '0.875rem 1.25rem',
                  borderBottom: i < rows.length - 1 ? '1px solid var(--color-border)' : 'none',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.9375rem', fontWeight: 500 }}>
                    {stu.first_name} {stu.last_name}
                  </div>
                  <div className="text-help">
                    Grade {stu.grade ?? '—'} · {PROGRAM_LABELS[r.program] ?? r.program} ·{' '}
                    {r.payment_reference_code}
                  </div>
                </div>
                <StatusBadge
                  label={r.registration_fee_status}
                  variant={FEE_VARIANT[r.registration_fee_status] ?? 'neutral'}
                />
              </div>
            )
          })}
        </div>
      )}
    </AdminShell>
  )
}
