import { createClient } from '@/lib/supabase/server'
import { requireSection } from '@/lib/auth/admin-access'
import { AdminShell, PageHeader } from '@/components/ui'
import PaymentRecordForm from './payment-record-form'
import UnmatchedQueue, { type UnmatchedPayment } from './unmatched-queue'
import PaymentsTable, { type PaymentRow } from './payments-table'
import ZeffySync from './zeffy-sync'

export default async function AdminPaymentsPage() {
  await requireSection('/admin/payments')
  const supabase = await createClient()

  // Full ledger — every payment, for the segmented per-type view.
  const { data: allData } = await supabase
    .from('payment_transaction')
    .select('id, amount, source, payment_type, matched_status, received_at, deposited_at, source_payment_id, payment_reference_code, donor_name, donor_email, family:family_id ( display_name, primary_email ), team:team_id ( team_name )')
    .order('received_at', { ascending: false })
  const rows: PaymentRow[] = (allData ?? []).map((p: any) => {
    const fam = Array.isArray(p.family) ? p.family[0] : p.family
    const team = Array.isArray(p.team) ? p.team[0] : p.team
    const payer = team ? `${team.team_name || 'IQ team'} (team)` : (fam?.display_name ?? fam?.primary_email ?? p.donor_name ?? p.donor_email ?? '—')
    return { id: p.id, payer, type: p.payment_type, source: p.source, amount: Number(p.amount), date: p.received_at, deposited: p.deposited_at, matched: p.matched_status, ref: p.payment_reference_code ?? p.source_payment_id ?? '' }
  })

  // Unmatched queue (for matching).
  const { data, error } = await supabase
    .from('payment_transaction')
    .select('id, amount, source, payment_type, received_at, source_payment_id, payment_reference_code, family:family_id ( display_name, primary_email )')
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
      <PageHeader title="Payments" subtitle="Registration fees, IQ team fees, fundraising, and sponsorships." />

      <PaymentsTable rows={rows} />

      <h2 className="text-section-title" style={{ margin: '2.5rem 0 1rem' }}>Sync from Zeffy</h2>
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
