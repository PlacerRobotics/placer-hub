import { createClient } from '@/lib/supabase/server'
import { AdminShell, PageHeader } from '@/components/ui'
import PaymentRecordForm from './payment-record-form'
import UnmatchedQueue, { type UnmatchedPayment } from './unmatched-queue'
import ZeffySync from './zeffy-sync'

export default async function AdminPaymentsPage() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('payment_transaction')
    .select(
      'id, amount, source, payment_type, received_at, source_payment_id, payment_reference_code, family:family_id ( display_name, primary_email )'
    )
    .eq('matched_status', 'unmatched')
    .order('received_at', { ascending: false })

  const items: UnmatchedPayment[] = (data ?? []).map((p: any) => ({
    id: p.id,
    family: p.family?.display_name ?? p.family?.primary_email ?? 'Unknown',
    amount: Number(p.amount),
    source: p.source,
    date: p.received_at,
    checkNumber: p.source === 'check' ? p.source_payment_id ?? null : null,
  }))

  return (
    <AdminShell activePath="/admin/payments">
      <PageHeader title="Payments" subtitle="Record manual payments and match unmatched ones." />

      <h2 className="text-section-title" style={{ margin: '0 0 1rem' }}>Sync from Zeffy</h2>
      <ZeffySync />

      <h2 className="text-section-title" style={{ margin: '2.5rem 0 1rem' }}>Record a payment</h2>
      <PaymentRecordForm />

      <h2 className="text-section-title" style={{ margin: '2.5rem 0 1rem' }}>Unmatched payments</h2>
      {error ? (
        <p style={{ color: 'var(--color-error)' }}>Couldn’t load payments: {error.message}</p>
      ) : (
        <UnmatchedQueue items={items} />
      )}
    </AdminShell>
  )
}
