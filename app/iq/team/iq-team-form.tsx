'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader, FormSection, FormField, TextInput, PrimaryButton, SecondaryButton, SuccessAlert, ErrorAlert } from '@/components/ui'

type RosterRow = { student_first: string; student_last: string; parent_first: string; parent_last: string; parent_email: string }
const emptyRow = (): RosterRow => ({ student_first: '', student_last: '', parent_first: '', parent_last: '', parent_email: '' })

const selectStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', fontSize: '0.9375rem', color: 'var(--color-text-primary)', backgroundColor: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '6px', fontFamily: 'inherit', boxSizing: 'border-box' }
const lbl: React.CSSProperties = { display: 'block', fontSize: '0.9375rem', fontWeight: 500, marginBottom: '0.375rem' }

export default function IqTeamForm({ email, coach }: { email: string; coach: { first_name: string; last_name: string; phone: string } }) {
  const router = useRouter()
  const [cFirst, setCFirst] = useState(coach.first_name)
  const [cLast, setCLast] = useState(coach.last_name)
  const [cPhone, setCPhone] = useState(coach.phone)
  const [aFirst, setAFirst] = useState(''); const [aLast, setALast] = useState(''); const [aEmail, setAEmail] = useState(''); const [aPhone, setAPhone] = useState('')
  const [schoolOrg, setSchoolOrg] = useState('')
  const [division, setDivision] = useState('ES')
  const [teamName, setTeamName] = useState('')
  const [returning, setReturning] = useState('')
  const [competes, setCompetes] = useState('unsure')
  const [feeAck, setFeeAck] = useState(false)
  const [roster, setRoster] = useState<RosterRow[]>([emptyRow()])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ invited: number; members: { student: string; parentEmail: string; status: string }[] } | null>(null)

  const valid = cFirst.trim() && cLast.trim() && feeAck && roster.some((r) => r.student_first.trim() && r.student_last.trim() && r.parent_email.trim())

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
          school_org: schoolOrg.trim(), division, team_name: teamName.trim(), returning_number: returning.trim(),
          competes_outside: competes, fee_ack: feeAck,
          roster: roster.filter((r) => r.student_first.trim() && r.student_last.trim() && r.parent_email.trim()),
        }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setError(d.error || 'Something went wrong.'); setBusy(false); return }
      setResult({ invited: d.invited ?? 0, members: d.members ?? [] })
    } catch { setError('Network error — please try again.'); setBusy(false) }
  }

  if (result) {
    return (
      <>
        <PageHeader title="IQ team created" subtitle="Your team is set up and invitations are on their way." />
        <SuccessAlert title={`Team created · ${result.invited} parent invite(s) sent`}>
          Each parent gets a magic link to register their student for your IQ team. You can track and adjust the
          roster with an admin anytime.
        </SuccessAlert>
        <div style={{ marginTop: '1.25rem', border: '1px solid var(--color-border)', borderRadius: '10px', overflow: 'hidden' }}>
          {result.members.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', padding: '0.75rem 1rem', borderBottom: i < result.members.length - 1 ? '1px solid var(--color-border)' : 'none', fontSize: '0.875rem' }}>
              <span>{m.student || '—'} <span style={{ color: 'var(--color-text-muted)' }}>· {m.parentEmail}</span></span>
              <span style={{ color: m.status === 'invited' ? 'var(--color-success)' : 'var(--color-text-muted)' }}>{m.status}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: '1.25rem' }}><PrimaryButton onClick={() => router.push('/dashboard')}>Go to dashboard</PrimaryButton></div>
      </>
    )
  }

  return (
    <>
      <PageHeader title="Register an IQ team" subtitle="Coach application for the 2026–27 VEX IQ season." />
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

      <FormSection title="Team">
        <FormField label="School / organization" htmlFor="org"><TextInput id="org" value={schoolOrg} onChange={(e) => setSchoolOrg(e.target.value)} placeholder="Placer Robotics" /></FormField>
        <div>
          <label htmlFor="div" style={lbl}>Division</label>
          <select id="div" style={selectStyle} value={division} onChange={(e) => setDivision(e.target.value)}>
            <option value="ES">Elementary (ES)</option>
            <option value="MS">Middle (MS)</option>
          </select>
        </div>
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

      <FormSection title="Team members" description="Add each student and a parent email — each parent gets a magic link to register their student for your team.">
        {roster.map((r, i) => (
          <div key={i} style={{ border: '1px solid var(--color-border)', borderRadius: '8px', padding: '0.875rem', marginBottom: '0.75rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.625rem' }}>
              <div><label style={lbl}>Student first</label><TextInput value={r.student_first} onChange={(e) => setRow(i, 'student_first', e.target.value)} /></div>
              <div><label style={lbl}>Student last</label><TextInput value={r.student_last} onChange={(e) => setRow(i, 'student_last', e.target.value)} /></div>
              <div><label style={lbl}>Parent first</label><TextInput value={r.parent_first} onChange={(e) => setRow(i, 'parent_first', e.target.value)} /></div>
              <div><label style={lbl}>Parent last</label><TextInput value={r.parent_last} onChange={(e) => setRow(i, 'parent_last', e.target.value)} /></div>
              <div style={{ gridColumn: '1 / -1' }}><label style={lbl}>Parent email</label><TextInput type="email" value={r.parent_email} onChange={(e) => setRow(i, 'parent_email', e.target.value)} /></div>
            </div>
            {roster.length > 1 && (
              <button type="button" onClick={() => setRoster((rows) => rows.filter((_, idx) => idx !== i))} style={{ marginTop: '0.5rem', background: 'none', border: 'none', color: 'var(--color-error)', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>Remove</button>
            )}
          </div>
        ))}
        <SecondaryButton onClick={() => setRoster((rows) => [...rows, emptyRow()])}>+ Add another member</SecondaryButton>
      </FormSection>

      <FormSection title="Fee agreement" description="VEX IQ is billed as a flat team fee the coach collects.">
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem', fontSize: '0.9375rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={feeAck} onChange={(e) => setFeeAck(e.target.checked)} style={{ marginTop: '0.25rem' }} />
          <span>I agree to collect the $1,200 Placer Robotics IQ program fee on behalf of my team, and I have reviewed the league policies and code of conduct.</span>
        </label>
      </FormSection>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
        <PrimaryButton loading={busy} disabled={!valid} onClick={submit}>Create team &amp; invite members</PrimaryButton>
      </div>
    </>
  )
}
