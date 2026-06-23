'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FormSection, FormField, TextInput, PrimaryButton, ErrorAlert } from '@/components/ui'

export type SignWaiver = { id: string; title: string; body_markdown: string }

export default function WaiverSignForm({
  waivers,
  alreadySigned,
  guardianName,
}: {
  waivers: SignWaiver[]
  alreadySigned: string[]
  guardianName: string
}) {
  const router = useRouter()
  const signedSet = new Set(alreadySigned)
  const toSign = waivers.filter((w) => !signedSet.has(w.id))

  const [agreed, setAgreed] = useState<Record<string, boolean>>({})
  const [signature, setSignature] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const valid = toSign.every((w) => agreed[w.id]) && signature.trim()

  async function submit() {
    if (submitting || !valid) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/waivers/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signatureName: signature.trim(), waiverIds: toSign.map((w) => w.id) }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Could not record your signature.')
        setSubmitting(false)
        return
      }
      router.push('/dashboard?notice=signed')
    } catch {
      setError('Network error — please try again.')
      setSubmitting(false)
    }
  }

  return (
    <>
      {error && (
        <div style={{ marginBottom: '1.25rem' }}>
          <ErrorAlert title="Couldn’t sign">{error}</ErrorAlert>
        </div>
      )}

      {toSign.map((w) => (
        <div
          key={w.id}
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '10px',
            padding: '1.25rem',
            marginBottom: '1.25rem',
          }}
        >
          <h3 className="text-card-title" style={{ marginBottom: '0.5rem' }}>{w.title}</h3>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: '0 0 0.625rem' }}>
            Scroll within the box below to read the full agreement.
          </p>
          <div
            style={{
              maxHeight: '300px',
              overflowY: 'auto',
              border: '1px solid var(--color-border)',
              borderRadius: '6px',
              padding: '0.875rem',
              fontSize: '0.875rem',
              lineHeight: 1.6,
              color: 'var(--color-text-muted)',
              whiteSpace: 'pre-wrap',
              marginBottom: '0.875rem',
            }}
          >
            {w.body_markdown}
          </div>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem', fontSize: '0.9375rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={!!agreed[w.id]}
              onChange={(e) => setAgreed((prev) => ({ ...prev, [w.id]: e.target.checked }))}
              style={{ marginTop: '0.25rem' }}
            />
            <span>I have read and agree to the {w.title}.</span>
          </label>
        </div>
      ))}

      <FormSection
        title="Signature"
        description="By typing your full legal name below, you sign the agreements above as a parent or legal guardian. Today's date is recorded automatically."
      >
        <FormField label="Parent / legal guardian full legal name" htmlFor="sig" required>
          <TextInput id="sig" value={signature} onChange={(e) => setSignature(e.target.value)} placeholder={guardianName} />
        </FormField>
      </FormSection>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <PrimaryButton loading={submitting} disabled={!valid} onClick={submit}>Sign agreements</PrimaryButton>
      </div>
    </>
  )
}
