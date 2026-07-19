'use client'

import { useState } from 'react'

const panel: React.CSSProperties = { backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '1.125rem 1.25rem', marginBottom: '1.25rem' }
const btn: React.CSSProperties = { padding: '8px 16px', borderRadius: 6, fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'inherit', border: 'none' }
const navyBtn: React.CSSProperties = { ...btn, backgroundColor: 'var(--color-navy-deep)', color: '#fff' }
const goldBtn: React.CSSProperties = { ...btn, backgroundColor: 'var(--color-gold)', color: 'var(--color-navy-darker)' }

// One-time MS/HS "you're registered but not on Slack yet" campaign trigger.
// Sample always goes to kevin.miller@placerrobotics.org for review; the real
// send requires typing CONFIRM so a stray click can't email the whole list.
export default function CatchupCampaign({ candidateCount, v5Count, combatCount, bothCount }: {
  candidateCount: number
  v5Count: number
  combatCount: number
  bothCount: number
}) {
  const [busy, setBusy] = useState<'sample' | 'send' | null>(null)
  const [msg, setMsg] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [confirmText, setConfirmText] = useState('')

  async function post(mode: 'sample' | 'send') {
    setBusy(mode); setMsg('')
    try {
      const res = await fetch('/api/admin/slack/catchup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode }) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setMsg(d.error || 'Failed.'); return }
      setMsg(mode === 'sample' ? 'Sample sent to kevin.miller@placerrobotics.org — check your inbox.' : `Sent ${d.sent} · skipped ${d.skipped} (no email on file) · errors ${d.errors}.`)
      setConfirming(false); setConfirmText('')
    } catch { setMsg('Network error.') } finally { setBusy(null) }
  }

  if (!candidateCount) {
    return (
      <div style={panel}>
        <h3 className="text-card-title" style={{ margin: '0 0 0.375rem' }}>Slack catch-up campaign</h3>
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>No MS/HS families registered or cleared to register are missing from Slack right now.</p>
      </div>
    )
  }

  return (
    <div style={panel}>
      <h3 className="text-card-title" style={{ margin: '0 0 0.375rem' }}>Slack catch-up campaign</h3>
      <p style={{ margin: '0 0 0.875rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
        {candidateCount} MS/HS guardian{candidateCount === 1 ? '' : 's'} registered or cleared to register for 2026-27, not yet on Slack — {v5Count} V5, {combatCount} Combat, {bothCount} both.
      </p>
      <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" style={navyBtn} disabled={busy !== null} onClick={() => post('sample')}>{busy === 'sample' ? 'Sending…' : 'Send sample to me'}</button>
        {!confirming ? (
          <button type="button" style={goldBtn} disabled={busy !== null} onClick={() => setConfirming(true)}>Send to all {candidateCount}</button>
        ) : (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type SEND to confirm"
              style={{ padding: '7px 10px', fontSize: '0.8125rem', border: '1.5px solid var(--color-border)', borderRadius: 6, fontFamily: 'inherit' }}
            />
            <button type="button" style={{ ...goldBtn, opacity: confirmText === 'SEND' ? 1 : 0.5 }} disabled={busy !== null || confirmText !== 'SEND'} onClick={() => post('send')}>
              {busy === 'send' ? 'Sending…' : `Confirm — email all ${candidateCount}`}
            </button>
            <button type="button" onClick={() => { setConfirming(false); setConfirmText('') }} style={{ ...btn, backgroundColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>Cancel</button>
          </span>
        )}
      </div>
      {msg && <p style={{ margin: '0.75rem 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>{msg}</p>}
      <p style={{ margin: '0.75rem 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>One-time campaign — there's no dedup against a prior run, so only use "Send to all" once you're happy with the sample.</p>
    </div>
  )
}
