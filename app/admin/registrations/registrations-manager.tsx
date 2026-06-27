'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { StatusBadge } from '@/components/ui'

export type RegRow = {
  familySeasonId: string
  studentId: string
  name: string
  program: string
  division: string
  teamId: string | null
  teamLabel: string
  school: string
  guardianEmail: string
  guardianLoggedIn: boolean
  status: string
  magicLinkSent: boolean
  lastUpdated: string | null
  fundraisingMethod: string | null
  fundraisingMethods: string[]
  payment: { state: 'paid' | 'partial' | 'unpaid' | 'waived' | 'na'; amount: number | null }
}
export type TeamOpt = { id: string; label: string }

// Payment state → badge. Amount (when known) shows $40 vs the full online donation.
const PAY_META: Record<string, { label: string; bg: string; fg: string }> = {
  paid: { label: 'Paid', bg: '#E3F4E8', fg: '#1E7C3D' },
  partial: { label: 'Partial', bg: '#FBF1D6', fg: '#8A6D1A' },
  unpaid: { label: 'Unpaid', bg: '#FBE9E9', fg: '#B23A3A' },
  waived: { label: 'Waived', bg: '#ECECEC', fg: '#555555' },
}
function payCell(p: RegRow['payment']) {
  if (p.state === 'na') return <span title="VEX IQ — coach pays the team fee" style={{ color: 'var(--color-text-muted)' }}>—</span>
  const m = PAY_META[p.state]
  const amt = (p.state === 'paid' || p.state === 'partial') && p.amount != null ? ` $${Number(p.amount).toLocaleString()}` : ''
  return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: '0.6875rem', fontWeight: 700, backgroundColor: m.bg, color: m.fg }}>{m.label}{amt}</span>
}
const PAY_FILTERS: [string, string][] = [['all', 'Payment: all'], ['paid', 'Paid'], ['partial', 'Partial'], ['unpaid', 'Unpaid'], ['waived', 'Waived'], ['na', 'IQ (coach pays)']]

// Fundraising method → compact badge (colors per spec: Direct blue, Match purple,
// Sponsor gold, Check gray, Aid yellow). Custom palette — StatusBadge lacks purple/gold.
const FUND_BADGE: Record<string, { label: string; bg: string; fg: string }> = {
  direct_donation: { label: 'Direct', bg: '#E6F0FB', fg: '#1B5FA8' },
  corporate_match: { label: 'Match', bg: '#F0E8FB', fg: '#6B3FA0' },
  sponsored: { label: 'Sponsor', bg: '#FBF1D6', fg: '#8A6D1A' },
  paper_check: { label: 'Check', bg: '#ECECEC', fg: '#555555' },
  pending: { label: 'Aid', bg: '#FFF8E6', fg: '#8A6D1A' },
}
function fundBadge(m: string) {
  const b = FUND_BADGE[m]
  if (!b) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>
  return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: '0.6875rem', fontWeight: 700, backgroundColor: b.bg, color: b.fg }}>{b.label}</span>
}
function fundBadges(methods: string[]) {
  if (!methods.length) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>
  return <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>{methods.map((m) => <span key={m}>{fundBadge(m)}</span>)}</span>
}
const FUND_FILTERS: [string, string][] = [
  ['all', 'Fundraising: all'], ['direct_donation', 'Direct'], ['corporate_match', 'Match'],
  ['sponsored', 'Sponsor'], ['paper_check', 'Check'], ['pending', 'Aid'], ['not_selected', 'Not Selected'],
]

const PROGRAM_LABELS: Record<string, string> = {
  vex_v5: 'VEX V5', combat: 'Combat', both: 'VEX V5 & Combat', vex_iq: 'VEX IQ', not_sure: 'Not sure',
}
const STATUS_LABELS: Record<string, string> = {
  cleared_to_register: 'Cleared to Register', registered: 'Registered', cancelled: 'Cancelled', applied: 'Applied', suspended: 'Suspended',
}
const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'error' | 'info' | 'neutral'> = {
  cleared_to_register: 'info', registered: 'success', cancelled: 'neutral', applied: 'warning', suspended: 'error',
}

