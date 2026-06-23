'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ApsSyncButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  async function sync() {
    if (busy) return
    setBusy(true); setMsg('')
    try {
      const res = await fetch('/api/admin/volunteers/aps-sync', { method: 'POST' })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setMsg(d.error || 'Sync failed.'); setBusy(false); return }
      setMsg(`Updated ${d.summary.updated} · skipped ${d.summary.skipped} · errors ${d.summary.errors}`)
      setBusy(false)
      router.refresh()
    } catch { setMsg('Network error.'); setBusy(false) }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
      <button type="button" onClick={sync} disabled={busy} style={{ padding: '8px 16px', backgroundColor: 'var(--color-navy-deep)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: '0.875rem', cursor: busy ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>{busy ? 'Syncing…' : 'Sync from APS'}</button>
      {msg && <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>{msg}</span>}
    </div>
  )
}
