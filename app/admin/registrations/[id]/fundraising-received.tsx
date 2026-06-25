'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const input: React.CSSProperties = { padding: '8px 10px', fontSize: '0.875rem', border: '1.5px solid var(--color-border)', borderRadius: '6px', fontFamily: 'inherit', backgroundColor: 'var(--color-surface)' }
const btn: React.CSSProperties = { padding: '8px 14px', border: 'none', borderRadius: '6px', fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'inherit' }
const label: React.CSSProperties = { display: 'block', fontSize: '0.75rem', fontWeight: 500, marginBottom: '0.2rem', color: 'var(--color-text-muted)' }

export default function FundraisingReceived({
  familySeasonId,
  studentId,
  current,
}: {
  familySeasonId: string
  studentId: string
  current: { receivedAt: string | null; amount: string; note: string }
}) {
  const router = useRouter()
  const today = new Date().toISOString().slice(0, 10)
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(current.receivedAt ? current.receivedAt.slice(0, 10) : today)
  const [amount, setAmount] = useState(current.amount)
  const [note, setNote] = useState(current.note)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function post(body: any) {
    setBusy(true); setErr('')
    try {
      const res = await fetch(`/api/admin/registrations/${familySeasonId}/fundraising-received`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ student_id: studentId, ...body }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setErr(d.error || 'Failed.'); return }
      setOpen(false); router.refresh()
    } catch { setErr('Network error.') } finally { setBusy(false) }
  }

  return (
    <div style={{ marginTop: '0.75rem' }}>
      {current.receivedAt ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-success)' }}>
            ✓ Fundraising received {new Date(current.receivedAt).toLocaleDateString()}{current.amount ? ` · $${current.amount}` : ''}{current.note ? ` · ${current.note}` : ''}
          </span>
          <button type="button" style={{ ...btn, background: 'var(--color-border)', color: 'var(--color-text-primary)' }} disabled={busy} onClick={() => post({ received: false })}>Clear</button>
        </div>
      ) : !open ? (
        <button type="button" style={{ ...btn, background: 'var(--color-navy-deep)', color: '#fff' }} onClick={() => setOpen(true)}>Mark fundraising received…</button>
      ) : (
        <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div><label style={label}>Date received</label><input style={input} type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div><label style={label}>Amount</label><input style={{ ...input, width: 90 }} type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="550" /></div>
          <div><label style={label}>Source / note</label><input style={{ ...input, minWidth: 180 }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Benevity transfer / check #123" /></div>
          <button type="button" style={{ ...btn, background: 'var(--color-gold)', color: 'var(--color-navy-darker)' }} disabled={busy} onClick={() => post({ received: true, date, amount, note })}>Save</button>
          <button type="button" style={{ ...btn, background: 'var(--color-border)', color: 'var(--color-text-primary)' }} disabled={busy} onClick={() => setOpen(false)}>Cancel</button>
        </div>
      )}
      {err && <p style={{ color: 'var(--color-error)', fontSize: '0.8125rem', marginTop: '0.4rem' }}>{err}</p>}
    </div>
  )
}
