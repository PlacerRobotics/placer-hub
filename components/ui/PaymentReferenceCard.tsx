/**
 * PaymentReferenceCard — displays payment reference code with copy button.
 * Always shown on registration confirmation. One code per enrollment.
 */

'use client'

import { useState } from 'react'

interface PaymentReferenceCardProps {
  code: string
  studentName?: string
  program?: string
}

export function PaymentReferenceCard({ code, studentName, program }: PaymentReferenceCardProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const el = document.createElement('textarea')
      el.value = code
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1.5px solid var(--color-border)',
        borderRadius: '10px',
        padding: '1.25rem',
        marginBottom: '1rem',
      }}
    >
      {(studentName || program) && (
        <div
          style={{
            fontSize: '0.8125rem',
            color: 'var(--color-text-muted)',
            marginBottom: '0.5rem',
            fontWeight: 500,
          }}
        >
          {studentName && <span>{studentName}</span>}
          {studentName && program && <span> · </span>}
          {program && <span>{program}</span>}
        </div>
      )}

      <div
        style={{
          fontSize: '0.8125rem',
          fontWeight: 600,
          color: 'var(--color-text-muted)',
          textTransform: 'uppercase' as const,
          letterSpacing: '0.08em',
          marginBottom: '0.375rem',
        }}
      >
        Payment reference code
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
        }}
      >
        <code
          style={{
            fontFamily: 'ui-monospace, SFMono-Regular, monospace',
            fontSize: '1.125rem',
            fontWeight: 700,
            color: 'var(--color-navy-deep)',
            letterSpacing: '0.05em',
            backgroundColor: 'var(--color-bg-light)',
            padding: '6px 12px',
            borderRadius: '6px',
            border: '1px solid var(--color-border)',
          }}
        >
          {code}
        </code>
        <button
          onClick={handleCopy}
          aria-label="Copy payment reference code"
          style={{
            padding: '6px 12px',
            backgroundColor: copied ? 'rgba(46,125,50,0.12)' : 'var(--color-bg-light)',
            color: copied ? '#1B5E20' : 'var(--color-navy-deep)',
            border: `1px solid ${copied ? 'rgba(46,125,50,0.3)' : 'var(--color-border)'}`,
            borderRadius: '6px',
            fontSize: '0.8125rem',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.15s',
            fontFamily: 'inherit',
          }}
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>

      <p
        style={{
          fontSize: '0.8125rem',
          color: 'var(--color-text-muted)',
          marginTop: '0.625rem',
          lineHeight: '1.5',
        }}
      >
        Use this code in Zeffy payment comments, check memo, Benevity notes, or employer matching forms.
      </p>
    </div>
  )
}
