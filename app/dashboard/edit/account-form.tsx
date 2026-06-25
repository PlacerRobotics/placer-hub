'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FormSection, FormField, TextInput, PrimaryButton } from '@/components/ui'

const TSHIRT_OPTIONS: [string, string][] = [
  ['ym', 'Youth Medium'], ['yl', 'Youth Large'], ['xs', 'Adult XS'], ['s', 'Adult Small'],
  ['m', 'Adult Medium'], ['l', 'Adult Large'], ['xl', 'Adult XL'], ['xxl', 'Adult 2XL'], ['xxxl', 'Adult 3XL'],
]

export type AccountData = {
  guardian1: { name: string; email: string; communication_email: string; slack_email: string; street_address: string; city: string; state: string; zip_code: string; phone: string }
  students: {
    id: string; name: string; tshirt_size: string; communication_email: string; fusion_education_email: string; slack_email: string
    ec_first: string; ec_last: string; ec_phone: string; ec_relationship: string
    fund: {
      show: boolean; locked: boolean; methods: string[]; target: number
      employer_company: string; employer_pct: string; employer_portal: string
      sponsor_business: string; sponsor_contact: string; sponsor_amount: string
    }
  }[]
  guardian2: { first_name: string; last_name: string; email: string; communication_email: string; slack_email: string; street_address: string; city: string; state: string; zip_code: string; phone: string } | null
}

const FUND_METHODS: [string, string, string][] = [
  ['direct_donation', 'Direct contribution via Zeffy', 'I’ll donate toward the commitment online'],
  ['corporate_match', 'Employer / corporate match', 'My employer matches charitable donations'],
  ['sponsored', 'Business sponsorship', 'A business is sponsoring my student'],
  ['paper_check', 'Paper check', 'I’ll submit a paper check'],
  ['pending', 'Financial assistance', 'I’d like to apply for financial assistance'],
]
const FUND_LABEL: Record<string, string> = Object.fromEntries(FUND_METHODS.map(([v, l]) => [v, l]))

const WORKSPACE_HELP = 'Google Workspace email — used for Google Drive access and all communications.'

// Slack email: free to set the first time, but once set it can only be changed by an
// admin (Slack can't rename or merge accounts), so we lock it and point to support.
function SlackField({ id, value, onChange, locked }: { id: string; value: string; onChange: (v: string) => void; locked: boolean }) {
  if (locked) {
    return (
      <FormField label="Slack email" helpText="To change your Slack email, contact info@placerrobotics.org — Slack accounts are updated manually.">
        <div style={{ fontSize: '0.9375rem' }}>{value}</div>
      </FormField>
    )
  }
  return (
    <FormField label="Slack email" htmlFor={id} helpText="Only if your Slack uses a different email than your login. Once set, changing it later needs an admin.">
      <TextInput id={id} type="email" value={value} onChange={(e) => onChange(e.target.value)} />
    </FormField>
  )
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
      {data.students.map((s) => (
        <div key={s.id} id={`student-${s.id}`} style={{ scrollMarginTop: '70px' }}>
          <StudentSection student={s} onSaved={() => router.refresh()} />
          {s.fund.show && <FundraisingSection studentId={s.id} name={s.name} fund={s.fund} onSaved={() => router.refresh()} />}
        </div>
      ))}
      <FamilySection g1={data.guardian1} onSaved={() => router.refresh()} />
      <FormSection title="Guardian 1 (you)" description="To change your login email, contact info@placerrobotics.org.">
        <FormField label="Name"><div style={{ fontSize: '0.9375rem' }}>{data.guardian1.name}</div></FormField>
        <FormField label="Login email"><div style={{ fontSize: '0.9375rem' }}>{data.guardian1.email}</div></FormField>
      </FormSection>
      <Guardian2Section g2={data.guardian2} onSaved={() => router.refresh()} />
    </>
  )
}

