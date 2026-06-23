/**
 * Compact financial-aid link for parent-facing flows. Deliberately low-key — a
 * single line, not a prominent card — so it never dominates the page. Links to the
 * in-app request form by default (/financial-aid); pass an external href (e.g. a
 * public Google Form) for unauthenticated pages.
 */
export function FinancialAidCallout({ href = '/financial-aid' }: { href?: string }) {
  const external = href.startsWith('http')
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-navy-deep)' }}
    >
      Need financial assistance? Apply for financial aid →
    </a>
  )
}
