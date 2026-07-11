'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { StatusBadge } from '@/components/ui'

export type Team = {
  id: string
  team_number: string | null
  team_name: string | null
  program: string
  division: string
  season: string
  school_org: string
  active: boolean
  is_provisional: boolean
  notes: string | null
  kit_number: string | null
  kit_checkout_date: string | null
  kit_return_date: string | null
  kit_return_verified: boolean
}

const PROGRAM_LABELS: Record<string, string> = { vex_v5: 'VEX V5', vex_iq: 'VEX IQ', combat: 'Combat' }

const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.8125rem', fontWeight: 500, marginBottom: '0.25rem', color: 'var(--color-text-muted)' }
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', fontSize: '0.9375rem', border: '1.5px solid var(--color-border)', borderRadius: '6px', fontFamily: 'inherit', boxSizing: 'border-box', backgroundColor: 'var(--color-surface)' }
const btn: React.CSSProperties = { padding: '7px 14px', border: 'none', borderRadius: '6px', fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'inherit' }

function EditForm({ team, onClose }: { team: Team; onClose: () => void }) {
  const router = useRouter()
  const [f, setF] = useState({
    team_number: team.team_number ?? '',
    team_name: team.team_name ?? '',
    program: team.program,
    division: team.division,
    season: team.season,
    school_org: team.school_org,
    active: team.active,
    notes: team.notes ?? '',
    kit_number: team.kit_number ?? '',
    kit_checkout_date: team.kit_checkout_date ?? '',
    kit_return_date: team.kit_return_date ?? '',
    kit_return_verified: team.kit_return_verified ?? false,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set<K extends keyof typeof f>(k: K, v: (typeof f)[K]) { setF((s) => ({ ...s, [k]: v })) }

  async function save() {
    setSaving(true); setError('')
    try {
      const res = await fetch(`/api/admin/teams/${team.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(f),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Save failed.'); return }
      onClose(); router.refresh()
    } catch { setError('Network error.') } finally { setSaving(false) }
  }

  async function deactivate() {
    if (!confirm('Mark this team inactive? (Soft delete — it can be reactivated by editing.)')) return
    setSaving(true); setError('')
    try {
      const res = await fetch(`/api/admin/teams/${team.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed.'); return }
      onClose(); router.refresh()
    } catch { setError('Network error.') } finally { setSaving(false) }
  }

  return (
    <div style={{ padding: '1rem 1.25rem', backgroundColor: 'var(--color-bg-light)', borderTop: '1px solid var(--color-border)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.875rem' }}>
        <div><label style={labelStyle}>Team number</label><input style={inputStyle} value={f.team_number} onChange={(e) => set('team_number', e.target.value)} /></div>
        <div><label style={labelStyle}>Team name</label><input style={inputStyle} value={f.team_name} onChange={(e) => set('team_name', e.target.value)} /></div>
        <div><label style={labelStyle}>Program</label><select style={inputStyle} value={f.program} onChange={(e) => set('program', e.target.value)}><option value="vex_v5">VEX V5</option><option value="vex_iq">VEX IQ</option><option value="combat">Combat</option></select></div>
        <div><label style={labelStyle}>Division</label><select style={inputStyle} value={f.division} onChange={(e) => set('division', e.target.value)}><option value="ES">Elementary</option><option value="MS">Middle</option><option value="HS">High</option></select></div>
        <div><label style={labelStyle}>Season</label><input style={inputStyle} value={f.season} onChange={(e) => set('season', e.target.value)} /></div>
        <div><label style={labelStyle}>School / org</label><input style={inputStyle} value={f.school_org} onChange={(e) => set('school_org', e.target.value)} /></div>
      </div>
      <div style={{ marginTop: '0.875rem' }}>
        <label style={labelStyle}>Notes</label>
        <textarea style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }} value={f.notes} onChange={(e) => set('notes', e.target.value)} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.875rem', marginTop: '0.875rem' }}>
        <div><label style={labelStyle}>Kit number</label><input style={inputStyle} value={f.kit_number} onChange={(e) => set('kit_number', e.target.value)} placeholder="e.g. K-0042" /></div>
        <div><label style={labelStyle}>Kit checked out</label><input type="date" style={inputStyle} value={f.kit_checkout_date} onChange={(e) => set('kit_checkout_date', e.target.value)} /></div>
        <div><label style={labelStyle}>Kit returned</label><input type="date" style={inputStyle} value={f.kit_return_date} onChange={(e) => set('kit_return_date', e.target.value)} /></div>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.875rem', fontSize: '0.9375rem', cursor: 'pointer' }}>
        <input type="checkbox" checked={f.kit_return_verified} onChange={(e) => set('kit_return_verified', e.target.checked)} style={{ width: 16, height: 16 }} />
        Kit returned &amp; verified (close out)
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.875rem', fontSize: '0.9375rem', cursor: 'pointer' }}>
        <input type="checkbox" checked={f.active} onChange={(e) => set('active', e.target.checked)} style={{ width: 16, height: 16 }} />
        Active
      </label>
      {error && <p style={{ color: 'var(--color-error)', fontSize: '0.8125rem', marginTop: '0.625rem' }}>{error}</p>}
      <div style={{ display: 'flex', gap: '0.625rem', marginTop: '1rem', alignItems: 'center' }}>
        <button type="button" onClick={save} disabled={saving} style={{ ...btn, backgroundColor: 'var(--color-gold)', color: 'var(--color-navy-darker)' }}>{saving ? 'Saving…' : 'Save'}</button>
        <button type="button" onClick={onClose} disabled={saving} style={{ ...btn, backgroundColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>Cancel</button>
        <button type="button" onClick={deactivate} disabled={saving} style={{ ...btn, backgroundColor: 'transparent', color: 'var(--color-error)', marginLeft: 'auto' }}>Deactivate</button>
      </div>
    </div>
  )
}

export function TeamRows({ teams }: { teams: Team[] }) {
  const [editing, setEditing] = useState<string | null>(null)

  return (
    <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', overflow: 'hidden' }}>
      {teams.map((t, i) => (
        <div key={t.id} style={{ borderBottom: i < teams.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.875rem 1.25rem' }}>
            <div>
              <div style={{ fontSize: '0.9375rem', fontWeight: 500 }}>{t.team_name || t.team_number || 'Unnamed team'}</div>
              <div className="text-help">{PROGRAM_LABELS[t.program] ?? t.program} · {t.division} · {t.school_org} · Kit {t.kit_number || '—'}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
              {t.is_provisional && <StatusBadge label="provisional — needs re-confirmation" variant="warning" />}
              {t.kit_return_verified && <StatusBadge label="kit returned" variant="success" />}
              <StatusBadge label={t.active ? 'active' : 'inactive'} variant={t.active ? 'success' : 'neutral'} />
              <Link href={`/admin/teams/${t.id}`} style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Coaches →</Link>
              <button type="button" onClick={() => setEditing(editing === t.id ? null : t.id)} style={{ ...btn, backgroundColor: 'var(--color-navy-deep)', color: '#fff' }}>
                {editing === t.id ? 'Close' : 'Edit'}
              </button>
            </div>
          </div>
          {editing === t.id && <EditForm team={t} onClose={() => setEditing(null)} />}
        </div>
      ))}
    </div>
  )
}
