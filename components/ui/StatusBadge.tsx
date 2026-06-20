/**
 * StatusBadge — colored label with text.
 * ALWAYS includes text. Never relies on color alone. WCAG 2.1 AA compliant.
 *
 * Program accent colors for program badges.
 * Functional status colors for operational states.
 */

type BadgeVariant =
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'neutral'
  | 'program-v5'
  | 'program-iq'
  | 'program-combat'
  | 'program-general'

interface StatusBadgeProps {
  label: string
  variant?: BadgeVariant
  size?: 'sm' | 'md'
}

const VARIANT_STYLES: Record<BadgeVariant, { bg: string; color: string; border: string }> = {
  success: {
    bg: 'rgba(46,125,50,0.12)',
    color: '#1B5E20',
    border: 'rgba(46,125,50,0.3)',
  },
  warning: {
    bg: 'rgba(183,121,31,0.12)',
    color: '#7B4F00',
    border: 'rgba(183,121,31,0.3)',
  },
  error: {
    bg: 'rgba(198,40,40,0.10)',
    color: '#B71C1C',
    border: 'rgba(198,40,40,0.25)',
  },
  info: {
    bg: 'rgba(37,99,235,0.10)',
    color: '#1E40AF',
    border: 'rgba(37,99,235,0.25)',
  },
  neutral: {
    bg: 'rgba(107,114,128,0.10)',
    color: '#374151',
    border: 'rgba(107,114,128,0.25)',
  },
  'program-v5': {
    bg: 'rgba(37,99,235,0.10)',
    color: '#1E40AF',
    border: 'rgba(37,99,235,0.25)',
  },
  'program-iq': {
    bg: 'rgba(242,195,82,0.20)',
    color: '#7B4F00',
    border: 'rgba(242,195,82,0.4)',
  },
  'program-combat': {
    bg: 'rgba(217,91,61,0.12)',
    color: '#9A3412',
    border: 'rgba(217,91,61,0.3)',
  },
  'program-general': {
    bg: 'rgba(126,143,185,0.12)',
    color: '#374151',
    border: 'rgba(126,143,185,0.3)',
  },
}

export function StatusBadge({ label, variant = 'neutral', size = 'sm' }: StatusBadgeProps) {
  const styles = VARIANT_STYLES[variant]
  const fontSize = size === 'sm' ? '0.75rem' : '0.8125rem'
  const padding = size === 'sm' ? '2px 8px' : '3px 10px'

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontSize,
        fontWeight: 500,
        padding,
        borderRadius: '999px',
        backgroundColor: styles.bg,
        color: styles.color,
        border: `1px solid ${styles.border}`,
        letterSpacing: '0.01em',
        whiteSpace: 'nowrap' as const,
      }}
    >
      {label}
    </span>
  )
}

// Convenience: program badge from program enum value
export function ProgramBadge({ program }: { program: 'vex_v5' | 'vex_iq' | 'combat' | 'not_sure' }) {
  const map = {
    vex_v5: { label: 'VEX V5', variant: 'program-v5' as BadgeVariant },
    vex_iq: { label: 'VEX IQ', variant: 'program-iq' as BadgeVariant },
    combat: { label: 'Combat Robotics', variant: 'program-combat' as BadgeVariant },
    not_sure: { label: 'Not Sure', variant: 'neutral' as BadgeVariant },
  }
  const { label, variant } = map[program]
  return <StatusBadge label={label} variant={variant} />
}