const sel: React.CSSProperties = { padding: '7px 9px', fontSize: '0.8125rem', border: '1.5px solid var(--color-border)', borderRadius: '6px', fontFamily: 'inherit', backgroundColor: 'var(--color-surface)' }
const cell: React.CSSProperties = { padding: '0.6rem 0.75rem', fontSize: '0.8125rem', borderBottom: '1px solid var(--color-border)', textAlign: 'left', verticalAlign: 'middle' }
const th: React.CSSProperties = { ...cell, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', fontSize: '0.6875rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }
const btn: React.CSSProperties = { padding: '4px 9px', fontSize: '0.75rem', fontWeight: 600, border: '1px solid var(--color-border)', borderRadius: '5px', background: 'var(--color-surface)', cursor: 'pointer', fontFamily: 'inherit' }

export default function RegistrationsManager({ rows, teams, schools }: { rows: RegRow[]; teams: TeamOpt[]; schools: string[] }) {
  const router = useRouter()
  const [fStatus, setFStatus] = useState('all')
  const [fProgram, setFProgram] = useState('all')
  const [fDivision, setFDivision] = useState('all')
  const [fTeam, setFTeam] = useState('all')
  const [fSchool, setFSchool] = useState('all')
  const [fMagic, setFMagic] = useState('all')
  const [fLogin, setFLogin] = useState('all')
  const [fFund, setFFund] = useState('all')
  const [fPay, setFPay] = useState('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [assignTeam, setAssignTeam] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (fStatus !== 'all' && r.status !== fStatus) return false
        if (fProgram !== 'all' && r.program !== fProgram) return false
        if (fDivision !== 'all' && r.division !== fDivision) return false
        if (fTeam !== 'all' && r.teamId !== fTeam) return false
        if (fSchool !== 'all' && r.school !== fSchool) return false
        if (fMagic === 'sent' && !r.magicLinkSent) return false
        if (fMagic === 'not_sent' && r.magicLinkSent) return false
        if (fLogin === 'logged_in' && !r.guardianLoggedIn) return false
        if (fLogin === 'never' && r.guardianLoggedIn) return false
        if (fFund === 'not_selected' && r.fundraisingMethods.length) return false
        if (fFund !== 'all' && fFund !== 'not_selected' && !r.fundraisingMethods.includes(fFund)) return false
        if (fPay !== 'all' && r.payment.state !== fPay) return false
        if (search.trim()) {
          const q = search.toLowerCase()
          if (!r.name.toLowerCase().includes(q) && !r.guardianEmail.toLowerCase().includes(q)) return false
        }
        return true
      }),
    [rows, fStatus, fProgram, fDivision, fTeam, fSchool, fMagic, fLogin, fFund, fPay, search]
  )

  const selectedRows = filtered.filter((r) => selected.has(r.studentId))

  function toggle(id: string) {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleAll() {
    setSelected((s) => (selectedRows.length === filtered.length ? new Set() : new Set(filtered.map((r) => r.studentId))))
  }

  async function call(url: string, body?: any, method = 'POST') {
    setBusy(true); setMsg('')
    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setMsg(data.error || 'Action failed.'); return null }
      router.refresh()
      return data
    } catch { setMsg('Network error.'); return null } finally { setBusy(false) }
  }

  async function bulk(action: 'send_invites' | 'cancel' | 'assign_team') {
    if (!selectedRows.length) return
    if (action === 'send_invites') {
      const eligible = selectedRows.filter((r) => r.status === 'cleared_to_register' && !r.magicLinkSent)
      const guardians = new Set(eligible.map((r) => r.guardianEmail).filter((e) => e && e !== '—')).size
      if (!guardians) { setMsg('No eligible rows (cleared & not yet invited).'); return }
      if (!confirm(`This will send magic links to ${guardians} guardians. Continue?`)) return
      const ids = [...new Set(eligible.map((r) => r.familySeasonId).filter(Boolean))]
      const d = await call('/api/admin/registrations/bulk', { action, ids })
      if (d) {
        const fails: string[] = d.failures ?? []
        setMsg(fails.length
          ? `Sent ${d.sent ?? 0} invite(s). ${fails.length} failed: ${fails.join('; ')}`
          : `Sent ${d.sent ?? 0} invite(s).`)
        setSelected(new Set())
      }
    } else if (action === 'cancel') {
      if (!confirm(`Cancel ${selectedRows.length} selected registration(s)?`)) return
      const ids = [...new Set(selectedRows.map((r) => r.familySeasonId).filter(Boolean))]
      const d = await call('/api/admin/registrations/bulk', { action, ids })
      if (d) { setMsg(`Cancelled ${d.cancelled ?? 0}.`); setSelected(new Set()) }
    } else if (action === 'assign_team') {
      if (!assignTeam) { setMsg('Pick a team first.'); return }
      const ids = selectedRows.map((r) => r.studentId)
      const d = await call('/api/admin/registrations/bulk', { action, ids, team_id: assignTeam })
      if (d) { setMsg(`Assigned ${d.assigned ?? 0}${d.skipped?.length ? `, ${d.skipped.length} skipped (not registered)` : ''}.`); setSelected(new Set()) }
    }
  }

  function exportCsv() {
    const headers = ['Student', 'Program', 'Division', 'Team', 'School', 'Guardian Email', 'Status', 'Fundraising', 'Paid', 'Amount Paid', 'Magic Link', 'Login', 'Last Updated']
    const lines = [headers.join(',')]
    for (const r of filtered) {
      const vals = [
        r.name, PROGRAM_LABELS[r.program] ?? r.program, r.division, r.teamLabel, r.school, r.guardianEmail,
        STATUS_LABELS[r.status] ?? r.status, r.fundraisingMethods.length ? r.fundraisingMethods.map((m) => FUND_BADGE[m]?.label ?? m).join(' + ') : 'Not selected',
        r.payment.state === 'na' ? 'IQ (coach pays)' : (PAY_META[r.payment.state]?.label ?? r.payment.state),
        r.payment.amount != null ? r.payment.amount : '',
        r.magicLinkSent ? 'Sent' : 'Not sent',
        r.guardianLoggedIn ? 'Logged in' : r.magicLinkSent ? 'Invited' : 'Not invited',
        r.lastUpdated ? new Date(r.lastUpdated).toLocaleDateString() : '',
      ].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
      lines.push(vals.join(','))
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `registrations-filtered-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  function dot(r: RegRow) {
    const color = r.guardianLoggedIn ? 'var(--color-success)' : r.magicLinkSent ? 'var(--color-gold)' : 'var(--color-text-muted)'
    const title = r.guardianLoggedIn ? 'Logged in' : r.magicLinkSent ? 'Invite sent, not logged in' : 'Not invited'
    return <span title={title} style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', backgroundColor: color }} />
  }

  const allChecked = filtered.length > 0 && selectedRows.length === filtered.length

  return (
    <div>
      {/* Filter bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
        <input placeholder="Search name or email…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ ...sel, minWidth: 200 }} />
        <select style={sel} value={fStatus} onChange={(e) => setFStatus(e.target.value)}><option value="all">All statuses</option><option value="cleared_to_register">Cleared to Register</option><option value="registered">Registered</option><option value="applied">Applied</option><option value="suspended">Suspended</option><option value="cancelled">Cancelled</option></select>
        <select style={sel} value={fProgram} onChange={(e) => setFProgram(e.target.value)}><option value="all">All programs</option><option value="vex_v5">VEX V5</option><option value="combat">Combat</option><option value="both">Both</option><option value="vex_iq">VEX IQ</option></select>
        <select style={sel} value={fDivision} onChange={(e) => setFDivision(e.target.value)}><option value="all">All divisions</option><option value="ES">ES</option><option value="MS">MS</option><option value="HS">HS</option></select>
        <select style={sel} value={fTeam} onChange={(e) => setFTeam(e.target.value)}><option value="all">All teams</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select>
        <select style={sel} value={fSchool} onChange={(e) => setFSchool(e.target.value)}><option value="all">All schools</option>{schools.map((s) => <option key={s} value={s}>{s}</option>)}</select>
        <select style={sel} value={fMagic} onChange={(e) => setFMagic(e.target.value)}><option value="all">Magic link: all</option><option value="sent">Sent</option><option value="not_sent">Not sent</option></select>
        <select style={sel} value={fLogin} onChange={(e) => setFLogin(e.target.value)}><option value="all">Login: all</option><option value="logged_in">Logged in</option><option value="never">Never</option></select>
        <select style={sel} value={fFund} onChange={(e) => setFFund(e.target.value)}>{FUND_FILTERS.map(([v, lbl]) => <option key={v} value={v}>{lbl}</option>)}</select>
        <select style={sel} value={fPay} onChange={(e) => setFPay(e.target.value)}>{PAY_FILTERS.map(([v, lbl]) => <option key={v} value={v}>{lbl}</option>)}</select>
        <button type="button" onClick={exportCsv} style={{ ...btn, padding: '7px 12px' }}>Export Filtered</button>
      </div>

      {/* Bulk action bar */}
      {selectedRows.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.625rem', alignItems: 'center', padding: '0.75rem 1rem', marginBottom: '1rem', backgroundColor: 'var(--color-bg-light)', border: '1px solid var(--color-border)', borderRadius: '8px' }}>
          <strong style={{ fontSize: '0.875rem' }}>{selectedRows.length} selected</strong>
          <button type="button" disabled={busy} onClick={() => bulk('send_invites')} style={{ ...btn, backgroundColor: 'var(--color-gold)', color: 'var(--color-navy-darker)', borderColor: 'transparent' }}>Send Magic Links</button>
          <button type="button" disabled={busy} onClick={() => bulk('cancel')} style={{ ...btn, color: 'var(--color-error)' }}>Cancel Selected</button>
          <span style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
            <select style={sel} value={assignTeam} onChange={(e) => setAssignTeam(e.target.value)}><option value="">Assign team…</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select>
            <button type="button" disabled={busy || !assignTeam} onClick={() => bulk('assign_team')} style={btn}>Assign</button>
          </span>
        </div>
      )}
      {msg && <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>{msg}</p>}

      {/* Table */}
      <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: '10px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'var(--color-surface)' }}>
          <thead>
            <tr>
              <th style={{ ...th, width: 28 }}><input type="checkbox" checked={allChecked} onChange={toggleAll} /></th>
              <th style={th}>Student</th><th style={th}>Program</th><th style={th}>Div</th><th style={th}>Team</th><th style={th}>School</th><th style={th}>Guardian</th><th style={th}>Status</th><th style={th}>Fundraising</th><th style={th}>Paid</th><th style={th}>Magic Link</th><th style={th}>Login</th><th style={th}>Updated</th><th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td style={cell} colSpan={14}>No registrations match these filters.</td></tr>
            ) : filtered.map((r) => (
              <tr key={r.studentId}>
                <td style={cell}><input type="checkbox" checked={selected.has(r.studentId)} onChange={() => toggle(r.studentId)} /></td>
                <td style={cell}>{r.name}</td>
                <td style={cell}>{PROGRAM_LABELS[r.program] ?? r.program}</td>
                <td style={cell}>{r.division}</td>
                <td style={cell}>{r.teamLabel}</td>
                <td style={cell}>{r.school}</td>
                <td style={cell}>{r.guardianEmail}</td>
                <td style={cell}><StatusBadge label={STATUS_LABELS[r.status] ?? r.status} variant={STATUS_VARIANT[r.status] ?? 'neutral'} /></td>
                <td style={cell}>{fundBadges(r.fundraisingMethods)}</td>
                <td style={cell}>{payCell(r.payment)}</td>
                <td style={cell}>{r.magicLinkSent ? 'Sent' : 'Not sent'}</td>
                <td style={cell}>{dot(r)}</td>
                <td style={cell}>{r.lastUpdated ? new Date(r.lastUpdated).toLocaleDateString() : '—'}</td>
                <td style={cell}>
                  <span style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                    <button type="button" style={btn} onClick={() => router.push(`/admin/registrations/${r.familySeasonId}?student=${r.studentId}`)}>View</button>
                    {r.status === 'cleared_to_register' && (
                      <button type="button" disabled={busy} style={btn} onClick={() => call(`/api/admin/registrations/${r.familySeasonId}/send-invite`)}>{r.magicLinkSent ? 'Resend' : 'Send Invite'}</button>
                    )}
                    {r.status !== 'cancelled' && (
                      <button type="button" disabled={busy} style={{ ...btn, color: 'var(--color-error)' }} onClick={() => { if (confirm('Cancel this registration?')) call(`/api/admin/registrations/${r.familySeasonId}/cancel`) }}>Cancel</button>
                    )}
                    {r.status === 'cancelled' && (
                      <button type="button" disabled={busy} style={btn} onClick={() => call(`/api/admin/registrations/${r.familySeasonId}/reinstate`)}>Reinstate</button>
                    )}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
