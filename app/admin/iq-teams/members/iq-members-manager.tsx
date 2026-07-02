'use client'

import { useMemo, useState } from 'react'
import { StatusBadge } from '@/components/ui'

export type TeamOpt = { id: string; label: string }
export type IqMemberRow = {
  studentId: string
  name: string
  lastFirst: string
  grade: number | null
  school: string
  teamId: string
  teamLabel: string
  coach: string
  parentName: string
  parentEmail: string
  regStatus: 'complete' | 'waiver_pending' | 'form_pending' | 'not_started'
  signed: boolean
  registered: boolean
  dropRequested: boolean
  master: Record<string, string>
}

const REG_META: Record<string, { label: string; variant: 'success' | 'warning' | 'info' | 'neutral' }> = {
  complete: { label: 'Complete', variant: 'success' },
  waiver_pending: { label: 'Waiver pending', variant: 'warning' },
  form_pending: { label: 'Form pending', variant: 'warning' },
  not_started: { label: 'Not started', variant: 'neutral' },
}
// Full per-student export — ordered columns for the "IQ master download".
const MASTER_COLS: [string, string][] = [
  ['teamNumber', 'Team #'], ['teamName', 'Team name'], ['coach', 'Coach'], ['coachEmail', 'Coach email'],
  ['studentFirst', 'Student first'], ['studentLast', 'Student last'], ['preferredName', 'Preferred name'],
  ['grade', 'Grade'], ['birthdate', 'Birthdate'], ['tshirt', 'T-shirt'], ['school', 'School'],
  ['studentPhone', 'Student phone'], ['studentCommEmail', 'Student Google Workspace email'], ['studentFusionEmail', 'Student Fusion email'], ['studentSlackEmail', 'Student Slack email'],
  ['studentStreet', 'Student street'], ['studentCity', 'City'], ['studentState', 'State'], ['studentZip', 'ZIP'],
  ['parent1Name', 'Parent 1'], ['parent1Rel', 'Parent 1 relationship'], ['parent1Login', 'Parent 1 login email'], ['parent1Comm', 'Parent 1 comm email'], ['parent1Phone', 'Parent 1 phone'],
  ['parent2Name', 'Parent 2'], ['parent2Login', 'Parent 2 login email'], ['parent2Phone', 'Parent 2 phone'],
  ['address', 'Family address'],
  ['emergencyName', 'Emergency contact'], ['emergencyPhone', 'Emergency phone'], ['emergencyRel', 'Emergency relationship'],
  ['regStatus', 'Registration status'], ['waiver', 'Waiver'], ['registered', 'Form submitted'], ['appStatus', 'Application status'], ['dropRequested', 'Drop requested'],
]

const sel: React.CSSProperties = { padding: '7px 9px', fontSize: '0.8125rem', border: '1.5px solid var(--color-border)', borderRadius: 6, fontFamily: 'inherit', backgroundColor: 'var(--color-surface)' }
const cell: React.CSSProperties = { padding: '0.6rem 0.75rem', fontSize: '0.8125rem', borderBottom: '1px solid var(--color-border)', textAlign: 'left', verticalAlign: 'middle' }
const th: React.CSSProperties = { ...cell, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', fontSize: '0.6875rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }
const btn: React.CSSProperties = { padding: '7px 12px', fontSize: '0.8125rem', fontWeight: 600, border: '1px solid var(--color-border)', borderRadius: 6, background: 'var(--color-surface)', cursor: 'pointer', fontFamily: 'inherit' }

function download(name: string, headers: string[], lines: string[][]) {
  const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = [headers.map(esc).join(','), ...lines.map((r) => r.map(esc).join(','))].join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  a.download = name
  a.click()
}

