'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PublicShell, FormField, TextInput, PrimaryButton, SecondaryButton, InfoAlert, SuccessAlert, ErrorAlert } from '@/components/ui'

const sel: React.CSSProperties = { width: '100%', padding: '9px 12px', fontSize: '0.9375rem', border: '1.5px solid var(--color-border)', borderRadius: 6, fontFamily: 'inherit', boxSizing: 'border-box', backgroundColor: 'var(--color-surface)' }
const lbl: React.CSSProperties = { display: 'block', fontSize: '0.9375rem', fontWeight: 500, marginBottom: '0.375rem' }
const grid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }
const card: React.CSSProperties = { marginTop: '1.5rem', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }
const PROGRAMS = [['vex_iq', 'VEX IQ'], ['vex_v5', 'VEX V5'], ['combat', 'Combat Robotics'], ['other', 'Other']]
const ROLES = [['general', 'General volunteer'], ['iq_coach', 'IQ Coach'], ['v5_coach', 'V5 Coach'], ['combat_coach', 'Combat Coach'], ['assistant_coach', 'Assistant Coach'], ['mentor', 'Mentor']]

function Radio({ name, value, cur, onChange, label }: { name: string; value: string; cur: string; onChange: (v: string) => void; label: string }) {
  return <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9375rem', cursor: 'pointer' }}><input type="radio" name={name} checked={cur === value} onChange={() => onChange(value)} />{label}</label>
}

