/**
 * PublicShell — layout for unauthenticated pages (/apply, /login)
 * Navy header with Placer Robotics brand, centered content, light gray bg
 */

import Link from 'next/link'

interface PublicShellProps {
  children: React.ReactNode
  maxWidth?: 'sm' | 'md' | 'lg'
}

const maxWidthMap = {
  sm: '480px',
  md: '640px',
  lg: '768px',
}

export function PublicShell({ children, maxWidth = 'md' }: PublicShellProps) {
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
        }}
      >
        <Link href="/" style={{ textDecoration: 'none' }}>
          <span
            className="font-display"
            style={{
              color: 'var(--color-gold)',
              fontSize: '1.125rem',
              fontWeight: 700,
              letterSpacing: '0.02em',
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
      </header>

      {/* Content */}
      <main
        style={{
          maxWidth: maxWidthMap[maxWidth],
          margin: '0 auto',
          padding: '2.5rem 1.5rem',
        }}
      >
        {children}
      </main>

      {/* Footer */}
      <footer
        style={{
          textAlign: 'center',
          padding: '2rem 1.5rem',
          color: 'var(--color-text-muted)',
          fontSize: '0.8125rem',
        }}
      >
        © {new Date().getFullYear()} Placer Advanced Robotics and Technology · 501(c)(3) Nonprofit
      </footer>
    </div>
  )
}
