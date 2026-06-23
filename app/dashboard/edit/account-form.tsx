'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormSection, FormField, TextInput, PrimaryButton } from '@/components/ui'

const TSHIRT_OPTIONS: [string, string][] = [
  ['ym', 'Youth Medium'], ['yl', 'Youth Large'], ['xs', 'Adult XS'], ['s', 'Adult Small'],
  ['m', 'Adult Medium'], ['l', 'Adult Large'], ['xl', 'Adult XL'], ['xxl', 'Adult 2XL'], ['xxxl', 'Adult 3XL'],
]

export type AccountData = {
  guardian1: { name: string; email: string; street_address: string; city: string; state: string; zip_code: string; phone: string }
  students: { id: string; name: string; tshirt_size: string; ec_first: string; ec_last: string; ec_phone: string; ec_relationship: string }[]
  guardian2: { first_name: string; last_name: string; email: string; phone: string } | null
}

const selectStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', fontSize: '0.9375rem', color: 'var(--color-text-primary)',
  backgroundColor: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '6px',
  fontFamily: 'inherit', boxSizing: 'border-box',
}

function Saved({ state }: { state: string }) {
  if (!state) return null
  const ok = state === 'saved'
  return <p style={{ fontSize: '0.8125rem', marginTop: '0.5rem', color: ok ? 'var(--color-success)' : 'var(--color-error)' }}>{ok ? 'Saved.' : state}</p>
}

export default function AccountForm({ data }: { data: AccountData }) {
  const router = useRouter()

  return (
    <>
      {data.students.map((s) => <StudentSection key={s.id} student={s} onSaved={() => router.refresh()} />)}
      <FamilySection g1={data.guardian1} onSaved={() => router.refresh()} />
      <FormSection title="Guardian 1 (you)" description="To change your login email, contact info@placerrobotics.org.">
        <FormField label="Name"><div style={{ fontSize: '0.9375rem' }}>{data.guardian1.name}</div></FormField>
        <FormField label="Login email"><div style={{ fontSize: '0.9375rem' }}>{data.guardian1.email}</div></FormField>
      </FormSection>
      <Guardian2Section g2={data.guardian2} onSaved={() => router.refresh()} />

      <FormSection title="Add a student" description="Registering another child? Start a new application.">
        <Link href="/apply" style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--color-navy-deep)' }}>
          Apply for another student →
        </Link>
      </FormSection>
    </>
  )
}

