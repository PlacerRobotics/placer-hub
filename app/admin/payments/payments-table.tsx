'use client'

import { useMemo, useState } from 'react'
import { StatusBadge } from '@/components/ui'

export type PaymentRow = {
  id: string; payer: string; type: string; source: string
  amount: number; date: string | null; deposited: string | null; matched: string; ref: string
}

const TYPE_LABELS: Record<string, string> = { registration_fee: 'Registration', iq_team_fee: 'IQ team fee', fundraising: 'Fundraising', sponsorship: 'Sponsorship', in_kind: 'In-kind', unknown: 'Unknown' }
const TYPE_TABS: [string, string][] = [['all', 'All'], ['registration_fee', 'Registration'], ['iq_team_fee', 'IQ team'], ['fundraising', 'Fundraising'], ['sponsorship', 'Sponsorship']]
const MATCHED = new Set(['auto_matched', 'manually_matched'])
const MATCH_VARIANT: Record<string, 'success' | 'warning' | 'neutral'> = { auto_matched: 'success', manually_matched: 'success', unmatched: 'warning', needs_review: 'warning', ignored: 'neutral' }

const cell: React.CSSProperties = { padding: '0.5rem 0.75rem', fontSize: '0.8125rem', borderBottom: '1px solid var(--color-border)', textAlign: 'left', whiteSpace: 'nowrap' }
const th: React.CSSProperties = { ...cell, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.6875rem', color: 'var(--color-text-muted)' }
const tab = (active: boolean): React.CSSProperties => ({ padding: '6px 12px', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid var(--color-border)', background: active ? 'var(--color-navy-deep)' : 'transparent', color: active ? '#fff' : 'var(--color-text-primary)' })
const card: React.CSSProperties = { border: '1px solid var(--color-border)', borderRadius: 8, padding: '0.75rem 1rem', minWidth: 130 }

export default function PaymentsTable({ rows }: { rows: PaymentRow[] }) {
  const [type, setType] = useState('all')
  const [status, setStatus] = useState('all')

  const summary = useMemo(() => {
    const s: Record<string, { total: number; count: number }> = {}
    for (const r of rows) { (s[r.type] ??= { total: 0, count: 0 }); s[r.type].total += r.amount; s[r.type].count++ }
    return s
  }, [rows])
  const unmatched = rows.filter((r) => !MATCHED.has(r.matched)).length

  const filtered = rows.filter((r) => {
    if (type !== 'all' && r.type !== type) return false
    if (status === 'matched' && !MATCHED.has(r.matched)) return false
    if (status === 'unmatched' && MATCHED.has(r.matched)) return false
    return true
  })
  const filteredTotal = filtered.reduce((t, r) => t + r.amount, 0)

  return (
    <>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        {['registration_fee', 'iq_team_fee', 'fundraising', 'sponsorship'].map((t) => (
          <div key={t} style={card}>
            <div style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)', fontWeight: 700 }}>{TYPE_LABELS[t]}</div>
            <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-navy-deep)' }}>${(summary[t]?.total ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{summary[t]?.count ?? 0} payment{(summary[t]?.count ?? 0) === 1 ? '' : 's'}</div>
          </div>
        ))}
        <div style={{ ...card, borderColor: unmatched ? 'var(--color-warning)' : 'var(--color-border)' }}>
          <div style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)', fontWeight: 700 }}>Unmatched</div>
          <div style={{ fontSize: '1.125rem', fontWeight: 700, color: unmatched ? '#C9971B' : 'var(--color-navy-deep)' }}>{unmatched}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>need matching</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.875rem' }}>
        {TYPE_TABS.map(([t, l]) => <button key={t} type="button" onClick={() => setType(t)} style={tab(type === t)}>{l}</button>)}
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ marginLeft: 'auto', padding: '6px 10px', borderRadius: 6, border: '1.5px solid var(--color-border)', fontFamily: 'inherit', fontSize: '0.8125rem', backgroundColor: 'var(--color-surface)' }}>
          <option value="all">All statuses</option>
          <option value="matched">Matched</option>
          <option value="unmatched">Unmatched</option>
        </select>
      </div>
      <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: '0.625rem' }}>{filtered.length} payments · ${filteredTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>

      <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'var(--color-surface)' }}>
          <thead><tr><th style={th}>Payer</th><th style={th}>Type</th><th style={th}>Source</th><th style={th}>Amount</th><th style={th}>Received</th><th style={th}>Deposited</th><th style={th}>Status</th><th style={th}>Ref</th></tr></thead>
          <tbody>
            {filtered.length === 0 ? <tr><td style={cell} colSpan={8}>No payments match.</td></tr> : filtered.map((r) => (
              <tr key={r.id}>
                <td style={cell}>{r.payer}</td>
                <td style={cell}>{TYPE_LABELS[r.type] ?? r.type}</td>
                <td style={cell}>{r.source}</td>
                <td style={cell}>${r.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td style={cell}>{r.date ? new Date(r.date).toLocaleDateString() : '—'}</td>
                <td style={cell}>{r.deposited ? new Date(r.deposited).toLocaleDateString() : '—'}</td>
                <td style={cell}><StatusBadge label={r.matched.replace(/_/g, ' ')} variant={MATCH_VARIANT[r.matched] ?? 'neutral'} /></td>
                <td style={cell}>{r.ref || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