export default function IqMembersManager({ rows, teams }: { rows: IqMemberRow[]; teams: TeamOpt[] }) {
  const [search, setSearch] = useState('')
  const [fTeam, setFTeam] = useState('all')
  const [fReg, setFReg] = useState('all')
  const [fWaiver, setFWaiver] = useState('all')
  const [sort, setSort] = useState<'team' | 'student'>('team')

  const filtered = useMemo(() => {
    const out = rows.filter((r) => {
      if (fTeam !== 'all' && r.teamId !== fTeam) return false
      if (fReg !== 'all' && r.regStatus !== fReg) return false
      if (fWaiver === 'signed' && !r.signed) return false
      if (fWaiver === 'unsigned' && r.signed) return false
      if (search.trim()) { const q = search.toLowerCase(); if (!r.name.toLowerCase().includes(q) && !r.parentName.toLowerCase().includes(q) && !r.parentEmail.toLowerCase().includes(q) && !r.teamLabel.toLowerCase().includes(q)) return false }
      return true
    })
    const cmp = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    out.sort((a, b) => sort === 'student'
      ? cmp(a.lastFirst, b.lastFirst)
      : cmp(a.teamLabel, b.teamLabel) || cmp(a.lastFirst, b.lastFirst))
    return out
  }, [rows, search, fTeam, fReg, fWaiver, sort])

  const today = new Date().toISOString().slice(0, 10)
  function exportView() {
    download(`iq-members-${today}.csv`,
      ['Student', 'Grade', 'School', 'Team', 'Coach', 'Parent', 'Parent email', 'Registration', 'Waiver'],
      filtered.map((r) => [r.name, String(r.grade ?? ''), r.school, r.teamLabel, r.coach, r.parentName, r.parentEmail, REG_META[r.regStatus].label, r.signed ? 'signed' : 'not signed']))
  }
  function exportMaster() {
    download(`iq-master-${today}.csv`, MASTER_COLS.map((c) => c[1]), filtered.map((r) => MASTER_COLS.map((c) => r.master[c[0]] ?? '')))
  }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
        <input placeholder="Search student, email, team…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ ...sel, minWidth: 220 }} />
        <select style={sel} value={fTeam} onChange={(e) => setFTeam(e.target.value)}><option value="all">All teams</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select>
        <select style={sel} value={fReg} onChange={(e) => setFReg(e.target.value)}><option value="all">Registration: all</option><option value="complete">Complete</option><option value="waiver_pending">Waiver pending</option><option value="form_pending">Form pending</option><option value="not_started">Not started</option></select>
        <select style={sel} value={fWaiver} onChange={(e) => setFWaiver(e.target.value)}><option value="all">Waiver: all</option><option value="signed">Signed</option><option value="unsigned">Not signed</option></select>
        <select style={sel} value={sort} onChange={(e) => setSort(e.target.value as 'team' | 'student')}><option value="team">Sort: Team #, then student</option><option value="student">Sort: Student (last, first)</option></select>
        <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>{filtered.length} of {rows.length}</span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
          <button type="button" onClick={exportView} style={btn}>Export view</button>
          <button type="button" onClick={exportMaster} style={{ ...btn, background: 'var(--color-navy-deep)', color: '#fff', borderColor: 'transparent' }}>IQ master download</button>
        </span>
      </div>

      <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'var(--color-surface)' }}>
          <thead><tr>
            <th style={th}>Student</th><th style={th}>Grade</th><th style={th}>School</th><th style={th}>Team</th><th style={th}>Coach</th><th style={th}>Parent</th><th style={th}>Registration</th><th style={th}>Waiver</th>
          </tr></thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td style={cell} colSpan={8}>No members match these filters.</td></tr>
            ) : filtered.map((r) => (
              <tr key={r.studentId}>
                <td style={cell}>{r.name}{r.dropRequested && <span style={{ color: '#C9971B', fontWeight: 700, fontSize: '0.6875rem' }}> ⚠ DROP</span>}</td>
                <td style={cell}>{r.grade ?? '—'}</td>
                <td style={cell}>{r.school}</td>
                <td style={cell}>{r.teamLabel}</td>
                <td style={cell}>{r.coach}</td>
                <td style={cell}>{r.parentName}{r.parentEmail && r.parentEmail !== '—' && <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>{r.parentEmail}</div>}</td>
                <td style={cell}><StatusBadge label={REG_META[r.regStatus].label} variant={REG_META[r.regStatus].variant} /></td>
                <td style={{ ...cell, color: r.signed ? 'var(--color-success)' : 'var(--color-text-muted)', fontWeight: 600 }}>{r.signed ? '✓ signed' : 'not yet'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
