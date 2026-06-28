'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PublicShell, FormField, TextInput, PrimaryButton, SecondaryButton, InfoAlert, SuccessAlert, ErrorAlert } from '@/components/ui'

const sel: React.CSSProperties = { width: '100%', padding: '9px 12px', fontSize: '0.9375rem', border: '1.5px solid var(--color-border)', borderRadius: 6, fontFamily: 'inherit', boxSizing: 'border-box', backgroundColor: 'var(--color-surface)' }
const lbl: React.CSSProperties = { display: 'block', fontSize: '0.9375rem', fontWeight: 500, marginBottom: '0.375rem' }
const grid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }
const card: React.CSSProperties = { marginTop: '1.5rem', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }
const PROGRAMS = [['vex_iq', 'VEX IQ'], ['vex_v5', 'VEX V5 (VRC)'], ['combat', 'Combat Robotics'], ['other', 'Other']]
const ROLES = [['general', 'General volunteer'], ['iq_coach', 'IQ Coach'], ['v5_coach', 'V5 Coach'], ['combat_coach', 'Combat Coach'], ['assistant_coach', 'Assistant Coach'], ['mentor', 'Mentor']]

// In-hub source of truth for the full policy text (the seeded, versioned agreements).
const POLICY_URL = '/volunteer/waiver'

function Radio({ name, value, cur, onChange, label }: { name: string; value: string; cur: string; onChange: (v: string) => void; label: string }) {
  return <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9375rem', cursor: 'pointer' }}><input type="radio" name={name} checked={cur === value} onChange={() => onChange(value)} />{label}</label>
}

