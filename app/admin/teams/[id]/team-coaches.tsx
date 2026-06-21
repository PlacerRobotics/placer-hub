'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export type Coach = {
  id: string // team_member id
  team_role: string
  guardian: { first_name: string | null; last_name: string | null; login_email: string | null } | null
}
type GuardianHit = { id: string; first_name: string | null; last_name: string | null; login_email: string | null }

const ROLE_LABELS: Record<string, string> = { coach: 'Coach', assistant_coach: 'Assistant Coach', mentor: 'Mentor' }
const ROLES = ['coach', 'assistant_coach', 'mentor']

const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', fontSize: '0.9375rem', border: '1.5px solid var(--color-border)', borderRadius: '6px', fontFamily: 'inherit', boxSizing: 'border-box', backgroundColor: 'var(--color-surface)' }
const btn: React.CSSProperties = { padding: '8px 16px', border: 'none', borderRadius: '6px', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit' }

function gName(g: { first_name: string | null; last_name: string | null } | null) {
  return `${g?.first_name ?? ''} ${g?.last_name ?? ''}`.trim() || '—'
}

export function TeamCoaches({ teamId, coaches }: { teamId: string; coaches: Coach[] }) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<GuardianHit[]>([])
  const [picked, setPicked] = useState<GuardianHit | null>(null)
  const [role, setRole] = useState('coach')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function search(value: string) {
    setQ(value); setPicked(null)
    if (value.trim().length < 2) { setHits([]); return }
    try {
      const res = await fetch(`/api/admin/guardians/search?q=${encodeURIComponent(value)}`)
      const data = await res.json()
      setHits(data.guardians ?? [])
    } catch { setHits([]) }
  }

  async function save() {
    if (!picked || busy) return
    setBusy(true); setError('')
    try {
      const res = await fetch(`/api/admin/teams/${teamId}/coaches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guardian_id: picked.id, team_role: role }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to add coach.'); return }
      setAdding(false); setQ(''); setHits([]); setPicked(null); setRole('coach'); router.refresh()
    } catch { setError('Network error.') } finally { setBusy(false) }
  }

  async function remove(memberId: string) {
    if (!confirm('Remove this coach from the team?')) return
    try {
      const res = await fetch(`/api/admin/teams/${teamId}/coaches?member_id=${memberId}`, { method: 'DELETE' })
      if (res.ok) router.refresh()
    } catch { /* ignore */ }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
        <h2 className="text-section-title">Coaches</h2>
        {!adding && (
          <button type="button" onClick={() => setAdding(true)} style={{ ...btn, backgroundColor: 'var(--color-navy-deep)', color: '#fff' }}>Add Coach</button>
        )}
      </div>

      {coaches.length === 0 ? (
        <p className="text-help" style={{ marginBottom: '1rem' }}>No coaches assigned yet.</p>
      ) : (
        <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', overflow: 'hidden', marginBottom: '1rem' }}>
          {coaches.map((c, i) => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.75rem 1.25rem', borderBottom: i < coaches.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
              <div>
                <div style={{ fontSize: '0.9375rem', fontWeight: 500 }}>{gName(c.guardian)} <span className="text-help">· {ROLE_LABELS[c.team_role] ?? c.team_role}</span></div>
                <div className="text-help">{c.guardian?.login_email ?? '—'}</div>
              </div>
              <button type="button" onClick={() => remove(c.id)} style={{ ...btn, backgroundColor: 'transparent', color: 'var(--color-error)', padding: '6px 10px' }}>Remove</button>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '1.25rem', maxWidth: '520px' }}>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>Find guardian (name or email)</label>
          <input style={inputStyle} value={q} onChange={(e) => search(e.target.value)} placeholder="Start typing…" autoFocus />
          {!picked && hits.length > 0 && (
            <div style={{ border: '1px solid var(--color-border)', borderRadius: '6px', marginTop: '0.375rem', overflow: 'hidden' }}>
              {hits.map((h) => (
                <button key={h.id} type="button" onClick={() => { setPicked(h); setHits([]); setQ(gName(h)) }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', background: 'none', border: 'none', borderBottom: '1px solid var(--color-border)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.875rem' }}>
                  {gName(h)} <span className="text-help">· {h.login_email}</span>
                </button>
              ))}
            </div>
          )}
          {!picked && q.trim().length >= 2 && hits.length === 0 && (
            <p className="text-help" style={{ marginTop: '0.5rem' }}>
              No match. <Link href="/admin/guardians/new">Create new guardian →</Link>
            </p>
          )}
          {picked && (
            <p style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>Selected: <strong>{gName(picked)}</strong> ({picked.login_email})</p>
          )}

          <div style={{ marginTop: '0.875rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>Role</label>
            <select style={inputStyle} value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </div>

          {error && <p style={{ color: 'var(--color-error)', fontSize: '0.8125rem', marginTop: '0.625rem' }}>{error}</p>}
          <div style={{ display: 'flex', gap: '0.625rem', marginTop: '1rem' }}>
            <button type="button" onClick={save} disabled={!picked || busy} style={{ ...btn, backgroundColor: 'var(--color-gold)', color: 'var(--color-navy-darker)', cursor: picked && !busy ? 'pointer' : 'not-allowed' }}>{busy ? 'Saving…' : 'Save'}</button>
            <button type="button" onClick={() => { setAdding(false); setQ(''); setHits([]); setPicked(null); setError('') }} disabled={busy} style={{ ...btn, backgroundColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
