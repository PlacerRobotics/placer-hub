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
  WarningAlert,
  SuccessAlert,
  ErrorAlert,
} from '@/components/ui'
import { ageFromDob, isSchoolDomain } from '@/lib/compliance'

const OTHER_SCHOOL = '__other__'

const consentLabel: React.CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer', marginTop: '0.5rem' }

const PROGRAM_LABELS: Record<string, string> = { vex_v5: 'VEX V5', combat: 'Combat', vex_iq: 'VEX IQ', both: 'VEX V5 & Combat', not_sure: 'program' }
// Fundraising method labels (values match family_season.fundraising_method CHECK).
const FUND_METHOD_LABELS: Record<string, string> = {
  direct_donation: 'Direct contribution via Zeffy',
  corporate_match: 'Employer / corporate match',
  sponsored: 'Business sponsorship',
  paper_check: 'Paper check',
  pending: 'Financial assistance (pending)',
}
const FINANCIAL_AID_URL = 'https://forms.gle/nqjneY9ESyLRdZ8V9'
const MAIL_ADDRESS = 'Placer Advanced Robotics and Technology, 9182 Cedar Ridge Drive, Granite Bay, CA 95746'
// Post-submit message shown on the confirmation screen, keyed by fundraising method.
const SUBMIT_METHOD_MESSAGE: Record<string, string> = {
  direct_donation: 'To make your full fundraising contribution, select a Standard ($790) or Champion ($1,040) ticket on Zeffy, or return to make an additional contribution at any time.',
  corporate_match: 'Your employer match information has been saved. We’ll follow up to confirm your submission.',
  sponsored: 'Your sponsorship interest has been noted. PART staff will contact you to confirm the arrangement.',
  paper_check: 'Please bring your check to the next team meeting made payable to PART.',
  pending: 'Your financial aid request will be reviewed separately. Please pay the $40 registration fee via Zeffy to hold your spot.',
}

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
    communication_email: string | null
  }
  schools: { id: string; name: string; grade_min: number | null; grade_max: number | null }[]
  waivers: { id: string; waiver_type: string; version: string; title: string; body_markdown: string; body_hash: string }[]
  paymentReferenceCode: string
  guardianName: string
  zeffyUrl: string | null
  fundraisingTarget: number
  emergency: { first_name: string; last_name: string; relationship: string; phone: string } | null
  consent: { slackConsent: boolean; emailCertified: boolean } | null
  signed: { signedAt: string; parentName: string; studentName: string } | null
  fundraising: {
    method: string; employer_company: string; employer_pct: string; employer_portal: string
    sponsor_business: string; sponsor_contact: string; sponsor_amount: string
  } | null
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
const helpTextStyle: React.CSSProperties = { fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: '0.5rem 0 0', lineHeight: 1.5 }

