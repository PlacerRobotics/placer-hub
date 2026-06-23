'use client'

import { useState } from 'react'
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
  submitted: 'Submitted', needs_follow_up: 'Needs follow-up', program_pending: 'Program pending',
  accepted: 'Accepted', admin_waived: 'Admin waived', declined: 'Declined', withdrawn: 'Withdrawn',
}
const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'error' | 'info' | 'neutral'> = {
  submitted: 'info', needs_follow_up: 'warning', program_pending: 'warning',
  accepted: 'success', admin_waived: 'neutral', declined: 'error', withdrawn: 'neutral',
}
const GROUPS: Record<string, string[]> = {
  pending: ['submitted', 'needs_follow_up', 'program_pending'],
  accepted: ['accepted', 'admin_waived'],
  declined: ['declined', 'withdrawn'],
}
const TABS: [string, string][] = [['pending', 'Pending review'], ['accepted', 'Accepted'], ['declined', 'Declined'], ['all', 'All']]

const tabBtn = (active: boolean): React.CSSProperties => ({
  padding: '6px 12px', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  border: '1px solid var(--color-border)', background: active ? 'var(--color-navy-deep)' : 'transparent', color: active ? '#fff' : 'var(--color-text-primary)',
})

export default function ApplicationsQueue({ items }: { items: QueueItem[] }) {
  const router = useRouter()
  const [group, setGroup] = useState('pending')
  const [program, setProgram] = useState('all')

  const inGroup = (s: string, g: string) => (g === 'all' ? true : (GROUPS[g] ?? []).includes(s))
  const groupCount = (g: string) => items.filter((a) => inGroup(a.status, g)).length
  const filtered = items.filter((a) => inGroup(a.status, group) && (program === 'all' || a.program === program))

  return (
    <>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
        {TABS.map(([g, l]) => (
          <button key={g} type="button" onClick={() => setGroup(g)} style={tabBtn(group === g)}>{l} ({groupCount(g)})</button>
        ))}
        <select value={program} onChange={(e) => setProgram(e.target.value)} style={{ marginLeft: 'auto', padding: '6px 10px', borderRadius: 6, border: '1.5px solid var(--color-border)', fontFamily: 'inherit', fontSize: '0.8125rem', backgroundColor: 'var(--color-surface)' }}>
          <option value="all">All programs</option>
          <option value="vex_v5">VEX V5</option>
          <option value="combat">Combat</option>
          <option value="both">V5 &amp; Combat</option>
          <option value="not_sure">Not sure</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="Nothing here" description="No applications match this filter." />
      ) : (
        <AdminQueueTable
          title="Applications"
          count={filtered.length}
          items={filtered.map((a) => ({
            id: a.id,
            primary: a.name,
            secondary: `${PROGRAM_LABELS[a.program] ?? a.program} · ${a.school}`,
            status: STATUS_LABEL[a.status] ?? a.status,
            statusVariant: STATUS_VARIANT[a.status] ?? 'neutral',
            waitingTime: a.submitted ? new Date(a.submitted).toLocaleDateString() : undefined,
            onClick: () => router.push(`/admin/applications/${a.id}`),
          }))}
        />
      )}
    </>
  )
}
