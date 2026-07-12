'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export type GuardianForEdit = { id: string; first_name: string; last_name: string; login_email: string; communication_email: string; phone: string }
type Student = { id: string; first_name: string; last_name: string; grade: number | string; tshirt_size: string }

const TSHIRT: [string, string][] = [
  ['ym', 'Youth Medium'], ['yl', 'Youth Large'], ['xs', 'Adult XS'], ['s', 'Adult Small'],
  ['m', 'Adult Medium'], ['l', 'Adult Large'], ['xl', 'Adult XL'], ['xxl', 'Adult 2XL'], ['xxxl', 'Adult 3XL'],
]
const card: React.CSSProperties = { backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '1.25rem', marginBottom: '1.25rem' }
const btn: React.CSSProperties = { padding: '8px 14px', border: '1px solid var(--color-border)', borderRadius: '6px', fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer', background: 'var(--color-surface)', fontFamily: 'inherit' }
const navyBtn: React.CSSProperties = { ...btn, background: 'var(--color-navy-deep)', color: '#fff', border: 'none' }
const input: React.CSSProperties = { width: '100%', padding: '8px 10px', fontSize: '0.875rem', border: '1.5px solid var(--color-border)', borderRadius: '6px', fontFamily: 'inherit', boxSizing: 'border-box' }
const lbl: React.CSSProperties = { display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '0.25rem' }

function Msg({ m }: { m: string }) {
  if (!m) return null
  const ok = m === 'saved'
  return <span style={{ fontSize: '0.8125rem', marginLeft: '0.75rem', color: ok ? 'var(--color-success)' : 'var(--color-error)' }}>{ok ? 'Saved.' : m}</span>
}

// Admin actions for a family. Guardian editing (name/contact/login email) works
// for ANY guardian on the family, not just the first — the underlying PATCH
// routes always accepted an explicit guardian_id, this UI just used to only
// expose it for guardian 1. Matters for exactly the case that surfaces a
// mis-keyed second guardian: a same-name-in-the-duplicates-report pair that
// turns out to be two DIFFERENT real people (e.g. two parents) because one of
// them has the wrong first/last name on file — the fix there is correcting the
// name, not merging two real people into one.
export default function FamilyActions({ familyId, guardians, students }: { familyId: string; guardians: GuardianForEdit[]; students: Student[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState('')
  const [actionMsg, setActionMsg] = useState('')
  const [viewLink, setViewLink] = useState('')
  const [emailEditId, setEmailEditId] = useState<string | null>(null)
  const [newEmail, setNewEmail] = useState('')
  const [contactEditId, setContactEditId] = useState<string | null>(null)
  const [editStudent, setEditStudent] = useState<string | null>(null)

  async function call(key: string, url: string, body?: any, method = 'POST') {
    setBusy(key); setActionMsg('')
    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setActionMsg(d.error || 'Action failed.'); return null }
      return d
    } catch { setActionMsg('Network error.'); return null } finally { setBusy('') }
  }

  return (
    <div style={card}>
      <h3 className="text-card-title" style={{ marginBottom: '0.875rem' }}>Admin actions</h3>
      <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" style={btn} disabled={busy === 'resend'} onClick={async () => { const d = await call('resend', `/api/admin/families/${familyId}/resend-invite`); if (d) setActionMsg('saved') }}>Resend magic link</button>
        <button type="button" style={btn} disabled={busy === 'view'} onClick={async () => { const d = await call('view', `/api/admin/families/${familyId}/view-as-family`); if (d?.url) { setViewLink(d.url); window.open(d.url, '_blank', 'noopener') } }}>View as family</button>
        <Msg m={actionMsg} />
      </div>
      {viewLink && (
        <p style={{ marginTop: '0.75rem', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
          Opened in a new tab. ⚠️ This logs that browser in <strong>as the family</strong> — use an incognito window so you don&apos;t lose your admin session.
        </p>
      )}

      {/* Per-guardian edit controls — name/contact/login email, any guardian */}
      {guardians.map((g, i) => (
        <div key={g.id} style={{ marginTop: '1.25rem', borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.5rem' }}>Guardian {i + 1}: {g.first_name} {g.last_name} · {g.login_email}</div>
          <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap' }}>
            <button type="button" style={btn} onClick={() => setContactEditId((v) => (v === g.id ? null : g.id))}>{contactEditId === g.id ? 'Cancel' : 'Edit name / contact'}</button>
            <button type="button" style={btn} onClick={() => { setEmailEditId((v) => (v === g.id ? null : g.id)); setNewEmail('') }}>{emailEditId === g.id ? 'Cancel' : 'Change login email'}</button>
          </div>

          {emailEditId === g.id && (
            <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <label style={lbl}>New login email (updates auth + guardian)</label>
                <input style={input} type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder={g.login_email} />
              </div>
              <button type="button" style={navyBtn} disabled={busy === 'email' || !newEmail.trim()} onClick={async () => {
                const d = await call('email', `/api/admin/families/${familyId}/change-email`, { guardian_id: g.id, new_email: newEmail.trim() })
                if (d) { setActionMsg(d.authUpdated ? 'saved' : 'saved (guardian only — no auth user yet)'); setEmailEditId(null); setNewEmail(''); router.refresh() }
              }}>Update email</button>
            </div>
          )}
          {contactEditId === g.id && <GuardianEdit familyId={familyId} g={g} onDone={() => { setContactEditId(null); router.refresh() }} />}
        </div>
      ))}

      {/* Student edits */}
      {students.length > 0 && (
        <div style={{ marginTop: '1.25rem', borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {students.map((s) => (
              <button key={s.id} type="button" style={btn} onClick={() => setEditStudent((v) => (v === s.id ? null : s.id))}>
                {editStudent === s.id ? 'Cancel' : `Edit ${s.first_name}`}
              </button>
            ))}
          </div>
          {students.filter((s) => s.id === editStudent).map((s) => (
            <StudentEdit key={s.id} s={s} onDone={() => { setEditStudent(null); router.refresh() }} />
          ))}
        </div>
      )}
    </div>
  )
}

function GuardianEdit({ familyId, g, onDone }: { familyId: string; g: GuardianForEdit; onDone: () => void }) {
  const [first, setFirst] = useState(g.first_name)
  const [last, setLast] = useState(g.last_name)
  const [email, setEmail] = useState(g.communication_email)
  const [phone, setPhone] = useState(g.phone)
  const [busy, setBusy] = useState(false)
  const [m, setM] = useState('')
  async function save() {
    setBusy(true); setM('')
    const res = await fetch(`/api/admin/families/${familyId}/guardian`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ guardian_id: g.id, first_name: first, last_name: last, communication_email: email, phone }) })
    const d = await res.json().catch(() => ({}))
    setBusy(false); setM(res.ok ? 'saved' : (d.error || 'Save failed.'))
    if (res.ok) onDone()
  }
  return (
    <div style={{ marginTop: '0.875rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
      <div><label style={lbl}>First name</label><input style={input} value={first} onChange={(e) => setFirst(e.target.value)} /></div>
      <div><label style={lbl}>Last name</label><input style={input} value={last} onChange={(e) => setLast(e.target.value)} /></div>
      <div><label style={lbl}>Contact email</label><input style={input} value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <div><label style={lbl}>Phone</label><input style={input} value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
      <div style={{ gridColumn: '1 / -1' }}><button type="button" style={navyBtn} disabled={busy} onClick={save}>Save guardian</button><Msg m={m} /></div>
    </div>
  )
}

function StudentEdit({ s, onDone }: { s: Student; onDone: () => void }) {
  const [first, setFirst] = useState(s.first_name)
  const [last, setLast] = useState(s.last_name)
  const [grade, setGrade] = useState(String(s.grade ?? ''))
  const [tshirt, setTshirt] = useState(s.tshirt_size)
  const [busy, setBusy] = useState(false)
  const [m, setM] = useState('')
  async function save() {
    setBusy(true); setM('')
    const res = await fetch(`/api/admin/students/${s.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ first_name: first, last_name: last, grade, tshirt_size: tshirt }) })
    const d = await res.json().catch(() => ({}))
    setBusy(false); setM(res.ok ? 'saved' : (d.error || 'Save failed.'))
    if (res.ok) onDone()
  }
  return (
    <div style={{ marginTop: '0.875rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
      <div><label style={lbl}>First name</label><input style={input} value={first} onChange={(e) => setFirst(e.target.value)} /></div>
      <div><label style={lbl}>Last name</label><input style={input} value={last} onChange={(e) => setLast(e.target.value)} /></div>
      <div><label style={lbl}>Grade</label><input style={input} type="number" value={grade} onChange={(e) => setGrade(e.target.value)} /></div>
      <div><label style={lbl}>T-shirt</label><select style={input} value={tshirt} onChange={(e) => setTshirt(e.target.value)}><option value="">—</option>{TSHIRT.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
      <div style={{ gridColumn: '1 / -1' }}><button type="button" style={navyBtn} disabled={busy} onClick={save}>Save student</button><Msg m={m} /></div>
    </div>
  )
}