function Stepper({ step, steps }: { step: number; steps: string[] }) {
  return (
    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.75rem', flexWrap: 'wrap' }}>
      {steps.map((label, i) => {
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
            {n < steps.length && <span style={{ color: 'var(--color-text-muted)' }}>·</span>}
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
  fundraisingTarget,
  emergency,
  consent,
  signed,
  fundraising,
}: Props) {
  const router = useRouter()
  const alreadySigned = !!signed
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  // IQ registration is team-managed (no $40 fee, no per-student fundraising), so it
  // skips the Payment & Fundraising step entirely — consistent with the IQ fee = $0
  // path in /api/register and the existing "no payment needed" review note.
  const isIq = program === 'vex_iq'
  const STEPS = isIq
    ? ['Student', 'Emergency Contact', 'Waivers', 'Review']
    : ['Student', 'Emergency Contact', 'Waivers', 'Payment & Fundraising', 'Review']
  const REVIEW_STEP = isIq ? 4 : 5
  const programLabel = PROGRAM_LABELS[program] ?? 'program'

  // Step 4 (non-IQ) — Payment & Fundraising. Prefilled on resume from the saved selection.
  const [fundMethod, setFundMethod] = useState(fundraising?.method ?? '')
  const [empCompany, setEmpCompany] = useState(fundraising?.employer_company ?? '')
  const [empPct, setEmpPct] = useState(fundraising?.employer_pct ?? '')
  const [empPortal, setEmpPortal] = useState(fundraising?.employer_portal ?? '')
  const [spBusiness, setSpBusiness] = useState(fundraising?.sponsor_business ?? '')
  const [spContact, setSpContact] = useState(fundraising?.sponsor_contact ?? '')
  const [spAmount, setSpAmount] = useState(fundraising?.sponsor_amount ?? '')

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
  const [studentEmail, setStudentEmail] = useState(student.communication_email ?? '')
  const [emailCertified, setEmailCertified] = useState(consent?.emailCertified ?? false)
  const [schoolEmailConfirmed, setSchoolEmailConfirmed] = useState(false)
  const [slackConsent, setSlackConsent] = useState(consent?.slackConsent ?? false)
  const [coppaConsent, setCoppaConsent] = useState(false)

  // Step 2 — prefill from any existing emergency contact on file.
  const [ec1First, setEc1First] = useState(emergency?.first_name ?? '')
  const [ec1Last, setEc1Last] = useState(emergency?.last_name ?? '')
  const [ec1Rel, setEc1Rel] = useState(emergency?.relationship ?? '')
  const [ec1Phone, setEc1Phone] = useState(emergency?.phone ?? '')
  const [ec2First, setEc2First] = useState('')
  const [ec2Last, setEc2Last] = useState('')
  const [ec2Rel, setEc2Rel] = useState('')
  const [ec2Phone, setEc2Phone] = useState('')

  // Step 3 — prefilled + locked on resume when waivers are already signed.
  const [agreed, setAgreed] = useState<Record<string, boolean>>(
    alreadySigned ? Object.fromEntries(waivers.map((w) => [w.id, true])) : {}
  )
  const [studentSig, setStudentSig] = useState(signed?.studentName ?? '')
  const [signature, setSignature] = useState(signed?.parentName ?? '')
  const [electronicConsent, setElectronicConsent] = useState(alreadySigned)

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

  const studentAge = ageFromDob(dob)
  const isUnder13 = studentAge != null && studentAge < 13
  const needsCoppa = Number(grade) === 6 || Number(grade) === 7 || isUnder13
  const emailProvided = studentEmail.trim().length > 0
  const schoolDomainMatch = emailProvided && isSchoolDomain(studentEmail)
  const step1Valid =
    first.trim() && last.trim() && dob && grade && tshirt && (schoolId !== OTHER_SCHOOL || schoolOther.trim()) && schoolId &&
    (!needsCoppa || coppaConsent) &&
    (!emailProvided || (emailCertified && (!schoolDomainMatch || schoolEmailConfirmed)))
  const step2Valid = ec1First.trim() && ec1Last.trim() && ec1Rel.trim() && ec1Phone.trim()
  const allWaiversAgreed = waivers.length > 0 ? waivers.every((w) => agreed[w.id]) : true
  const step3Valid = alreadySigned || (allWaiversAgreed && electronicConsent && !!studentSig.trim() && !!signature.trim())
  const empPctNum = Number(empPct)
  const spAmountNum = Number(spAmount)
  const step4Valid =
    !!fundMethod &&
    (fundMethod !== 'corporate_match' || (!!empCompany.trim() && !!empPct.trim() && empPctNum >= 1 && empPctNum <= 100 && !!empPortal)) &&
    (fundMethod !== 'sponsored' || (!!spBusiness.trim() && !!spContact.trim() && !!spAmount.trim() && spAmountNum > 0))

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
      electronicConsent,
      coppaConsent,
      emailCertified: emailProvided && emailCertified,
      slackConsent: isUnder13 ? false : slackConsent,
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
        communication_email: studentEmail.trim() || null,
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
      fundraising: isIq
        ? null
        : {
            method: fundMethod,
            employer_company: empCompany.trim() || null,
            employer_pct: empPct.trim() ? empPctNum : null,
            employer_portal: empPortal || null,
            sponsor_business: spBusiness.trim() || null,
            sponsor_contact: spContact.trim() || null,
            sponsor_amount: spAmount.trim() ? spAmountNum : null,
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
        setSubmitted(true)
        setSubmitting(false)
        if (typeof window !== 'undefined') window.scrollTo({ top: 0 })
      }
    } catch {
      setError('Network error — please try again.')
      setSubmitting(false)
    }
  }

  // Post-submit confirmation + payment screen (Part 3).
  if (submitted) {
    return (
      <FamilyShell familyName={guardianName} maxWidth="lg">
        <PageHeader title="Registration submitted" subtitle={`${first || student.first_name} · ${season} season`} />
        {isIq ? (
          <>
            <div style={{ marginBottom: '1.25rem' }}>
              <SuccessAlert title="Registration submitted!">
                Your VEX IQ team’s fee (paid by the coach) covers registration — no payment is needed here.
              </SuccessAlert>
            </div>
            <PrimaryButton onClick={() => router.push('/dashboard?notice=registered')}>Go to my dashboard →</PrimaryButton>
          </>
        ) : (
          <>
            <div style={{ marginBottom: '1.25rem' }}>
              <SuccessAlert title="Registration submitted!">Complete your payment to secure your spot.</SuccessAlert>
            </div>
            <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '1.25rem', marginBottom: '1.25rem' }}>
              <p style={{ fontWeight: 700, fontSize: '0.9375rem', margin: '0 0 0.75rem' }}>Payment summary</p>
              <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.9375rem' }}>
                <Row label="Registration fee" value="$40 (required, non-deductible)" />
                <Row label="Fundraising commitment" value={`$${fundraisingTarget} via ${FUND_METHOD_LABELS[fundMethod] ?? '—'}`} />
                <Row label="Total due via Zeffy today" value="$40" />
              </div>
            </div>
            {zeffyUrl ? (
              <a href={zeffyUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', padding: '12px 24px', backgroundColor: 'var(--color-gold)', color: 'var(--color-navy-darker)', fontWeight: 700, fontSize: '0.9375rem', borderRadius: 6, textDecoration: 'none' }}>
                Pay Registration Fee via Zeffy →
              </a>
            ) : (
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: 0 }}>The secure online payment link will be emailed to you.</p>
            )}
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: '0.625rem 0 1.25rem', lineHeight: 1.6 }}>
              Select the ticket for {programLabel}. The $40 registration fee ticket is separate from any additional contribution you choose to make.
            </p>
            {fundMethod && SUBMIT_METHOD_MESSAGE[fundMethod] && (
              <div style={{ backgroundColor: 'var(--color-bg-light)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '0.875rem 1rem', marginBottom: '1.25rem', fontSize: '0.875rem', color: 'var(--color-text-primary)', lineHeight: 1.6 }}>
                {SUBMIT_METHOD_MESSAGE[fundMethod]}
              </div>
            )}
            <div><PrimaryButton onClick={() => router.push('/dashboard?notice=registered')}>Go to my dashboard →</PrimaryButton></div>
          </>
        )}
      </FamilyShell>
    )
  }

  return (
    <FamilyShell familyName={guardianName} maxWidth="lg">
      <PageHeader
        title="Complete Registration"
        subtitle={`Registering ${first || student.first_name} for the ${season} season`}
      />
      <Stepper step={step} steps={STEPS} />

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
                {(program === 'vex_iq' ? [3, 4, 5, 6] : [6, 7, 8, 9, 10, 11, 12]).map((g) => <option key={g} value={g}>{g}</option>)}
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
            {/* Email + Slack are V5/Combat only — IQ is an elementary, team-managed flow. */}
            {program !== 'vex_iq' && (
              <>
                <FormField label="Fusion Education email" htmlFor="fusion" helpText="Use your student Fusion account email if you have one.">
                  <TextInput id="fusion" type="email" value={fusion} onChange={(e) => setFusion(e.target.value)} />
                </FormField>

                <FormField label="Student email (optional)" htmlFor="studentEmail" helpText="A personal email your student checks regularly.">
                  <TextInput id="studentEmail" type="email" value={studentEmail} onChange={(e) => setStudentEmail(e.target.value)} />
                </FormField>
                {schoolDomainMatch && (
                  <div>
                    <WarningAlert>School email addresses are often blocked or monitored — we recommend a personal email your student checks regularly.</WarningAlert>
                    <label style={consentLabel}>
                      <input type="checkbox" checked={schoolEmailConfirmed} onChange={(e) => setSchoolEmailConfirmed(e.target.checked)} />
                      <span>I understand and want to use this school email address anyway.</span>
                    </label>
                  </div>
                )}
                {emailProvided && (
                  <label style={consentLabel}>
                    <input type="checkbox" checked={emailCertified} onChange={(e) => setEmailCertified(e.target.checked)} />
                    <span>I certify that I have access to this email and consent to Placer Robotics using it to communicate with my student.</span>
                  </label>
                )}
                {!isUnder13 && (
                  <label style={consentLabel}>
                    <input type="checkbox" checked={slackConsent} onChange={(e) => setSlackConsent(e.target.checked)} />
                    <span>I consent to my student&apos;s email being used to invite them to the Placer Robotics Slack workspace. I understand Slack requires users to be 13 or older.</span>
                  </label>
                )}
              </>
            )}
            {needsCoppa && (
              <label style={consentLabel}>
                <input type="checkbox" checked={coppaConsent} onChange={(e) => setCoppaConsent(e.target.checked)} />
                <span>I am the parent or legal guardian of this student and consent to the collection of their personal information as described in our Privacy Policy. Students under 13 may not use Slack.</span>
              </label>
            )}
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

          <div style={{ marginBottom: '1.25rem' }}>
            <WarningAlert>
              Please list one emergency contact who is <strong>not</strong> a parent/guardian already on your account.
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
          {signed && (
            <div style={{ marginBottom: '1.25rem' }}>
              <SuccessAlert title="Agreements already signed">
                You signed these agreements on {new Date(signed.signedAt).toLocaleDateString()}. They’re shown here for your records and can’t be changed.
              </SuccessAlert>
            </div>
          )}
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
              <details open style={{ border: '1px solid var(--color-border)', borderRadius: '6px', padding: '0.875rem', marginBottom: '0.875rem' }}>
                <summary style={{ cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-navy-deep)' }}>
                  Full agreement — read below, then collapse if you like
                </summary>
                <div style={{ fontSize: '0.875rem', lineHeight: 1.7, color: 'var(--color-text-primary)', whiteSpace: 'pre-wrap', marginTop: '0.875rem' }}>
                  {w.body_markdown}
                </div>
              </details>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem', fontSize: '0.9375rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={!!agreed[w.id]}
                  disabled={alreadySigned}
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
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem', fontSize: '0.9375rem', cursor: 'pointer', marginBottom: '0.5rem' }}>
              <input type="checkbox" checked={electronicConsent} disabled={alreadySigned} onChange={(e) => setElectronicConsent(e.target.checked)} style={{ marginTop: '0.25rem' }} />
              <span>I agree that typing my name below is my electronic signature, that it is the legal equivalent of a handwritten signature, and that it is legally binding. I consent to signing these agreements electronically.</span>
            </label>
            <FormField
              label="Student / participant full legal name"
              htmlFor="studentSig"
              required
              helpText="The student's printed name, as their acknowledgment of the agreements above."
            >
              <TextInput
                id="studentSig"
                value={studentSig}
                disabled={alreadySigned}
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
              <TextInput id="signature" value={signature} disabled={alreadySigned} onChange={(e) => setSignature(e.target.value)} placeholder={guardianName} />
            </FormField>
          </FormSection>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
            <SecondaryButton onClick={() => setStep(2)}>Back</SecondaryButton>
            <PrimaryButton disabled={!step3Valid} onClick={() => setStep(4)}>Continue</PrimaryButton>
          </div>
        </>
      )}

      {/* Step 4 — Payment & Fundraising (non-IQ; IQ is team-managed) */}
      {!isIq && step === 4 && (
        <>
          <FormSection title="Payment &amp; Fundraising" description="Review the registration fee and choose how you’ll meet your fundraising commitment.">
            <div style={{ backgroundColor: 'var(--color-bg-light)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '1rem 1.25rem', fontSize: '0.9375rem', color: 'var(--color-text-primary)', lineHeight: 1.6 }}>
              A $40 registration fee is required for all students. You will pay this via Zeffy at the end of registration. This fee is non-refundable and is not tax-deductible.
            </div>
          </FormSection>

          <div style={{ marginBottom: '1.5rem' }}>
            <h2 className="text-section-title" style={{ margin: '0 0 0.375rem' }}>How will you fulfill your fundraising commitment?</h2>
            <p style={{ fontSize: '0.9375rem', color: 'var(--color-text-muted)', margin: '0 0 1rem', lineHeight: 1.6 }}>
              Your {programLabel} participation includes a fundraising commitment of ${fundraisingTarget} (in addition to the $40 fee). Select how you plan to fulfill it.
            </p>

            <RadioCard value="direct_donation" current={fundMethod} onSelect={setFundMethod} title="Direct contribution via Zeffy" label="I’ll make a contribution when I pay the registration fee" />

            <RadioCard value="corporate_match" current={fundMethod} onSelect={setFundMethod} title="Employer / corporate match" label="My employer matches charitable donations">
              <FormField label="Employer name" htmlFor="empCompany" required>
                <TextInput id="empCompany" value={empCompany} onChange={(e) => setEmpCompany(e.target.value)} />
              </FormField>
              <FormField label="Match percentage" htmlFor="empPct" required>
                <TextInput id="empPct" type="number" min={1} max={100} value={empPct} onChange={(e) => setEmpPct(e.target.value)} placeholder="e.g. 100 for a 100% match" />
              </FormField>
              <div>
                <label htmlFor="empPortal" style={labelStyle}>How submitted<span style={{ color: 'var(--color-error)', marginLeft: 3 }}>*</span></label>
                <select id="empPortal" value={empPortal} onChange={(e) => setEmpPortal(e.target.value)} style={selectStyle}>
                  <option value="">Select…</option>
                  <option value="benevity">Benevity</option>
                  <option value="yourcause">YourCause</option>
                  <option value="employer_portal">Employer portal</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <p style={helpTextStyle}>We’ll follow up to confirm your match submission.</p>
            </RadioCard>

            <RadioCard value="sponsored" current={fundMethod} onSelect={setFundMethod} title="Business sponsorship" label="A business is sponsoring my student">
              <FormField label="Business name" htmlFor="spBusiness" required>
                <TextInput id="spBusiness" value={spBusiness} onChange={(e) => setSpBusiness(e.target.value)} />
              </FormField>
              <FormField label="Contact name" htmlFor="spContact" required>
                <TextInput id="spContact" value={spContact} onChange={(e) => setSpContact(e.target.value)} />
              </FormField>
              <FormField label="Estimated sponsorship amount" htmlFor="spAmount" required>
                <TextInput id="spAmount" type="number" min={0} value={spAmount} onChange={(e) => setSpAmount(e.target.value)} />
              </FormField>
              <p style={helpTextStyle}>Sponsorship arrangements will be confirmed separately with PART staff. You will still pay the $40 registration fee via Zeffy.</p>
            </RadioCard>

            <RadioCard value="paper_check" current={fundMethod} onSelect={setFundMethod} title="Paper check" label="I’ll submit a paper check">
              <p style={helpTextStyle}>Bring your check to the next team meeting or mail to: {MAIL_ADDRESS}. Make payable to PART.</p>
            </RadioCard>

            <RadioCard value="pending" current={fundMethod} onSelect={setFundMethod} title="Financial assistance" label="I’d like to apply for financial assistance">
              <a href={FINANCIAL_AID_URL} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', padding: '9px 16px', backgroundColor: 'var(--color-navy-deep)', color: '#fff', fontWeight: 600, fontSize: '0.875rem', borderRadius: 6, textDecoration: 'none', marginBottom: '0.625rem' }}>
                Complete Financial Aid Request →
              </a>
              <p style={helpTextStyle}>Submit your request, then continue registration. Aid decisions are made separately and do not affect your registration status.</p>
            </RadioCard>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
            <SecondaryButton onClick={() => setStep(3)}>Back</SecondaryButton>
            <PrimaryButton disabled={!step4Valid} onClick={() => setStep(5)}>Continue</PrimaryButton>
          </div>
        </>
      )}

      {/* Final step — Review & Submit */}
      {step === REVIEW_STEP && (
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
              {!isIq && <Row label="Fundraising" value={FUND_METHOD_LABELS[fundMethod] ?? '—'} />}
            </div>
            <div style={{ marginTop: '0.75rem' }}>
              <div className="text-label" style={{ color: 'var(--color-text-muted)', marginBottom: '0.375rem' }}>Program</div>
              <ProgramBadge program={(['vex_v5', 'vex_iq', 'combat', 'not_sure'].includes(program) ? program : 'not_sure') as Program} />
            </div>
          </FormSection>

          {isIq ? (
            <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '1.25rem', marginBottom: '1.5rem', fontSize: '0.9375rem', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
              No payment is needed here — your VEX IQ team’s fee (paid by the coach) covers registration.
            </div>
          ) : (
            <div style={{ backgroundColor: 'var(--color-bg-light)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '1.25rem', marginBottom: '1.5rem', fontSize: '0.9375rem', color: 'var(--color-text-primary)', lineHeight: 1.6 }}>
              After you submit, we’ll direct you to pay the <strong>$40 registration fee</strong> via Zeffy to secure {first || student.first_name}’s spot.
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
            <SecondaryButton onClick={() => setStep(isIq ? 3 : 4)}>Back</SecondaryButton>
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

function RadioCard({
  value,
  current,
  onSelect,
  title,
  label,
  children,
}: {
  value: string
  current: string
  onSelect: (v: string) => void
  title: string
  label: string
  children?: React.ReactNode
}) {
  const selected = current === value
  return (
    <div style={{ border: `1.5px solid ${selected ? 'var(--color-navy-deep)' : 'var(--color-border)'}`, borderRadius: 8, padding: '0.875rem 1rem', marginBottom: '0.75rem', backgroundColor: selected ? 'var(--color-bg-light)' : 'var(--color-surface)' }}>
      <label style={{ display: 'flex', gap: '0.625rem', alignItems: 'flex-start', cursor: 'pointer' }}>
        <input type="radio" name="fundMethod" checked={selected} onChange={() => onSelect(value)} style={{ marginTop: 4 }} />
        <span>
          <span style={{ fontWeight: 600, fontSize: '0.9375rem', display: 'block', color: 'var(--color-text-primary)' }}>{title}</span>
          <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>{label}</span>
        </span>
      </label>
      {selected && children && <div style={{ marginTop: '0.875rem', paddingLeft: '1.75rem' }}>{children}</div>}
    </div>
  )
}
