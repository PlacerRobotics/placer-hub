'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  PublicShell,
  TextInput,
  PrimaryButton,
  InfoAlert,
  SuccessAlert,
  ErrorAlert,
} from '@/components/ui'

type Status = 'idle' | 'sending' | 'sent' | 'error'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!email || status === 'sending') return

    setStatus('sending')
    setErrorMessage('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: process.env.NEXT_PUBLIC_SITE_URL + '/api/auth/callback',
      },
    })

    if (error) {
      setStatus('error')
      setErrorMessage(error.message)
    } else {
      setStatus('sent')
    }
  }

  return (
    <PublicShell maxWidth="sm">
      <h1 className="text-page-title">Sign in to Placer Robotics Hub</h1>
      <p className="text-body" style={{ marginTop: '0.75rem', color: 'var(--color-text-muted)' }}>
        We&apos;ll email you a secure sign-in link. No password needed.
      </p>

      {status === 'sent' ? (
        <div style={{ marginTop: '1.75rem' }}>
          <SuccessAlert title="Check your email">
            We sent a sign-in link to {email}. Click it to finish signing in — it expires
            shortly, so use it soon. (Don&apos;t see it? Check your spam folder.)
          </SuccessAlert>
        </div>
      ) : (
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
          <div>
            <label
              htmlFor="email"
              style={{
                display: 'block',
                fontSize: '0.9375rem',
                fontWeight: 500,
                color: 'var(--color-text-primary)',
                marginBottom: '0.375rem',
              }}
            >
              Email address
            </label>
            <TextInput
              id="email"
              type="email"
              name="email"
              placeholder="you@example.com"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={status === 'sending'}
            />
          </div>

          {status === 'error' && (
            <ErrorAlert title="Couldn't send the link">
              {errorMessage || 'Something went wrong. Please check the address and try again.'}
            </ErrorAlert>
          )}

          <PrimaryButton type="submit" size="md" fullWidth loading={status === 'sending'}>
            Send sign-in link
          </PrimaryButton>
        </form>
      )}

      <div style={{ marginTop: '1.5rem' }}>
        <InfoAlert title="New to Placer Robotics?">
          You&apos;ll need to <Link href="/apply">apply first</Link> before you can sign in.
        </InfoAlert>
      </div>
    </PublicShell>
  )
}
