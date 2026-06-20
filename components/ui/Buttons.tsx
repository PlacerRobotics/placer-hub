/**
 * Button components
 * PrimaryButton — gold on public pages, navy on admin
 * SecondaryButton — outlined
 * DangerButton — red, destructive actions only
 */

import React from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
  fullWidth?: boolean
  loading?: boolean
  context?: 'public' | 'admin'
}

const SIZE_STYLES = {
  sm: { padding: '6px 14px', fontSize: '0.8125rem', minHeight: '32px' },
  md: { padding: '10px 20px', fontSize: '0.9375rem', minHeight: '44px' },
  lg: { padding: '13px 28px', fontSize: '1rem', minHeight: '52px' },
}

export function PrimaryButton({
  children,
  size = 'md',
  fullWidth = false,
  loading = false,
  context = 'public',
  disabled,
  style,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading
  const bgColor = context === 'public' ? 'var(--color-gold)' : 'var(--color-navy-deep)'
  const textColor = context === 'public' ? 'var(--color-navy-darker)' : '#fff'
  const hoverBg = context === 'public' ? 'var(--color-gold-dark)' : 'var(--color-navy-darker)'

  return (
    <button
      disabled={isDisabled}
      style={{
        ...SIZE_STYLES[size],
        backgroundColor: isDisabled ? 'var(--color-border)' : bgColor,
        color: isDisabled ? 'var(--color-text-muted)' : textColor,
        border: 'none',
        borderRadius: '6px',
        fontWeight: 600,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        width: fullWidth ? '100%' : 'auto',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        transition: 'background-color 0.15s',
        textDecoration: 'none',
        fontFamily: 'inherit',
        ...style,
      }}
      onMouseEnter={(e) => {
        if (!isDisabled) (e.target as HTMLButtonElement).style.backgroundColor = hoverBg
      }}
      onMouseLeave={(e) => {
        if (!isDisabled) (e.target as HTMLButtonElement).style.backgroundColor = bgColor
      }}
      {...props}
    >
      {loading ? 'Loading…' : children}
    </button>
  )
}

export function SecondaryButton({
  children,
  size = 'md',
  fullWidth = false,
  loading = false,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading

  return (
    <button
      disabled={isDisabled}
      style={{
        ...SIZE_STYLES[size],
        backgroundColor: 'transparent',
        color: isDisabled ? 'var(--color-text-muted)' : 'var(--color-navy-deep)',
        border: `1.5px solid ${isDisabled ? 'var(--color-border)' : 'var(--color-navy-deep)'}`,
        borderRadius: '6px',
        fontWeight: 500,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        width: fullWidth ? '100%' : 'auto',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        transition: 'all 0.15s',
        fontFamily: 'inherit',
        ...style,
      }}
      {...props}
    >
      {loading ? 'Loading…' : children}
    </button>
  )
}

export function DangerButton({
  children,
  size = 'md',
  fullWidth = false,
  loading = false,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading

  return (
    <button
      disabled={isDisabled}
      style={{
        ...SIZE_STYLES[size],
        backgroundColor: isDisabled ? 'var(--color-border)' : 'var(--color-error)',
        color: isDisabled ? 'var(--color-text-muted)' : '#fff',
        border: 'none',
        borderRadius: '6px',
        fontWeight: 600,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        width: fullWidth ? '100%' : 'auto',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        transition: 'background-color 0.15s',
        fontFamily: 'inherit',
        ...style,
      }}
      {...props}
    >
      {loading ? 'Loading…' : children}
    </button>
  )
}
