/**
 * Supportive financial-aid callout. Links to the in-app request form by default
 * (/financial-aid); pass an external href (e.g. a public Google Form) for use on
 * unauthenticated pages where the visitor has no account yet.
 */
export function FinancialAidCallout({ href = '/financial-aid' }: { href?: string }) {
  const external = href.startsWith('http')
  return (
    <div
      style={{
        backgroundColor: 'rgba(242, 195, 82, 0.10)',
        border: '1px solid rgba(242, 195, 82, 0.45)',
        borderRadius: '10px',
        padding: '1.25rem',
      }}
    >
      <div className="text-card-title" style={{ color: 'var(--color-navy-deep)', marginBottom: '0.375rem' }}>
        Need financial assistance?
      </div>
      <p style={{ fontSize: '0.9375rem', color: 'var(--color-text-muted)', lineHeight: 1.5, margin: '0 0 0.75rem' }}>
        PART offers need-based financial aid for families who qualify. Requests are reviewed
        confidentially and do not affect your application status.
      </p>
      <a
        href={href}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--color-navy-deep)' }}
      >
        Apply for financial aid →
      </a>
    </div>
  )
}
