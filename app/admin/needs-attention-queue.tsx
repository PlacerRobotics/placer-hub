'use client'

import { useRouter } from 'next/navigation'
import { AdminQueueTable } from '@/components/ui'

export type Queue = {
  id: string
  primary: string
  secondary: string
  count: number
  href: string
  variant: 'info' | 'warning' | 'error' | 'neutral'
}

export default function NeedsAttentionQueue({ items }: { items: Queue[] }) {
  const router = useRouter()
  return (
    <AdminQueueTable
      title="Open queues"
      count={items.length}
      items={items.map((i) => ({
        id: i.id,
        primary: i.primary,
        secondary: i.secondary,
        status: String(i.count),
        statusVariant: i.count > 0 ? i.variant : 'neutral',
        onClick: () => router.push(i.href),
      }))}
    />
  )
}
