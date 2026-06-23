'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { StatusBadge } from '@/components/ui'

export type FamilyRow = {
  id: string
  familyName: string
  guardianEmail: string
  students: string[]
  status: string
  programs: string[]
  divisions: string[]
}

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'error' | 'info' | 'neutral'> = {
  registered: 'success', cleared_to_register: 'info', cancelled: 'neutral', applied: 'warning', accepted: 'info',
}
const PROGRAM_LABELS: Record<string, string> = { vex_v5: 'VEX V5', combat: 'Combat', vex_iq: 'VEX IQ' }
const DIVISION_LABELS: Record<string, string> = { ES: 'Elementary', MS: 'Middle', HS: 'High' }
const cell: React.CSSProperties = { padding: '0.6rem 0.75rem', fontSize: '0.8125rem', borderBottom: '1px solid var(--color-border)', textAlign: 'left', verticalAlign: 'top' }
const th: React.CSSProperties = { ...cell, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', fontSize: '0.6875rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }
const btn: React.CSSProperties = { padding: '4px 10px', fontSize: '0.75rem', fontWeight: 600, border: '1px solid var(--color-border)', borderRadius: '5px', background: 'var(--color-surface)', cursor: 'pointer', fontFamily: 'inherit' }
const sel: React.CSSProperties = { padding: '7px 10px', fontSize: '0.8125rem', border: '1.5px solid var(--color-border)', borderRadius: 6, fontFamily: 'inherit', backgroundColor: 'var(--color-surface)' }

export default function FamiliesTable({ rows }: { rows: FamilyRow[] }) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [program, setProgram] = useState('all')
  const [division, setDivision] = useState('all')
  const [status, setStatus] = useState('all')

  const statuses = useMemo(() => [...new Set(rows.map((r) => r.status).filter((s) => s && s !== '—'))].sort(), [rows])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return rows.filter((r) => {
      if (program !== 'all' && !r.programs.includes(program)) return false
      if (division !== 'all' && !r.divisions.includes(division)) return false
      if (status !== 'all' && r.status !== status) return false
      if (s && !(r.familyName.toLowerCase().includes(s) || r.guardianEmail.toLowerCase().includes(s) || r.students.some((n) => n.toLowerCase().includes(s)))) return false
      return true
    })
  }, [rows, q, program, division, status])

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
        <input placeholder="Search family, email, or student…" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: '1 1 240px', minWidth: 200, padding: '8px 11px', fontSize: '0.875rem', border: '1.5px solid var(--color-border)', borderRadius: 6, fontFamily: 'inherit' }} />
        <select value={program} onChange={(e) => setProgram(e.target.value)} style={sel}><option value="all">All programs</option>{Object.entries(PROGRAM_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <select value={division} onChange={(e) => setDivision(e.target.value)} style={sel}><option value="all">All ages</option>{Object.entries(DIVISION_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={sel}><option value="all">All statuses</option>{statuses.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}</select>
      </div>
      <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: '0.625rem' }}>{filtered.length} of {rows.length} families</div>
      <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: '10px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'var(--color-surface)' }}>
          <thead>
            <tr><th style={th}>Family</th><th style={th}>Guardian 1 Email</th><th style={th}>Students</th><th style={th}>Programs</th><th style={th}>Season Status</th><th style={th}>Actions</th></tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td style={cell} colSpan={6}>No families match.</td></tr>
            ) : filtered.map((r) => (
              <tr key={r.id}>
                <td style={cell}>{r.familyName}</td>
                <td style={cell}>{r.guardianEmail}</td>
                <td style={cell}>{r.students.length ? `${r.students.length} · ${r.students.join(', ')}` : '—'}</td>
                <td style={cell}>{r.programs.length ? r.programs.map((p) => PROGRAM_LABELS[p] ?? p).join(', ') : '—'}</td>
                <td style={cell}><StatusBadge label={r.status} variant={STATUS_VARIANT[r.status] ?? 'neutral'} /></td>
                <td style={cell}><button type="button" style={btn} onClick={() => router.push(`/admin/families/${r.id}`)}>View</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
