'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader, FormSection, FormField, TextInput, PrimaryButton, SecondaryButton, SuccessAlert, ErrorAlert, InfoAlert } from '@/components/ui'

const OTHER_SCHOOL = '__other__'
type School = { id: string; name: string; grade_min: number | null; grade_max: number | null }
type RosterRow = { student_first: string; student_last: string; grade: string; schoolId: string; schoolOther: string; parent_first: string; parent_last: string; parent_email: string }
const emptyRow = (): RosterRow => ({ student_first: '', student_last: '', grade: '', schoolId: '', schoolOther: '', parent_first: '', parent_last: '', parent_email: '' })
const rowComplete = (r: RosterRow) => r.student_first.trim() && r.student_last.trim() && r.parent_email.trim() && r.grade

const selectStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', fontSize: '0.875rem', color: 'var(--color-text-primary)', backgroundColor: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '6px', fontFamily: 'inherit', boxSizing: 'border-box' }
const lbl: React.CSSProperties = { display: 'block', fontSize: '0.8125rem', fontWeight: 500, marginBottom: '0.25rem' }
const grid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }
const GRADES = [3, 4, 5, 6]

export default function IqTeamForm({ email, coach, schools, zeffyUrl, fee, takenNumbers = [] }: { email: string; coach: { first_name: string; last_name: string; phone: string }; schools: School[]; zeffyUrl: string | null; fee: number; takenNumbers?: string[] }) {
  const router = useRouter()
  const [cFirst, setCFirst] = useState(coach.first_name)
  const [cLast, setCLast] = useState(coach.last_name)
  const [cPhone, setCPhone] = useState(coach.phone)
  const [aFirst, setAFirst] = useState(''); const [aLast, setALast] = useState(''); const [aEmail, setAEmail] = useState(''); const [aPhone, setAPhone] = useState('')
  const [returning, setReturning] = useState('')
  const [competes, setCompetes] = useState('unsure')
  const [ocFirst, setOcFirst] = useState(''); const [ocLast, setOcLast] = useState(''); const [ocGrade, setOcGrade] = useState(''); const [ocSchoolId, setOcSchoolId] = useState(''); const [ocSchoolOther, setOcSchoolOther] = useState('')
  const [feeAck, setFeeAck] = useState(false)
  const [roster, setRoster] = useState<RosterRow[]>([emptyRow(), emptyRow()])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ paymentRef: string; members: { student: string; under: string }[] } | null>(null)

  const completeOthers = roster.filter(rowComplete).length
  const ownCount = ocFirst.trim() && ocLast.trim() && ocGrade ? 1 : 0
  const totalMembers = ownCount + completeOthers
  const numberTaken = !!returning.trim() && takenNumbers.includes(returning.trim().toUpperCase())
  const valid = cFirst.trim() && cLast.trim() && feeAck && totalMembers >= 3 && !numberTaken

  function setRow(i: number, k: keyof RosterRow, v: string) {
    setRoster((rows) => rows.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)))
  }

  async function submit() {
    if (busy || !valid) return
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/iq/team', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coach: { first_name: cFirst.trim(), last_name: cLast.trim(), phone: cPhone.trim() },
          assistant: aFirst.trim() ? { first_name: aFirst.trim(), last_name: aLast.trim(), email: aEmail.trim(), phone: aPhone.trim() } : null,
          returning_number: returning.trim(), competes_outside: competes,
          own_child: ownCount ? { first_name: ocFirst.trim(), last_name: ocLast.trim(), grade: ocGrade, school_id: ocSchoolId && ocSchoolId !== OTHER_SCHOOL ? ocSchoolId : '', school: ocSchoolId === OTHER_SCHOOL ? ocSchoolOther.trim() : '' } : {},
          fee_ack: feeAck,
          roster: roster.filter(rowComplete).map((r) => ({
            student_first: r.student_first, student_last: r.student_last, grade: r.grade,
            parent_first: r.parent_first, parent_last: r.parent_last, parent_email: r.parent_email,
            school_id: r.schoolId && r.schoolId !== OTHER_SCHOOL ? r.schoolId : '',
            school: r.schoolId === OTHER_SCHOOL ? r.schoolOther.trim() : '',
          })),
        }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setError(d.error || 'Something went wrong.'); setBusy(false); return }
      setResult({ paymentRef: d.paymentRef ?? '', members: d.members ?? [] })
    } catch { setError('Network error — please try again.'); setBusy(false) }
  }

  if (result) {
    return (
      <>
        <PageHeader title="IQ team created" subtitle="One more step — pay your team fee." />
        <SuccessAlert title="Team created — payment needed">
          Pay your <strong>${fee.toLocaleString()}</strong> team fee now to start the review. Once it’s confirmed, the IQ
          Coordinator reviews your team; after approval, each family is invited to register. We also emailed you this link.
        </SuccessAlert>

        <div style={{ marginTop: '1.25rem', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '1.25rem', textAlign: 'center' }}>
          {zeffyUrl ? (
            <a href={zeffyUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', padding: '13px 28px', background: 'var(--color-gold)', color: 'var(--color-navy-darker)', fontWeight: 700, fontSize: '1rem', borderRadius: 8, textDecoration: 'none' }}>
              Pay the ${fee.toLocaleString()} team fee via Zeffy →
            </a>
          ) : (
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>A secure payment link will be emailed to you shortly.</p>
          )}
          <p style={{ margin: '0.875rem 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
            Pay with the <strong>same email you signed in with</strong> ({email}) and enter your reference code{' '}
            <strong>{result.paymentRef}</strong> in Zeffy — that’s how we match your payment to your team.
          </p>
        </div>

        <div style={{ marginTop: '1.25rem', border: '1px solid var(--color-border)', borderRadius: '10px', overflow: 'hidden' }}>
          {result.members.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', padding: '0.75rem 1rem', borderBottom: i < result.members.length - 1 ? '1px solid var(--color-border)' : 'none', fontSize: '0.875rem' }}>
              <span>{m.student || '—'}</span>
              <span style={{ color: m.under.startsWith('error') ? 'var(--color-error)' : 'var(--color-text-muted)' }}>{m.under}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: '1.25rem' }}><SecondaryButton onClick={() => router.push('/dashboard')}>Go to dashboard</SecondaryButton></div>
      </>
    )
  }

  const schoolSelect = (grade: string, schoolId: string, schoolOther: string, onId: (v: string) => void, onOther: (v: string) => void) => {
    const gnum = Number(grade)
    const visible = !grade ? [] : schools.filter((s) => (s.grade_min == null || gnum >= s.grade_min) && (s.grade_max == null || gnum <= s.grade_max))
    return (
      <div>
        <label style={lbl}>School</label>
        <select style={selectStyle} value={schoolId} onChange={(e) => onId(e.target.value)}>
          <option value="">{grade ? 'Select…' : 'Pick grade first'}</option>
          {visible.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          <option value={OTHER_SCHOOL}>Other (not listed)</option>
        </select>
        {schoolId === OTHER_SCHOOL && <div style={{ marginTop: '0.4rem' }}><TextInput placeholder="School name" value={schoolOther} onChange={(e) => onOther(e.target.value)} /></div>}
      </div>
    )
  }

  const memberRow = (label: string, sf: string, setSf: (v: string) => void, sl: string, setSl: (v: string) => void, gr: string, setGr: (v: string) => void, schoolNode: React.ReactNode, extra?: React.ReactNode) => (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: '8px', padding: '0.75rem 0.875rem', marginBottom: '0.625rem' }}>
      {label && <div style={{ fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.5rem' }}>{label}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.5rem' }}>
        <div><label style={lbl}>Student first</label><TextInput value={sf} onChange={(e) => setSf(e.target.value)} /></div>
        <div><label style={lbl}>Student last</label><TextInput value={sl} onChange={(e) => setSl(e.target.value)} /></div>
        <div><label style={lbl}>Grade</label><select style={selectStyle} value={gr} onChange={(e) => setGr(e.target.value)}><option value="">—</option>{GRADES.map((g) => <option key={g} value={g}>{g}</option>)}</select></div>
        <div>{schoolNode}</div>
      </div>
      {extra}
    </div>
  )

  return (
    <>
      <PageHeader title="Create your IQ team" subtitle="Coach application for the 2026–27 VEX IQ season (Elementary)." />
      {error && <div style={{ marginBottom: '1.25rem' }}><ErrorAlert title="Couldn’t submit">{error}</ErrorAlert></div>}

      <FormSection title="Coach" description={`Signed in as ${email}.`}>
        <div style={grid2}>
          <FormField label="First name" htmlFor="cf" required><TextInput id="cf" value={cFirst} onChange={(e) => setCFirst(e.target.value)} /></FormField>
          <FormField label="Last name" htmlFor="cl" required><TextInput id="cl" value={cLast} onChange={(e) => setCLast(e.target.value)} /></FormField>
        </div>
        <FormField label="Phone" htmlFor="cp"><TextInput id="cp" type="tel" value={cPhone} onChange={(e) => setCPhone(e.target.value)} /></FormField>
      </FormSection>

      <FormSection title="Assistant coach / mentor (optional)">
        <div style={grid2}>
          <FormField label="First name" htmlFor="af"><TextInput id="af" value={aFirst} onChange={(e) => setAFirst(e.target.value)} /></FormField>
          <FormField label="Last name" htmlFor="al"><TextInput id="al" value={aLast} onChange={(e) => setALast(e.target.value)} /></FormField>
        </div>
        <div style={grid2}>
          <FormField label="Email" htmlFor="ae"><TextInput id="ae" type="email" value={aEmail} onChange={(e) => setAEmail(e.target.value)} /></FormField>
          <FormField label="Phone" htmlFor="ap"><TextInput id="ap" type="tel" value={aPhone} onChange={(e) => setAPhone(e.target.value)} /></FormField>
        </div>
      </FormSection>

      <FormSection title="Team" description="All Placer Robotics IQ teams are Elementary (ES). Team name/number are assigned later from RobotEvents.">
        <div style={grid2}>
          <FormField label="Returning team number (optional)" htmlFor="rn" helpText="Had a number last season? Enter it so we can match you — the IQ Coordinator confirms/assigns the official number. New teams: leave blank.">
            <TextInput id="rn" value={returning} onChange={(e) => setReturning(e.target.value)} placeholder="e.g. 295Y" />
            {numberTaken && (
              <p style={{ margin: '0.4rem 0 0', fontSize: '0.8125rem', color: 'var(--color-error)', fontWeight: 600 }}>
                Team #{returning.trim().toUpperCase()} already exists. If that&apos;s your team, don&apos;t create a new one — contact the IQ Coordinator at registrar@placerrobotics.org to be added.
              </p>
            )}
          </FormField>
          <div>
            <label htmlFor="co" style={lbl}>Compete outside the Placer League?</label>
            <select id="co" style={selectStyle} value={competes} onChange={(e) => setCompetes(e.target.value)}>
              <option value="no">No</option>
              <option value="yes">Yes</option>
              <option value="unsure">Unsure</option>
            </select>
          </div>
        </div>
      </FormSection>

      <FormSection title="Your own child (optional)" description="If your child is on the team, add them here — they go under your account, no separate invite.">
        {memberRow('', ocFirst, setOcFirst, ocLast, setOcLast, ocGrade, setOcGrade, schoolSelect(ocGrade, ocSchoolId, ocSchoolOther, setOcSchoolId, setOcSchoolOther))}
      </FormSection>

      <FormSection title="Team members" description="At least 3 members total (up to 10). Grade + school help us review and approve. Each parent gets a magic link (after approval) to register.">
        {roster.map((r, i) => (
          memberRow(
            `Member ${i + 1}`, r.student_first, (v) => setRow(i, 'student_first', v), r.student_last, (v) => setRow(i, 'student_last', v),
            r.grade, (v) => setRow(i, 'grade', v),
            schoolSelect(r.grade, r.schoolId, r.schoolOther, (v) => setRow(i, 'schoolId', v), (v) => setRow(i, 'schoolOther', v)),
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.5rem', marginTop: '0.5rem' }}>
                <div><label style={lbl}>Parent first</label><TextInput value={r.parent_first} onChange={(e) => setRow(i, 'parent_first', e.target.value)} /></div>
                <div><label style={lbl}>Parent last</label><TextInput value={r.parent_last} onChange={(e) => setRow(i, 'parent_last', e.target.value)} /></div>
                <div style={{ gridColumn: '1 / -1' }}><label style={lbl}>Parent email</label><TextInput type="email" value={r.parent_email} onChange={(e) => setRow(i, 'parent_email', e.target.value)} /></div>
              </div>
              {roster.length > 2 && <button type="button" onClick={() => setRoster((rows) => rows.filter((_, idx) => idx !== i))} style={{ marginTop: '0.5rem', background: 'none', border: 'none', color: 'var(--color-error)', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>Remove</button>}
            </>
          )
        ))}
        {roster.length < 10 && <SecondaryButton onClick={() => setRoster((rows) => [...rows, emptyRow()])}>+ Add another member</SecondaryButton>}
        <div style={{ marginTop: '0.75rem', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
          Parent emails will receive a registration invitation once your team is approved and the fee is confirmed. Do not use student email addresses.
        </div>
        {totalMembers < 3 && (
          <div style={{ marginTop: '0.75rem' }}><InfoAlert title="Need 3 total">Add {3 - totalMembers} more — teams need at least 3 members total{ownCount ? ' (including your child)' : ''}. Each needs a grade.</InfoAlert></div>
        )}
      </FormSection>

      <FormSection title="Fee agreement" description="VEX IQ is billed as a flat team fee the coach collects.">
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem', fontSize: '0.9375rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={feeAck} onChange={(e) => setFeeAck(e.target.checked)} style={{ marginTop: '0.25rem' }} />
          <span>I agree to collect the $1,200 Placer Robotics IQ program fee on behalf of my team, and I have reviewed the league policies and code of conduct.</span>
        </label>
      </FormSection>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
        <PrimaryButton loading={busy} disabled={!valid} onClick={submit}>Create team</PrimaryButton>
      </div>
    </>
  )
}
