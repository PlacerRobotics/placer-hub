'use client'

import { useState } from 'react'

const panel: React.CSSProperties = { backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '1.125rem 1.25rem', marginBottom: '1.25rem' }
const btn: React.CSSProperties = { padding: '8px 16px', borderRadius: 6, fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'inherit', border: 'none' }
const navyBtn: React.CSSProperties = { ...btn, backgroundColor: 'var(--color-navy-deep)', color: '#fff' }
const goldBtn: React.CSSProperties = { ...btn, backgroundColor: 'var(--color-gold)', color: 'var(--color-navy-darker)' }

// One-time "finish your registration" campaign trigger — MS/HS families cleared
// to register or registered with outstanding steps. Sample always goes to
// kevin.miller@placerrobotics.org; the real send requires typing SEND.
export default function ReminderCampaign({ notRegistered, unpaid, fundraisingOpen, fullyDone }: {
  notRegistered: number
  unpaid: number
  fundraisingOpen: number
  fullyDone: number
}) {
  const [busy, setBusy] = useState<'sample' | 'send' | null>(null)
  const [msg, setMsg] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [confirmText, setConfirmText] = useState('')

  const outstanding = notRegistered + unpaid + fundraisingOpen

  async function post(mode: 'sample' | 'send') {
    setBusy(mode); setMsg('')
    try {
      const res = await fetch('/api/admin/registrations/reminders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode }) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setMsg(d.error || 'Failed.'); return }
      setMsg(mode === 'sample'
        ? 'Sample sent to kevin.miller@placerrobotics.org (guardian + student versions) — check your inbox.'
        : `Sent to ${d.families} families (${d.guardianEmailsSent} guardian emails, ${d.studentEmailsSent} student emails). ${d.guardianEmailsFailed + d.studentEmailsFailed} failed.`)
      setConfirming(false); setConfirmText('')
    } catch { setMsg('Network error.') } finally { setBusy(null) }
  }

  if (!outstanding) {
    return (
      <div style={panel}>
        <h3 className="text-card-title" style={{ margin: '0 0 0.375rem' }}>Registration reminders</h3>
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>No MS/HS families registered or cleared to register have outstanding steps right now.</p>
      </div>
    )
  }

  return (
    <div style={panel}>
      <h3 className="text-card-title" style={{ margin: '0 0 0.375rem' }}>Registration reminders</h3>
      <p style={{ margin: '0 0 0.875rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
        {outstanding} student{outstanding === 1 ? '' : 's'} across cleared-to-register/registered MS/HS families with outstanding steps — {notRegistered} not registered, {unpaid} registered but unpaid, {fundraisingOpen} fee paid with fundraising still open ({fullyDone} fully complete, excluded).
      </p>
      <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" style={navyBtn} disabled={busy !== null} onClick={() => post('sample')}>{busy === 'sample' ? 'Sending…' : 'Send sample to me'}</button>
        {!confirming ? (
          <button type="button" style={goldBtn} disabled={busy !== null} onClick={() => setConfirming(true)}>Send to all outstanding families</button>
        ) : (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type SEND to confirm"
              style={{ padding: '7px 10px', fontSize: '0.8125rem', border: '1.5px solid var(--color-border)', borderRadius: 6, fontFamily: 'inherit' }}
            />
            <button type="button" style={{ ...goldBtn, opacity: confirmText === 'SEND' ? 1 : 0.5 }} disabled={busy !== null || confirmText !== 'SEND'} onClick={() => post('send')}>
              {busy === 'send' ? 'Sending…' : 'Confirm — email everyone outstanding'}
            </button>
            <button type="button" onClick={() => { setConfirming(false); setConfirmText('') }} style={{ ...btn, backgroundColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>Cancel</button>
          </span>
        )}
      </div>
      {msg && <p style={{ margin: '0.75rem 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>{msg}</p>}
      <p style={{ margin: '0.75rem 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Due date is fixed at July 31, 2026 for this round. One-time campaign — there's no dedup against a prior run, so only use "Send to all" once you're happy with the sample.</p>
    </div>
  )
}