function StudentSection({ student, onSaved }: { student: AccountData['students'][number]; onSaved: () => void }) {
  const [tshirt, setTshirt] = useState(student.tshirt_size)
  const [commEmail, setCommEmail] = useState(student.communication_email)
  const [fusion, setFusion] = useState(student.fusion_education_email)
  const [slack, setSlack] = useState(student.slack_email)
  const slackLocked = !!student.slack_email
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
        body: JSON.stringify({
          tshirt_size: tshirt, ec_first: ecFirst, ec_last: ecLast, ec_phone: ecPhone, ec_relationship: ecRel,
          communication_email: commEmail, fusion_education_email: fusion,
          ...(slackLocked ? {} : { slack_email: slack }),
        }),
      })
      const d = await res.json().catch(() => ({}))
      setState(res.ok ? 'saved' : (d.error || 'Save failed.'))
      if (res.ok) onSaved()
    } catch { setState('Network error.') } finally { setBusy(false) }
  }

  return (
    <FormSection title={student.name} description="T-shirt size, emails, and emergency contact.">
      <div>
        <label htmlFor={`ts-${student.id}`} style={{ display: 'block', fontSize: '0.9375rem', fontWeight: 500, marginBottom: '0.375rem' }}>T-shirt size</label>
        <select id={`ts-${student.id}`} value={tshirt} onChange={(e) => setTshirt(e.target.value)} style={selectStyle}>
          <option value="">Select size…</option>
          {TSHIRT_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <FormField label="Google Workspace email" htmlFor={`comm-${student.id}`} helpText={WORKSPACE_HELP}><TextInput id={`comm-${student.id}`} type="email" value={commEmail} onChange={(e) => setCommEmail(e.target.value)} /></FormField>
      <FormField label="Fusion Education email" htmlFor={`fus-${student.id}`} helpText="Your student's Fusion account email, if they have one."><TextInput id={`fus-${student.id}`} type="email" value={fusion} onChange={(e) => setFusion(e.target.value)} /></FormField>
      <SlackField id={`slack-${student.id}`} value={slack} onChange={setSlack} locked={slackLocked} />
      <FormField label="Emergency contact first name" htmlFor={`ecf-${student.id}`}><TextInput id={`ecf-${student.id}`} value={ecFirst} onChange={(e) => setEcFirst(e.target.value)} /></FormField>
      <FormField label="Emergency contact last name" htmlFor={`ecl-${student.id}`}><TextInput id={`ecl-${student.id}`} value={ecLast} onChange={(e) => setEcLast(e.target.value)} /></FormField>
      <FormField label="Emergency contact phone" htmlFor={`ecp-${student.id}`}><TextInput id={`ecp-${student.id}`} type="tel" value={ecPhone} onChange={(e) => setEcPhone(e.target.value)} /></FormField>
      <FormField label="Relationship to student" htmlFor={`ecr-${student.id}`}><TextInput id={`ecr-${student.id}`} value={ecRel} onChange={(e) => setEcRel(e.target.value)} /></FormField>
      <div><PrimaryButton loading={busy} onClick={save}>Save {student.name.split(' ')[0]}</PrimaryButton><Saved state={state} /></div>
    </FormSection>
  )
}

function FamilySection({ g1, onSaved }: { g1: AccountData['guardian1']; onSaved: () => void }) {
  const [commEmail, setCommEmail] = useState(g1.communication_email)
  const [slack, setSlack] = useState(g1.slack_email)
  const slackLocked = !!g1.slack_email
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
        body: JSON.stringify({
          street_address: street, city, state: stateField, zip_code: zip, phone,
          communication_email: commEmail,
          ...(slackLocked ? {} : { slack_email: slack }),
        }),
      })
      const d = await res.json().catch(() => ({}))
      setState(res.ok ? 'saved' : (d.error || 'Save failed.'))
      if (res.ok) onSaved()
    } catch { setState('Network error.') } finally { setBusy(false) }
  }

  return (
    <FormSection title="Your contact info & emails" description="Home address, phone, and the emails we use to reach you.">
      <FormField label="Google Workspace email" htmlFor="g1comm" helpText={WORKSPACE_HELP}><TextInput id="g1comm" type="email" value={commEmail} onChange={(e) => setCommEmail(e.target.value)} /></FormField>
      <SlackField id="g1slack" value={slack} onChange={setSlack} locked={slackLocked} />
      <FormField label="Street address" htmlFor="street"><TextInput id="street" value={street} onChange={(e) => setStreet(e.target.value)} /></FormField>
      <FormField label="City" htmlFor="city"><TextInput id="city" value={city} onChange={(e) => setCity(e.target.value)} /></FormField>
      <FormField label="State" htmlFor="state"><TextInput id="state" value={stateField} onChange={(e) => setStateField(e.target.value)} /></FormField>
      <FormField label="ZIP" htmlFor="zip"><TextInput id="zip" value={zip} onChange={(e) => setZip(e.target.value)} /></FormField>
      <FormField label="Primary phone" htmlFor="phone"><TextInput id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></FormField>
      <div><PrimaryButton loading={busy} onClick={save}>Save contact info</PrimaryButton><Saved state={state} /></div>
    </FormSection>
  )
}