function StudentSection({ student, onSaved }: { student: AccountData['students'][number]; onSaved: () => void }) {
  const [tshirt, setTshirt] = useState(student.tshirt_size)
  const [ecFirst, setEcFirst] = useState(student.ec_first)
  const [ecLast, setEcLast] = useState(student.ec_last)
  const [ecPhone, setEcPhone] = useState(student.ec_phone)
  const [ecRel, setEcRel] = useState(student.ec_relationship)
  const [state, setState] = useState('')
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true); setState('')
    try {
      const res = await fetch(`/api/family/students/${student.id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tshirt_size: tshirt, ec_first: ecFirst, ec_last: ecLast, ec_phone: ecPhone, ec_relationship: ecRel }),
      })
      const d = await res.json().catch(() => ({}))
      setState(res.ok ? 'saved' : (d.error || 'Save failed.'))
      if (res.ok) onSaved()
    } catch { setState('Network error.') } finally { setBusy(false) }
  }

  return (
    <FormSection title={student.name} description="T-shirt size and emergency contact.">
      <div>
        <label htmlFor={`ts-${student.id}`} style={{ display: 'block', fontSize: '0.9375rem', fontWeight: 500, marginBottom: '0.375rem' }}>T-shirt size</label>
        <select id={`ts-${student.id}`} value={tshirt} onChange={(e) => setTshirt(e.target.value)} style={selectStyle}>
          <option value="">Select size…</option>
          {TSHIRT_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <FormField label="Emergency contact first name" htmlFor={`ecf-${student.id}`}><TextInput id={`ecf-${student.id}`} value={ecFirst} onChange={(e) => setEcFirst(e.target.value)} /></FormField>
      <FormField label="Emergency contact last name" htmlFor={`ecl-${student.id}`}><TextInput id={`ecl-${student.id}`} value={ecLast} onChange={(e) => setEcLast(e.target.value)} /></FormField>
      <FormField label="Emergency contact phone" htmlFor={`ecp-${student.id}`}><TextInput id={`ecp-${student.id}`} type="tel" value={ecPhone} onChange={(e) => setEcPhone(e.target.value)} /></FormField>
      <FormField label="Relationship to student" htmlFor={`ecr-${student.id}`}><TextInput id={`ecr-${student.id}`} value={ecRel} onChange={(e) => setEcRel(e.target.value)} /></FormField>
      <div><PrimaryButton loading={busy} onClick={save}>Save {student.name.split(' ')[0]}</PrimaryButton><Saved state={state} /></div>
    </FormSection>
  )
}

function FamilySection({ g1, onSaved }: { g1: AccountData['guardian1']; onSaved: () => void }) {
  const [street, setStreet] = useState(g1.street_address)
  const [city, setCity] = useState(g1.city)
  const [stateField, setStateField] = useState(g1.state)
  const [zip, setZip] = useState(g1.zip_code)
  const [phone, setPhone] = useState(g1.phone)
  const [state, setState] = useState('')
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true); setState('')
    try {
      const res = await fetch('/api/family/profile', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ street_address: street, city, state: stateField, zip_code: zip, phone }),
      })
      const d = await res.json().catch(() => ({}))
      setState(res.ok ? 'saved' : (d.error || 'Save failed.'))
      if (res.ok) onSaved()
    } catch { setState('Network error.') } finally { setBusy(false) }
  }

  return (
    <FormSection title="Family contact info" description="Home address and primary phone.">
      <FormField label="Street address" htmlFor="street"><TextInput id="street" value={street} onChange={(e) => setStreet(e.target.value)} /></FormField>
      <FormField label="City" htmlFor="city"><TextInput id="city" value={city} onChange={(e) => setCity(e.target.value)} /></FormField>
      <FormField label="State" htmlFor="state"><TextInput id="state" value={stateField} onChange={(e) => setStateField(e.target.value)} /></FormField>
      <FormField label="ZIP" htmlFor="zip"><TextInput id="zip" value={zip} onChange={(e) => setZip(e.target.value)} /></FormField>
      <FormField label="Primary phone" htmlFor="phone"><TextInput id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></FormField>
      <div><PrimaryButton loading={busy} onClick={save}>Save contact info</PrimaryButton><Saved state={state} /></div>
    </FormSection>
  )
}

function Guardian2Section({ g2, onSaved }: { g2: AccountData['guardian2']; onSaved: () => void }) {
  const [first, setFirst] = useState(g2?.first_name ?? '')
  const [last, setLast] = useState(g2?.last_name ?? '')
  const [email, setEmail] = useState(g2?.email ?? '')
  const [phone, setPhone] = useState(g2?.phone ?? '')
  const [state, setState] = useState('')
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true); setState('')
    try {
      const res = await fetch('/api/family/guardian2', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ first_name: first, last_name: last, email, phone }),
      })
      const d = await res.json().catch(() => ({}))
      setState(res.ok ? 'saved' : (d.error || 'Save failed.'))
      if (res.ok) onSaved()
    } catch { setState('Network error.') } finally { setBusy(false) }
  }

  return (
    <FormSection title={g2 ? 'Guardian 2' : 'Add guardian 2'} description="A second parent or guardian (contact info; not a login).">
      <FormField label="First name" htmlFor="g2f"><TextInput id="g2f" value={first} onChange={(e) => setFirst(e.target.value)} /></FormField>
      <FormField label="Last name" htmlFor="g2l"><TextInput id="g2l" value={last} onChange={(e) => setLast(e.target.value)} /></FormField>
      <FormField label="Email" htmlFor="g2e"><TextInput id="g2e" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></FormField>
      <FormField label="Phone" htmlFor="g2p"><TextInput id="g2p" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></FormField>
      <div><PrimaryButton loading={busy} onClick={save}>{g2 ? 'Save guardian 2' : 'Add guardian 2'}</PrimaryButton><Saved state={state} /></div>
    </FormSection>
  )
}
