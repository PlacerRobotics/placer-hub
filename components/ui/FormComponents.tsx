'use client'

/**
 * Form components
 * FormSection — labeled section within a multi-step form
 * FormField — labeled input with help text and error state
 *
 * Marked 'use client' because TextInput/TextArea attach onFocus/onBlur handlers.
 * Without this, rendering them from a Server Component (e.g. /iq/team/[id]) throws
 * "Event handlers cannot be passed to Client Component props".
 */

import React from 'react'

// ── FormSection ──────────────────────────────────────────────────────────────

interface FormSectionProps {
  title: string
  description?: string
  children: React.ReactNode
}

export function FormSection({ title, description, children }: FormSectionProps) {
  return (
    <section style={{ marginBottom: '2rem' }}>
      <div style={{ marginBottom: '1.25rem' }}>
        <h2
          className="text-section-title"
          style={{ marginBottom: description ? '0.375rem' : 0 }}
        >
          {title}
        </h2>
        {description && (
          <p className="text-help" style={{ lineHeight: '1.5' }}>
            {description}
          </p>
        )}
      </div>
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '10px',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column' as const,
          gap: '1.25rem',
        }}
      >
        {children}
      </div>
    </section>
  )
}

// ── FormField ────────────────────────────────────────────────────────────────

interface FormFieldProps {
  label: string
  htmlFor?: string
  helpText?: string
  error?: string
  required?: boolean
  children: React.ReactNode
}

export function FormField({
  label,
  htmlFor,
  helpText,
  error,
  required = false,
  children,
}: FormFieldProps) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        style={{
          display: 'block',
          fontSize: '0.9375rem',
          fontWeight: 500,
          color: 'var(--color-text-primary)',
          marginBottom: '0.375rem',
        }}
      >
        {label}
        {required && (
          <span
            aria-hidden="true"
            style={{ color: 'var(--color-error)', marginLeft: '3px' }}
          >
            *
          </span>
        )}
      </label>

      {children}

      {error && (
        <p
          role="alert"
          style={{
            fontSize: '0.8125rem',
            color: 'var(--color-error)',
            marginTop: '0.375rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
          }}
        >
          <span aria-hidden="true">✕</span> {error}
        </p>
      )}

      {helpText && !error && (
        <p
          className="text-help"
          style={{ marginTop: '0.375rem' }}
        >
          {helpText}
        </p>
      )}
    </div>
  )
}

// ── TextInput ────────────────────────────────────────────────────────────────

interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

export function TextInput({ error, style, ...props }: TextInputProps) {
  return (
    <input
      style={{
        width: '100%',
        padding: '9px 12px',
        fontSize: '0.9375rem',
        color: 'var(--color-text-primary)',
        backgroundColor: 'var(--color-surface)',
        border: `1.5px solid ${error ? 'var(--color-error)' : 'var(--color-border)'}`,
        borderRadius: '6px',
        outline: 'none',
        fontFamily: 'inherit',
        boxSizing: 'border-box' as const,
        ...style,
      }}
      onFocus={(e) => {
        e.target.style.borderColor = error ? 'var(--color-error)' : 'var(--color-navy-deep)'
      }}
      onBlur={(e) => {
        e.target.style.borderColor = error ? 'var(--color-error)' : 'var(--color-border)'
      }}
      {...props}
    />
  )
}

// ── TextArea ─────────────────────────────────────────────────────────────────

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean
}

export function TextArea({ error, style, ...props }: TextAreaProps) {
  return (
    <textarea
      style={{
        width: '100%',
        padding: '9px 12px',
        fontSize: '0.9375rem',
        color: 'var(--color-text-primary)',
        backgroundColor: 'var(--color-surface)',
        border: `1.5px solid ${error ? 'var(--color-error)' : 'var(--color-border)'}`,
        borderRadius: '6px',
        outline: 'none',
        fontFamily: 'inherit',
        resize: 'vertical' as const,
        minHeight: '100px',
        boxSizing: 'border-box' as const,
        ...style,
      }}
      {...props}
    />
  )
}
