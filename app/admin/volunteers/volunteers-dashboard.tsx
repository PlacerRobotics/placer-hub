'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { StatusBadge } from '@/components/ui'

export type Bucket = 'cleared' | 'renewal_pending' | 'in_progress' | 'denied' | 'deactivated'
export type VolRow = {
  id: string; name: string; email: string; status: string; bucket: Bucket
  doj: boolean; aps: 'valid' | 'expiring' | 'expired' | 'none'; apsExpiry: string | null
  rc: boolean; yp: boolean; waiver: boolean
}

const GREEN = 'var(--color-success)', RED = 'var(--color-error)', YELLOW = '#C9971B', BLUE = 'var(--color-info)', GREY = 'var(--color-text-muted)'
type Variant = 'success' | 'warning' | 'info' | 'error' | 'neutral'
const BUCKET_META: Record<Bucket, { label: string; variant: Variant; color: string }> = {
  cleared: { label: 'Cleared', variant: 'success', color: GREEN },
  renewal_pending: { label: 'Renewal pending', variant: 'info', color: BLUE },
  in_progress: { label: 'In progress', variant: 'warning', color: YELLOW },
  denied: { label: 'Denied', variant: 'error', color: RED },
  deactivated: { label: 'Deactivated', variant: 'neutral', color: GREY },
}
const matchTab = (r: VolRow, t: string) => t === 'all' || r.bucket === t

