'use client'

import { useState } from 'react'
import { AdminShell, PageHeader, StatusBadge, ErrorAlert, SuccessAlert, InfoAlert } from '@/components/ui'

type Row = Record<string, string>

function parseCSV(text: string): Row[] {
  const grid: string[][] = []
  let cur: string[] = []
  let field = ''
  let q = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else q = false } else field += ch
    } else if (ch === '"') q = true
    else if (ch === ',') { cur.push(field); field = '' }
    else if (ch === '\n') { cur.push(field); grid.push(cur); cur = []; field = '' }
    else if (ch !== '\r') field += ch
  }
  if (field.length || cur.length) { cur.push(field); grid.push(cur) }
  const header = (grid.shift() ?? []).map((h) => h.trim())
  return grid.filter((r) => r.some((c) => c.trim() !== '')).map((r) => {
    const o: Row = {}
    header.forEach((h, idx) => { o[h] = (r[idx] ?? '').trim() })
    return o
  })
}

function progOf(v: string) {
  const u = (v || '').toUpperCase()
  if (u.includes('V5')) return 'VEX V5'
  if (u.includes('IQ')) return 'VEX IQ'
  if (u.includes('COMBAT')) return 'Combat'
  return '—'
}
function divOf(v: string) {
  const u = (v || '').trim().toLowerCase()
  if (['es', 'elementary', 'elementary school'].includes(u)) return 'ES'
  if (['ms', 'middle', 'm', 'middle school'].includes(u)) return 'MS'
  if (['hs', 'high', 'h', 'high school'].includes(u)) return 'HS'
  return '—'
}

const cell: React.CSSProperties = { padding: '0.5rem 0.75rem', fontSize: '0.8125rem', borderBottom: '1px solid var(--color-border)', textAlign: 'left' }
const th: React.CSSProperties = { ...cell, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.6875rem', color: 'var(--color-text-muted)' }

export default function ImportTeamsPage() {
  const [fileText, setFileText] = useState('')
  const [rows, setRows] = useState<Row[] | null>(null)
  const [parseError, setParseError] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<any>(null)

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setRows(null); setResult(null); setParseError('')
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = () => setFileText(String(reader.result ?? ''))
    reader.readAsText(file)
  }
  function preview() {
    try {
      const parsed = parseCSV(fileText)
      if (!parsed.length) { setParseError('No data rows found.'); return }
      setRows(parsed); setParseError(''); setResult(null)
    } catch { setParseError('Could not parse the CSV.') }
  }
  async function runImport() {
    if (!rows || importing) return
    setImporting(true); setResult(null)
    try {
      const res = await fetch('/api/admin/import-teams', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows }) })
      setResult(await res.json())
    } catch { setResult({ error: 'Import failed — network error.' }) }
    finally { setImporting(false) }
  }

  return (
    <AdminShell activePath="/admin/import-teams">
      <PageHeader title="Import Teams" subtitle="Create or update team records from a CSV. Does not assign students — team assignment happens at registration." />

      <div style={{ marginBottom: '1.25rem' }}>
        <InfoAlert title="Expected columns">
          team_number, team_name, program (V5/IQ/Combat), division (MS/HS), school_org, team_fee_amount (optional). Season is 2026–27. Rows match existing teams on team number + program (update), otherwise create.
        </InfoAlert>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <input type="file" accept=".csv,text/csv" onChange={onFile} />
        <button type="button" onClick={preview} disabled={!fileText} style={{ padding: '8px 16px', backgroundColor: 'var(--color-navy-deep)', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, fontSize: '0.875rem', cursor: fileText ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>Preview</button>
        <button type="button" onClick={runImport} disabled={!rows || importing} style={{ padding: '8px 16px', backgroundColor: 'var(--color-gold)', color: 'var(--color-navy-darker)', border: 'none', borderRadius: '6px', fontWeight: 600, fontSize: '0.875rem', cursor: rows && !importing ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>{importing ? 'Importing…' : 'Run Import'}</button>
      </div>

      {parseError && <div style={{ marginBottom: '1rem' }}><ErrorAlert>{parseError}</ErrorAlert></div>}

      {rows && !result && (
        <>
          <p style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '0.875rem' }}>{rows.length} team row(s)</p>
          <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: '10px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'var(--color-surface)' }}>
              <thead><tr><th style={th}>Team Number</th><th style={th}>Team Name</th><th style={th}>Program</th><th style={th}>Division</th><th style={th}>School / Org</th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td style={cell}>{r['team_number'] || '—'}</td>
                    <td style={cell}>{r['team_name'] || '—'}</td>
                    <td style={cell}>{progOf(r['program'])}</td>
                    <td style={cell}>{divOf(r['division'])}</td>
                    <td style={cell}>{r['school_org'] || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {result && (result.error ? (
        <ErrorAlert title="Import failed">{result.error}</ErrorAlert>
      ) : (
        <>
          <div style={{ marginBottom: '1.25rem' }}>
            <SuccessAlert title="Import complete">
              {result.summary.created} created · {result.summary.updated} updated · {result.summary.errors} errors
            </SuccessAlert>
          </div>
          <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: '10px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'var(--color-surface)' }}>
              <thead><tr><th style={th}>Team</th><th style={th}>Action</th><th style={th}>Status</th></tr></thead>
              <tbody>
                {result.results.map((r: any, i: number) => (
                  <tr key={i}>
                    <td style={cell}>{r.team}</td>
                    <td style={cell}>{r.action}</td>
                    <td style={cell}>
                      {r.status === 'created' ? <StatusBadge label="created" variant="success" />
                        : r.status === 'updated' ? <StatusBadge label="updated" variant="info" />
                        : r.status.startsWith('error') ? <StatusBadge label={r.status} variant="error" />
                        : <StatusBadge label={r.status} variant="neutral" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ))}
    </AdminShell>
  )
}
