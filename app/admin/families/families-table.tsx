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
}

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'error' | 'info' | 'neutral'> = {
  registered: 'success', cleared_to_register: 'info', cancelled: 'neutral', applied: 'warning', accepted: 'info',
}
const cell: React.CSSProperties = { padding: '0.6rem 0.75rem', fontSize: '0.8125rem', borderBottom: '1px solid var(--color-border)', textAlign: 'left', verticalAlign: 'top' }
const th: React.CSSProperties = { ...cell, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', fontSize: '0.6875rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }
const btn: React.CSSProperties = { padding: '4px 10px', fontSize: '0.75rem', fontWeight: 600, border: '1px solid var(--color-border)', borderRadius: '5px', background: 'var(--color-surface)', cursor: 'pointer', fontFamily: 'inherit' }

export default function FamiliesTable({ rows }: { rows: FamilyRow[] }) {
  const router = useRouter()
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return rows
    return rows.filter(
      (r) =>
        r.familyName.toLowerCase().includes(s) ||
        r.guardianEmail.toLowerCase().includes(s) ||
        r.students.some((n) => n.toLowerCase().includes(s))
    )
  }, [rows, q])

  return (
    <div>
      <input
        placeholder="Search by family, guardian email, or student name…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ width: '100%', maxWidth: 420, padding: '8px 11px', fontSize: '0.875rem', border: '1.5px solid var(--color-border)', borderRadius: '6px', marginBottom: '1rem', fontFamily: 'inherit' }}
      />
      <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: '10px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'var(--color-surface)' }}>
          <thead>
            <tr><th style={th}>Family</th><th style={th}>Guardian 1 Email</th><th style={th}>Students</th><th style={th}>Season Status</th><th style={th}>Actions</th></tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td style={cell} colSpan={5}>No families match.</td></tr>
            ) : filtered.map((r) => (
              <tr key={r.id}>
                <td style={cell}>{r.familyName}</td>
                <td style={cell}>{r.guardianEmail}</td>
                <td style={cell}>{r.students.length ? `${r.students.length} · ${r.students.join(', ')}` : '—'}</td>
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
