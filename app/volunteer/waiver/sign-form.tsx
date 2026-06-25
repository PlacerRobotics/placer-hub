'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { TextInput, PrimaryButton, ErrorAlert } from '@/components/ui'

export default function WaiverSignForm({
  templateId,
  version,
  bodyHash,
  defaultFirst,
  defaultLast,
}: {
  templateId: string
  version: string
  bodyHash: string
  defaultFirst: string
  defaultLast: string
}) {
  const router = useRouter()
  const [first, setFirst] = useState(defaultFirst)
  const [last, setLast] = useState(defaultLast)
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const ready = agreed && !!first.trim() && !!last.trim()

  async function submit() {
    if (busy || !ready) return
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/volunteer/waiver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: templateId,
          version,
          body_hash: bodyHash,
          first_name: first.trim(),
          last_name: last.trim(),
          acknowledged: true,
        }),
      })
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
        <span>I have read and <strong>accept</strong> the agreement above for the 2026-27 season. Typing my full legal name below is my legally binding electronic signature.</span>
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.9375rem', fontWeight: 500, marginBottom: '0.375rem' }}>First name</label>
          <TextInput value={first} onChange={(e) => setFirst(e.target.value)} placeholder="First name" />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.9375rem', fontWeight: 500, marginBottom: '0.375rem' }}>Last name</label>
          <TextInput value={last} onChange={(e) => setLast(e.target.value)} placeholder="Last name" />
        </div>
      </div>
      <div style={{ marginTop: '1rem' }}>
        <PrimaryButton onClick={submit} loading={busy} disabled={!ready}>Sign &amp; submit</PrimaryButton>
      </div>
    </div>
  )
}
