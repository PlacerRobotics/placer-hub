'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FormSection, FormField, TextInput, PrimaryButton, SecondaryButton, SuccessAlert, ErrorAlert } from '@/components/ui'

const OTHER_SCHOOL = '__other__'
type School = { id: string; name: string; grade_min: number | null; grade_max: number | null }
type Row = { student_first: string; student_last: string; grade: string; schoolId: string; schoolOther: string; parent_first: string; parent_last: string; parent_email: string }
const emptyRow = (): Row => ({ student_first: '', student_last: '', grade: '', schoolId: '', schoolOther: '', parent_first: '', parent_last: '', parent_email: '' })
const rowComplete = (r: Row) => r.student_first.trim() && r.student_last.trim() && r.parent_email.trim() && r.grade

const selectStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', fontSize: '0.875rem', color: 'var(--color-text-primary)', backgroundColor: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '6px', fontFamily: 'inherit', boxSizing: 'border-box' }
const lbl: React.CSSProperties = { display: 'block', fontSize: '0.8125rem', fontWeight: 500, marginBottom: '0.25rem' }
const GRADES = [3, 4, 5, 6]

export default function IqRosterBuilder({ teamId, schools, teamActive }: { teamId: string; schools: School[]; teamActive: boolean }) {
  const router = useRouter()
  const [ocFirst, setOcFirst] = useState(''); const [ocLast, setOcLast] = useState(''); const [ocGrade, setOcGrade] = useState(''); const [ocSchoolId, setOcSchoolId] = useState(''); const [ocSchoolOther, setOcSchoolOther] = useState('')
  const [roster, setRoster] = useState<Row[]>([emptyRow()])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<{ student: string; under: string }[] | null>(null)

  const ownCount = ocFirst.trim() && ocLast.trim() && ocGrade ? 1 : 0
  const total = ownCount + roster.filter(rowComplete).length
  const valid = total >= 1

  function setRow(i: number, k: keyof Row, v: string) {
    setRoster((rows) => rows.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)))
  }

  async function submit() {
    if (busy || !valid) return
    setBusy(true); setError('')
    try {
      const res = await fetch(`/api/iq/team/${teamId}/members`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          own_child: ownCount ? { first_name: ocFirst.trim(), last_name: ocLast.trim(), grade: ocGrade, school_id: ocSchoolId && ocSchoolId !== OTHER_SCHOOL ? ocSchoolId : '', school: ocSchoolId === OTHER_SCHOOL ? ocSchoolOther.trim() : '' } : null,
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
      setDone(d.members ?? [])
      setOcFirst(''); setOcLast(''); setOcGrade(''); setOcSchoolId(''); setOcSchoolOther('')
      setRoster([emptyRow()])
      setBusy(false)
      router.refresh()
    } catch { setError('Network error — please try again.'); setBusy(false) }
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
    <FormSection title="Add team members" description={teamActive ? 'Add your own child and your roster. Each parent gets a registration invite right away (the team is active).' : 'Add your own child and your roster. Each parent is invited to register once your team is approved.'}>
      {done && (
        <div style={{ marginBottom: '1rem' }}>
          <SuccessAlert title={`Added ${done.length} member${done.length === 1 ? '' : 's'}`}>
            {done.map((m) => `${m.student} (${m.under})`).join(' · ')}{teamActive ? ' — invites sent.' : ' — they’ll be invited after approval.'} Add more below if you need to.
          </SuccessAlert>
        </div>
      )}
      {error && <div style={{ marginBottom: '1rem' }}><ErrorAlert title="Couldn’t add">{error}</ErrorAlert></div>}

      <div style={{ fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.5rem' }}>Your own child (optional)</div>
      <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>Goes under your account — no separate invite.</div>
      {memberRow('', ocFirst, setOcFirst, ocLast, setOcLast, ocGrade, setOcGrade, schoolSelect(ocGrade, ocSchoolId, ocSchoolOther, setOcSchoolId, setOcSchoolOther))}

      <div style={{ fontSize: '0.8125rem', fontWeight: 700, margin: '1rem 0 0.5rem' }}>Other students</div>
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
            {roster.length > 1 && <button type="button" onClick={() => setRoster((rows) => rows.filter((_, idx) => idx !== i))} style={{ marginTop: '0.5rem', background: 'none', border: 'none', color: 'var(--color-error)', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>Remove</button>}
          </>
        )
      ))}
      {roster.length < 10 && <SecondaryButton onClick={() => setRoster((rows) => [...rows, emptyRow()])}>+ Add another member</SecondaryButton>}
      <div style={{ marginTop: '0.5rem', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>Use each parent’s email — not a student email. A grade is required for each student.</div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.875rem' }}>
        <PrimaryButton loading={busy} disabled={!valid} onClick={submit}>{total > 0 ? `Add ${total} member${total === 1 ? '' : 's'}` : 'Add members'}</PrimaryButton>
      </div>
    </FormSection>
  )
}
