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

const inputStyle: React.CSSProperties = { padding: '6px 9px', fontSize: '0.8125rem', border: '1.5px solid var(--color-border)', borderRadius: '6px', fontFamily: 'inherit', backgroundColor: 'var(--color-surface)', width: '140px' }
const goldBtn: React.CSSProperties = { padding: '6px 14px', backgroundColor: 'var(--color-gold)', color: 'var(--color-navy-darker)', border: 'none', borderRadius: '6px', fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'inherit' }
const dangerBtn: React.CSSProperties = { padding: '6px 14px', backgroundColor: 'var(--color-error)', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'inherit' }

export default async function FinancialAidPage() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('financial_aid')
    .select('id, family_id, status, requested_at, need_description, registration_fee_waiver_requested, family:family_id ( primary_email ), application:student_application_id ( student:student_id ( first_name, last_name ) )')
    .eq('season', SEASON)
    .order('requested_at', { ascending: false })
  const rows = (data ?? []) as any[]

  async function approve(formData: FormData) {
    'use server'
    const id = String(formData.get('id') ?? '')
    const familyId = String(formData.get('familyId') ?? '')
    if (!id || !familyId) return
    const waiveFee = formData.get('waiveFee') === 'on'
    const adjStr = String(formData.get('adjustedTarget') ?? '').trim()
    const adjustedTarget = adjStr ? Number(adjStr) : 0
    const now = new Date().toISOString()
    const db = await createClient()

    await db
      .from('financial_aid')
      .update({
        status: 'approved',
        resolution_type: adjustedTarget > 0 ? 'partial_waiver' : 'full_waiver',
        adjusted_fundraising_target: adjustedTarget,
        registration_fee_waived: waiveFee,
        registration_fee_waiver_at: waiveFee ? now : null,
        resolved_at: now,
      })
      .eq('id', id)

    // Apply to any existing enrollment(s) for this family + season.
    const update: Record<string, unknown> = {
      fundraising_target: adjustedTarget,
      fundraising_status: adjustedTarget <= 0 ? 'waived' : 'partial',
    }
    if (waiveFee) update.registration_fee_status = 'waived'
    await db.from('enrollment').update(update).eq('family_id', familyId).eq('season', SEASON)

    redirect('/admin/financial-aid')
  }

  async function deny(formData: FormData) {
    'use server'
    const id = String(formData.get('id') ?? '')
    if (!id) return
    const db = await createClient()
    await db
      .from('financial_aid')
      .update({ status: 'denied', resolution_type: 'denied', resolved_at: new Date().toISOString() })
      .eq('id', id)
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {rows.map((r) => {
            const stu = r.application?.student
            const name = stu ? `${stu.first_name} ${stu.last_name}` : r.family?.primary_email ?? 'Unknown'
            return (
              <div key={r.id} style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                  <div>
                    <div style={{ fontSize: '0.9375rem', fontWeight: 500 }}>{name}</div>
                    <div className="text-help">{r.family?.primary_email ?? '—'}{r.registration_fee_waiver_requested ? ' · fee waiver requested' : ''}</div>
                    {r.need_description && <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: '0.5rem 0 0', maxWidth: '46rem', lineHeight: 1.5 }}>{r.need_description}</p>}
                  </div>
                  <StatusBadge label={r.status} variant={STATUS_VARIANT[r.status] ?? 'neutral'} />
                </div>

                {r.status === 'pending' && (
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)' }}>
                    <form action={approve} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="familyId" value={r.family_id} />
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem' }}>
                        <input type="checkbox" name="waiveFee" defaultChecked={!!r.registration_fee_waiver_requested} /> Waive registration fee
                      </label>
                      <label style={{ fontSize: '0.8125rem' }}>
                        <span style={{ display: 'block', marginBottom: '0.2rem' }}>Adjusted fundraising target ($)</span>
                        <input name="adjustedTarget" type="number" step="0.01" min="0" placeholder="0 = full waiver" style={inputStyle} />
                      </label>
                      <button type="submit" style={goldBtn}>Approve</button>
                    </form>
                    <form action={deny}>
                      <input type="hidden" name="id" value={r.id} />
                      <button type="submit" style={dangerBtn}>Deny</button>
                    </form>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </AdminShell>
  )
}
