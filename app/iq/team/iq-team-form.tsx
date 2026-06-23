'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader, FormSection, FormField, TextInput, PrimaryButton, SecondaryButton, SuccessAlert, ErrorAlert, InfoAlert } from '@/components/ui'

type RosterRow = { student_first: string; student_last: string; grade: string; school: string; parent_first: string; parent_last: string; parent_email: string }
const emptyRow = (): RosterRow => ({ student_first: '', student_last: '', grade: '', school: '', parent_first: '', parent_last: '', parent_email: '' })
const rowComplete = (r: RosterRow) => r.student_first.trim() && r.student_last.trim() && r.parent_email.trim() && r.grade

const selectStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', fontSize: '0.875rem', color: 'var(--color-text-primary)', backgroundColor: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '6px', fontFamily: 'inherit', boxSizing: 'border-box' }
const lbl: React.CSSProperties = { display: 'block', fontSize: '0.8125rem', fontWeight: 500, marginBottom: '0.25rem' }
const grid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }
const GRADES = [3, 4, 5, 6]

export default function IqTeamForm({ email, coach }: { email: string; coach: { first_name: string; last_name: string; phone: string } }) {
  const router = useRouter()
  const [cFirst, setCFirst] = useState(coach.first_name)
  const [cLast, setCLast] = useState(coach.last_name)
  const [cPhone, setCPhone] = useState(coach.phone)
  const [aFirst, setAFirst] = useState(''); const [aLast, setALast] = useState(''); const [aEmail, setAEmail] = useState(''); const [aPhone, setAPhone] = useState('')
  const [returning, setReturning] = useState('')
  const [competes, setCompetes] = useState('unsure')
  const [ocFirst, setOcFirst] = useState(''); const [ocLast, setOcLast] = useState(''); const [ocGrade, setOcGrade] = useState(''); const [ocSchool, setOcSchool] = useState('')
  const [feeAck, setFeeAck] = useState(false)
  const [roster, setRoster] = useState<RosterRow[]>([emptyRow(), emptyRow()])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ members: { student: string; under: string }[] } | null>(null)

  const completeOthers = roster.filter(rowComplete).length
  const ownCount = ocFirst.trim() && ocLast.trim() && ocGrade ? 1 : 0
  const totalMembers = ownCount + completeOthers
  const valid = cFirst.trim() && cLast.trim() && feeAck && totalMembers >= 3

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
          own_child: ownCount ? { first_name: ocFirst.trim(), last_name: ocLast.trim(), grade: ocGrade, school: ocSchool.trim() } : {},
          fee_ack: feeAck,
          roster: roster.filter(rowComplete),
        }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setError(d.error || 'Something went wrong.'); setBusy(false); return }
      setResult({ members: d.members ?? [] })
    } catch { setError('Network error — please try again.'); setBusy(false) }
  }

  if (result) {
    return (
      <>
        <PageHeader title="Team submitted" subtitle="Your IQ team is in for review." />
        <SuccessAlert title="Submitted for IQ Coordinator approval">
          Once the IQ Coordinator approves your team, each parent gets a magic link to register their student. We&apos;ll
          email you when it&apos;s approved. Nothing is sent to parents until then.
        </SuccessAlert>
        <div style={{ marginTop: '1.25rem', border: '1px solid var(--color-border)', borderRadius: '10px', overflow: 'hidden' }}>
          {result.members.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', padding: '0.75rem 1rem', borderBottom: i < result.members.length - 1 ? '1px solid var(--color-border)' : 'none', fontSize: '0.875rem' }}>
              <span>{m.student || '—'}</span>
              <span style={{ color: m.under.startsWith('error') ? 'var(--color-error)' : 'var(--color-text-muted)' }}>{m.under}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: '1.25rem' }}><PrimaryButton onClick={() => router.push('/dashboard')}>Go to dashboard</PrimaryButton></div>
      </>
    )
  }

  const memberRow = (label: string, sf: string, setSf: (v: string) => void, sl: string, setSl: (v: string) => void, gr: string, setGr: (v: string) => void, sc: string, setSc: (v: string) => void, extra?: React.ReactNode) => (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: '8px', padding: '0.75rem 0.875rem', marginBottom: '0.625rem' }}>
      {label && <div style={{ fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.5rem' }}>{label}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.5rem' }}>
        <div><label style={lbl}>Student first</label><TextInput value={sf} onChange={(e) => setSf(e.target.value)} /></div>
        <div><label style={lbl}>Student last</label><TextInput value={sl} onChange={(e) => setSl(e.target.value)} /></div>
        <div><label style={lbl}>Grade</label><select style={selectStyle} value={gr} onChange={(e) => setGr(e.target.value)}><option value="">—</option>{GRADES.map((g) => <option key={g} value={g}>{g}</option>)}</select></div>
        <div><label style={lbl}>School</label><TextInput value={sc} onChange={(e) => setSc(e.target.value)} /></div>
      </div>
      {extra}
    </div>
  )

  return (
    <>
      <PageHeader title="Register an IQ team" subtitle="Coach application for the 2026–27 VEX IQ season (Elementary)." />
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
          <FormField label="Returning team number (optional)" htmlFor="rn" helpText="Had a number last season? Enter it. New teams: leave blank.">
            <TextInput id="rn" value={returning} onChange={(e) => setReturning(e.target.value)} placeholder="e.g. 295Y" />
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
        {memberRow('', ocFirst, setOcFirst, ocLast, setOcLast, ocGrade, setOcGrade, ocSchool, setOcSchool)}
      </FormSection>

      <FormSection title="Team members" description="At least 3 members total. Grade + school help us review and approve. Each parent gets a magic link (after approval) to register.">
        {roster.map((r, i) => (
          memberRow(
            `Member ${i + 1}`, r.student_first, (v) => setRow(i, 'student_first', v), r.student_last, (v) => setRow(i, 'student_last', v),
            r.grade, (v) => setRow(i, 'grade', v), r.school, (v) => setRow(i, 'school', v),
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
        <SecondaryButton onClick={() => setRoster((rows) => [...rows, emptyRow()])}>+ Add another member</SecondaryButton>
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
        <PrimaryButton loading={busy} disabled={!valid} onClick={submit}>Submit team for approval</PrimaryButton>
      </div>
    </>
  )
}
