'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FormField, TextArea, TextInput, PrimaryButton, InfoAlert, SuccessAlert, ErrorAlert } from '@/components/ui'

export default function AidRequestForm({ alreadyPending }: { alreadyPending: boolean }) {
  const router = useRouter()
  const [need, setNeed] = useState('')
  const [govt, setGovt] = useState('')
  const [feeWaiver, setFeeWaiver] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saving' | 'done'>('idle')
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!need.trim() || status === 'saving') return
    setStatus('saving')
    setError('')
    try {
      const res = await fetch('/api/financial-aid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ needDescription: need, govtProgram: govt, feeWaiverRequested: feeWaiver }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Something went wrong.')
        setStatus('idle')
      } else {
        setStatus('done')
        router.refresh()
      }
    } catch {
      setError('Network error — please try again.')
      setStatus('idle')
    }
  }

  if (status === 'done') {
    return (
      <SuccessAlert title="Request submitted">
        Your financial aid request was submitted confidentially. Our financial aid team will review
        it and follow up by email. This does not affect your application status.
      </SuccessAlert>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
    >
      <InfoAlert title="Confidential">
        Requests are reviewed confidentially by our financial aid team only, and do not affect your
        application or registration status.
      </InfoAlert>

      {alreadyPending && (
        <InfoAlert title="You already have a pending request">
          Submitting again will update your existing request.
        </InfoAlert>
      )}

      <FormField label="Describe your need" htmlFor="need" required helpText="A brief note helps us understand how to help — no documentation required to start.">
        <TextArea id="need" value={need} onChange={(e) => setNeed(e.target.value)} />
      </FormField>

      <FormField label="Government assistance program (optional)" htmlFor="govt" helpText="e.g. free/reduced lunch, CalFresh — if applicable.">
        <TextInput id="govt" value={govt} onChange={(e) => setGovt(e.target.value)} />
      </FormField>

      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem', fontSize: '0.9375rem', cursor: 'pointer' }}>
        <input type="checkbox" checked={feeWaiver} onChange={(e) => setFeeWaiver(e.target.checked)} style={{ marginTop: '0.25rem' }} />
        <span>Also request a registration fee waiver.</span>
      </label>

      {error && <ErrorAlert title="Couldn’t submit">{error}</ErrorAlert>}

      <PrimaryButton type="submit" disabled={!need.trim()} loading={status === 'saving'}>
        Submit request
      </PrimaryButton>
    </form>
  )
}
