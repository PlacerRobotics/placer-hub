'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export type TeamOpt = { id: string; label: string }

const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', fontSize: '0.9375rem', border: '1.5px solid var(--color-border)', borderRadius: '6px', fontFamily: 'inherit', boxSizing: 'border-box', backgroundColor: 'var(--color-surface)' }
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.8125rem', fontWeight: 500, marginBottom: '0.25rem', color: 'var(--color-text-muted)' }
const btn: React.CSSProperties = { padding: '8px 16px', border: 'none', borderRadius: '6px', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit' }

export default function RegistrationEdit({
  familySeasonId,
  studentId,
  teams,
  current,
}: {
  familySeasonId: string
  studentId: string
  teams: TeamOpt[]
  current: { tshirt_size: string; program: string; team_id: string; emergency_name: string; emergency_phone: string }
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ ...current })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  function set<K extends keyof typeof f>(k: K, v: string) { setF((s) => ({ ...s, [k]: v })) }

  async function save() {
    setBusy(true); setErr('')
    try {
      const res = await fetch(`/api/admin/registrations/${familySeasonId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId, ...f }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setErr(d.error || 'Save failed.'); return }
      setOpen(false); router.refresh()
    } catch { setErr('Network error.') } finally { setBusy(false) }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} style={{ ...btn, backgroundColor: 'var(--color-navy-deep)', color: '#fff' }}>
        Edit registration
      </button>
    )
  }

  return (
    <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '1.25rem' }}>
      <h3 className="text-card-title" style={{ marginBottom: '1rem' }}>Edit registration</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.875rem' }}>
        <div>
          <label style={labelStyle}>T-shirt size</label>
          <select style={inputStyle} value={f.tshirt_size} onChange={(e) => set('tshirt_size', e.target.value)}>
            <option value="">—</option>
            {['xs', 's', 'm', 'l', 'xl', 'xxl'].map((s) => <option key={s} value={s}>{s.toUpperCase()}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Program</label>
          <select style={inputStyle} value={f.program} onChange={(e) => set('program', e.target.value)}>
            <option value="vex_v5">VEX V5</option>
            <option value="combat">Combat</option>
            <option value="vex_iq">VEX IQ</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Team</label>
          <select style={inputStyle} value={f.team_id} onChange={(e) => set('team_id', e.target.value)}>
            <option value="">— Unassigned —</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Emergency contact name</label>
          <input style={inputStyle} value={f.emergency_name} onChange={(e) => set('emergency_name', e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Emergency contact phone</label>
          <input style={inputStyle} value={f.emergency_phone} onChange={(e) => set('emergency_phone', e.target.value)} />
        </div>
      </div>
      {err && <p style={{ color: 'var(--color-error)', fontSize: '0.8125rem', marginTop: '0.625rem' }}>{err}</p>}
      <div style={{ display: 'flex', gap: '0.625rem', marginTop: '1rem' }}>
        <button type="button" onClick={save} disabled={busy} style={{ ...btn, backgroundColor: 'var(--color-gold)', color: 'var(--color-navy-darker)' }}>{busy ? 'Saving…' : 'Save'}</button>
        <button type="button" onClick={() => { setOpen(false); setF({ ...current }); setErr('') }} disabled={busy} style={{ ...btn, backgroundColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>Cancel</button>
      </div>
    </div>
  )
}
