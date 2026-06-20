'use client'

import { AdminShell, PageHeader, AdminQueueTable } from '@/components/ui'

const noop = () => {}

export default function AdminPage() {
  return (
    <AdminShell activePath="/admin">
      <PageHeader title="Needs Attention" subtitle="Queues that require a staff decision today." />

      <AdminQueueTable
        title="Open queues"
        count={5}
        items={[
          { id: 'applications', primary: 'Applications to review', secondary: 'New applicants awaiting a decision', status: '12', statusVariant: 'info', onClick: noop },
          { id: 'aid', primary: 'Financial aid requests', secondary: 'Need approval before registration', status: '3', statusVariant: 'warning', onClick: noop },
          { id: 'unpaid', primary: 'Registrations unpaid', secondary: 'Spots not yet secured by payment', status: '8', statusVariant: 'warning', onClick: noop },
          { id: 'payments', primary: 'Unmatched payments', secondary: 'Payments without a matching enrollment', status: '4', statusVariant: 'error', onClick: noop },
          { id: 'sync', primary: 'Sync failures', secondary: 'Records out of sync with the source system', status: '2', statusVariant: 'error', onClick: noop },
        ]}
      />
    </AdminShell>
  )
}
