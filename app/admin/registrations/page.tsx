import { createClient } from '@/lib/supabase/server'
import { AdminShell, PageHeader, StatusBadge, EmptyState } from '@/components/ui'
import RosterDownload from './roster-download'

const SEASON = '2026-27'

const PROGRAM_LABELS: Record<string, string> = {
  vex_v5: 'VEX V5',
  combat: 'Combat',
  both: 'VEX V5 & Combat',
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

  // Cleared-to-register students who have NOT completed registration yet (no
  // enrollment) — this is where imported applicants live until their family
  // finishes the registration wizard.
  const { data: clearedFs } = await supabase
    .from('family_season')
    .select('family_id')
    .eq('season', SEASON)
    .eq('status', 'cleared_to_register')
  const clearedFamilyIds = (clearedFs ?? []).map((f: any) => f.family_id)

  let pending: any[] = []
  if (clearedFamilyIds.length) {
    const { data: studs } = await supabase
      .from('student')
      .select('id, first_name, last_name, grade')
      .in('family_id', clearedFamilyIds)
    const studentIds = (studs ?? []).map((s: any) => s.id)
    const { data: enr } = await supabase.from('enrollment').select('student_id').eq('season', SEASON)
    const enrolledIds = new Set((enr ?? []).map((e: any) => e.student_id))
    const { data: apps } = studentIds.length
      ? await supabase
          .from('student_application')
          .select('student_id, program_interest')
          .eq('season', SEASON)
          .in('student_id', studentIds)
      : { data: [] as any[] }
    const progByStudent: Record<string, string> = Object.fromEntries(
      (apps ?? []).map((a: any) => [a.student_id, a.program_interest])
    )
    pending = (studs ?? [])
      .filter((s: any) => !enrolledIds.has(s.id))
      .map((s: any) => ({ ...s, program: progByStudent[s.id] ?? '—' }))
  }

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

      {pending.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h2 className="text-section-title" style={{ marginBottom: '0.375rem' }}>
            Cleared — awaiting registration <span className="text-help">({pending.length})</span>
          </h2>
          <p className="text-help" style={{ marginBottom: '0.875rem' }}>
            Imported / cleared students who haven’t completed the registration wizard yet.
          </p>
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '10px',
              overflow: 'hidden',
            }}
          >
            {pending.map((s, i) => (
              <div
                key={s.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  padding: '0.875rem 1.25rem',
                  borderBottom: i < pending.length - 1 ? '1px solid var(--color-border)' : 'none',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.9375rem', fontWeight: 500 }}>
                    {s.first_name} {s.last_name}
                  </div>
                  <div className="text-help">
                    Grade {s.grade ?? '—'} · {PROGRAM_LABELS[s.program] ?? s.program}
                  </div>
                </div>
                <StatusBadge label="cleared" variant="info" />
              </div>
            ))}
          </div>
        </div>
      )}
    </AdminShell>
  )
}
