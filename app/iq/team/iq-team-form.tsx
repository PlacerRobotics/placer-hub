'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader, FormSection, FormField, TextInput, PrimaryButton, SecondaryButton, SuccessAlert, ErrorAlert, InfoAlert } from '@/components/ui'

type RosterRow = { student_first: string; student_last: string; parent_first: string; parent_last: string; parent_email: string }
const emptyRow = (): RosterRow => ({ student_first: '', student_last: '', parent_first: '', parent_last: '', parent_email: '' })
const rowComplete = (r: RosterRow) => r.student_first.trim() && r.student_last.trim() && r.parent_email.trim()

const selectStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', fontSize: '0.9375rem', color: 'var(--color-text-primary)', backgroundColor: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '6px', fontFamily: 'inherit', boxSizing: 'border-box' }
const lbl: React.CSSProperties = { display: 'block', fontSize: '0.9375rem', fontWeight: 500, marginBottom: '0.375rem' }

export default function IqTeamForm({ email, coach }: { email: string; coach: { first_name: string; last_name: string; phone: string } }) {
  const router = useRouter()
  const [cFirst, setCFirst] = useState(coach.first_name)
  const [cLast, setCLast] = useState(coach.last_name)
  const [cPhone, setCPhone] = useState(coach.phone)
  const [aFirst, setAFirst] = useState(''); const [aLast, setALast] = useState(''); const [aEmail, setAEmail] = useState(''); const [aPhone, setAPhone] = useState('')
  const [teamName, setTeamName] = useState('')
  const [returning, setReturning] = useState('')
  const [competes, setCompetes] = useState('unsure')
  const [ocFirst, setOcFirst] = useState(''); const [ocLast, setOcLast] = useState('')
  const [feeAck, setFeeAck] = useState(false)
  const [roster, setRoster] = useState<RosterRow[]>([emptyRow(), emptyRow()])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ members: { student: string; under: string }[] } | null>(null)

  const completeOthers = roster.filter(rowComplete).length
  const valid = cFirst.trim() && cLast.trim() && feeAck && ocFirst.trim() && ocLast.trim() && completeOthers >= 2

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
          team_name: teamName.trim(), returning_number: returning.trim(), competes_outside: competes,
          own_child: { first_name: ocFirst.trim(), last_name: ocLast.trim() },
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

  return (
    <>
      <PageHeader title="Register an IQ team" subtitle="Coach application for the 2026–27 VEX IQ season (Elementary)." />
      {error && <div style={{ marginBottom: '1.25rem' }}><ErrorAlert title="Couldn’t submit">{error}</ErrorAlert></div>}

      <FormSection title="Coach" description={`Signed in as ${email}.`}>
        <FormField label="First name" htmlFor="cf" required><TextInput id="cf" value={cFirst} onChange={(e) => setCFirst(e.target.value)} /></FormField>
        <FormField label="Last name" htmlFor="cl" required><TextInput id="cl" value={cLast} onChange={(e) => setCLast(e.target.value)} /></FormField>
        <FormField label="Phone" htmlFor="cp"><TextInput id="cp" type="tel" value={cPhone} onChange={(e) => setCPhone(e.target.value)} /></FormField>
      </FormSection>

      <FormSection title="Assistant coach / mentor (optional)">
        <FormField label="First name" htmlFor="af"><TextInput id="af" value={aFirst} onChange={(e) => setAFirst(e.target.value)} /></FormField>
        <FormField label="Last name" htmlFor="al"><TextInput id="al" value={aLast} onChange={(e) => setALast(e.target.value)} /></FormField>
        <FormField label="Email" htmlFor="ae"><TextInput id="ae" type="email" value={aEmail} onChange={(e) => setAEmail(e.target.value)} /></FormField>
        <FormField label="Phone" htmlFor="ap"><TextInput id="ap" type="tel" value={aPhone} onChange={(e) => setAPhone(e.target.value)} /></FormField>
      </FormSection>

      <FormSection title="Team" description="All Placer Robotics IQ teams are Elementary (ES).">
        <FormField label="Robot team name (optional)" htmlFor="tn"><TextInput id="tn" value={teamName} onChange={(e) => setTeamName(e.target.value)} /></FormField>
        <FormField label="Returning team number (optional)" htmlFor="rn" helpText="If you had a team number last season, enter it. New teams: leave blank — we'll assign one.">
          <TextInput id="rn" value={returning} onChange={(e) => setReturning(e.target.value)} placeholder="e.g. 295Y" />
        </FormField>
        <div>
          <label htmlFor="co" style={lbl}>Will your team compete outside the Placer League?</label>
          <select id="co" style={selectStyle} value={competes} onChange={(e) => setCompetes(e.target.value)}>
            <option value="no">No</option>
            <option value="yes">Yes</option>
            <option value="unsure">Unsure</option>
          </select>
        </div>
      </FormSection>

      <FormSection title="Your own child" description="Your child is on the team. They'll be added under your account — no separate invite.">
        <FormField label="First name" htmlFor="ocf" required><TextInput id="ocf" value={ocFirst} onChange={(e) => setOcFirst(e.target.value)} /></FormField>
        <FormField label="Last name" htmlFor="ocl" required><TextInput id="ocl" value={ocLast} onChange={(e) => setOcLast(e.target.value)} /></FormField>
      </FormSection>

      <FormSection title="Other team members" description="A team needs at least 3 total — your child plus 2 more. Each parent gets a magic link (after approval) to register their student.">
        {roster.map((r, i) => (
          <div key={i} style={{ border: '1px solid var(--color-border)', borderRadius: '8px', padding: '0.875rem', marginBottom: '0.75rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.625rem' }}>
              <div><label style={lbl}>Student first</label><TextInput value={r.student_first} onChange={(e) => setRow(i, 'student_first', e.target.value)} /></div>
              <div><label style={lbl}>Student last</label><TextInput value={r.student_last} onChange={(e) => setRow(i, 'student_last', e.target.value)} /></div>
              <div><label style={lbl}>Parent first</label><TextInput value={r.parent_first} onChange={(e) => setRow(i, 'parent_first', e.target.value)} /></div>
              <div><label style={lbl}>Parent last</label><TextInput value={r.parent_last} onChange={(e) => setRow(i, 'parent_last', e.target.value)} /></div>
              <div style={{ gridColumn: '1 / -1' }}><label style={lbl}>Parent email</label><TextInput type="email" value={r.parent_email} onChange={(e) => setRow(i, 'parent_email', e.target.value)} /></div>
            </div>
            {roster.length > 2 && (
              <button type="button" onClick={() => setRoster((rows) => rows.filter((_, idx) => idx !== i))} style={{ marginTop: '0.5rem', background: 'none', border: 'none', color: 'var(--color-error)', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>Remove</button>
            )}
          </div>
        ))}
        <SecondaryButton onClick={() => setRoster((rows) => [...rows, emptyRow()])}>+ Add another member</SecondaryButton>
        {!valid && (ocFirst.trim() || completeOthers > 0) && completeOthers < 2 && (
          <div style={{ marginTop: '0.75rem' }}><InfoAlert title="Need 3 total">Add your child plus at least 2 more team members.</InfoAlert></div>
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
