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
    if (!confirm('Approve this team? Member families become ready to register (you send invites from Registrations).')) return
    setBusy(true); setMsg('')
    const res = await fetch(`/api/admin/iq-teams/${teamId}/approve`, { method: 'POST' })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { setMsg(d.error || 'Failed.'); setBusy(false); return }
    setMsg(`Approved · ${d.families ?? 0} family(ies) cleared — send invites from Registrations`)
    setBusy(false)
    router.refresh()
  }

  if (!canApprove) return <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>IQ Coordinator approval required</span>
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <PrimaryButton onClick={approve} loading={busy}>Approve team</PrimaryButton>
      {msg && <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>{msg}</span>}
    </div>
  )
}
