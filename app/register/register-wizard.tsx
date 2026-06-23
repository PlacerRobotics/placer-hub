'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  FamilyShell,
  PageHeader,
  FormSection,
  FormField,
  TextInput,
  PrimaryButton,
  SecondaryButton,
  ProgramBadge,
  PaymentReferenceCard,
  WarningAlert,
  ErrorAlert,
} from '@/components/ui'

const OTHER_SCHOOL = '__other__'
const STEPS = ['Student', 'Emergency Contact', 'Waivers', 'Review']

// Enum value -> display label. New youth/adult options plus legacy values that
// may already be on imported student records.
const TSHIRT_OPTIONS: [string, string][] = [
  ['ym', 'Youth Medium'],
  ['yl', 'Youth Large'],
  ['xs', 'Adult XS'],
  ['s', 'Adult Small'],
  ['m', 'Adult Medium'],
  ['l', 'Adult Large'],
  ['xl', 'Adult XL'],
  ['xxl', 'Adult 2XL'],
  ['xxxl', 'Adult 3XL'],
]
const TSHIRT_LABELS: Record<string, string> = Object.fromEntries(TSHIRT_OPTIONS)

type Program = 'vex_v5' | 'vex_iq' | 'combat' | 'not_sure'

type Props = {
  season: string
  studentId: string
  program: string
  student: {
    first_name: string
    last_name: string
    preferred_name: string | null
    birthdate: string | null
    grade: number | null
    school_id: string | null
    school_raw: string | null
    tshirt_size: string | null
    fusion_education_email: string | null
  }
  schools: { id: string; name: string; grade_min: number | null; grade_max: number | null }[]
  waivers: { id: string; waiver_type: string; version: string; title: string; body_markdown: string; body_hash: string }[]
  paymentReferenceCode: string
  guardianName: string
  zeffyUrl: string | null
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

function Stepper({ step }: { step: number }) {
  return (
    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.75rem', flexWrap: 'wrap' }}>
      {STEPS.map((label, i) => {
        const n = i + 1
        const active = n === step
        const done = n < step
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 24,
                height: 24,
                borderRadius: '50%',
                fontSize: '0.75rem',
                fontWeight: 700,
                backgroundColor: active || done ? 'var(--color-navy-deep)' : 'var(--color-border)',
                color: active || done ? '#fff' : 'var(--color-text-muted)',
              }}
            >
              {done ? '✓' : n}
            </span>
            <span
              style={{
                fontSize: '0.875rem',
                fontWeight: active ? 600 : 500,
                color: active ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
              }}
            >
              {label}
            </span>
            {n < STEPS.length && <span style={{ color: 'var(--color-text-muted)' }}>·</span>}
          </div>
        )
      })}
    </div>
  )
}

