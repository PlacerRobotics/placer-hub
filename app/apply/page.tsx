'use client'

import Link from 'next/link'
import { PublicShell, ProgramBadge, PrimaryButton } from '@/components/ui'

const PROGRAMS = [
  {
    program: 'vex_v5' as const,
    name: 'VEX V5 Robotics',
    grades: 'Grades 6–12',
    blurb: 'Build and code competition robots for the VEX V5 Robotics Competition. Teams meet weekly and travel to regional events.',
  },
  {
    program: 'combat' as const,
    name: 'Combat Robotics',
    grades: 'Grades 9–12',
    blurb: 'Design, machine, and drive combat robots. Emphasis on fabrication, safety, and iterative engineering.',
  },
  {
    program: 'vex_iq' as const,
    name: 'VEX IQ Robotics',
    grades: 'Grades 2–8',
    blurb: 'A hands-on introduction to robotics with snap-together parts and block or text coding. A great first competitive program.',
  },
]

const PROCESS = ['Apply', 'Accept', 'Register', 'Pay']

export default function ApplyPage() {
  return (
    <PublicShell maxWidth="lg">
      <h1 className="text-page-title">Apply for 2026–27 Placer Robotics</h1>
      <p className="text-body" style={{ marginTop: '0.75rem', color: 'var(--color-text-muted)', maxWidth: '36rem' }}>
        Tell us which program interests your family. Applications are reviewed on a rolling basis — you can change
        your selection later, and our team will help you find the right fit.
      </p>

      {/* Process overview */}
      <div style={{ marginTop: '2rem' }}>
        <div className="text-label" style={{ color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
          How it works
        </div>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          {PROCESS.map((step, i) => (
            <div key={step} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '999px',
                  padding: '0.4rem 0.9rem',
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--color-navy-deep)',
                    color: '#fff',
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                  }}
                >
                  {i + 1}
                </span>
                <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text-primary)' }}>{step}</span>
              </div>
              {i < PROCESS.length - 1 && (
                <span aria-hidden="true" style={{ color: 'var(--color-text-muted)' }}>→</span>
              )}
            </div>
          ))}
        </div>
        <p className="text-help" style={{ marginTop: '0.75rem' }}>
          Estimated time to apply: 10–15 minutes.
        </p>
      </div>

      {/* Program cards */}
      <div
        style={{
          marginTop: '2rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1rem',
        }}
      >
        {PROGRAMS.map((p) => (
          <div
            key={p.program}
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '10px',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
            }}
          >
            <div>
              <ProgramBadge program={p.program} />
            </div>
            <div className="text-card-title" style={{ marginTop: '0.25rem' }}>
              {p.name}
            </div>
            <div className="text-help">{p.grades}</div>
            <p style={{ fontSize: '0.9375rem', color: 'var(--color-text-muted)', lineHeight: 1.5, margin: 0 }}>
              {p.blurb}
            </p>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        <PrimaryButton size="lg" fullWidth>
          Start Application
        </PrimaryButton>
        <p className="text-help" style={{ textAlign: 'center', margin: 0 }}>
          Already started? <Link href="/login">Sign in to continue</Link>
        </p>
      </div>
    </PublicShell>
  )
}
