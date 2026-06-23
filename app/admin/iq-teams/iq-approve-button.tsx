'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PrimaryButton } from '@/components/ui'

export default function IqApproveButton({ teamId, canApprove }: { teamId: string; canApprove: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  async function approve() {
    if (busy) return
    if (!confirm('Approve this team and send magic-link invites to all parents?')) return
    setBusy(true); setMsg('')
    const res = await fetch(`/api/admin/iq-teams/${teamId}/approve`, { method: 'POST' })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { setMsg(d.error || 'Failed.'); setBusy(false); return }
    setMsg(`Approved · ${d.invited ?? 0} invite(s) sent${d.failed?.length ? ` · ${d.failed.length} failed` : ''}`)
    setBusy(false)
    router.refresh()
  }

  if (!canApprove) return <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>IQ Coordinator approval required</span>
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <PrimaryButton onClick={approve} loading={busy}>Approve &amp; send invites</PrimaryButton>
      {msg && <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>{msg}</span>}
    </div>
  )
}