function FundraisingSection({ studentId, name, fund, onSaved }: { studentId: string; name: string; fund: AccountData['students'][number]['fund']; onSaved: () => void }) {
  const first = name.split(' ')[0]
  const [methods, setMethods] = useState<string[]>(fund.methods.length ? fund.methods : ['direct_donation'])
  const [empCompany, setEmpCompany] = useState(fund.employer_company)
  const [empPct, setEmpPct] = useState(fund.employer_pct)
  const [empPortal, setEmpPortal] = useState(fund.employer_portal)
  const [spBusiness, setSpBusiness] = useState(fund.sponsor_business)
  const [spContact, setSpContact] = useState(fund.sponsor_contact)
  const [spAmount, setSpAmount] = useState(fund.sponsor_amount)
  const [state, setState] = useState('')
  const [busy, setBusy] = useState(false)
  const toggle = (v: string) => setMethods((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]))
  const hasMatch = methods.includes('corporate_match')
  const hasSponsor = methods.includes('sponsored')

  if (fund.locked) {
    return (
      <FormSection title={`${first}’s fundraising`} description="Locked once a payment is recorded.">
        <FormField label="Fundraising method(s)" helpText="A payment has been recorded, so this is locked. To change it, contact info@placerrobotics.org.">
          <div style={{ fontSize: '0.9375rem' }}>{fund.methods.length ? fund.methods.map((m) => FUND_LABEL[m] ?? m).join(', ') : '—'}</div>
        </FormField>
      </FormSection>
    )
  }

  async function save() {
    if (!methods.length) { setState('Pick at least one method.'); return }
    if (hasMatch && !(empCompany.trim() && empPct.trim() && empPortal)) { setState('Complete the employer match fields.'); return }
    if (hasSponsor && !(spBusiness.trim() && spContact.trim() && spAmount.trim())) { setState('Complete the sponsorship fields.'); return }
    setBusy(true); setState('')
    try {
      const res = await fetch('/api/family/fundraising', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId, methods, employer_company: empCompany, employer_pct: empPct, employer_portal: empPortal, sponsor_business: spBusiness, sponsor_contact: spContact, sponsor_amount: spAmount }),
      })
      const d = await res.json().catch(() => ({}))
      setState(res.ok ? 'saved' : (d.error || 'Save failed.'))
      if (res.ok) onSaved()
    } catch { setState('Network error.') } finally { setBusy(false) }
  }

  return (
    <FormSection title={`${first}’s fundraising`} description={`How you’ll meet ${first}’s $${fund.target} commitment (separate from the $40 registration fee). Editable until a payment is recorded.`}>
      {FUND_METHODS.map(([v, label, desc]) => (
        <label key={v} style={{ display: 'flex', gap: '0.625rem', alignItems: 'flex-start', cursor: 'pointer', marginBottom: '0.5rem' }}>
          <input type="checkbox" checked={methods.includes(v)} onChange={() => toggle(v)} style={{ marginTop: 3, width: 16, height: 16, accentColor: 'var(--color-navy-deep)' }} />
          <span><span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{label}</span><span style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>{desc}</span></span>
        </label>
      ))}
      {hasMatch && (
        <div style={{ paddingLeft: '1.625rem', display: 'grid', gap: '0.625rem' }}>
          <FormField label="Employer name" htmlFor={`fcomp-${studentId}`}><TextInput id={`fcomp-${studentId}`} value={empCompany} onChange={(e) => setEmpCompany(e.target.value)} /></FormField>
          <FormField label="Match percentage" htmlFor={`fpct-${studentId}`}><TextInput id={`fpct-${studentId}`} type="number" value={empPct} onChange={(e) => setEmpPct(e.target.value)} placeholder="e.g. 100" /></FormField>
          <div>
            <label htmlFor={`fport-${studentId}`} style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, marginBottom: '0.25rem', color: 'var(--color-text-muted)' }}>How submitted</label>
            <select id={`fport-${studentId}`} value={empPortal} onChange={(e) => setEmpPortal(e.target.value)} style={selectStyle}>
              <option value="">Select…</option><option value="benevity">Benevity</option><option value="yourcause">YourCause</option><option value="employer_portal">Employer portal</option><option value="other">Other</option>
            </select>
          </div>
        </div>
      )}
      {hasSponsor && (
        <div style={{ paddingLeft: '1.625rem', display: 'grid', gap: '0.625rem' }}>
          <FormField label="Business name" htmlFor={`fbiz-${studentId}`}><TextInput id={`fbiz-${studentId}`} value={spBusiness} onChange={(e) => setSpBusiness(e.target.value)} /></FormField>
          <FormField label="Contact name" htmlFor={`fcon-${studentId}`}><TextInput id={`fcon-${studentId}`} value={spContact} onChange={(e) => setSpContact(e.target.value)} /></FormField>
          <FormField label="Estimated amount" htmlFor={`famt-${studentId}`}><TextInput id={`famt-${studentId}`} type="number" value={spAmount} onChange={(e) => setSpAmount(e.target.value)} /></FormField>
        </div>
      )}
      <div><PrimaryButton loading={busy} onClick={save}>Save fundraising</PrimaryButton><Saved state={state} /></div>
    </FormSection>
  )
}

