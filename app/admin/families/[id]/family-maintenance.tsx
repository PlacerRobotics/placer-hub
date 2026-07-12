'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// Duplicate-family cleanup actions (the "meaningful" half of the duplicates
// report): move an unregistered student to their real family, and delete a
// family once it's an empty shell. The API enforces every guard server-side;
// this UI just explains them.
export type MaintStudent = { id: string; name: string; registered: boolean }
export type Blockers = Record<string, number>

const card: React.CSSProperties = { border: '1.5px solid var(--color-error)', borderRadius: 10, padding: '1rem 1.25rem', margin: '1.5rem 0', backgroundColor: 'var(--color-surface)' }
const input: React.CSSProperties = { padding: '7px 10px', fontSize: '0.8125rem', border: '1.5px solid var(--color-border)', borderRadius: 6, fontFamily: 'inherit', minWidth: 240 }
const dangerBtn: React.CSSProperties = { padding: '7px 14px', backgroundColor: 'var(--color-error)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'inherit' }
const outlineBtn: React.CSSProperties = { padding: '6px 12px', background: 'var(--color-surface)', color: 'var(--color-navy-deep)', border: '1.5px solid var(--color-navy-deep)', borderRadius: 6, fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'inherit' }

export default function FamilyMaintenance({ familyId, familyLabel, students, blockers }: { familyId: string; familyLabel: string; students: MaintStudent[]; blockers: Blockers }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [moveTarget, setMoveTarget] = useState<Record<string, string>>({})

  const blocking = Object.entries(blockers).filter(([, c]) => c > 0)
  const deletable = blocking.length === 0

  async function post(url: string, body?: unknown) {
    setBusy(true); setMsg('')
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : '{}' })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setMsg(d.error || 'Action failed.'); return false }
      return true
    } catch { setMsg('Network error.'); return false } finally { setBusy(false) }
  }

  async function moveStudent(s: MaintStudent) {
    const email = (moveTarget[s.id] ?? '').trim()
    if (!email) { setMsg('Enter the target guardian’s login email first.'); return }
    if (!window.confirm(`Move ${s.name} (and their application + emergency contacts) to the family whose guardian signs in as ${email}?`)) return
    if (await post(`/api/admin/students/${s.id}/move-family`, { target_guardian_email: email })) {
      setMsg(`${s.name} moved.`)
      router.refresh()
    }
  }

  async function deleteFamily() {
    if (!window.confirm(`Delete ${familyLabel}?\n\nThis removes the family record and its guardian/season rows. It cannot be undone.`)) return
    if (await post(`/api/admin/families/${familyId}/delete`)) {
      window.location.href = '/admin/families?notice=deleted'
    }
  }

  return (
    <div style={card}>
      <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, margin: '0 0 0.25rem', color: 'var(--color-error)' }}>Duplicate cleanup</h3>
      <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: '0 0 0.875rem' }}>
        For spurious duplicate families (bad-email imports, the mailto: bug). Move any real students to the correct family first — then the empty shell can be deleted.
      </p>

      {students.map((s) => (
        <div key={s.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, minWidth: 140 }}>{s.name}</span>
          {s.registered ? (
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>registered — has enrollment/waiver records; merge manually, not movable here</span>
          ) : (
            <>
              <input
                style={input}
                type="email"
                placeholder="target guardian's login email"
                value={moveTarget[s.id] ?? ''}
                onChange={(e) => setMoveTarget((m) => ({ ...m, [s.id]: e.target.value }))}
              />
              <button type="button" style={outlineBtn} disabled={busy} onClick={() => moveStudent(s)}>Move to that family</button>
            </>
          )}
        </div>
      ))}

      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.875rem', paddingTop: '0.875rem', borderTop: '1px solid var(--color-border)' }}>
        <button type="button" style={{ ...dangerBtn, opacity: deletable ? 1 : 0.5, cursor: deletable ? 'pointer' : 'not-allowed' }} disabled={busy || !deletable} onClick={deleteFamily}>
          Delete this family
        </button>
        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
          {deletable
            ? 'This family is an empty shell (no students, enrollments, payments, waivers, volunteers, or aid records) — safe to delete.'
            : `Blocked — still has ${blocking.map(([k, c]) => `${c} ${k.replace(/_/g, ' ')}`).join(', ')}.`}
        </span>
      </div>
      {msg && <p style={{ fontSize: '0.8125rem', color: msg.endsWith('moved.') ? 'var(--color-success)' : 'var(--color-error)', margin: '0.625rem 0 0' }}>{msg}</p>}
    </div>
  )
}