export default function RegisterWizard({
  season,
  studentId,
  program,
  student,
  schools,
  waivers,
  paymentReferenceCode,
  guardianName,
  zeffyUrl,
}: Props) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Step 1
  const [first, setFirst] = useState(student.first_name ?? '')
  const [last, setLast] = useState(student.last_name ?? '')
  const [preferred, setPreferred] = useState(student.preferred_name ?? '')
  const [dob, setDob] = useState(student.birthdate ?? '')
  const [grade, setGrade] = useState(student.grade ? String(student.grade) : '')
  const [schoolId, setSchoolId] = useState(student.school_id ?? (student.school_raw ? OTHER_SCHOOL : ''))
  const [schoolOther, setSchoolOther] = useState(student.school_raw ?? '')
  const [tshirt, setTshirt] = useState(student.tshirt_size ?? '')
  const [fusion, setFusion] = useState(student.fusion_education_email ?? '')

  // Step 2
  const [ec1First, setEc1First] = useState('')
  const [ec1Last, setEc1Last] = useState('')
  const [ec1Rel, setEc1Rel] = useState('')
  const [ec1Phone, setEc1Phone] = useState('')
  const [ec2First, setEc2First] = useState('')
  const [ec2Last, setEc2Last] = useState('')
  const [ec2Rel, setEc2Rel] = useState('')
  const [ec2Phone, setEc2Phone] = useState('')

  // Step 3
  const [agreed, setAgreed] = useState<Record<string, boolean>>({})
  const [studentSig, setStudentSig] = useState('')
  const [signature, setSignature] = useState('')

  const schoolName = useMemo(() => {
    if (schoolId === OTHER_SCHOOL) return schoolOther
    return schools.find((s) => s.id === schoolId)?.name ?? '—'
  }, [schoolId, schoolOther, schools])

  // Narrow the school list to those serving the selected grade. NULL min/max are
  // treated as open-ended so a school without a range is never hidden.
  const visibleSchools = useMemo(() => {
    if (!grade) return schools
    const g = Number(grade)
    return schools.filter(
      (s) => g >= (s.grade_min ?? -Infinity) && g <= (s.grade_max ?? Infinity)
    )
  }, [schools, grade])

  // If a previously-selected school no longer serves the chosen grade, clear it.
  useEffect(() => {
    if (schoolId && schoolId !== OTHER_SCHOOL && !visibleSchools.some((s) => s.id === schoolId)) {
      setSchoolId('')
    }
  }, [visibleSchools, schoolId])

  const step1Valid = first.trim() && last.trim() && dob && grade && tshirt && (schoolId !== OTHER_SCHOOL || schoolOther.trim()) && schoolId
  const step2Valid = ec1First.trim() && ec1Last.trim() && ec1Rel.trim() && ec1Phone.trim()
  const allWaiversAgreed = waivers.length > 0 ? waivers.every((w) => agreed[w.id]) : true
  const step3Valid = allWaiversAgreed && studentSig.trim() && signature.trim()

  async function handleSubmit() {
    if (submitting) return
    setSubmitting(true)
    setError('')
    const payload = {
      studentId,
      program,
      paymentReferenceCode,
      signatureName: signature.trim(),
      studentSignatureName: studentSig.trim(),
      student: {
        first_name: first.trim(),
        last_name: last.trim(),
        preferred_name: preferred.trim() || null,
        birthdate: dob || null,
        grade: Number(grade),
        school_id: schoolId && schoolId !== OTHER_SCHOOL ? schoolId : null,
        school_raw: schoolId === OTHER_SCHOOL ? schoolOther.trim() : null,
        tshirt_size: tshirt || null,
        fusion_education_email: fusion.trim() || null,
      },
      emergency: {
        first_name: ec1First.trim(),
        last_name: ec1Last.trim(),
        relationship: ec1Rel.trim(),
        phone: ec1Phone.trim(),
        second_first_name: ec2First.trim(),
        second_last_name: ec2Last.trim(),
        second_relationship: ec2Rel.trim(),
        second_phone: ec2Phone.trim(),
      },
    }
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Something went wrong submitting your registration.')
        setSubmitting(false)
      } else {
        router.push('/dashboard?notice=registered')
      }
    } catch {
      setError('Network error — please try again.')
      setSubmitting(false)
    }
  }

  return (
    <FamilyShell familyName={guardianName} maxWidth="lg">
      <PageHeader
        title="Complete Registration"
        subtitle={`Registering ${first || student.first_name} for the ${season} season`}
      />
      <Stepper step={step} />

      {error && (
        <div style={{ marginBottom: '1.25rem' }}>
          <ErrorAlert title="Couldn’t complete registration">{error}</ErrorAlert>
        </div>
      )}

      {/* Step 1 — Student Information */}
      {step === 1 && (
        <>
          <FormSection title="Student Information" description="Tell us about the student you’re registering.">
            <FormField label="Legal first name" htmlFor="first" required>
              <TextInput id="first" value={first} onChange={(e) => setFirst(e.target.value)} />
            </FormField>
            <FormField label="Legal last name" htmlFor="last" required>
              <TextInput id="last" value={last} onChange={(e) => setLast(e.target.value)} />
            </FormField>
            <FormField label="Preferred name" htmlFor="preferred">
              <TextInput id="preferred" value={preferred} onChange={(e) => setPreferred(e.target.value)} />
            </FormField>
            <FormField label="Date of birth" htmlFor="dob" required>
              <TextInput id="dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
            </FormField>
            <div>
              <label htmlFor="grade" style={labelStyle}>Grade<span style={{ color: 'var(--color-error)', marginLeft: 3 }}>*</span></label>
              <select id="grade" value={grade} onChange={(e) => setGrade(e.target.value)} style={selectStyle}>
                <option value="">Select grade…</option>
                {[3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="school" style={labelStyle}>School<span style={{ color: 'var(--color-error)', marginLeft: 3 }}>*</span></label>
              <select id="school" value={schoolId} onChange={(e) => setSchoolId(e.target.value)} style={selectStyle}>
                <option value="">{grade ? 'Select school…' : 'Select grade first…'}</option>
                {visibleSchools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                <option value={OTHER_SCHOOL}>Other (not listed)</option>
              </select>
              {schoolId === OTHER_SCHOOL && (
                <div style={{ marginTop: '0.625rem' }}>
                  <TextInput placeholder="School name" value={schoolOther} onChange={(e) => setSchoolOther(e.target.value)} />
                </div>
              )}
            </div>
            <div>
              <label htmlFor="tshirt" style={labelStyle}>T-shirt size<span style={{ color: 'var(--color-error)', marginLeft: 3 }}>*</span></label>
              <select id="tshirt" value={tshirt} onChange={(e) => setTshirt(e.target.value)} style={selectStyle}>
                <option value="">Select size…</option>
                {TSHIRT_OPTIONS.map(([v, lbl]) => (
                  <option key={v} value={v}>{lbl}</option>
                ))}
              </select>
            </div>
            <FormField label="Fusion Education email" htmlFor="fusion" helpText="Use your student Fusion account email if you have one.">
              <TextInput id="fusion" type="email" value={fusion} onChange={(e) => setFusion(e.target.value)} />
            </FormField>
          </FormSection>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <PrimaryButton disabled={!step1Valid} onClick={() => setStep(2)}>Continue</PrimaryButton>
          </div>
        </>
      )}

      {/* Step 2 — Emergency Contact */}
      {step === 2 && (
        <>
          <FormSection title="Emergency Contact" description="Someone we can reach if we can’t reach a guardian.">
            <FormField label="First name" htmlFor="ec1First" required>
              <TextInput id="ec1First" value={ec1First} onChange={(e) => setEc1First(e.target.value)} />
            </FormField>
            <FormField label="Last name" htmlFor="ec1Last" required>
              <TextInput id="ec1Last" value={ec1Last} onChange={(e) => setEc1Last(e.target.value)} />
            </FormField>
            <FormField label="Relationship to student" htmlFor="ec1Rel" required>
              <TextInput id="ec1Rel" value={ec1Rel} onChange={(e) => setEc1Rel(e.target.value)} />
            </FormField>
            <FormField label="Phone" htmlFor="ec1Phone" required>
              <TextInput id="ec1Phone" type="tel" value={ec1Phone} onChange={(e) => setEc1Phone(e.target.value)} />
            </FormField>
          </FormSection>

          <FormSection title="Secondary emergency contact (optional)">
            <FormField label="First name" htmlFor="ec2First">
              <TextInput id="ec2First" value={ec2First} onChange={(e) => setEc2First(e.target.value)} />
            </FormField>
            <FormField label="Last name" htmlFor="ec2Last">
              <TextInput id="ec2Last" value={ec2Last} onChange={(e) => setEc2Last(e.target.value)} />
            </FormField>
            <FormField label="Relationship to student" htmlFor="ec2Rel">
              <TextInput id="ec2Rel" value={ec2Rel} onChange={(e) => setEc2Rel(e.target.value)} />
            </FormField>
            <FormField label="Phone" htmlFor="ec2Phone">
              <TextInput id="ec2Phone" type="tel" value={ec2Phone} onChange={(e) => setEc2Phone(e.target.value)} />
            </FormField>
          </FormSection>

          <div style={{ marginBottom: '1.25rem' }}>
            <WarningAlert>
              Emergency contact cannot be a parent/guardian already listed on your account.
            </WarningAlert>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
            <SecondaryButton onClick={() => setStep(1)}>Back</SecondaryButton>
            <PrimaryButton disabled={!step2Valid} onClick={() => setStep(3)}>Continue</PrimaryButton>
          </div>
        </>
      )}

      {/* Step 3 — Waivers */}
      {step === 3 && (
        <>
          <h2 className="text-section-title" style={{ marginBottom: '1rem' }}>Waivers</h2>
          {waivers.length === 0 && (
            <div style={{ marginBottom: '1.25rem' }}>
              <WarningAlert>No active waivers are configured yet — you can continue.</WarningAlert>
            </div>
          )}
          {waivers.map((w) => (
            <div
              key={w.id}
              style={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: '10px',
                padding: '1.25rem',
                marginBottom: '1.25rem',
              }}
            >
              <h3 className="text-card-title" style={{ marginBottom: '0.5rem' }}>{w.title}</h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: '0 0 0.625rem' }}>
                Scroll within the box below to read the full agreement.
              </p>
              <div
                style={{
                  maxHeight: '300px',
                  overflowY: 'auto',
                  border: '1px solid var(--color-border)',
                  borderRadius: '6px',
                  padding: '0.875rem',
                  fontSize: '0.875rem',
                  lineHeight: 1.6,
                  color: 'var(--color-text-muted)',
                  whiteSpace: 'pre-wrap',
                  marginBottom: '0.875rem',
                }}
              >
                {w.body_markdown}
              </div>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem', fontSize: '0.9375rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={!!agreed[w.id]}
                  onChange={(e) => setAgreed((prev) => ({ ...prev, [w.id]: e.target.checked }))}
                  style={{ marginTop: '0.25rem' }}
                />
                <span>I have read and agree to the {w.title}.</span>
              </label>
            </div>
          ))}

          <FormSection
            title="Signatures"
            description="Both the participant and a parent or legal guardian acknowledge all of the agreements above. Type each full legal name below — today's date is recorded automatically with each signature."
          >
            <FormField
              label="Student / participant full legal name"
              htmlFor="studentSig"
              required
              helpText="The student's printed name, as their acknowledgment of the agreements above."
            >
              <TextInput
                id="studentSig"
                value={studentSig}
                onChange={(e) => setStudentSig(e.target.value)}
                placeholder={`${first || student.first_name} ${last || student.last_name}`.trim()}
              />
            </FormField>
            <FormField
              label="Parent / legal guardian full legal name"
              htmlFor="signature"
              required
              helpText="Your printed name, signing as the parent or legal guardian on the participant's behalf."
            >
              <TextInput id="signature" value={signature} onChange={(e) => setSignature(e.target.value)} placeholder={guardianName} />
            </FormField>
          </FormSection>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
            <SecondaryButton onClick={() => setStep(2)}>Back</SecondaryButton>
            <PrimaryButton disabled={!step3Valid} onClick={() => setStep(4)}>Continue</PrimaryButton>
          </div>
        </>
      )}

      {/* Step 4 — Review & Submit */}
      {step === 4 && (
        <>
          <FormSection title="Review &amp; Submit" description="Please confirm everything is correct before submitting.">
            <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.9375rem' }}>
              <Row label="Student" value={`${first} ${last}${preferred ? ` (${preferred})` : ''}`} />
              <Row label="Date of birth" value={dob || '—'} />
              <Row label="Grade" value={grade || '—'} />
              <Row label="School" value={schoolName} />
              <Row label="T-shirt size" value={TSHIRT_LABELS[tshirt] ?? (tshirt || '—')} />
              <Row label="Emergency contact" value={`${ec1First} ${ec1Last} · ${ec1Rel} · ${ec1Phone}`} />
              <Row label="Student signature" value={studentSig || '—'} />
              <Row label="Parent/guardian signature" value={signature || '—'} />
            </div>
            <div style={{ marginTop: '0.75rem' }}>
              <div className="text-label" style={{ color: 'var(--color-text-muted)', marginBottom: '0.375rem' }}>Program</div>
              <ProgramBadge program={(['vex_v5', 'vex_iq', 'combat', 'not_sure'].includes(program) ? program : 'not_sure') as Program} />
            </div>
          </FormSection>

          <h2 className="text-section-title" style={{ margin: '0 0 1rem' }}>Payment</h2>
          <PaymentReferenceCard code={paymentReferenceCode} studentName={`${first} ${last}`} />
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '10px',
              padding: '1.25rem',
              marginBottom: '1.5rem',
            }}
          >
            <p style={{ fontSize: '0.9375rem', color: 'var(--color-text-muted)', lineHeight: 1.6, margin: '0 0 1rem' }}>
              Your spot is secured once payment is received. Include your payment reference code{' '}
              <strong style={{ color: 'var(--color-text-primary)' }}>{paymentReferenceCode}</strong> with your payment.
            </p>

            {/* Online payment — the preferred, primary path */}
            <p style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 0.625rem' }}>
              Pay online (recommended)
            </p>
            {zeffyUrl ? (
              <a
                href={zeffyUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-block',
                  padding: '12px 24px',
                  backgroundColor: 'var(--color-gold)',
                  color: 'var(--color-navy-darker)',
                  fontWeight: 700,
                  fontSize: '0.9375rem',
                  borderRadius: '6px',
                  textDecoration: 'none',
                }}
              >
                Pay online via Zeffy →
              </a>
            ) : (
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: 0 }}>
                The secure online payment link will be emailed to you after you submit.
              </p>
            )}

            {/* Check — secondary, collapsed behind a disclosure */}
            <details style={{ marginTop: '1.25rem' }}>
              <summary style={{ cursor: 'pointer', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                or pay by check instead
              </summary>
              <div style={{ marginTop: '0.625rem', fontSize: '0.875rem', color: 'var(--color-text-muted)', lineHeight: 1.7 }}>
                <p style={{ margin: '0 0 0.375rem' }}>
                  Make checks payable to: <strong style={{ color: 'var(--color-text-primary)' }}>Placer Advanced Robotics and Technology</strong>
                </p>
                <p style={{ margin: '0 0 0.375rem' }}>
                  Mail to: <strong style={{ color: 'var(--color-text-primary)' }}>9182 Cedar Ridge Drive, Granite Bay, CA 95746</strong>
                </p>
                <p style={{ margin: 0 }}>
                  Write your payment reference code <strong style={{ color: 'var(--color-text-primary)' }}>{paymentReferenceCode}</strong> in the memo.
                </p>
              </div>
            </details>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
            <SecondaryButton onClick={() => setStep(3)}>Back</SecondaryButton>
            <PrimaryButton loading={submitting} onClick={handleSubmit}>Complete Registration</PrimaryButton>
          </div>
        </>
      )}
    </FamilyShell>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '0.5rem', alignItems: 'baseline' }}>
      <span className="text-label" style={{ color: 'var(--color-text-muted)' }}>{label}</span>
      <span style={{ color: 'var(--color-text-primary)' }}>{value}</span>
    </div>
  )
}
