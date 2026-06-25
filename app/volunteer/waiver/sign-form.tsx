'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { TextInput, PrimaryButton, ErrorAlert } from '@/components/ui'

export type SignWaiver = { id: string; title: string; body_markdown: string }

export default function WaiverSignForm({
  waivers,
  alreadySigned,
  defaultFirst,
  defaultLast,
}: {
  waivers: SignWaiver[]
  alreadySigned: string[]
  defaultFirst: string
  defaultLast: string
}) {
  const router = useRouter()
  const signedSet = new Set(alreadySigned)
  const toSign = waivers.filter((w) => !signedSet.has(w.id))

  const [agreed, setAgreed] = useState<Record<string, boolean>>({})
  const [first, setFirst] = useState(defaultFirst)
  const [last, setLast] = useState(defaultLast)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const ready = toSign.every((w) => agreed[w.id]) && !!first.trim() && !!last.trim()

  async function submit() {
    if (busy || !ready) return
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/volunteer/waiver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ first_name: first.trim(), last_name: last.trim(), waiver_ids: toSign.map((w) => w.id), acknowledged: true }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setError(d.error || 'Could not save.'); setBusy(false); return }
      router.push('/volunteer')
      router.refresh()
    } catch { setError('Network error — please try again.'); setBusy(false) }
  }

  return (
    <>
      {error && <div style={{ marginBottom: '1.25rem' }}><ErrorAlert title="Couldn’t sign">{error}</ErrorAlert></div>}

      <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: '0 0 1rem' }}>
        Volunteers sign two documents each season: our standard Release of Liability and the Registered Volunteer policy acknowledgment.
      </p>

      {toSign.map((w) => (
        <div key={w.id} style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '1.25rem', marginBottom: '1.25rem' }}>
          <h3 className="text-card-title" style={{ marginBottom: '0.5rem' }}>{w.title}</h3>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: '0 0 0.625rem' }}>Scroll within the box below to read the full agreement.</p>
          <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 6, padding: '0.875rem', fontSize: '0.875rem', lineHeight: 1.6, color: 'var(--color-text-muted)', whiteSpace: 'pre-wrap', marginBottom: '0.875rem' }}>
            {w.body_markdown}
          </div>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem', fontSize: '0.9375rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={!!agreed[w.id]} onChange={(e) => setAgreed((prev) => ({ ...prev, [w.id]: e.target.checked }))} style={{ marginTop: '0.25rem' }} />
            <span>I have read and <strong>accept</strong> the {w.title}.</span>
          </label>
        </div>
      ))}

      <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: '0 0 0.75rem' }}>
        Typing your full legal name below is your legally binding electronic signature for the agreements above. Today’s date is recorded automatically.
      </p>
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
    </>
  )
}
