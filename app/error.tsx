'use client'

import { useEffect } from 'react'

// Root error boundary. Without this, an uncaught error renders an unstyled blank
// page. This gives a branded, recoverable fallback for any route segment that
// doesn't define its own error boundary.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div style={{ maxWidth: 520, margin: '4rem auto', padding: '0 1.25rem', textAlign: 'center', fontFamily: 'inherit' }}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0E2558', margin: '0 0 0.5rem' }}>Something went wrong</h1>
      <p style={{ color: '#5b6472', margin: '0 0 1.5rem', lineHeight: 1.5 }}>This page couldn’t load. Please try again — if it keeps happening, contact registrar@placerrobotics.org.</p>
      <button
        onClick={reset}
        style={{ padding: '9px 18px', background: '#0E2558', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit' }}
      >
        Try again
      </button>
      {error.digest && <p style={{ marginTop: '1.25rem', fontSize: '0.75rem', color: '#9aa1ab' }}>Reference: {error.digest}</p>}
    </div>
  )
}
