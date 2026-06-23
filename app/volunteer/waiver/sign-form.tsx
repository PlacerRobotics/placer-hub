'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { TextInput, PrimaryButton, ErrorAlert } from '@/components/ui'

export default function WaiverSignForm({ volunteerName }: { volunteerName: string }) {
  const router = useRouter()
  const [sig, setSig] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const ready = agreed && !!sig.trim()

  async function submit() {
    if (busy || !ready) return
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/volunteer/waiver', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ signature: sig.trim(), acknowledged: true }) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setError(d.error || 'Could not save.'); setBusy(false); return }
      router.push('/volunteer')
      router.refresh()
    } catch { setError('Network error — please try again.'); setBusy(false) }
  }

  return (
    <div style={{ marginTop: '1.5rem' }}>
      {error && <div style={{ marginBottom: '1rem' }}><ErrorAlert title="Error">{error}</ErrorAlert></div>}
      <label style={{ display: 'flex', gap: '0.625rem', alignItems: 'flex-start', marginBottom: '1.25rem', fontSize: '0.9375rem', lineHeight: 1.5, cursor: 'pointer' }}>
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} style={{ marginTop: '0.2rem', width: 16, height: 16, flexShrink: 0 }} />
        <span>I have read and <strong>accept</strong> the Youth Protection &amp; Abuse Prevention Policy above for the 2026-27 season. Typing my full legal name below is my legally binding electronic signature.</span>
      </label>
      <label style={{ display: 'block', fontSize: '0.9375rem', fontWeight: 500, marginBottom: '0.375rem' }}>Type your full legal name to sign</label>
      <TextInput value={sig} onChange={(e) => setSig(e.target.value)} placeholder={volunteerName || 'Your full legal name'} />
      <div style={{ marginTop: '1rem' }}>
        <PrimaryButton onClick={submit} loading={busy} disabled={!ready}>Sign &amp; submit</PrimaryButton>
      </div>
    </div>
  )
}
