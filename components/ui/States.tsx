/**
 * EmptyState — empty queue or no results
 * LoadingState — skeleton or spinner
 * PageHeader — page title + optional breadcrumb + actions
 */

// ── EmptyState ────────────────────────────────────────────────────────────────

interface EmptyStateProps {
  title: string
  description?: string
  action?: {
    label: string
    onClick?: () => void
    href?: string
  }
  icon?: string
}

export function EmptyState({ title, description, action, icon = '○' }: EmptyStateProps) {
  return (
    <div
      style={{
        textAlign: 'center' as const,
        padding: '3rem 2rem',
        color: 'var(--color-text-muted)',
      }}
    >
      <div style={{ fontSize: '2rem', marginBottom: '0.75rem', opacity: 0.4 }}>{icon}</div>
      <h3
        style={{
          fontSize: '1rem',
          fontWeight: 600,
          color: 'var(--color-text-primary)',
          marginBottom: description ? '0.375rem' : action ? '1rem' : 0,
        }}
      >
        {title}
      </h3>
      {description && (
        <p
          style={{
            fontSize: '0.9375rem',
            marginBottom: action ? '1rem' : 0,
            maxWidth: '360px',
            margin: '0 auto',
            lineHeight: '1.5',
          }}
        >
          {description}
        </p>
      )}
      {action && (
        <div style={{ marginTop: '1.25rem' }}>
          {action.href ? (
            <a
              href={action.href}
              style={{
                display: 'inline-block',
                padding: '8px 18px',
                backgroundColor: 'var(--color-navy-deep)',
                color: '#fff',
                borderRadius: '6px',
                fontWeight: 600,
                fontSize: '0.9375rem',
                textDecoration: 'none',
              }}
            >
              {action.label}
            </a>
          ) : (
            <button
              onClick={action.onClick}
              style={{
                padding: '8px 18px',
                backgroundColor: 'var(--color-navy-deep)',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 600,
                fontSize: '0.9375rem',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {action.label}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── LoadingState ──────────────────────────────────────────────────────────────

interface LoadingStateProps {
  message?: string
  rows?: number
}

export function LoadingState({ message, rows = 3 }: LoadingStateProps) {
  return (
    <div aria-label={message ?? 'Loading…'} aria-busy="true">
      {message && (
        <p
          style={{
            fontSize: '0.9375rem',
            color: 'var(--color-text-muted)',
            marginBottom: '1rem',
          }}
        >
          {message}
        </p>
      )}
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            height: '52px',
            backgroundColor: 'var(--color-border)',
            borderRadius: '6px',
            marginBottom: '8px',
            opacity: 1 - i * 0.2,
            animation: 'pulse 1.5s ease-in-out infinite',
          }}
        />
      ))}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}

// ── PageHeader ────────────────────────────────────────────────────────────────

interface PageHeaderProps {
  title: string
  subtitle?: string
  breadcrumb?: Array<{ label: string; href?: string }>
  actions?: React.ReactNode
}

export function PageHeader({ title, subtitle, breadcrumb, actions }: PageHeaderProps) {
  return (
    <div style={{ marginBottom: '1.75rem' }}>
      {breadcrumb && breadcrumb.length > 0 && (
        <nav aria-label="Breadcrumb" style={{ marginBottom: '0.5rem' }}>
          <ol
            style={{
              display: 'flex',
              gap: '0.5rem',
              listStyle: 'none',
              padding: 0,
              margin: 0,
              fontSize: '0.8125rem',
              color: 'var(--color-text-muted)',
            }}
          >
            {breadcrumb.map((crumb, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {i > 0 && <span aria-hidden="true">›</span>}
                {crumb.href ? (
                  <a href={crumb.href} style={{ color: 'var(--color-text-muted)', textDecoration: 'none' }}>
                    {crumb.label}
                  </a>
                ) : (
                  <span>{crumb.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
        <div>
          <h1 className="text-page-title">{title}</h1>
          {subtitle && (
            <p style={{ fontSize: '0.9375rem', color: 'var(--color-text-muted)', marginTop: '0.375rem' }}>
              {subtitle}
            </p>
          )}
        </div>
        {actions && <div style={{ flexShrink: 0 }}>{actions}</div>}
      </div>
    </div>
  )
}
