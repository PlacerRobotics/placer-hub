'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export type AssignTeam = { id: string; number: string; name: string; program: string }

const PROGRAM_LABELS: Record<string, string> = { vex_v5: 'VEX V5', combat: 'Combat', vex_iq: 'VEX IQ' }
const btn: React.CSSProperties = { padding: '6px 12px', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'inherit' }
const navyBtn: React.CSSProperties = { ...btn, backgroundColor: 'var(--color-navy-deep)', color: '#fff' }
const linkBtn: React.CSSProperties = { background: 'none', border: 'none', color: 'var(--color-navy-deep)', fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }
const dangerLink: React.CSSProperties = { ...linkBtn, color: 'var(--color-error)' }
const input: React.CSSProperties = { padding: '8px 10px', fontSize: '0.875rem', border: '1.5px solid var(--color-border)', borderRadius: 6, fontFamily: 'inherit', boxSizing: 'border-box', backgroundColor: 'var(--color-surface)' }

export default function TeamAssign({ familySeasonId, studentId, studentProgram, hasEnrollment, current, teams }: {
  familySeasonId: string
  studentId: string
  studentProgram: string
  hasEnrollment: boolean
  current: { id: string; label: string } | null
  teams: AssignTeam[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [prog, setProg] = useState(['vex_v5', 'combat', 'vex_iq'].includes(studentProgram) ? studentProgram : 'all')
  const [search, setSearch] = useState('')
  const [sel, setSel] = useState('')

  async function post(teamId: string) {
    setBusy(true); setErr('')
    try {
      const res = await fetch(`/api/admin/registrations/${familySeasonId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ student_id: studentId, team_id: teamId }) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setErr(d.error || 'Failed.'); setBusy(false); return }
      setOpen(false); setBusy(false); router.refresh()
    } catch { setErr('Network error.'); setBusy(false) }
  }

  const q = search.trim().toLowerCase()
  const filtered = teams.filter((t) => (prog === 'all' || t.program === prog) && (!q || `${t.number} ${t.name}`.toLowerCase().includes(q)))

  return (
    <span>
      {current ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <strong>{current.label}</strong>
          <button type="button" onClick={() => { setSel(''); setErr(''); setOpen(true) }} style={linkBtn}>Change Team</button>
          <button type="button" onClick={() => post('')} disabled={busy} style={dangerLink}>Remove from Team</button>
        </span>
      ) : (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ color: 'var(--color-text-muted)' }}>Unassigned{hasEnrollment ? '' : ' · pending placement'}</span>
          <button type="button" onClick={() => { setSel(''); setErr(''); setOpen(true) }} style={navyBtn}>Assign Team</button>
        </span>
      )}
      {err && !open && <span style={{ color: 'var(--color-error)', fontSize: '0.8125rem', marginLeft: 8 }}>{err}</span>}

      {open && (
        <div onClick={() => !busy && setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ backgroundColor: 'var(--color-surface)', borderRadius: 12, padding: '1.25rem 1.5rem', width: '100%', maxWidth: 480, boxShadow: '0 8px 32px rgba(0,0,0,0.25)' }}>
            <h3 className="text-card-title" style={{ margin: '0 0 1rem' }}>{current ? 'Change team' : 'Assign team'}</h3>
            <div style={{ display: 'flex', gap: '0.625rem', marginBottom: '0.75rem' }}>
              <select value={prog} onChange={(e) => setProg(e.target.value)} style={input}>
                <option value="all">All programs</option>
                <option value="vex_v5">VEX V5</option>
                <option value="combat">Combat</option>
                <option value="vex_iq">VEX IQ</option>
              </select>
              <input placeholder="Search number or name…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ ...input, flex: 1 }} />
            </div>
            <select value={sel} onChange={(e) => setSel(e.target.value)} size={8} style={{ ...input, width: '100%', height: 'auto' }}>
              {filtered.length === 0 ? <option value="" disabled>No matching teams</option> : filtered.map((t) => (
                <option key={t.id} value={t.id}>{(t.number || t.name || t.id)}{t.number && t.name ? ` · ${t.name}` : ''} · {PROGRAM_LABELS[t.program] ?? t.program}</option>
              ))}
            </select>
            {err && <p style={{ color: 'var(--color-error)', fontSize: '0.8125rem', margin: '0.5rem 0 0' }}>{err}</p>}
            <div style={{ display: 'flex', gap: '0.625rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setOpen(false)} disabled={busy} style={{ ...btn, backgroundColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>Cancel</button>
              <button type="button" onClick={() => sel && post(sel)} disabled={busy || !sel} style={{ ...btn, backgroundColor: 'var(--color-gold)', color: 'var(--color-navy-darker)', opacity: sel ? 1 : 0.6 }}>{busy ? 'Saving…' : 'Confirm'}</button>
            </div>
          </div>
        </div>
      )}
    </span>
  )
}
