import { createClient } from '@/lib/supabase/server'
import { AdminShell, PageHeader } from '@/components/ui'
import NeedsAttentionQueue, { type Queue } from './needs-attention-queue'

const SEASON = '2026-27'

export default async function AdminHomePage() {
  const supabase = await createClient()
  const n = async (q: any) => ((await q).count ?? 0) as number

  const [apps, aid, unpaid, payments, syncFailures] = await Promise.all([
    n(
      supabase
        .from('student_application')
        .select('*', { count: 'exact', head: true })
        .eq('season', SEASON)
        .eq('status', 'submitted')
    ),
    n(
      supabase
        .from('financial_aid')
        .select('*', { count: 'exact', head: true })
        .eq('season', SEASON)
        .eq('status', 'pending')
    ),
    n(
      supabase
        .from('enrollment')
        .select('*', { count: 'exact', head: true })
        .eq('season', SEASON)
        .eq('registration_fee_status', 'unpaid')
        .not('submitted_at', 'is', null)
    ),
    n(
      supabase
        .from('payment_transaction')
        .select('*', { count: 'exact', head: true })
        .eq('matched_status', 'unmatched')
    ),
    n(supabase.from('sync_log').select('*', { count: 'exact', head: true }).eq('success', false)),
  ])

  const items: Queue[] = [
    { id: 'applications', primary: 'Applications to review', secondary: 'New applicants awaiting a decision', count: apps, href: '/admin/applications', variant: 'info' },
    { id: 'aid', primary: 'Financial aid requests', secondary: 'Need approval before registration', count: aid, href: '/admin/financial-aid', variant: 'warning' },
    { id: 'unpaid', primary: 'Registrations unpaid', secondary: 'Spots not yet secured by payment', count: unpaid, href: '/admin/registrations', variant: 'warning' },
    { id: 'payments', primary: 'Unmatched payments', secondary: 'Payments without a matching enrollment', count: payments, href: '/admin/payments', variant: 'error' },
    { id: 'sync', primary: 'Sync failures', secondary: 'Records out of sync with the source system', count: syncFailures, href: '/admin/sync', variant: 'error' },
  ]

  return (
    <AdminShell activePath="/admin">
      <PageHeader title="Needs Attention" subtitle="Queues that require a staff decision today." />
      <NeedsAttentionQueue items={items} />
    </AdminShell>
  )
}
