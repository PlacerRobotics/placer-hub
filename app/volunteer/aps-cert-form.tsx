'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const input: React.CSSProperties = { width: '100%', padding: '8px 10px', fontSize: '0.875rem', border: '1.5px solid var(--color-border)', borderRadius: 6, fontFamily: 'inherit', boxSizing: 'border-box', backgroundColor: 'var(--color-surface)' }
const btn: React.CSSProperties = { padding: '8px 14px', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'inherit', background: 'var(--color-gold)', color: 'var(--color-navy-darker)' }

// Volunteer self-reports their APS (CA Mandated Reporter) certificate expiry + link.
// Recorded into youth_protection_cert; an admin can still verify/override.
export default function ApsCertForm({ expiration, certUrl }: { expiration: string; certUrl: string }) {
  const router = useRouter()
  const [exp, setExp] = useState(expiration)
  const [url, setUrl] = useState(certUrl)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  async function save() {
    if (busy || !exp) { if (!exp) setErr('Enter the certificate expiration date.'); return }
    setBusy(true); setErr(''); setMsg('')
    try {
      const res = await fetch('/api/volunteer/aps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiration_date: exp, cert_url: url.trim() || null }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setErr(d.error || 'Could not save.'); setBusy(false); return }
      setMsg('Saved.'); setBusy(false); router.refresh()
    } catch { setErr('Network error.'); setBusy(false) }
  }

  return (
    <div style={{ marginTop: '0.75rem' }}>
      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 3 }}>Certificate expiration date</label>
      <input style={input} type="date" value={exp} onChange={(e) => setExp(e.target.value)} />
      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', margin: '0.5rem 0 3px' }}>Certificate link (optional)</label>
      <input style={input} type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
      {err && <div style={{ color: 'var(--color-error)', fontSize: '0.75rem', marginTop: 6 }}>{err}</div>}
      {msg && <div style={{ color: 'var(--color-success)', fontSize: '0.75rem', marginTop: 6 }}>{msg}</div>}
      <button type="button" onClick={save} disabled={busy} style={{ ...btn, marginTop: '0.625rem', opacity: busy ? 0.6 : 1 }}>{busy ? 'Saving…' : 'Save certificate'}</button>
    </div>
  )
}
