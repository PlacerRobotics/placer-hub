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
} from '@/components/ui'
import { FinancialAidCallout } from '@/components/FinancialAidCallout'

// Mirrors the live Google Form "Placer Robotics – 2026–27 Application".
// Programs are a multi-select (V5 / Combat / Not Sure); a single program_interest
// is derived server-side for the pipeline. VEX IQ (grades 3–6) applies elsewhere.
const PROGRAM_OPTIONS = ['VEX V5', 'Combat Robotics', 'Not Sure']
const EXPERIENCE_OPTIONS = ['VEX IQ', 'VEX V5', 'Combat Robotics', 'FRC/FTC', 'FLL', 'PTLW']
const SKILLS_OPTIONS = [
  'Coding (VEXcode, Python)',
  'CAD (Fusion 360, Onshape)',
  'Mechanical Building',
  'Electrical Engineering',
  'None yet',
]
const VOLUNTEER_OPTIONS = [
  'Lab Supervision',
  'General Activities / Events Volunteer',
  'Combat Advisor / Mentor',
  'Robotics Center Operations / Facilities',
  'VEX Equipment Managers',
  'Fundraising / Grants / Sponsorships',
  'Business / Marketing',
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
  const [studentEmail, setStudentEmail] = useState('')
  const [studentPhone, setStudentPhone] = useState('')
  const [dob, setDob] = useState('')
  const [address, setAddress] = useState('')
  const [grade, setGrade] = useState('')
  const [schoolId, setSchoolId] = useState('')
  const [schoolOther, setSchoolOther] = useState('')
  const [schools, setSchools] = useState<
    { id: string; name: string; grade_min: number | null; grade_max: number | null }[]
  >([])
  const [gpaOverall, setGpaOverall] = useState('')
  const [gpaRecent, setGpaRecent] = useState('')
  const [referral, setReferral] = useState('')

  // Section 2 — Program Interests
  const [programs, setPrograms] = useState<string[]>([])
  const [experience, setExperience] = useState<string[]>([])
  const [skills, setSkills] = useState<string[]>([])
  const [teammates, setTeammates] = useState('')

  // Section 3 — Student Motivation & Goals
  const [background, setBackground] = useState('')
  const [whyJoin, setWhyJoin] = useState('')
  const [whyCompetitive, setWhyCompetitive] = useState('')
  const [goals, setGoals] = useState('')
  const [commitment, setCommitment] = useState('')
  const [extracurriculars, setExtracurriculars] = useState('')
  const [extracurricularHours, setExtracurricularHours] = useState('')
  const [summer, setSummer] = useState<'yes' | 'maybe' | 'no' | ''>('')

  // Section 4 — Parent / Guardian Information
  const [pFirst, setPFirst] = useState('')
  const [pLast, setPLast] = useState('')
  const [pEmail, setPEmail] = useState('')
  const [pPhone, setPPhone] = useState('')
  const [volunteerInterests, setVolunteerInterests] = useState<string[]>([])
  const [volunteerNotes, setVolunteerNotes] = useState('')
  const [occupation, setOccupation] = useState('')

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
    studentEmail.trim() &&
    studentPhone.trim() &&
    dob.trim() &&
    address.trim() &&
    grade &&
    (schoolId === OTHER_SCHOOL ? schoolOther.trim() : schoolId) &&
    referral.trim()
  const step2Valid = programs.length > 0
  const step3Valid =
    background.trim() &&
    whyJoin.trim() &&
    whyCompetitive.trim() &&
    goals.trim() &&
    commitment.trim() &&
    extracurriculars.trim() &&
    extracurricularHours.trim() &&
    summer !== ''
  const step4Valid = pFirst.trim() && pLast.trim() && pEmail.trim() && pPhone.trim()
  const step5Valid = certified

  async function handleSubmit() {
    if (!step5Valid || submitting) return
    setSubmitting(true)
    setError('')
    const payload = {
      programs,
      student: {
        first_name: stuFirst.trim(),
        last_name: stuLast.trim(),
        preferred_name: preferred.trim() || null,
        communication_email: studentEmail.trim(),
        phone: studentPhone.trim(),
        birthdate: dob || null,
        home_address: address.trim(),
        grade: Number(grade),
        school_id: schoolId && schoolId !== OTHER_SCHOOL ? schoolId : null,
        school_raw: schoolId === OTHER_SCHOOL ? schoolOther.trim() : null,
      },
      application: {
        gpa_overall: gpaOverall.trim() || null,
        gpa_recent_term: gpaRecent.trim() || null,
        referral_source: referral.trim(),
        previous_experience: experience,
        skills_interest: skills,
        teammate_preference: teammates.trim() || null,
        motivation_background: background.trim(),
        motivation_why_join: whyJoin.trim(),
        motivation_why_competitive: whyCompetitive.trim(),
        motivation_goals: goals.trim(),
        commitment_level: commitment.trim(),
        extracurriculars: extracurriculars.trim(),
        extracurricular_hours: extracurricularHours.trim(),
        summer_availability: summer,
        additional_notes: additionalNotes.trim() || null,
      },
      guardian: {
        first_name: pFirst.trim(),
        last_name: pLast.trim(),
        email: pEmail.trim(),
        phone: pPhone.trim(),
        occupation: occupation.trim() || null,
        volunteer_interests: volunteerInterests,
        volunteer_notes: volunteerNotes.trim() || null,
      },
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
            on a rolling basis and will email {pEmail} once a decision is made.
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
      <h1 className="text-page-title">Placer Robotics — 2026–27 Application</h1>
      <p className="text-help" style={{ marginTop: '0.5rem' }}>
        For students in grades 7–12 applying to join Placer Robotics competition teams. Step {step} of {TOTAL_STEPS}.
      </p>

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
          <FormField label="Preferred name / nickname (optional)" htmlFor="preferred">
            <TextInput id="preferred" value={preferred} onChange={(e) => setPreferred(e.target.value)} />
          </FormField>
          <FormField label="Student email" htmlFor="studentEmail" required>
            <TextInput id="studentEmail" type="email" value={studentEmail} onChange={(e) => setStudentEmail(e.target.value)} />
          </FormField>
          <FormField label="Student phone number" htmlFor="studentPhone" required>
            <TextInput id="studentPhone" type="tel" value={studentPhone} onChange={(e) => setStudentPhone(e.target.value)} />
          </FormField>
          <FormField label="Date of birth" htmlFor="dob" required helpText="Required for age-group cut-offs.">
            <TextInput id="dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
          </FormField>
          <FormField label="Home address (City, State, ZIP)" htmlFor="address" required>
            <TextInput id="address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Roseville, CA 95661" />
          </FormField>
          <div>
            <label htmlFor="grade" style={labelStyle}>Grade entering (Fall 2026){req}</label>
            <select id="grade" value={grade} onChange={(e) => setGrade(e.target.value)} style={selectStyle}>
              <option value="">Choose…</option>
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
          <FormField label="Current overall GPA" htmlFor="gpaOverall">
            <TextInput id="gpaOverall" value={gpaOverall} onChange={(e) => setGpaOverall(e.target.value)} inputMode="decimal" placeholder="e.g. 3.8" />
          </FormField>
          <FormField label="Most recent GPA (last term)" htmlFor="gpaRecent">
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
        <div style={{ ...cardBase, marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h2 className="text-section-title">Program interests</h2>
          <div>
            <label style={labelStyle}>Which programs are you interested in?{req}</label>
            <CheckGroup options={PROGRAM_OPTIONS} selected={programs} onToggle={(v) => setPrograms((s) => toggle(s, v))} />
          </div>
          <div>
            <label style={labelStyle}>Previous robotics experience</label>
            <CheckGroup options={EXPERIENCE_OPTIONS} selected={experience} onToggle={(v) => setExperience((s) => toggle(s, v))} />
          </div>
          <div>
            <label style={labelStyle}>What skills are you excited about or already familiar with?</label>
            <CheckGroup options={SKILLS_OPTIONS} selected={skills} onToggle={(v) => setSkills((s) => toggle(s, v))} />
          </div>
          <FormField label="List any teammates you’d like to work with (optional)" htmlFor="teammates">
            <TextArea id="teammates" value={teammates} onChange={(e) => setTeammates(e.target.value)} style={{ minHeight: '70px' }} />
          </FormField>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
            <SecondaryButton onClick={() => setStep(1)}>Back</SecondaryButton>
            <PrimaryButton disabled={!step2Valid} onClick={() => setStep(3)}>Next</PrimaryButton>
          </div>
        </div>
      )}

      {/* Section 3 — Student Motivation & Goals */}
      {step === 3 && (
        <div style={{ ...cardBase, marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h2 className="text-section-title">Student motivation &amp; goals</h2>
          <FormField label="Student background — tell us about yourself" htmlFor="bg" required>
            <TextArea id="bg" value={background} onChange={(e) => setBackground(e.target.value)} />
          </FormField>
          <FormField label="Why do you want to join Placer Robotics?" htmlFor="whyJoin" required>
            <TextArea id="whyJoin" value={whyJoin} onChange={(e) => setWhyJoin(e.target.value)} />
          </FormField>
          <FormField label="Why do you want to be on a competitive robotics team?" htmlFor="whyComp" required>
            <TextArea id="whyComp" value={whyCompetitive} onChange={(e) => setWhyCompetitive(e.target.value)} />
          </FormField>
          <FormField label="What are your personal goals for the 2026–27 season?" htmlFor="goals" required>
            <TextArea id="goals" value={goals} onChange={(e) => setGoals(e.target.value)} />
          </FormField>
          <FormField label="Describe your commitment level for the season. How many hours per week do you expect to spend on robotics?" htmlFor="commit" required>
            <TextArea id="commit" value={commitment} onChange={(e) => setCommitment(e.target.value)} />
          </FormField>
          <FormField label="List your other extracurriculars (sports, band, clubs, etc.)" htmlFor="extra" required>
            <TextArea id="extra" value={extracurriculars} onChange={(e) => setExtracurriculars(e.target.value)} />
          </FormField>
          <FormField label="How many hours/week do you spend on those activities?" htmlFor="extraHours" required>
            <TextInput id="extraHours" value={extracurricularHours} onChange={(e) => setExtracurricularHours(e.target.value)} />
          </FormField>
          <div>
            <label style={labelStyle}>Are you available to volunteer at camps this summer or get started early?{req}</label>
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

      {/* Section 4 — Parent / Guardian Information */}
      {step === 4 && (
        <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ ...cardBase, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h2 className="text-section-title">Parent / guardian information</h2>
            <FormField label="Parent/guardian first name" htmlFor="pFirst" required>
              <TextInput id="pFirst" value={pFirst} onChange={(e) => setPFirst(e.target.value)} />
            </FormField>
            <FormField label="Parent/guardian last name" htmlFor="pLast" required>
              <TextInput id="pLast" value={pLast} onChange={(e) => setPLast(e.target.value)} />
            </FormField>
            <FormField label="Parent/guardian email" htmlFor="pEmail" required helpText="This becomes your sign-in email.">
              <TextInput id="pEmail" type="email" value={pEmail} onChange={(e) => setPEmail(e.target.value)} />
            </FormField>
            <FormField label="Parent/guardian phone number" htmlFor="pPhone" required>
              <TextInput id="pPhone" type="tel" value={pPhone} onChange={(e) => setPPhone(e.target.value)} />
            </FormField>
            <div>
              <label style={labelStyle}>Areas interested in volunteering (parents)</label>
              <CheckGroup options={VOLUNTEER_OPTIONS} selected={volunteerInterests} onToggle={(v) => setVolunteerInterests((s) => toggle(s, v))} />
            </div>
            <FormField label="Parent volunteering comments or notes" htmlFor="volNotes">
              <TextArea id="volNotes" value={volunteerNotes} onChange={(e) => setVolunteerNotes(e.target.value)} style={{ minHeight: '70px' }} />
            </FormField>
            <FormField label="Parent occupation / career" htmlFor="occupation" helpText="Helpful for mentoring, operations, etc.">
              <TextInput id="occupation" value={occupation} onChange={(e) => setOccupation(e.target.value)} />
            </FormField>
          </div>

          <InfoAlert title="Guardians receive all communications">
            We send notifications to the guardian on the account.
          </InfoAlert>

          <FinancialAidCallout href="https://forms.gle/nqjneY9ESyLRdZ8V9" />

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
          <FormField label="Anything else we should know? (optional)" htmlFor="anything">
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
