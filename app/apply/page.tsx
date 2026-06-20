'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  PublicShell,
  FormField,
  TextInput,
  PrimaryButton,
  SecondaryButton,
  InfoAlert,
  SuccessAlert,
  ErrorAlert,
  ProgramBadge,
} from '@/components/ui'

type Program = 'vex_v5' | 'combat' | 'vex_iq' | 'not_sure'

const PROGRAMS: { value: Program; name: string; grades: string }[] = [
  { value: 'vex_v5', name: 'VEX V5 Robotics', grades: 'Grades 6–12' },
  { value: 'combat', name: 'Combat Robotics', grades: 'Grades 9–12' },
  { value: 'vex_iq', name: 'VEX IQ Robotics', grades: 'Grades 2–8' },
  { value: 'not_sure', name: 'Not sure yet', grades: 'We’ll help you choose' },
]

const OTHER_SCHOOL = '__other__'

const cardBase: React.CSSProperties = {
  backgroundColor: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: '10px',
  padding: '1.5rem',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.9375rem',
  fontWeight: 500,
  color: 'var(--color-text-primary)',
  marginBottom: '0.375rem',
}

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  fontSize: '0.9375rem',
  color: 'var(--color-text-primary)',
  backgroundColor: 'var(--color-surface)',
  border: '1.5px solid var(--color-border)',
  borderRadius: '6px',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
}

