import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminShell, PageHeader, StatusBadge, EmptyState } from '@/components/ui'

const SEASON = '2026-27'
const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'error' | 'neutral'> = {
  pending: 'warning',
  approved: 'success',
  denied: 'error',
  withdrawn: 'neutral',
}

const btn = (bg: string, fg: string): React.CSSProperties => ({
  padding: '6px 14px', backgroundColor: bg, color: fg, border: 'none', borderRadius: '6px',
  fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'inherit',
})

export default async function FinancialAidPage() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('financial_aid')
    .select(
      'id, status, requested_at, registration_fee_waiver_requested, family:family_id ( primary_email ), application:student_application_id ( student:student_id ( first_name, last_name ) )'
    )
    .eq('season', SEASON)
    .order('requested_at', { ascending: false })
  const rows = (data ?? []) as any[]

  async function decide(formData: FormData) {
    'use server'
    const id = String(formData.get('id') ?? '')
    const decision = String(formData.get('decision') ?? '')
    if (!id || !['approved', 'denied'].includes(decision)) return
    const db = await createClient()
    await db.from('financial_aid').update({ status: decision, resolved_at: new Date().toISOString() }).eq('id', id)
    redirect('/admin/financial-aid')
  }

  return (
    <AdminShell activePath="/admin/financial-aid">
      <PageHeader title="Financial Aid" subtitle="Confidential — visible only to financial aid admins and super admins." />
      {error ? (
        <p style={{ color: 'var(--color-error)' }}>Couldn’t load: {error.message}</p>
      ) : rows.length === 0 ? (
        <EmptyState title="No financial aid requests" description="Need-based aid requests appear here for review." />
      ) : (
        <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', overflow: 'hidden' }}>
          {rows.map((r, i) => {
            const stu = r.application?.student
            const name = stu ? `${stu.first_name} ${stu.last_name}` : r.family?.primary_email ?? 'Unknown'
            return (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.875rem 1.25rem', borderBottom: i < rows.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                <div>
                  <div style={{ fontSize: '0.9375rem', fontWeight: 500 }}>{name}</div>
                  <div className="text-help">
                    {r.family?.primary_email ?? '—'}
                    {r.registration_fee_waiver_requested ? ' · fee waiver requested' : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <StatusBadge label={r.status} variant={STATUS_VARIANT[r.status] ?? 'neutral'} />
                  {r.status === 'pending' && (
                    <>
                      <form action={decide}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="decision" value="approved" /><button type="submit" style={btn('var(--color-gold)', 'var(--color-navy-darker)')}>Approve</button></form>
                      <form action={decide}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="decision" value="denied" /><button type="submit" style={btn('var(--color-error)', '#fff')}>Deny</button></form>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </AdminShell>
  )
}