export default function VolunteerApplyPage() {
  const [step, setStep] = useState(1)
  const [f, setF] = useState({ first: '', last: '', email: '', phone: '', street: '', city: '', state: '', zip: '' })
  const [isReturning, setIsReturning] = useState('no')
  const [hasDoor, setHasDoor] = useState('no')
  const [doorType, setDoorType] = useState('card')
  const [programs, setPrograms] = useState<Record<string, boolean>>({})
  const [role, setRole] = useState('general')
  const [apsChoice, setApsChoice] = useState('enroll')
  const [keyReq, setKeyReq] = useState('none')
  const [signature, setSignature] = useState('')
  const [agreeYp, setAgreeYp] = useState(false)
  const [agreeRc, setAgreeRc] = useState(false)
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }))
  const step1Valid = f.first.trim() && f.last.trim() && f.email.trim() && f.phone.trim()
  const step4Valid = signature.trim() && agreeYp && agreeRc

  async function submit() {
    if (!step4Valid || status === 'sending') return
    setStatus('sending'); setError('')
    try {
      const res = await fetch('/api/volunteer/apply', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: f.first, last_name: f.last, email: f.email, phone: f.phone,
          street_address: f.street, city: f.city, state: f.state, zip: f.zip,
          is_returning: isReturning === 'yes', has_door_access: hasDoor === 'yes', door_access_type: hasDoor === 'yes' ? doorType : 'none',
          programs: Object.keys(programs).filter((k) => programs[k]), primary_role: role,
          aps_choice: apsChoice, key_access_request: keyReq,
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
        <div style={{ marginTop: '1.5rem' }}><SuccessAlert title="Thank you for applying to volunteer">We&apos;ve emailed a confirmation to {f.email}. We&apos;ll review your application and follow up with next steps. Sign in anytime to track your clearance.</SuccessAlert></div>
        <div style={{ marginTop: '1.5rem' }}><Link href="/login"><PrimaryButton fullWidth>Sign in to your portal</PrimaryButton></Link></div>
      </PublicShell>
    )
  }

  return (
    <PublicShell maxWidth="sm">
      <h1 className="text-page-title">Volunteer with Placer Robotics</h1>
      <p className="text-body" style={{ marginTop: '0.5rem', color: 'var(--color-text-muted)' }}>Step {step} of 4 · No student required.</p>

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
          <div><div style={lbl}>Do you currently have door access?</div><div style={{ display: 'flex', gap: '1.25rem' }}><Radio name="door" value="yes" cur={hasDoor} onChange={setHasDoor} label="Yes" /><Radio name="door" value="no" cur={hasDoor} onChange={setHasDoor} label="No" /></div>
            {hasDoor === 'yes' && <div style={{ marginTop: '0.5rem' }}><select style={sel} value={doorType} onChange={(e) => setDoorType(e.target.value)}><option value="card">Key card</option><option value="phone">Phone app</option></select></div>}
          </div>
          <div><div style={lbl}>Which programs are you involved with?</div><div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {PROGRAMS.map(([v, l]) => <label key={v} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9375rem', cursor: 'pointer' }}><input type="checkbox" checked={!!programs[v]} onChange={(e) => setPrograms((p) => ({ ...p, [v]: e.target.checked }))} />{l}</label>)}
          </div></div>
          <div><label style={lbl}>Primary role</label><select style={sel} value={role} onChange={(e) => setRole(e.target.value)}>{ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        </div>
      )}

      {step === 3 && (
        <div style={card}>
          <div><div style={lbl}>APS Mandated Reporter training</div><div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <Radio name="aps" value="enroll" cur={apsChoice} onChange={setApsChoice} label="Enroll me in the free APS course" />
            <Radio name="aps" value="have" cur={apsChoice} onChange={setApsChoice} label="I already have a current certificate" />
          </div>
            {apsChoice === 'have' && <div style={{ marginTop: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Your certificate details (including expiry) are synced automatically from APS — no need to enter them here.</span>
            </div>}
          </div>
          <div><div style={lbl}>Key access request</div><div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <Radio name="key" value="card" cur={keyReq} onChange={setKeyReq} label="Yes, new key card" />
            <Radio name="key" value="renew" cur={keyReq} onChange={setKeyReq} label="Yes, renew access" />
            <Radio name="key" value="phone" cur={keyReq} onChange={setKeyReq} label="Yes, phone access" />
            <Radio name="key" value="none" cur={keyReq} onChange={setKeyReq} label="No access needed" />
          </div></div>
        </div>
      )}

      {step === 4 && (
        <div style={card}>
          <InfoAlert title="Youth Protection Policy">I will follow the Two-Adult Rule, complete mandated-reporter training, and report any suspicion of abuse directly to CPS or law enforcement. <Link href="/volunteer/waiver">Read the full policy</Link>.</InfoAlert>
          <InfoAlert title="Robotics Center Use Policy">I will follow facility, safety, and access rules in the Robotics Center, including PPE and supervision requirements.</InfoAlert>
          <label style={{ display: 'flex', gap: '0.5rem', fontSize: '0.9375rem', cursor: 'pointer' }}><input type="checkbox" checked={agreeYp} onChange={(e) => setAgreeYp(e.target.checked)} /> I have read and agree to follow the Youth Protection Policy.</label>
          <label style={{ display: 'flex', gap: '0.5rem', fontSize: '0.9375rem', cursor: 'pointer' }}><input type="checkbox" checked={agreeRc} onChange={(e) => setAgreeRc(e.target.checked)} /> I have read and agree to follow the Robotics Center Use Policy.</label>
          <FormField label="Type your full legal name to sign" htmlFor="sig" required><TextInput id="sig" value={signature} onChange={(e) => setSignature(e.target.value)} /></FormField>
          {status === 'error' && <ErrorAlert title="Couldn’t submit">{error}</ErrorAlert>}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.25rem', gap: '0.75rem' }}>
        {step > 1 ? <SecondaryButton onClick={() => setStep((s) => s - 1)}>← Back</SecondaryButton> : <span />}
        {step < 4
          ? <PrimaryButton onClick={() => setStep((s) => s + 1)} disabled={step === 1 && !step1Valid}>Next →</PrimaryButton>
          : <PrimaryButton onClick={submit} loading={status === 'sending'} disabled={!step4Valid}>Submit application</PrimaryButton>}
      </div>

      <div style={{ marginTop: '1.5rem' }}><InfoAlert title="Already have an account?">If you registered a student, <Link href="/login">sign in</Link> and add volunteering from your dashboard.</InfoAlert></div>
    </PublicShell>
  )
}
