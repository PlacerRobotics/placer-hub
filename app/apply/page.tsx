'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  PublicShell,
  FormField,
  TextInput,
  TextArea,
  PrimaryButton,
  SecondaryButton,
  InfoAlert,
  SuccessAlert,
  ErrorAlert,
  ProgramBadge,
} from '@/components/ui'
import { FinancialAidCallout } from '@/components/FinancialAidCallout'

// PRD §5 canonical field set. Apply offers V5 / Combat / Not Sure (single choice
// stored in program_interest); VEX IQ (grades 3–6) applies via the IQ path.
type Program = 'vex_v5' | 'combat' | 'both' | 'not_sure'

const PROGRAMS: { value: Program; name: string; grades: string }[] = [
  { value: 'vex_v5', name: 'VEX V5 Robotics', grades: 'Grades 7–12 (6th grade by exception)' },
  { value: 'combat', name: 'Combat Robotics', grades: 'Grades 7–12' },
  { value: 'both', name: 'VEX V5 & Combat', grades: 'Interested in both programs' },
  { value: 'not_sure', name: 'Not sure yet', grades: 'We’ll help you choose' },
]

const EXPERIENCE_OPTIONS = ['VEX IQ', 'VEX V5', 'Combat Robotics', 'FRC/FTC', 'FLL', 'PLTW', 'None']
const SKILLS_OPTIONS = [
  'Coding (VEXcode, Python)',
  'CAD (Fusion 360, Onshape)',
  'Mechanical Building',
  'Electrical Engineering',
  'None yet',
]
const VOLUNTEER_OPTIONS = [
  'Lab Supervision',
  'General Activities & Events',
  'Combat Advisor/Mentor',
  'Robotics Center Operations/Facilities',
  'VEX Equipment Manager',
  'Fundraising/Grants/Sponsorships',
  'Business/Marketing',
  'Summer Camps',
]
const SUMMER_OPTIONS: { value: 'yes' | 'maybe' | 'no'; label: string }[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'no', label: 'No' },
]

const DATA_NOTICE =
  'Placer Advanced Robotics and Technology (Placer Robotics) collects information about student ' +
  'participants for the purpose of program registration, safety, team administration, and program ' +
  'communications. Student information is not sold, shared with advertisers, or used for purposes ' +
  'unrelated to program operations. By submitting this application, the parent or guardian certifies ' +
  'they are authorized to provide this information on behalf of the student.'

const TOTAL_STEPS = 5
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

const req = <span style={{ color: 'var(--color-error)', marginLeft: 3 }}>*</span>

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

function CheckGroup({
  options,
  selected,
  onToggle,
}: {
  options: string[]
  selected: string[]
  onToggle: (value: string) => void
}) {
  return (
    <div style={{ display: 'grid', gap: '0.5rem' }}>
      {options.map((opt) => (
        <label
          key={opt}
          style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', fontSize: '0.9375rem', color: 'var(--color-text-primary)', cursor: 'pointer' }}
        >
          <input type="checkbox" checked={selected.includes(opt)} onChange={() => onToggle(opt)} style={{ width: 16, height: 16 }} />
          {opt}
        </label>
      ))}
    </div>
  )
}