export default function VolunteerApplyPage() {
  const [step, setStep] = useState(1)
  const [f, setF] = useState({ first: '', last: '', email: '', phone: '', street: '', city: '', state: '', zip: '' })
  const [isReturning, setIsReturning] = useState('no')
  const [programs, setPrograms] = useState<Record<string, boolean>>({})
  const [role, setRole] = useState('general')
  const [apsChoice, setApsChoice] = useState('enroll')
  const [signature, setSignature] = useState('')
  const [agreeYp, setAgreeYp] = useState(false)
  const [agreeRc, setAgreeRc] = useState(false)
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }))
  const step1Valid = f.first.trim() && f.last.trim() && f.email.trim() && f.phone.trim()
  const step3Valid = signature.trim() && agreeYp && agreeRc

  async function submit() {
    if (!step3Valid || status === 'sending') return
    setStatus('sending'); setError('')
    try {
      const res = await fetch('/api/volunteer/apply', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: f.first, last_name: f.last, email: f.email, phone: f.phone,
          street_address: f.street, city: f.city, state: f.state, zip: f.zip,
          is_returning: isReturning === 'yes',
          programs: Object.keys(programs).filter((k) => programs[k]), primary_role: role,
          aps_choice: apsChoice,
          signature, agreed_yp: agreeYp, agreed_rc: agreeRc,
        }),
      })
      const d = await res.json()
      if (!res.ok) { setError(d.error || 'Something went wrong.'); setStatus('error') } else setStatus('done')
    } catch { setError('Network error — please try again.'); setStatus('error') }
  }

  if (status === 'done') {
    return (
      <PublicShell maxWidth="sm">
        <h1 className="text-page-title">Application received</h1>
        <div style={{ marginTop: '1.5rem' }}><SuccessAlert title="Thank you for applying to volunteer">We&apos;ve emailed a confirmation to {f.email}. We&apos;ll review your application and follow up with next steps — including your Abuse Prevention (APS) training and the Youth Protection &amp; Robotics Center quizzes. Sign in anytime to track your clearance.</SuccessAlert></div>
        <div style={{ marginTop: '1.5rem' }}><Link href="/login"><PrimaryButton fullWidth>Sign in to your portal</PrimaryButton></Link></div>
      </PublicShell>
    )
  }

  return (
    <PublicShell maxWidth="sm">
      <h1 className="text-page-title">Apply to be a Registered Volunteer</h1>
      <p className="text-body" style={{ marginTop: '0.5rem', color: 'var(--color-text-muted)' }}>Step {step} of 3 · No student required.</p>

      {step === 1 && (
        <div style={card}>
          <div style={grid2}>
            <FormField label="First name" htmlFor="fn" required><TextInput id="fn" value={f.first} onChange={set('first')} /></FormField>
            <FormField label="Last name" htmlFor="ln" required><TextInput id="ln" value={f.last} onChange={set('last')} /></FormField>
          </div>
          <FormField label="Email" htmlFor="em" required helpText="This becomes your sign-in email."><TextInput id="em" type="email" value={f.email} onChange={set('email')} /></FormField>
          <FormField label="Mobile phone" htmlFor="ph" required><TextInput id="ph" type="tel" value={f.phone} onChange={set('phone')} /></FormField>
          <FormField label="Street address" htmlFor="st"><TextInput id="st" value={f.street} onChange={set('street')} /></FormField>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0.75rem' }}>
            <FormField label="City" htmlFor="ci"><TextInput id="ci" value={f.city} onChange={set('city')} /></FormField>
            <FormField label="State" htmlFor="sta"><TextInput id="sta" value={f.state} onChange={set('state')} /></FormField>
            <FormField label="ZIP" htmlFor="zi"><TextInput id="zi" value={f.zip} onChange={set('zip')} /></FormField>
          </div>
        </div>
      )}

      {step === 2 && (
        <div style={card}>
          <div><div style={lbl}>Are you a returning volunteer?</div><div style={{ display: 'flex', gap: '1.25rem' }}><Radio name="ret" value="yes" cur={isReturning} onChange={setIsReturning} label="Yes" /><Radio name="ret" value="no" cur={isReturning} onChange={setIsReturning} label="No" /></div></div>
          <div><div style={lbl}>Which program(s) are you involved with?</div><div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {PROGRAMS.map(([v, l]) => <label key={v} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9375rem', cursor: 'pointer' }}><input type="checkbox" checked={!!programs[v]} onChange={(e) => setPrograms((p) => ({ ...p, [v]: e.target.checked }))} />{l}</label>)}
          </div></div>
          <div><label style={lbl}>Primary role</label><select style={sel} value={role} onChange={(e) => setRole(e.target.value)}>{ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
          <div><div style={lbl}>APS Mandated Reporter training (CA AB 506)</div><div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <Radio name="aps" value="enroll" cur={apsChoice} onChange={setApsChoice} label="Enroll me in the free APS course" />
            <Radio name="aps" value="have" cur={apsChoice} onChange={setApsChoice} label="I already have a current certificate" />
          </div>
            {apsChoice === 'have' && <div style={{ marginTop: '0.4rem' }}><span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Your certificate details (including expiry) sync automatically from APS — no need to enter them here.</span></div>}
          </div>
        </div>
      )}

      {step === 3 && (
        <div style={card}>
          <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
            In addition to the Abuse Prevention System (APS) course required by CA law, all Placer Robotics Registered Volunteers must review and agree to the policies below. The related quizzes (90%+ to pass) are assigned and tracked as part of your clearance.
          </div>

          <InfoAlert title="1) AB 506 Compliance & Youth Protection">
            I will follow the Two-Adult Rule, complete mandated-reporter (AB 506) training, and report any suspicion of abuse directly to CPS or law enforcement. <Link href={POLICY_URL}>Read the full Youth Protection policy</Link>, then pass the AB 506 Youth Protection quiz (90%+).
          </InfoAlert>
          <InfoAlert title="2) Robotics Center Use & Machine Room Safety">
            I will follow and enforce the Robotics Center facility, safety, and access rules — including PPE, supervision, and machine-room safety requirements. <Link href={POLICY_URL}>Read the full Robotics Center &amp; Machine Room policies</Link>, then pass the Robotics Center &amp; Machine Room Basics quiz (90%+).
          </InfoAlert>

          <label style={{ display: 'flex', gap: '0.5rem', fontSize: '0.9375rem', cursor: 'pointer' }}><input type="checkbox" checked={agreeYp} onChange={(e) => setAgreeYp(e.target.checked)} /> I have read and I agree to follow the Youth Protection Policy.</label>
          <label style={{ display: 'flex', gap: '0.5rem', fontSize: '0.9375rem', cursor: 'pointer' }}><input type="checkbox" checked={agreeRc} onChange={(e) => setAgreeRc(e.target.checked)} /> I have read and I agree to follow and enforce the Robotics Center Policies.</label>
          <FormField label="Type your full legal name to sign" htmlFor="sig" required><TextInput id="sig" value={signature} onChange={(e) => setSignature(e.target.value)} /></FormField>
          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>You&apos;ll also sign the formal versioned volunteer agreements in your portal once your application is reviewed.</p>
          {status === 'error' && <ErrorAlert title="Couldn’t submit">{error}</ErrorAlert>}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.25rem', gap: '0.75rem' }}>
        {step > 1 ? <SecondaryButton onClick={() => setStep((s) => s - 1)}>← Back</SecondaryButton> : <span />}
        {step < 3
          ? <PrimaryButton onClick={() => setStep((s) => s + 1)} disabled={step === 1 && !step1Valid}>Next →</PrimaryButton>
          : <PrimaryButton onClick={submit} loading={status === 'sending'} disabled={!step3Valid}>Submit application</PrimaryButton>}
      </div>

      <div style={{ marginTop: '1.5rem' }}><InfoAlert title="Already have an account?">If you registered a student, <Link href="/login">sign in</Link> and add volunteering from your dashboard.</InfoAlert></div>
    </PublicShell>
  )
}