export default function ApplyPage() {
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [successName, setSuccessName] = useState('')

  // Step 1
  const [program, setProgram] = useState<Program | ''>('')
  // Step 2
  const [stuFirst, setStuFirst] = useState('')
  const [stuLast, setStuLast] = useState('')
  const [grade, setGrade] = useState('')
  const [schoolId, setSchoolId] = useState('')
  const [schoolOther, setSchoolOther] = useState('')
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([])
  // Step 3
  const [g1First, setG1First] = useState('')
  const [g1Last, setG1Last] = useState('')
  const [g1Email, setG1Email] = useState('')
  const [g1Phone, setG1Phone] = useState('')
  const [g2First, setG2First] = useState('')
  const [g2Last, setG2Last] = useState('')
  const [g2Email, setG2Email] = useState('')
  const [g2Phone, setG2Phone] = useState('')

  useEffect(() => {
    fetch('/api/schools')
      .then((r) => r.json())
      .then((d) => setSchools(d.schools ?? []))
      .catch(() => setSchools([]))
  }, [])

  const step1Valid = program !== ''
  const step2Valid = stuFirst.trim() && stuLast.trim() && grade && (schoolId !== OTHER_SCHOOL || schoolOther.trim())
  const step3Valid = g1First.trim() && g1Last.trim() && g1Email.trim() && g1Phone.trim()

  async function handleSubmit() {
    if (!step3Valid || submitting) return
    setSubmitting(true)
    setError('')
    const payload = {
      program,
      student: {
        first_name: stuFirst.trim(),
        last_name: stuLast.trim(),
        grade: Number(grade),
        school_id: schoolId && schoolId !== OTHER_SCHOOL ? schoolId : null,
        school_raw: schoolId === OTHER_SCHOOL ? schoolOther.trim() : null,
      },
      guardian1: {
        first_name: g1First.trim(),
        last_name: g1Last.trim(),
        email: g1Email.trim(),
        phone: g1Phone.trim(),
      },
      guardian2: g2Email.trim()
        ? { first_name: g2First.trim(), last_name: g2Last.trim(), email: g2Email.trim(), phone: g2Phone.trim() }
        : null,
    }
    try {
      const res = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Something went wrong submitting your application.')
      } else {
        setSuccessName(data.student_name || `${stuFirst} ${stuLast}`)
      }
    } catch {
      setError('Network error — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (successName) {
    return (
      <PublicShell maxWidth="md">
        <h1 className="text-page-title">Application submitted</h1>
        <div style={{ marginTop: '1.5rem' }}>
          <SuccessAlert title={`We received ${successName}'s application`}>
            Thanks for applying to Placer Robotics for the 2026–27 season. Our team reviews applications
            on a rolling basis and will email {g1Email} once a decision is made.
          </SuccessAlert>
        </div>
        <div style={{ ...cardBase, marginTop: '1.5rem' }}>
          <h2 className="text-card-title" style={{ marginBottom: '0.75rem' }}>What happens next</h2>
          <ol style={{ margin: 0, paddingLeft: '1.25rem', color: 'var(--color-text-muted)', fontSize: '0.9375rem', lineHeight: 1.6 }}>
            <li>We review the application (usually within a few days).</li>
            <li>You’ll get an email with the decision.</li>
            <li>If accepted, you’ll sign in to complete registration and payment.</li>
          </ol>
          <div style={{ marginTop: '1.25rem' }}>
            <Link href="/login">Already have an account? Sign in →</Link>
          </div>
        </div>
      </PublicShell>
    )
  }

  return (
    <PublicShell maxWidth="md">
      <h1 className="text-page-title">Apply for 2026–27 Placer Robotics</h1>
      <p className="text-help" style={{ marginTop: '0.5rem' }}>Step {step} of 3</p>

      {error && (
        <div style={{ marginTop: '1rem' }}>
          <ErrorAlert title="Couldn’t submit">{error}</ErrorAlert>
        </div>
      )}

      {/* Step 1 — program selection */}
      {step === 1 && (
        <div style={{ marginTop: '1.5rem' }}>
          <h2 className="text-section-title" style={{ marginBottom: '1rem' }}>Which program interests your family?</h2>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {PROGRAMS.map((p) => {
              const selected = program === p.value
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setProgram(p.value)}
                  style={{
                    ...cardBase,
                    textAlign: 'left',
                    cursor: 'pointer',
                    borderColor: selected ? 'var(--color-navy-deep)' : 'var(--color-border)',
                    borderWidth: selected ? '2px' : '1px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    fontFamily: 'inherit',
                  }}
                >
                  <span>
                    <span className="text-card-title">{p.name}</span>
                    <span className="text-help" style={{ display: 'block' }}>{p.grades}</span>
                  </span>
                  {p.value !== 'not_sure' && <ProgramBadge program={p.value === 'vex_v5' ? 'vex_v5' : p.value === 'combat' ? 'combat' : 'vex_iq'} />}
                </button>
              )
            })}
          </div>
          <div style={{ marginTop: '1.5rem' }}>
            <PrimaryButton fullWidth disabled={!step1Valid} onClick={() => setStep(2)}>Continue</PrimaryButton>
          </div>
        </div>
      )}

      {/* Step 2 — student info */}
      {step === 2 && (
        <div style={{ ...cardBase, marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h2 className="text-section-title">Student information</h2>
          <FormField label="First name" htmlFor="stuFirst" required>
            <TextInput id="stuFirst" value={stuFirst} onChange={(e) => setStuFirst(e.target.value)} />
          </FormField>
          <FormField label="Last name" htmlFor="stuLast" required>
            <TextInput id="stuLast" value={stuLast} onChange={(e) => setStuLast(e.target.value)} />
          </FormField>
          <div>
            <label htmlFor="grade" style={labelStyle}>Grade (2026–27)<span style={{ color: 'var(--color-error)', marginLeft: 3 }}>*</span></label>
            <select id="grade" value={grade} onChange={(e) => setGrade(e.target.value)} style={selectStyle}>
              <option value="">Select grade…</option>
              {[6, 7, 8, 9, 10, 11, 12].map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="school" style={labelStyle}>School</label>
            <select id="school" value={schoolId} onChange={(e) => setSchoolId(e.target.value)} style={selectStyle}>
              <option value="">Select school…</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
              <option value={OTHER_SCHOOL}>Other (not listed)</option>
            </select>
            {schoolId === OTHER_SCHOOL && (
              <div style={{ marginTop: '0.625rem' }}>
                <TextInput placeholder="School name" value={schoolOther} onChange={(e) => setSchoolOther(e.target.value)} />
              </div>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
            <SecondaryButton onClick={() => setStep(1)}>Back</SecondaryButton>
            <PrimaryButton disabled={!step2Valid} onClick={() => setStep(3)}>Continue</PrimaryButton>
          </div>
        </div>
      )}

      {/* Step 3 — guardian info */}
      {step === 3 && (
        <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ ...cardBase, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h2 className="text-section-title">Guardian 1</h2>
            <FormField label="First name" htmlFor="g1First" required>
              <TextInput id="g1First" value={g1First} onChange={(e) => setG1First(e.target.value)} />
            </FormField>
            <FormField label="Last name" htmlFor="g1Last" required>
              <TextInput id="g1Last" value={g1Last} onChange={(e) => setG1Last(e.target.value)} />
            </FormField>
            <FormField label="Email" htmlFor="g1Email" required helpText="This becomes your sign-in email.">
              <TextInput id="g1Email" type="email" value={g1Email} onChange={(e) => setG1Email(e.target.value)} />
            </FormField>
            <FormField label="Mobile phone" htmlFor="g1Phone" required>
              <TextInput id="g1Phone" type="tel" value={g1Phone} onChange={(e) => setG1Phone(e.target.value)} />
            </FormField>
          </div>

          <div style={{ ...cardBase, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h2 className="text-section-title">Guardian 2 <span className="text-help">(optional)</span></h2>
            <FormField label="First name" htmlFor="g2First">
              <TextInput id="g2First" value={g2First} onChange={(e) => setG2First(e.target.value)} />
            </FormField>
            <FormField label="Last name" htmlFor="g2Last">
              <TextInput id="g2Last" value={g2Last} onChange={(e) => setG2Last(e.target.value)} />
            </FormField>
            <FormField label="Email" htmlFor="g2Email">
              <TextInput id="g2Email" type="email" value={g2Email} onChange={(e) => setG2Email(e.target.value)} />
            </FormField>
            <FormField label="Mobile phone" htmlFor="g2Phone">
              <TextInput id="g2Phone" type="tel" value={g2Phone} onChange={(e) => setG2Phone(e.target.value)} />
            </FormField>
          </div>

          <InfoAlert title="Both guardians receive all communications">
            We send notifications to every guardian on the account. Add a second guardian if you’d like them included.
          </InfoAlert>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
            <SecondaryButton onClick={() => setStep(2)}>Back</SecondaryButton>
            <PrimaryButton disabled={!step3Valid} loading={submitting} onClick={handleSubmit}>
              Submit application
            </PrimaryButton>
          </div>
        </div>
      )}
    </PublicShell>
  )
}