export default function ApplyPage() {
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [successName, setSuccessName] = useState('')

  // Section 1 — Student Information
  const [stuFirst, setStuFirst] = useState('')
  const [stuLast, setStuLast] = useState('')
  const [preferred, setPreferred] = useState('')
  const [grade, setGrade] = useState('')
  const [schoolId, setSchoolId] = useState('')
  const [schoolOther, setSchoolOther] = useState('')
  const [schools, setSchools] = useState<
    { id: string; name: string; grade_min: number | null; grade_max: number | null }[]
  >([])
  const [city, setCity] = useState('')
  const [zip, setZip] = useState('')
  const [studentEmail, setStudentEmail] = useState('')
  const [gpaOverall, setGpaOverall] = useState('')
  const [gpaRecent, setGpaRecent] = useState('')
  const [referral, setReferral] = useState('')

  // Section 2 — Program Interests
  const [program, setProgram] = useState<Program | ''>('')
  const [experience, setExperience] = useState<string[]>([])
  const [skills, setSkills] = useState<string[]>([])
  const [teammates, setTeammates] = useState('')

  // Section 3 — About You
  const [background, setBackground] = useState('')
  const [goals, setGoals] = useState('')
  const [extracurriculars, setExtracurriculars] = useState('')
  const [summer, setSummer] = useState<'yes' | 'maybe' | 'no' | ''>('')

  // Section 4 — Parent / Guardian
  const [g1First, setG1First] = useState('')
  const [g1Last, setG1Last] = useState('')
  const [g1Email, setG1Email] = useState('')
  const [g1Phone, setG1Phone] = useState('')
  const [g2First, setG2First] = useState('')
  const [g2Last, setG2Last] = useState('')
  const [g2Email, setG2Email] = useState('')
  const [g2Phone, setG2Phone] = useState('')
  const [singleGuardian, setSingleGuardian] = useState(false)
  const [volunteerInterests, setVolunteerInterests] = useState<string[]>([])
  const [occupation, setOccupation] = useState('')
  const [volunteerNotes, setVolunteerNotes] = useState('')

  // Section 5 — Final
  const [additionalNotes, setAdditionalNotes] = useState('')
  const [certified, setCertified] = useState(false)

  useEffect(() => {
    fetch('/api/schools')
      .then((r) => r.json())
      .then((d) => setSchools(d.schools ?? []))
      .catch(() => setSchools([]))
  }, [])

  // Narrow the school list to those serving the selected grade. NULL min/max are
  // treated as open-ended so a school without a range is never hidden.
  const visibleSchools = useMemo(() => {
    if (!grade) return schools
    const g = Number(grade)
    return schools.filter((s) => g >= (s.grade_min ?? -Infinity) && g <= (s.grade_max ?? Infinity))
  }, [schools, grade])

  useEffect(() => {
    if (schoolId && schoolId !== OTHER_SCHOOL && !visibleSchools.some((s) => s.id === schoolId)) {
      setSchoolId('')
    }
  }, [visibleSchools, schoolId])

  const step1Valid =
    stuFirst.trim() &&
    stuLast.trim() &&
    grade &&
    (schoolId === OTHER_SCHOOL ? schoolOther.trim() : schoolId) &&
    city.trim() &&
    zip.trim() &&
    gpaOverall.trim() &&
    gpaRecent.trim() &&
    referral.trim()
  const step2Valid = program !== ''
  const step3Valid = background.trim() && goals.trim() && extracurriculars.trim() && summer !== ''
  // "Single guardian?" (PRD §4): shown when Guardian 2 is empty. If G2 is left
  // blank, the family must confirm single-guardian before continuing.
  const g2Started = !!(g2First.trim() || g2Last.trim() || g2Email.trim() || g2Phone.trim())
  const step4Valid =
    g1First.trim() && g1Last.trim() && g1Email.trim() && g1Phone.trim() && (g2Started || singleGuardian)
  const step5Valid = certified

  async function handleSubmit() {
    if (!step5Valid || submitting) return
    setSubmitting(true)
    setError('')
    const payload = {
      program,
      student: {
        first_name: stuFirst.trim(),
        last_name: stuLast.trim(),
        preferred_name: preferred.trim() || null,
        grade: Number(grade),
        school_id: schoolId && schoolId !== OTHER_SCHOOL ? schoolId : null,
        school_raw: schoolId === OTHER_SCHOOL ? schoolOther.trim() : null,
        city: city.trim(),
        zip_code: zip.trim(),
        communication_email: studentEmail.trim() || null,
      },
      application: {
        gpa_overall: gpaOverall.trim(),
        gpa_recent_term: gpaRecent.trim(),
        referral_source: referral.trim(),
        previous_experience: experience,
        skills_interest: skills,
        teammate_preference: teammates.trim() || null,
        motivation_background: background.trim(),
        motivation_goals: goals.trim(),
        extracurriculars: extracurriculars.trim(),
        summer_availability: summer,
        additional_notes: additionalNotes.trim() || null,
      },
      guardian1: {
        first_name: g1First.trim(),
        last_name: g1Last.trim(),
        email: g1Email.trim(),
        phone: g1Phone.trim(),
        occupation: occupation.trim() || null,
        volunteer_interests: volunteerInterests,
        volunteer_notes: volunteerNotes.trim() || null,
      },
      guardian2: g2Email.trim()
        ? { first_name: g2First.trim(), last_name: g2Last.trim(), email: g2Email.trim(), phone: g2Phone.trim() }
        : null,
      data_certified: certified,
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
      <p className="text-help" style={{ marginTop: '0.5rem' }}>Step {step} of {TOTAL_STEPS}</p>

      {step === 1 && (
        <p className="text-help" style={{ marginTop: '0.75rem', lineHeight: 1.5 }}>
          This program is a serious time commitment — most students spend 8–15 hours per week during the
          season. This form has 5 short sections (about 15–20 minutes). Sections 1–3 should be completed by
          the student; the last section is for a parent or guardian.
        </p>
      )}

      {error && (
        <div style={{ marginTop: '1rem' }}>
          <ErrorAlert title="Couldn’t submit">{error}</ErrorAlert>
        </div>
      )}

      {/* Section 1 — Student Information */}
      {step === 1 && (
        <div style={{ ...cardBase, marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h2 className="text-section-title">Student information</h2>
          <FormField label="Student first name" htmlFor="stuFirst" required>
            <TextInput id="stuFirst" value={stuFirst} onChange={(e) => setStuFirst(e.target.value)} />
          </FormField>
          <FormField label="Student last name" htmlFor="stuLast" required>
            <TextInput id="stuLast" value={stuLast} onChange={(e) => setStuLast(e.target.value)} />
          </FormField>
          <FormField label="Preferred name / nickname" htmlFor="preferred">
            <TextInput id="preferred" value={preferred} onChange={(e) => setPreferred(e.target.value)} />
          </FormField>
          <div>
            <label htmlFor="grade" style={labelStyle}>Grade entering Fall 2026{req}</label>
            <select id="grade" value={grade} onChange={(e) => setGrade(e.target.value)} style={selectStyle}>
              <option value="">Select grade…</option>
              {[6, 7, 8, 9, 10, 11, 12].map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="school" style={labelStyle}>School attending (Fall 2026){req}</label>
            <select id="school" value={schoolId} onChange={(e) => setSchoolId(e.target.value)} style={selectStyle}>
              <option value="">{grade ? 'Select school…' : 'Select grade first…'}</option>
              {visibleSchools.map((s) => (
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
          <FormField label="City" htmlFor="city" required>
            <TextInput id="city" value={city} onChange={(e) => setCity(e.target.value)} />
          </FormField>
          <FormField label="ZIP code" htmlFor="zip" required>
            <TextInput id="zip" value={zip} onChange={(e) => setZip(e.target.value)} inputMode="numeric" />
          </FormField>
          <FormField label="Student email" htmlFor="studentEmail" helpText="We may use this to communicate with you directly. Optional.">
            <TextInput id="studentEmail" type="email" value={studentEmail} onChange={(e) => setStudentEmail(e.target.value)} />
          </FormField>
          <FormField label="Current overall GPA" htmlFor="gpaOverall" required>
            <TextInput id="gpaOverall" value={gpaOverall} onChange={(e) => setGpaOverall(e.target.value)} inputMode="decimal" placeholder="e.g. 3.8" />
          </FormField>
          <FormField label="Most recent term GPA" htmlFor="gpaRecent" required>
            <TextInput id="gpaRecent" value={gpaRecent} onChange={(e) => setGpaRecent(e.target.value)} inputMode="decimal" placeholder="e.g. 3.9" />
          </FormField>
          <FormField label="Who referred you to Placer Robotics?" htmlFor="referral" required helpText="Put N/A if none.">
            <TextInput id="referral" value={referral} onChange={(e) => setReferral(e.target.value)} />
          </FormField>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <PrimaryButton disabled={!step1Valid} onClick={() => setStep(2)}>Next</PrimaryButton>
          </div>
        </div>
      )}

      {/* Section 2 — Program Interests */}
      {step === 2 && (
        <div style={{ marginTop: '1.5rem' }}>
          <h2 className="text-section-title" style={{ marginBottom: '1rem' }}>Which program interests you?</h2>
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
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                    <span style={{ flexShrink: 0, width: 20, height: 20, borderRadius: '50%', border: `2px solid ${selected ? 'var(--color-navy-deep)' : '#aab3c2'}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                      {selected && <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: 'var(--color-navy-deep)' }} />}
                    </span>
                    <span>
                      <span className="text-card-title">{p.name}</span>
                      <span className="text-help" style={{ display: 'block' }}>{p.grades}</span>
                    </span>
                  </span>
                  {(p.value === 'vex_v5' || p.value === 'combat') && <ProgramBadge program={p.value} />}
                </button>
              )
            })}
          </div>

          <div style={{ ...cardBase, marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label style={labelStyle}>Previous robotics experience <span className="text-help">(optional)</span></label>
              <CheckGroup options={EXPERIENCE_OPTIONS} selected={experience} onToggle={(v) => setExperience((s) => toggle(s, v))} />
            </div>
            <div>
              <label style={labelStyle}>Skills you’re excited about or already familiar with <span className="text-help">(optional)</span></label>
              <CheckGroup options={SKILLS_OPTIONS} selected={skills} onToggle={(v) => setSkills((s) => toggle(s, v))} />
            </div>
            <FormField label="Any teammates you’d like to work with?" htmlFor="teammates">
              <TextArea id="teammates" value={teammates} onChange={(e) => setTeammates(e.target.value)} style={{ minHeight: '70px' }} />
            </FormField>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginTop: '1.5rem' }}>
            <SecondaryButton onClick={() => setStep(1)}>Back</SecondaryButton>
            <PrimaryButton disabled={!step2Valid} onClick={() => setStep(3)}>Next</PrimaryButton>
          </div>
        </div>
      )}

      {/* Section 3 — About You */}
      {step === 3 && (
        <div style={{ ...cardBase, marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h2 className="text-section-title">About you</h2>
          <p className="text-help" style={{ marginTop: '-0.5rem', fontStyle: 'italic' }}>
            Please answer these questions in your own words. We want to hear from you directly.
          </p>
          <FormField label="Tell us about yourself — your background, interests, and what draws you to robotics." htmlFor="bg" required>
            <TextArea id="bg" value={background} onChange={(e) => setBackground(e.target.value)} />
          </FormField>
          <FormField label="What are your goals for this season, and what are you willing to commit to make them happen?" htmlFor="goals" required>
            <TextArea id="goals" value={goals} onChange={(e) => setGoals(e.target.value)} />
          </FormField>
          <FormField label="What other activities are you involved in, and how much time do they take?" htmlFor="extra" required>
            <TextArea id="extra" value={extracurriculars} onChange={(e) => setExtracurriculars(e.target.value)} />
          </FormField>
          <div>
            <label style={labelStyle}>Are you available to help with summer camps or get an early start this summer?{req}</label>
            <div style={{ display: 'flex', gap: '1.25rem', marginTop: '0.25rem' }}>
              {SUMMER_OPTIONS.map((o) => (
                <label key={o.value} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9375rem', cursor: 'pointer' }}>
                  <input type="radio" name="summer" checked={summer === o.value} onChange={() => setSummer(o.value)} />
                  {o.label}
                </label>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
            <SecondaryButton onClick={() => setStep(2)}>Back</SecondaryButton>
            <PrimaryButton disabled={!step3Valid} onClick={() => setStep(4)}>Next</PrimaryButton>
          </div>
        </div>
      )}

      {/* Section 4 — Parent / Guardian */}
      {step === 4 && (
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
            {!g2Started && (
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem', fontSize: '0.9375rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={singleGuardian} onChange={(e) => setSingleGuardian(e.target.checked)} style={{ width: 16, height: 16, marginTop: 3 }} />
                <span>This is a single-guardian household — there is no second parent/guardian to add.{req}</span>
              </label>
            )}
          </div>

          <div style={{ ...cardBase, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h2 className="text-section-title">Volunteering <span className="text-help">(optional)</span></h2>
            <div>
              <label style={labelStyle}>Areas you’re interested in volunteering</label>
              <CheckGroup options={VOLUNTEER_OPTIONS} selected={volunteerInterests} onToggle={(v) => setVolunteerInterests((s) => toggle(s, v))} />
            </div>
            <FormField label="Your profession or field" htmlFor="occupation" helpText="Helps us match mentoring opportunities.">
              <TextInput id="occupation" value={occupation} onChange={(e) => setOccupation(e.target.value)} />
            </FormField>
            <FormField label="Volunteering comments or notes" htmlFor="volNotes">
              <TextArea id="volNotes" value={volunteerNotes} onChange={(e) => setVolunteerNotes(e.target.value)} style={{ minHeight: '70px' }} />
            </FormField>
          </div>

          <InfoAlert title="Both guardians receive all communications">
            We send notifications to every guardian on the account. Add a second guardian if you’d like them included.
          </InfoAlert>

          {process.env.NEXT_PUBLIC_FEATURE_FINANCIAL_AID === 'true' && <FinancialAidCallout href="https://forms.gle/nqjneY9ESyLRdZ8V9" />}

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
            <SecondaryButton onClick={() => setStep(3)}>Back</SecondaryButton>
            <PrimaryButton disabled={!step4Valid} onClick={() => setStep(5)}>Next</PrimaryButton>
          </div>
        </div>
      )}

      {/* Section 5 — Final confirmation */}
      {step === 5 && (
        <div style={{ ...cardBase, marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h2 className="text-section-title">Final confirmation</h2>
          <FormField label="Anything else we should know?" htmlFor="anything">
            <TextArea id="anything" value={additionalNotes} onChange={(e) => setAdditionalNotes(e.target.value)} />
          </FormField>
          <div
            style={{
              backgroundColor: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              padding: '1rem',
              fontSize: '0.8125rem',
              lineHeight: 1.55,
              color: 'var(--color-text-muted)',
            }}
          >
            {DATA_NOTICE}
          </div>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem', fontSize: '0.9375rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={certified} onChange={(e) => setCertified(e.target.checked)} style={{ width: 16, height: 16, marginTop: 3 }} />
            <span>
              I am the parent or guardian and certify that I am authorized to provide this information on behalf
              of the student.{req}
            </span>
          </label>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
            <SecondaryButton onClick={() => setStep(4)}>Back</SecondaryButton>
            <PrimaryButton disabled={!step5Valid} loading={submitting} onClick={handleSubmit}>
              Submit application
            </PrimaryButton>
          </div>
        </div>
      )}
    </PublicShell>
  )
}
