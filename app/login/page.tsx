'use client'

import Link from 'next/link'
import { PublicShell, FormField, TextInput, PrimaryButton } from '@/components/ui'

export default function LoginPage() {
  return (
    <PublicShell maxWidth="sm">
      <h1 className="text-page-title">Sign in to Placer Robotics Hub</h1>
      <p className="text-body" style={{ marginTop: '0.75rem', color: 'var(--color-text-muted)' }}>
        We&apos;ll send a secure link to your email. No password needed.
      </p>

      <form
        onSubmit={(e) => e.preventDefault()}
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
        <FormField label="Email address" htmlFor="email" helpText="We'll send a secure link to your email.">
          <TextInput id="email" type="email" name="email" placeholder="you@example.com" autoComplete="email" />
        </FormField>

        <PrimaryButton type="submit" size="md" fullWidth>
          Send sign-in link
        </PrimaryButton>
      </form>

      <p className="text-help" style={{ marginTop: '1.5rem', textAlign: 'center' }}>
        New to Placer Robotics? <Link href="/apply">Apply first</Link> to create your account.
      </p>
    </PublicShell>
  )
}
