'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// Manual "Add known email" (design: docs/design_email_identity_v1_0.md §1) — an
// APS-era yahoo, an abandoned login, whatever an admin has confirmed belongs to
// this guardian. Recorded aliases make future imports/roster-adds/Zeffy
// payments under that address resolve here instead of minting a duplicate.
export type GuardianForAliases = { id: string; name: string; aliases: { id: string; email: string; source: string }[] }

const input: React.CSSProperties = { padding: '6px 9px', fontSize: '0.8125rem', border: '1.5px solid var(--color-border)', borderRadius: 6, fontFamily: 'inherit', minWidth: 220 }
const pill: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '3px 8px', borderRadius: 999, backgroundColor: 'var(--color-bg-light)', border: '1px solid var(--color-border)', fontSize: '0.75rem' }
const outlineBtn: React.CSSProperties = { padding: '5px 10px', background: 'var(--color-surface)', color: 'var(--color-navy-deep)', border: '1.5px solid var(--color-navy-deep)', borderRadius: 6, fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit' }

export default function EmailAliases({ guardians }: { guardians: GuardianForAliases[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [newEmail, setNewEmail] = useState<Record<string, string>>({})

  if (!guardians.length) return null

  async function add(guardianId: string) {
    const email = (newEmail[guardianId] ?? '').trim()
    if (!email) return
    setBusy(true); setMsg('')
    try {
      const res = await fetch(`/api/admin/guardians/${guardianId}/aliases`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setMsg(d.error || 'Failed.'); return }
      setNewEmail((m) => ({ ...m, [guardianId]: '' }))
      router.refresh()
    } catch { setMsg('Network error.') } finally { setBusy(false) }
  }

  async function remove(guardianId: string, aliasId: string) {
    setBusy(true); setMsg('')
    try {
      const res = await fetch(`/api/admin/guardians/${guardianId}/aliases?alias_id=${aliasId}`, { method: 'DELETE' })
      if (!res.ok) { const d = await res.json().catch(() => ({})); setMsg(d.error || 'Failed.'); return }
      router.refresh()
    } catch { setMsg('Network error.') } finally { setBusy(false) }
  }

  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 10, padding: '1rem 1.25rem', margin: '1.5rem 0', backgroundColor: 'var(--color-surface)' }}>
      <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, margin: '0 0 0.25rem' }}>Known emails</h3>
      <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: '0 0 0.875rem' }}>
        Alternate addresses confirmed to belong to each guardian (an APS-era yahoo, an abandoned login). Future imports, roster-adds, and Zeffy payments under these resolve here instead of creating a duplicate family.
      </p>
      {guardians.map((g) => (
        <div key={g.id} style={{ marginBottom: '0.75rem' }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>{g.name}</div>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
            {g.aliases.length === 0 ? <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>None recorded.</span> : g.aliases.map((a) => (
              <span key={a.id} style={pill}>
                {a.email}
                <span style={{ color: 'var(--color-text-muted)' }}>· {a.source.replace(/_/g, ' ')}</span>
                <button type="button" title="Remove" disabled={busy} onClick={() => remove(g.id, a.id)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-error)', fontWeight: 700, fontSize: '0.8125rem', lineHeight: 1 }}>×</button>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input style={input} type="email" placeholder="known alternate email" value={newEmail[g.id] ?? ''} onChange={(e) => setNewEmail((m) => ({ ...m, [g.id]: e.target.value }))} />
            <button type="button" style={outlineBtn} disabled={busy} onClick={() => add(g.id)}>Add known email</button>
          </div>
        </div>
      ))}
      {msg && <p style={{ fontSize: '0.8125rem', color: 'var(--color-error)', margin: '0.5rem 0 0' }}>{msg}</p>}
    </div>
  )
}
