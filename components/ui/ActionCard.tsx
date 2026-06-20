/**
 * ActionCard — the "next step" card shown on family dashboard.
 * Always shows the most important action prominently.
 */

interface ActionCardProps {
  title: string
  description?: string
  ctaLabel: string
  onAction?: () => void
  href?: string
  variant?: 'primary' | 'neutral'
}

export function ActionCard({
  title,
  description,
  ctaLabel,
  onAction,
  href,
  variant = 'primary',
}: ActionCardProps) {
  const isPrimary = variant === 'primary'

  return (
    <div
      style={{
        backgroundColor: isPrimary ? 'var(--color-navy-deep)' : 'var(--color-surface)',
        border: isPrimary ? 'none' : '1px solid var(--color-border)',
        borderRadius: '10px',
        padding: '1.5rem',
        marginBottom: '1rem',
      }}
    >
      <div
        style={{
          fontSize: '0.75rem',
          fontWeight: 600,
          textTransform: 'uppercase' as const,
          letterSpacing: '0.08em',
          color: isPrimary ? 'var(--color-gold)' : 'var(--color-text-muted)',
          marginBottom: '0.5rem',
        }}
      >
        Next step
      </div>
      <div
        className="text-card-title"
        style={{
          color: isPrimary ? '#fff' : 'var(--color-text-primary)',
          marginBottom: description ? '0.5rem' : '1rem',
        }}
      >
        {title}
      </div>
      {description && (
        <p
          style={{
            fontSize: '0.9375rem',
            color: isPrimary ? 'rgba(255,255,255,0.7)' : 'var(--color-text-muted)',
            marginBottom: '1.25rem',
            lineHeight: '1.5',
          }}
        >
          {description}
        </p>
      )}
      {href ? (
        <a
          href={href}
          style={{
            display: 'inline-block',
            padding: '10px 20px',
            backgroundColor: 'var(--color-gold)',
            color: 'var(--color-navy-darker)',
            borderRadius: '6px',
            fontWeight: 600,
            fontSize: '0.9375rem',
            textDecoration: 'none',
          }}
        >
          {ctaLabel}
        </a>
      ) : (
        <button
          onClick={onAction}
          style={{
            padding: '10px 20px',
            backgroundColor: 'var(--color-gold)',
            color: 'var(--color-navy-darker)',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 600,
            fontSize: '0.9375rem',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {ctaLabel}
        </button>
      )}
    </div>
  )
}
