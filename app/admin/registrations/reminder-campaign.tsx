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
  const [failures, setFailures] = useState<{ recipient: string; type: 'guardian' | 'student'; familyId: string; error: string }[]>([])
  const [confirming, setConfirming] = useState(false)
  const [confirmText, setConfirmText] = useState('')

  const outstanding = notRegistered + unpaid + fundraisingOpen

  async function post(mode: 'sample' | 'send') {
    setBusy(mode); setMsg(''); setFailures([])
    try {
      const res = await fetch('/api/admin/registrations/reminders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode }) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setMsg(d.error || 'Failed.'); return }
      if (mode === 'sample') {
        setMsg('Sample sent to kevin.miller@placerrobotics.org (guardian + student versions) — check your inbox.')
      } else {
        const failedCount = d.guardianEmailsFailed + d.studentEmailsFailed
        const skippedCount = (d.guardianEmailsSkipped ?? 0) + (d.studentEmailsSkipped ?? 0)
        setMsg(`Sent to ${d.families} families (${d.guardianEmailsSent} guardian emails, ${d.studentEmailsSent} student emails). ${failedCount} failed.${skippedCount ? ` ${skippedCount} already had a successful send on record and were skipped.` : ''}`)
        setFailures(d.failures ?? [])
      }
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
      {failures.length > 0 && (
        <div style={{ margin: '0.5rem 0 0', border: '1px solid var(--color-border)', borderRadius: 6, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--color-bg-light)' }}>
                <th style={{ textAlign: 'left', padding: '6px 10px' }}>Recipient</th>
                <th style={{ textAlign: 'left', padding: '6px 10px' }}>Type</th>
                <th style={{ textAlign: 'left', padding: '6px 10px' }}>Error</th>
              </tr>
            </thead>
            <tbody>
              {failures.map((f, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '6px 10px' }}>{f.recipient}</td>
                  <td style={{ padding: '6px 10px' }}>{f.type}</td>
                  <td style={{ padding: '6px 10px' }}>{f.error}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p style={{ margin: '0.75rem 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Registration steps due July 31, 2026; fundraising commitment (sponsor/Benevity submissions, etc.) due August 14, 2026 — fixed for this round. Safe to re-run: anyone already logged as sent is skipped automatically, so "Send to all" only reaches families/students who haven't gotten it yet.</p>
    </div>
  )
}
