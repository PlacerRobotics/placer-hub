'use client'

import { useRouter } from 'next/navigation'
import { AdminQueueTable, EmptyState } from '@/components/ui'

const PROGRAM_LABELS: Record<string, string> = {
  vex_v5: 'VEX V5',
  combat: 'Combat',
  both: 'VEX V5 & Combat',
  vex_iq: 'VEX IQ',
  not_sure: 'Not sure',
}

export type QueueItem = {
  id: string
  name: string
  program: string
  school: string
  submitted: string | null
  status: string
}

const STATUS_LABEL: Record<string, string> = {
  submitted: 'Submitted',
  needs_follow_up: 'Needs follow-up',
  program_pending: 'Program pending',
  accepted: 'Accepted',
  admin_waived: 'Admin waived',
}
const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'error' | 'info' | 'neutral'> = {
  submitted: 'info',
  needs_follow_up: 'warning',
  program_pending: 'warning',
  accepted: 'success',
  admin_waived: 'neutral',
}

export default function ApplicationsQueue({ items }: { items: QueueItem[] }) {
  const router = useRouter()

  if (items.length === 0) {
    return (
      <EmptyState
        title="No applications yet"
        description="Applications appear here as families apply or are imported."
      />
    )
  }

  return (
    <AdminQueueTable
      title="Applications"
      count={items.length}
      items={items.map((a) => ({
        id: a.id,
        primary: a.name,
        secondary: `${PROGRAM_LABELS[a.program] ?? a.program} · ${a.school}`,
        status: STATUS_LABEL[a.status] ?? a.status,
        statusVariant: STATUS_VARIANT[a.status] ?? 'neutral',
        waitingTime: a.submitted ? new Date(a.submitted).toLocaleDateString() : undefined,
        onClick: () => router.push(`/admin/applications/${a.id}`),
      }))}
    />
  )
}
