/**
 * Admin components
 * AdminQueueTable — queue-based table with sort, filter, status
 * AdminDetailPanel — record detail with actions and audit
 * PermissionNotice — role-restricted message
 */

import { StatusBadge } from './StatusBadge'

// ── AdminQueueCard — queue item cards ────────────────────────────────────────

interface QueueItem {
  id: string
  primary: string
  secondary?: string
  meta?: string
  status: string
  statusVariant?: 'success' | 'warning' | 'error' | 'info' | 'neutral'
  waitingTime?: string
  onClick?: () => void
}

interface AdminQueueTableProps {
  title: string
  count?: number
  items: QueueItem[]
  emptyMessage?: string
}

export function AdminQueueTable({ title, count, items, emptyMessage }: AdminQueueTableProps) {
  return (
    <div style={{ marginBottom: '2rem' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.625rem',
          marginBottom: '0.875rem',
        }}
      >
        <h2 className="text-card-title" style={{ color: 'var(--color-text-primary)' }}>
          {title}
        </h2>
        {count !== undefined && (
          <span
            style={{
              backgroundColor: 'var(--color-navy-deep)',
              color: '#fff',
              fontSize: '0.75rem',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '999px',
              minWidth: '24px',
              textAlign: 'center' as const,
            }}
          >
            {count}
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            padding: '2rem',
            textAlign: 'center' as const,
            color: 'var(--color-text-muted)',
            fontSize: '0.9375rem',
          }}
        >
          {emptyMessage ?? 'Nothing here — all caught up.'}
        </div>
      ) : (
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            overflow: 'hidden',
          }}
        >
          {items.map((item, index) => (
            <div
              key={item.id}
              onClick={item.onClick}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '0.875rem 1.25rem',
                borderBottom: index < items.length - 1 ? '1px solid var(--color-border)' : 'none',
                cursor: item.onClick ? 'pointer' : 'default',
                gap: '1rem',
              }}
              onMouseEnter={(e) => {
                if (item.onClick) (e.currentTarget as HTMLDivElement).style.backgroundColor = 'var(--color-bg-light)'
              }}
              onMouseLeave={(e) => {
                if (item.onClick) (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent'
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 500,
                    fontSize: '0.9375rem',
                    color: 'var(--color-text-primary)',
                    marginBottom: item.secondary ? '0.125rem' : 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap' as const,
                  }}
                >
                  {item.primary}
                </div>
                {item.secondary && (
                  <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                    {item.secondary}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                {item.waitingTime && (
                  <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                    {item.waitingTime}
                  </span>
                )}
                <StatusBadge label={item.status} variant={item.statusVariant ?? 'neutral'} />
                {item.onClick && (
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>›</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── AdminDetailPanel ─────────────────────────────────────────────────────────

interface DetailField {
  label: string
  value: React.ReactNode
}

interface AdminDetailPanelProps {
  title: string
  fields: DetailField[]
  children?: React.ReactNode
}

export function AdminDetailPanel({ title, fields, children }: AdminDetailPanelProps) {
  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: '10px',
        overflow: 'hidden',
        marginBottom: '1.5rem',
      }}
    >
      <div
        style={{
          padding: '1rem 1.25rem',
          borderBottom: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-bg-light)',
        }}
      >
        <h3 className="text-card-title">{title}</h3>
      </div>
      <div style={{ padding: '1.25rem' }}>
        <dl style={{ display: 'grid', gap: '0.75rem' }}>
          {fields.map((field) => (
            <div key={field.label} style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '0.5rem', alignItems: 'start' }}>
              <dt className="text-label" style={{ color: 'var(--color-text-muted)', paddingTop: '1px' }}>
                {field.label}
              </dt>
              <dd style={{ fontSize: '0.9375rem', color: 'var(--color-text-primary)', margin: 0 }}>
                {field.value}
              </dd>
            </div>
          ))}
        </dl>
        {children && <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--color-border)' }}>{children}</div>}
      </div>
    </div>
  )
}

// ── PermissionNotice ─────────────────────────────────────────────────────────

interface PermissionNoticeProps {
  message: string
  context?: string
}

export function PermissionNotice({ message, context }: PermissionNoticeProps) {
  return (
    <div
      role="note"
      style={{
        backgroundColor: 'var(--color-bg-light)',
        border: '1px solid var(--color-border)',
        borderRadius: '6px',
        padding: '0.75rem 1rem',
        fontSize: '0.875rem',
        color: 'var(--color-text-muted)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
      }}
    >
      <span aria-hidden="true">🔒</span>
      <div>
        <span>{message}</span>
        {context && <span style={{ marginLeft: '0.25rem', color: 'var(--color-text-muted)' }}>{context}</span>}
      </div>
    </div>
  )
}
