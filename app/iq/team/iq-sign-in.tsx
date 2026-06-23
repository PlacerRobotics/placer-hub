'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader, TextInput, PrimaryButton, InfoAlert, SuccessAlert, ErrorAlert } from '@/components/ui'

export default function IqSignIn() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [err, setErr] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || status === 'sending') return
    setStatus('sending'); setErr('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: (process.env.NEXT_PUBLIC_SITE_URL || '') + '/api/auth/callback?redirectTo=/iq/team' },
    })
    if (error) { setStatus('error'); setErr(error.message) } else setStatus('sent')
  }

  return (
    <>
      <PageHeader title="Register an IQ team" subtitle="Coaches: sign in (or create your account) to apply." />
      {status === 'sent' ? (
        <SuccessAlert title="Check your email">
          We sent a sign-in link to {email}. Click it and you&apos;ll come right back here to fill out the team
          application. (Don&apos;t see it? Check spam.)
        </SuccessAlert>
      ) : (
        <form onSubmit={submit} style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 420 }}>
          <div>
            <label htmlFor="email" style={{ display: 'block', fontSize: '0.9375rem', fontWeight: 500, marginBottom: '0.375rem' }}>Your email</label>
            <TextInput id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="coach@email.com" disabled={status === 'sending'} />
          </div>
          {status === 'error' && <ErrorAlert title="Couldn’t send the link">{err}</ErrorAlert>}
          <PrimaryButton type="submit" fullWidth loading={status === 'sending'}>Send sign-in link</PrimaryButton>
        </form>
      )}
      <div style={{ marginTop: '1.5rem', maxWidth: 420 }}>
        <InfoAlert title="New coach?">No account yet? Just enter your email above — signing in creates your coach account.</InfoAlert>
      </div>
    </>
  )
}