function Guardian2Section({ g2, onSaved }: { g2: AccountData['guardian2']; onSaved: () => void }) {
  const [first, setFirst] = useState(g2?.first_name ?? '')
  const [last, setLast] = useState(g2?.last_name ?? '')
  const [email, setEmail] = useState(g2?.email ?? '')
  const [commEmail, setCommEmail] = useState(g2?.communication_email ?? '')
  const [slack, setSlack] = useState(g2?.slack_email ?? '')
  const slackLocked = !!g2?.slack_email
  const [street, setStreet] = useState(g2?.street_address ?? '')
  const [city, setCity] = useState(g2?.city ?? '')
  const [stateField, setStateField] = useState(g2?.state ?? '')
  const [zip, setZip] = useState(g2?.zip_code ?? '')
  const [phone, setPhone] = useState(g2?.phone ?? '')
  const [state, setState] = useState('')
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true); setState('')
    try {
      const res = await fetch('/api/family/guardian2', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: first, last_name: last, email, phone,
          communication_email: commEmail,
          street_address: street, city, state: stateField, zip_code: zip,
          ...(slackLocked ? {} : { slack_email: slack }),
        }),
      })
      const d = await res.json().catch(() => ({}))
      setState(res.ok ? 'saved' : (d.error || 'Save failed.'))
      if (res.ok) onSaved()
    } catch { setState('Network error.') } finally { setBusy(false) }
  }

  return (
    <FormSection title={g2 ? 'Guardian 2' : 'Add guardian 2'} description="A second parent or guardian — same details as guardian 1 (contact only; not a login).">
      <FormField label="First name" htmlFor="g2f"><TextInput id="g2f" value={first} onChange={(e) => setFirst(e.target.value)} /></FormField>
      <FormField label="Last name" htmlFor="g2l"><TextInput id="g2l" value={last} onChange={(e) => setLast(e.target.value)} /></FormField>
      <FormField label="Email" htmlFor="g2e" helpText="Primary email for this guardian."><TextInput id="g2e" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></FormField>
      <FormField label="Google Workspace email" htmlFor="g2comm" helpText={WORKSPACE_HELP}><TextInput id="g2comm" type="email" value={commEmail} onChange={(e) => setCommEmail(e.target.value)} /></FormField>
      <SlackField id="g2slack" value={slack} onChange={setSlack} locked={slackLocked} />
      <FormField label="Street address" htmlFor="g2street"><TextInput id="g2street" value={street} onChange={(e) => setStreet(e.target.value)} /></FormField>
      <FormField label="City" htmlFor="g2city"><TextInput id="g2city" value={city} onChange={(e) => setCity(e.target.value)} /></FormField>
      <FormField label="State" htmlFor="g2state"><TextInput id="g2state" value={stateField} onChange={(e) => setStateField(e.target.value)} /></FormField>
      <FormField label="ZIP" htmlFor="g2zip"><TextInput id="g2zip" value={zip} onChange={(e) => setZip(e.target.value)} /></FormField>
      <FormField label="Phone" htmlFor="g2p"><TextInput id="g2p" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></FormField>
      <div><PrimaryButton loading={busy} onClick={save}>{g2 ? 'Save guardian 2' : 'Add guardian 2'}</PrimaryButton><Saved state={state} /></div>
    </FormSection>
  )
}
