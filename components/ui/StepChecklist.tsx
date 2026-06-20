/**
 * StepChecklist — ordered step list with status indicators.
 * Used for volunteer clearance, registration wizard progress,
 * and renewal flows.
 */

import { StatusBadge } from './StatusBadge'

type StepStatus = 'complete' | 'in_progress' | 'pending' | 'blocked' | 'skipped'

interface Step {
  id: string
  label: string
  status: StepStatus
  owner?: 'you' | 'placer_robotics' | 'system'
  detail?: string
  action?: {
    label: string
    href?: string
    onClick?: () => void
  }
}

interface StepChecklistProps {
  steps: Step[]
  title?: string
}

const STATUS_CONFIG: Record<StepStatus, { badge: string; variant: 'success' | 'info' | 'neutral' | 'error' | 'warning'; icon: string }> = {
  complete: { badge: 'Complete', variant: 'success', icon: '✓' },
  in_progress: { badge: 'In progress', variant: 'info', icon: '◷' },
  pending: { badge: 'Not started', variant: 'neutral', icon: '○' },
  blocked: { badge: 'Blocked', variant: 'error', icon: '✕' },
  skipped: { badge: 'Not required', variant: 'neutral', icon: '—' },
}

const OWNER_LABELS = {
  you: 'Your action needed',
  placer_robotics: 'Waiting on Placer Robotics',
  system: 'Automated',
}

export function StepChecklist({ steps, title }: StepChecklistProps) {
  return (
    <div>
      {title && (
        <h2 className="text-section-title" style={{ marginBottom: '1.25rem' }}>
          {title}
        </h2>
      )}
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '10px',
          overflow: 'hidden',
        }}
      >
        {steps.map((step, index) => {
          const config = STATUS_CONFIG[step.status]
          const isLast = index === steps.length - 1

          return (
            <div
              key={step.id}
              style={{
                padding: '1rem 1.25rem',
                borderBottom: isLast ? 'none' : '1px solid var(--color-border)',
                display: 'flex',
                gap: '1rem',
                alignItems: 'flex-start',
              }}
            >
              {/* Step icon */}
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.875rem',
                  flexShrink: 0,
                  backgroundColor:
                    step.status === 'complete'
                      ? 'rgba(46,125,50,0.12)'
                      : step.status === 'in_progress'
                      ? 'rgba(37,99,235,0.12)'
                      : 'var(--color-bg-light)',
                  color:
                    step.status === 'complete'
                      ? '#1B5E20'
                      : step.status === 'in_progress'
                      ? '#1E40AF'
                      : 'var(--color-text-muted)',
                  border: '1.5px solid',
                  borderColor:
                    step.status === 'complete'
                      ? 'rgba(46,125,50,0.3)'
                      : step.status === 'in_progress'
                      ? 'rgba(37,99,235,0.3)'
                      : 'var(--color-border)',
                  marginTop: '2px',
                }}
              >
                {config.icon}
              </div>

              {/* Content */}
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.625rem',
                    flexWrap: 'wrap' as const,
                    marginBottom: step.detail || step.owner ? '0.375rem' : 0,
                  }}
                >
                  <span
                    style={{
                      fontWeight: 500,
                      fontSize: '0.9375rem',
                      color:
                        step.status === 'skipped'
                          ? 'var(--color-text-muted)'
                          : 'var(--color-text-primary)',
                    }}
                  >
                    {step.label}
                  </span>
                  <StatusBadge label={config.badge} variant={config.variant} />
                </div>

                {step.owner && step.status !== 'complete' && step.status !== 'skipped' && (
                  <div
                    style={{
                      fontSize: '0.8125rem',
                      color: 'var(--color-text-muted)',
                      marginBottom: step.detail ? '0.25rem' : 0,
                    }}
                  >
                    {OWNER_LABELS[step.owner]}
                  </div>
                )}

                {step.detail && (
                  <div
                    style={{
                      fontSize: '0.8125rem',
                      color: 'var(--color-text-muted)',
                      lineHeight: '1.5',
                    }}
                  >
                    {step.detail}
                  </div>
                )}

                {step.action && step.status !== 'complete' && step.status !== 'skipped' && (
                  <div style={{ marginTop: '0.625rem' }}>
                    {step.action.href ? (
                      <a
                        href={step.action.href}
                        style={{
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          color: 'var(--color-navy-deep)',
                          textDecoration: 'underline',
                        }}
                      >
                        {step.action.label}
                      </a>
                    ) : (
                      <button
                        onClick={step.action.onClick}
                        style={{
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          color: 'var(--color-navy-deep)',
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          cursor: 'pointer',
                          textDecoration: 'underline',
                          fontFamily: 'inherit',
                        }}
                      >
                        {step.action.label}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
