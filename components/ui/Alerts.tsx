/**
 * Alert components — informational, warning, error, success
 * Never rely on color alone. Always include text.
 */

interface AlertProps {
  children: React.ReactNode
  title?: string
}

const BASE_STYLE = {
  borderRadius: '6px',
  padding: '0.875rem 1rem',
  fontSize: '0.9375rem',
  lineHeight: '1.5',
  display: 'flex',
  gap: '0.75rem',
}

export function InfoAlert({ title, children }: AlertProps) {
  return (
    <div
      role="note"
      style={{
        ...BASE_STYLE,
        backgroundColor: 'rgba(37,99,235,0.08)',
        border: '1px solid rgba(37,99,235,0.2)',
        color: '#1E3A8A',
      }}
    >
      <span style={{ fontSize: '1rem', flexShrink: 0 }}>ℹ</span>
      <div>
        {title && <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{title}</div>}
        <div>{children}</div>
      </div>
    </div>
  )
}

export function WarningAlert({ title, children }: AlertProps) {
  return (
    <div
      role="alert"
      style={{
        ...BASE_STYLE,
        backgroundColor: 'rgba(183,121,31,0.08)',
        border: '1px solid rgba(183,121,31,0.25)',
        color: '#7B4F00',
      }}
    >
      <span style={{ fontSize: '1rem', flexShrink: 0 }}>⚠</span>
      <div>
        {title && <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{title}</div>}
        <div>{children}</div>
      </div>
    </div>
  )
}

export function ErrorAlert({ title, children }: AlertProps) {
  return (
    <div
      role="alert"
      style={{
        ...BASE_STYLE,
        backgroundColor: 'rgba(198,40,40,0.08)',
        border: '1px solid rgba(198,40,40,0.2)',
        color: '#B71C1C',
      }}
    >
      <span style={{ fontSize: '1rem', flexShrink: 0 }}>✕</span>
      <div>
        {title && <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{title}</div>}
        <div>{children}</div>
      </div>
    </div>
  )
}

export function SuccessAlert({ title, children }: AlertProps) {
  return (
    <div
      role="status"
      style={{
        ...BASE_STYLE,
        backgroundColor: 'rgba(46,125,50,0.08)',
        border: '1px solid rgba(46,125,50,0.2)',
        color: '#1B5E20',
      }}
    >
      <span style={{ fontSize: '1rem', flexShrink: 0 }}>✓</span>
      <div>
        {title && <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{title}</div>}
        <div>{children}</div>
      </div>
    </div>
  )
}
