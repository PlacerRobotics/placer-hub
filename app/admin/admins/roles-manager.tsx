'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ADMIN_ROLES, ROLE_LABEL } from '@/lib/auth/roles'

export type AdminRow = {
  id: string
  email: string
  displayName: string
  active: boolean
  roles: { id: string; role: string; program_scope: string | null }[]
}

const card: React.CSSProperties = { backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '1.25rem', marginBottom: '1rem' }
const input: React.CSSProperties = { padding: '8px 10px', fontSize: '0.875rem', border: '1.5px solid var(--color-border)', borderRadius: '6px', fontFamily: 'inherit' }
const navyBtn: React.CSSProperties = { padding: '8px 14px', background: 'var(--color-navy-deep)', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'inherit' }
const pill: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '3px 10px', borderRadius: '999px', backgroundColor: 'var(--color-bg-light)', border: '1px solid var(--color-border)', fontSize: '0.75rem', fontWeight: 600 }

export default function RolesManager({ admins }: { admins: AdminRow[] }) {
  const router = useRouter()
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newRole, setNewRole] = useState('registration_admin')

  async function post(url: string, body: any) {
    setBusy(true); setMsg('')
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setMsg(d.error || 'Action failed.'); return false }
      router.refresh()
      return true
    } catch { setMsg('Network error.'); return false } finally { setBusy(false) }
  }

  return (
    <div>
      <div style={card}>
        <h3 className="text-card-title" style={{ marginBottom: '0.75rem' }}>Add a role by email</h3>
        <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: '0 0 0.875rem' }}>
          The person must have signed in at least once (so they have an account). Granting a role makes them an admin.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input style={{ ...input, minWidth: 240 }} type="email" placeholder="person@email.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
          <select style={input} value={newRole} onChange={(e) => setNewRole(e.target.value)}>
            {ADMIN_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <button type="button" style={navyBtn} disabled={busy || !newEmail.trim()} onClick={async () => { if (await post('/api/admin/admins/grant', { email: newEmail.trim(), role: newRole })) setNewEmail('') }}>
            Grant role
          </button>
          {msg && <span style={{ fontSize: '0.8125rem', color: msg.includes('fail') || msg.includes('No account') || msg.includes('only') ? 'var(--color-error)' : 'var(--color-text-muted)' }}>{msg}</span>}
        </div>
      </div>

      {admins.map((a) => (
        <div key={a.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <span style={{ fontWeight: 600 }}>{a.displayName || a.email}</span>
              {a.displayName && <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem', marginLeft: '0.5rem' }}>{a.email}</span>}
              {!a.active && <span style={{ color: 'var(--color-error)', fontSize: '0.75rem', marginLeft: '0.5rem' }}>(inactive)</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', margin: '0.75rem 0' }}>
            {a.roles.length === 0 ? <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>No roles.</span> :
              a.roles.map((r) => (
                <span key={r.id} style={pill}>
                  {ROLE_LABEL[r.role] ?? r.role}{r.program_scope ? ` · ${r.program_scope}` : ''}
                  <button type="button" title="Revoke" disabled={busy} onClick={() => post('/api/admin/admins/revoke', { assignment_id: r.id })}
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-error)', fontWeight: 700, fontSize: '0.875rem', lineHeight: 1 }}>×</button>
                </span>
              ))}
          </div>
          <GrantToAdmin adminId={a.id} existing={new Set(a.roles.map((r) => r.role))} onGrant={(role) => post('/api/admin/admins/grant', { admin_profile_id: a.id, role })} busy={busy} />
        </div>
      ))}
    </div>
  )
}

function GrantToAdmin({ adminId, existing, onGrant, busy }: { adminId: string; existing: Set<string>; onGrant: (role: string) => void; busy: boolean }) {
  const available = ADMIN_ROLES.filter((r) => !existing.has(r.value))
  const [role, setRole] = useState(available[0]?.value ?? '')
  if (available.length === 0) return null
  return (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
      <select style={input} value={role} onChange={(e) => setRole(e.target.value)}>
        {available.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
      </select>
      <button type="button" style={{ ...navyBtn, padding: '6px 12px' }} disabled={busy || !role} onClick={() => onGrant(role)}>Add role</button>
    </div>
  )
}
