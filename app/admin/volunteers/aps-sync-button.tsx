'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ApsSyncButton() {
  const router = useRouter()
  const [busy, setBusy] = useState<'sync' | 'backfill' | null>(null)
  const [msg, setMsg] = useState('')

  async function run(kind: 'sync' | 'backfill') {
    if (busy) return
    setBusy(kind); setMsg('')
    try {
      const url = kind === 'sync' ? '/api/admin/volunteers/aps-sync' : '/api/admin/volunteers/aps-email-backfill'
      const res = await fetch(url, { method: 'POST' })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setMsg(d.error || 'Failed.'); setBusy(null); return }
      setMsg(`Updated ${d.summary.updated} · skipped ${d.summary.skipped} · errors ${d.summary.errors}`)
      setBusy(null)
      router.refresh()
    } catch { setMsg('Network error.'); setBusy(null) }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
      <button type="button" onClick={() => run('sync')} disabled={!!busy} style={{ padding: '8px 16px', backgroundColor: 'var(--color-navy-deep)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: '0.875rem', cursor: busy ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>{busy === 'sync' ? 'Syncing…' : 'Sync from APS'}</button>
      <button type="button" onClick={() => run('backfill')} disabled={!!busy} title="Fills in each volunteer's APS login email of record from MinistrySafe — run once, safe to re-run." style={{ padding: '8px 16px', backgroundColor: 'var(--color-surface)', color: 'var(--color-navy-deep)', border: '1.5px solid var(--color-navy-deep)', borderRadius: 6, fontWeight: 600, fontSize: '0.875rem', cursor: busy ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>{busy === 'backfill' ? 'Backfilling…' : 'Backfill APS login emails'}</button>
      {msg && <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>{msg}</span>}
    </div>
  )
}
