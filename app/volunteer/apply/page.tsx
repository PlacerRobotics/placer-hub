'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  PublicShell,
  FormField,
  TextInput,
  PrimaryButton,
  InfoAlert,
  SuccessAlert,
  ErrorAlert,
} from '@/components/ui'

export default function VolunteerApplyPage() {
  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')

  const valid = first.trim() && last.trim() && email.trim() && phone.trim()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!valid || status === 'sending') return
    setStatus('sending')
    setError('')
    try {
      const res = await fetch('/api/volunteer/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ first_name: first, last_name: last, email, phone }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Something went wrong.')
        setStatus('error')
      } else {
        setStatus('done')
      }
    } catch {
      setError('Network error — please try again.')
      setStatus('error')
    }
  }

  if (status === 'done') {
    return (
      <PublicShell maxWidth="sm">
        <h1 className="text-page-title">You&apos;re signed up to volunteer</h1>
        <div style={{ marginTop: '1.5rem' }}>
          <SuccessAlert title="Volunteer profile created">
            Sign in with {email} to track your clearance steps (background check, youth
            protection training, and more).
          </SuccessAlert>
        </div>
        <div style={{ marginTop: '1.5rem' }}>
          <Link href="/login">
            <PrimaryButton fullWidth>Sign in to continue</PrimaryButton>
          </Link>
        </div>
      </PublicShell>
    )
  }

  return (
    <PublicShell maxWidth="sm">
      <h1 className="text-page-title">Volunteer with Placer Robotics</h1>
      <p className="text-body" style={{ marginTop: '0.75rem', color: 'var(--color-text-muted)' }}>
        No student required. Create a volunteer account to start your clearance — background check
        and youth protection training.
      </p>

      <form
        onSubmit={handleSubmit}
        style={{
          marginTop: '1.75rem',
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '10px',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
        }}
      >
        <FormField label="First name" htmlFor="first" required>
          <TextInput id="first" value={first} onChange={(e) => setFirst(e.target.value)} />
        </FormField>
        <FormField label="Last name" htmlFor="last" required>
          <TextInput id="last" value={last} onChange={(e) => setLast(e.target.value)} />
        </FormField>
        <FormField label="Email" htmlFor="email" required helpText="This becomes your sign-in email.">
          <TextInput id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </FormField>
        <FormField label="Mobile phone" htmlFor="phone" required>
          <TextInput id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </FormField>

        {status === 'error' && <ErrorAlert title="Couldn’t sign you up">{error}</ErrorAlert>}

        <PrimaryButton type="submit" fullWidth loading={status === 'sending'}>
          Create volunteer account
        </PrimaryButton>
      </form>

      <div style={{ marginTop: '1.5rem' }}>
        <InfoAlert title="Already have an account?">
          If you already registered a student, <Link href="/login">sign in</Link> — you can add
          volunteering from your dashboard.
        </InfoAlert>
      </div>
    </PublicShell>
  )
}
