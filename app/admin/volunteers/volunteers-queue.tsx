'use client'

import { useRouter } from 'next/navigation'
import { AdminQueueTable, EmptyState } from '@/components/ui'

export type VolunteerItem = {
  id: string
  name: string
  email: string
  status: string
  progress: string
}

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'error' | 'info' | 'neutral'> = {
  pending: 'warning',
  in_progress: 'info',
  cleared: 'success',
  expired: 'warning',
  suspended: 'error',
  withdrawn: 'neutral',
}

export default function VolunteersQueue({ items }: { items: VolunteerItem[] }) {
  const router = useRouter()

  if (items.length === 0) {
    return (
      <EmptyState
        title="No volunteers yet"
        description="Volunteer profiles appear here as people sign up at /volunteer/apply."
      />
    )
  }

  return (
    <AdminQueueTable
      title="Volunteer profiles"
      count={items.length}
      items={items.map((v) => ({
        id: v.id,
        primary: v.name,
        secondary: `${v.email} · ${v.progress}`,
        status: v.status.replace('_', ' '),
        statusVariant: STATUS_VARIANT[v.status] ?? 'neutral',
        onClick: () => router.push(`/admin/volunteers/${v.id}`),
      }))}
    />
  )
}
