'use client'

import { useRouter } from 'next/navigation'
import { AdminQueueTable, EmptyState } from '@/components/ui'

const PROGRAM_LABELS: Record<string, string> = {
  vex_v5: 'VEX V5',
  combat: 'Combat',
  vex_iq: 'VEX IQ',
  not_sure: 'Not sure',
}

export type QueueItem = {
  id: string
  name: string
  program: string
  school: string
  submitted: string | null
}

export default function ApplicationsQueue({ items }: { items: QueueItem[] }) {
  const router = useRouter()

  if (items.length === 0) {
    return (
      <EmptyState
        title="No applications to review"
        description="Submitted applications will appear here as families apply."
      />
    )
  }

  return (
    <AdminQueueTable
      title="Submitted applications"
      count={items.length}
      items={items.map((a) => ({
        id: a.id,
        primary: a.name,
        secondary: `${PROGRAM_LABELS[a.program] ?? a.program} · ${a.school}`,
        status: 'Submitted',
        statusVariant: 'info' as const,
        waitingTime: a.submitted ? new Date(a.submitted).toLocaleDateString() : undefined,
        onClick: () => router.push(`/admin/applications/${a.id}`),
      }))}
    />
  )
}
