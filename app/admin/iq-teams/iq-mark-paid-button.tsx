'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PrimaryButton } from '@/components/ui'

export default function IqMarkPaidButton({ teamId, canAct }: { teamId: string; canAct: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  async function markPaid() {
    if (busy) return
    if (!confirm('Mark this team’s fee as paid? It will move to Pending Approval.')) return
    setBusy(true); setMsg('')
    const res = await fetch(`/api/admin/iq-teams/${teamId}/mark-paid`, { method: 'POST' })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { setMsg(d.error || 'Failed.'); setBusy(false); return }
    setMsg('Marked paid')
    setBusy(false)
    router.refresh()
  }

  if (!canAct) return <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>Awaiting payment</span>
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <PrimaryButton onClick={markPaid} loading={busy}>Mark fee paid</PrimaryButton>
      {msg && <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>{msg}</span>}
    </div>
  )
}
