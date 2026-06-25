/**
 * FamilyShell — layout for authenticated family pages
 * Navy header with family name, nav, light bg, single column mobile-first
 */

import Link from 'next/link'

interface FamilyShellProps {
  children: React.ReactNode
  familyName?: string
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl'
}

const maxWidthMap = {
  sm: '480px',
  md: '640px',
  lg: '768px',
  xl: '1024px',
}

export function FamilyShell({
  children,
  familyName,
  maxWidth = 'lg',
}: FamilyShellProps) {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-bg-light)' }}>
      {/* Header */}
      <header
        style={{
          backgroundColor: 'var(--color-navy-deep)',
          padding: '0 1.5rem',
          height: '56px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}
      >
        <Link href="/dashboard" style={{ textDecoration: 'none' }}>
          <span
            className="font-display"
            style={{
              color: 'var(--color-gold)',
              fontSize: '1.125rem',
              fontWeight: 700,
            }}
          >
            Placer Robotics
          </span>
          <span
            style={{
              color: 'var(--color-blue-gray)',
              fontSize: '0.875rem',
              marginLeft: '0.5rem',
            }}
          >
            Hub
          </span>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          {familyName && (
            <span style={{ color: 'var(--color-blue-gray)', fontSize: '0.875rem' }}>
              {familyName}
            </span>
          )}
          <Link
            href="/login"
            style={{
              color: 'var(--color-blue-gray)',
              fontSize: '0.875rem',
              textDecoration: 'none',
            }}
          >
            Sign out
          </Link>
        </div>
      </header>

      {/* Content */}
      <main
        style={{
          maxWidth: maxWidthMap[maxWidth],
          margin: '0 auto',
          padding: '2rem 1.5rem',
        }}
      >
        {children}
      </main>

      {/* Persistent help — infrequent parents always know where to get unstuck */}
      <footer
        style={{
          maxWidth: maxWidthMap[maxWidth],
          margin: '0 auto',
          padding: '1rem 1.5rem 2.5rem',
          textAlign: 'center',
          fontSize: '0.8125rem',
          color: 'var(--color-text-muted)',
        }}
      >
        Questions or stuck? Email{' '}
        <a href="mailto:info@placerrobotics.org" style={{ color: 'var(--color-navy-deep)' }}>
          info@placerrobotics.org
        </a>
      </footer>
    </div>
  )
}