const cell: React.CSSProperties = { padding: '0.5rem 0.75rem', fontSize: '0.8125rem', borderBottom: '1px solid var(--color-border)', textAlign: 'left', whiteSpace: 'nowrap' }
const th: React.CSSProperties = { ...cell, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.6875rem', color: 'var(--color-text-muted)' }
const card = (active: boolean, accent: string): React.CSSProperties => ({ border: `1px solid ${active ? accent : 'var(--color-border)'}`, borderLeft: `4px solid ${accent}`, borderRadius: 8, padding: '0.625rem 0.875rem', minWidth: 120, cursor: 'pointer', background: active ? 'var(--color-surface)' : 'transparent' })
const flag = (ok: boolean) => <span style={{ color: ok ? GREEN : RED, fontWeight: 700 }}>{ok ? '✓' : '✗'}</span>
const primaryBtn: React.CSSProperties = { padding: '6px 12px', backgroundColor: 'var(--color-navy-deep)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'inherit' }
const outlineBtn: React.CSSProperties = { padding: '6px 12px', background: 'none', border: '1px solid var(--color-border)', borderRadius: 6, fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'inherit' }
const dangerBtn: React.CSSProperties = { ...outlineBtn, border: '1px solid var(--color-error)', color: 'var(--color-error)' }

export default function VolunteersDashboard({ rows }: { rows: VolRow[] }) {
  const router = useRouter()
  const [tab, setTab] = useState('all')
  const [q, setQ] = useState('')

  const [sel, setSel] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const count = (t: string) => rows.filter((r) => matchTab(r, t)).length
  const s = q.trim().toLowerCase()
  const filtered = rows.filter((r) => matchTab(r, tab) && (!s || r.name.toLowerCase().includes(s) || r.email.toLowerCase().includes(s)))

  const filteredIds = filtered.map((r) => r.id)
  const allSelected = filteredIds.length > 0 && filteredIds.every((id) => sel.has(id))
  function toggleSel(id: string) { setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n }) }
  function toggleAll() { setSel((p) => { const n = new Set(p); if (allSelected) filteredIds.forEach((id) => n.delete(id)); else filteredIds.forEach((id) => n.add(id)); return n }) }
  async function runBulk(action: string, label: string) {
    if (!sel.size || busy) return
    const confirmActions = ['doj_complete', 'mark_cleared', 'deny', 'deactivate', 'reactivate', 'orientation_done']
    if (confirmActions.includes(action) && !confirm(`Apply “${label}” to ${sel.size} volunteer(s)?`)) return
    setBusy(true); setMsg('')
    try {
      const res = await fetch('/api/admin/volunteers/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ volunteerIds: [...sel], action }) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setMsg(d.error || 'Action failed.'); setBusy(false); return }
      if (typeof d.processed === 'number') setMsg(`${label}: ${d.processed} volunteer(s) updated.`)
      else if (d.emailDisabled) setMsg(`Email isn’t configured yet (RESEND_API_KEY) — ${d.failed} would have been notified (${label}).`)
      else setMsg(`${label}: ${d.emailed} emailed${d.skipped ? `, ${d.skipped} skipped` : ''}${d.failed ? `, ${d.failed} failed` : ''}.`)
      setSel(new Set()); router.refresh()
    } catch { setMsg('Network error.') } finally { setBusy(false) }
  }

  const STATS: [string, string, string][] = [
    ['all', 'Total', GREY],
    ['cleared', 'Cleared', GREEN],
    ['renewal_pending', 'Renewal pending', BLUE],
    ['in_progress', 'In progress', YELLOW],
    ['denied', 'Denied', RED],
    ['deactivated', 'Deactivated', GREY],
  ]

  function aps(r: VolRow) {
    const d = r.apsExpiry ? new Date(r.apsExpiry).toLocaleDateString() : ''
    if (r.aps === 'valid') return <span style={{ color: GREEN, fontWeight: 600 }}>✓ {d}</span>
    if (r.aps === 'expiring') return <span style={{ color: YELLOW, fontWeight: 600 }}>⚠ {d}</span>
    if (r.aps === 'expired') return <span style={{ color: RED, fontWeight: 600 }}>✗ exp {d}</span>
    return <span style={{ color: RED, fontWeight: 600 }}>✗ none</span>
  }

  return (
    <>
      <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        {STATS.map(([t, label, accent]) => (
          <div key={t} style={card(tab === t, accent)} onClick={() => setTab(t)}>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-navy-deep)' }}>{count(t)}</div>
            <div style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--color-text-muted)', fontWeight: 700 }}>{label}</div>
          </div>
        ))}
      </div>

      <input
        placeholder="Search by name or email…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ width: '100%', maxWidth: 360, padding: '8px 11px', fontSize: '0.875rem', border: '1.5px solid var(--color-border)', borderRadius: 6, marginBottom: '0.75rem', fontFamily: 'inherit' }}
      />
      <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: '0.625rem' }}>
        Showing {filtered.length} {tab === 'all' ? 'volunteers' : `· ${tab.replace(/_/g, ' ')}`} · APS must be valid through the season end (5/31/2027)
      </div>

      {sel.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap', marginBottom: '0.75rem', padding: '0.625rem 0.875rem', background: 'var(--color-surface)', border: '1px solid var(--color-navy-deep)', borderRadius: 8 }}>
          <span style={{ fontSize: '0.8125rem', fontWeight: 700 }}>{sel.size} selected</span>
          <button type="button" onClick={() => runBulk('doj_complete', 'DOJ complete')} disabled={busy} style={primaryBtn}>Mark DOJ complete</button>
          <button type="button" onClick={() => runBulk('mark_cleared', 'Mark cleared')} disabled={busy} style={primaryBtn}>Mark cleared</button>
          <button type="button" onClick={() => runBulk('orientation_done', 'Orientation done')} disabled={busy} style={outlineBtn}>Orientation done</button>
          <button type="button" onClick={() => runBulk('notify_waiver', 'Waiver reminder')} disabled={busy} style={outlineBtn}>Notify: sign waiver</button>
          <button type="button" onClick={() => runBulk('notify_aps', 'APS reminder')} disabled={busy} style={outlineBtn}>Notify: APS expiring</button>
          <button type="button" onClick={() => runBulk('reactivate', 'Reactivate')} disabled={busy} style={outlineBtn}>Reactivate</button>
          <button type="button" onClick={() => runBulk('deny', 'Deny')} disabled={busy} style={dangerBtn}>Deny</button>
          <button type="button" onClick={() => runBulk('deactivate', 'Deactivate')} disabled={busy} style={dangerBtn}>Deactivate</button>
          <button type="button" onClick={() => setSel(new Set())} disabled={busy} style={{ ...outlineBtn, marginLeft: 'auto' }}>Clear</button>
        </div>
      )}
      {msg && <div style={{ fontSize: '0.8125rem', color: 'var(--color-navy-deep)', fontWeight: 600, marginBottom: '0.625rem' }}>{msg}</div>}

      <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'var(--color-surface)' }}>
          <thead><tr><th style={th}><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all" /></th><th style={th}></th><th style={th}>Volunteer</th><th style={th}>Status</th><th style={th}>DOJ</th><th style={th}>APS</th><th style={th}>RC quiz</th><th style={th}>YP quiz</th><th style={th}>Waiver</th><th style={th}></th></tr></thead>
          <tbody>
            {filtered.length === 0 ? <tr><td style={cell} colSpan={10}>No volunteers in this view.</td></tr> : filtered.map((r) => (
              <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => router.push(`/admin/volunteers/${r.id}`)}>
                <td style={cell} onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={sel.has(r.id)} onChange={() => toggleSel(r.id)} aria-label={`Select ${r.name}`} /></td>
                <td style={cell}><span style={{ display: 'inline-block', width: 11, height: 11, borderRadius: '50%', background: BUCKET_META[r.bucket].color }} /></td>
                <td style={cell}><div style={{ fontWeight: 600 }}>{r.name}</div><div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{r.email}</div></td>
                <td style={cell}><StatusBadge label={BUCKET_META[r.bucket].label} variant={BUCKET_META[r.bucket].variant} /></td>
                <td style={cell}>{flag(r.doj)}</td>
                <td style={cell}>{aps(r)}</td>
                <td style={cell}>{flag(r.rc)}</td>
                <td style={cell}>{flag(r.yp)}</td>
                <td style={cell}>{flag(r.waiver)}</td>
                <td style={cell}><span style={{ fontWeight: 600, color: 'var(--color-navy-deep)' }}>Review →</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
