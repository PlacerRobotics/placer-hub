'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const STATUSES: [string, string][] = [
  ['prospect', 'Prospect'],
  ['applied', 'Applied'],
  ['accepted', 'Accepted'],
  ['cleared_to_register', 'Cleared to Register'],
  ['registered', 'Registered'],
  ['declined', 'Declined'],
  ['suspended', 'Suspended'],
  ['cancelled', 'Cancelled'],
]
const input: React.CSSProperties = { padding: '8px 10px', fontSize: '0.875rem', border: '1.5px solid var(--color-border)', borderRadius: 6, fontFamily: 'inherit', backgroundColor: 'var(--color-surface)' }
const btn: React.CSSProperties = { padding: '8px 14px', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'inherit', background: 'var(--color-navy-deep)', color: '#fff' }

export default function StatusControl({ familySeasonId, current }: { familySeasonId: string; current: string }) {
  const router = useRouter()
  const [val, setVal] = useState(current)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  async function apply() {
    if (busy || val === current) return
    if (!confirm(`Set registration status to "${STATUSES.find((s) => s[0] === val)?.[1] ?? val}"?`)) return
    setBusy(true); setMsg('')
    try {
      const res = await fetch(`/api/admin/registrations/${familySeasonId}/set-status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: val }) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setMsg(d.error || 'Failed.'); setBusy(false); return }
      setBusy(false); router.refresh()
    } catch { setMsg('Network error.'); setBusy(false) }
  }

  return (
    <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.9375rem', fontWeight: 600 }}>Set status</span>
        <select value={val} onChange={(e) => setVal(e.target.value)} style={input}>
          {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <button type="button" onClick={apply} disabled={busy || val === current} style={{ ...btn, opacity: busy || val === current ? 0.5 : 1 }}>{busy ? 'Saving…' : 'Apply'}</button>
        {msg && <span style={{ color: 'var(--color-error)', fontSize: '0.8125rem' }}>{msg}</span>}
      </div>
      <p className="text-help" style={{ margin: '0.5rem 0 0' }}>Reset the registration to any state (e.g. back to Applied, re-clear, or Cancelled). Logged in the status history below.</p>
    </div>
  )
}
