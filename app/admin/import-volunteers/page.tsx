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

const yes = (v: any) => ['yes', 'true', 'y', '1', 'x'].includes(String(v ?? '').trim().toLowerCase())
const no = (v: string) => ['', 'no', 'n', 'false', '0'].includes(v.trim().toLowerCase())

// Direct header → canonical-field renames for the volunteer registration CSV.
const DIRECT: Record<string, string> = {
  'First Name': 'first_name',
  'Last Name': 'last_name',
  'Email Address': 'email',
  'Cell Phone': 'phone',
  'Street Address': 'street_address',
  'City': 'city',
  'State / Province': 'state',
  'Postal / Zip Code': 'zip',
  'APS UserID': 'aps_user_id',
  'APS ExternalID': 'aps_external_id',
  'APS Score': 'aps_score',
  'APS Cert Link': 'aps_cert_url',
  'Certificate Expiration Date': 'aps_cert_expiry',
}

// Map a raw CSV row (keyed by the form's column headers) to the canonical fields
// the preview + import API expect. Quizzes/DOJ store completion DATES in this CSV,
// so "has a value" means complete.
function normalizeRow(raw: Row): Row {
  const v = (k: string) => (raw[k] ?? '').trim()
  const o: Row = {}
  for (const [csv, key] of Object.entries(DIRECT)) o[key] = v(csv)

  const rc = v('RC Quiz'); o.rc_quiz_passed = rc ? 'yes' : ''; o.rc_quiz_passed_date = rc
  const yp = v('AB506 YP Quiz'); o.yp_quiz_passed = yp ? 'yes' : ''; o.yp_quiz_passed_date = yp
  o.doj_cleared = no(v('DOJ Clear')) ? '' : 'yes'
  o.approved = (yes(v('Approved!')) || yes(v('Ready to Approve'))) ? 'yes' : ''
  o.is_returning = v('Are you a returning volunteer')
  o.has_door_access = v('Do you currently have robotics center door access via card or app?')

  const role = v('Are you a V5 Coach?')
  o.primary_role = no(role) ? '' : role
  const progs: string[] = []
  if (v('IQ Team')) progs.push('VEX IQ')
  if (v('V5 Team') || o.primary_role) progs.push('VEX V5')
  o.programs = progs.join(', ')
  return o
}
const cell: React.CSSProperties = { padding: '0.5rem 0.75rem', fontSize: '0.8125rem', borderBottom: '1px solid var(--color-border)', textAlign: 'left', whiteSpace: 'nowrap' }
const th: React.CSSProperties = { ...cell, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.6875rem', color: 'var(--color-text-muted)' }

export default function ImportVolunteersPage() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [parseError, setParseError] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [fileText, setFileText] = useState('')

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setRows(null); setResult(null); setParseError('')
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setFileText(String(reader.result ?? ''))
    reader.readAsText(file)
  }

  function preview() {
    try {
      const parsed = parseCSV(fileText).map(normalizeRow)
      if (!parsed.length) { setParseError('No data rows found.'); return }
      setRows(parsed); setParseError(''); setResult(null)
    } catch { setParseError('Could not parse the CSV.') }
  }

  async function runImport() {
    if (!rows || importing) return
    setImporting(true); setResult(null)
    try {
      const res = await fetch('/api/admin/import-volunteers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows }) })
      setResult(await res.json())
    } catch { setResult({ error: 'Import failed — network error.' }) } finally { setImporting(false) }
  }

  return (
    <AdminShell activePath="/admin/import-volunteers">
      <PageHeader title="Import Volunteers" subtitle="Create/update volunteers + their clearance from a CSV. No magic links are sent." />
      <div style={{ marginBottom: '1.25rem' }}>
        <InfoAlert title="Records only · teams untouched">
          Maps to the existing guardian-linked model: identity (guardian/family), per-season clearance (quizzes, key access,
          status), APS cert, and DOJ. Team assignments are managed separately in Teams — this import never changes them.
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
          <p style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '0.875rem' }}>{rows.length} volunteer row(s) ready</p>
          <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: '10px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'var(--color-surface)' }}>
              <thead><tr><th style={th}>Name</th><th style={th}>Email</th><th style={th}>Programs</th><th style={th}>Role</th><th style={th}>DOJ</th><th style={th}>APS Expiry</th><th style={th}>RC Quiz</th><th style={th}>YP Quiz</th><th style={th}>Approved</th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td style={cell}>{r.first_name} {r.last_name}</td>
                    <td style={cell}>{r.email}</td>
                    <td style={cell}>{r.programs || '—'}</td>
                    <td style={cell}>{r.primary_role || '—'}</td>
                    <td style={cell}>{yes(r.doj_cleared) ? '✓' : '—'}</td>
                    <td style={cell}>{r.aps_cert_expiry || '—'}</td>
                    <td style={cell}>{yes(r.rc_quiz_passed) ? `✓ ${r.rc_quiz_score || ''}` : '—'}</td>
                    <td style={cell}>{yes(r.yp_quiz_passed) ? `✓ ${r.yp_quiz_score || ''}` : '—'}</td>
                    <td style={cell}>{yes(r.approved) ? '✓' : '—'}</td>
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
              {result.summary.volunteersCreated} created · {result.summary.volunteersUpdated} updated · {result.summary.clearances} clearances · {result.summary.errors} errors
            </SuccessAlert>
          </div>
          <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: '10px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'var(--color-surface)' }}>
              <thead><tr><th style={th}>Name</th><th style={th}>Email</th><th style={th}>Result</th></tr></thead>
              <tbody>
                {result.results.map((r: any, i: number) => (
                  <tr key={i}>
                    <td style={cell}>{r.name}</td>
                    <td style={cell}>{r.email}</td>
                    <td style={cell}>{r.status.startsWith('error') || r.status.startsWith('skipped') ? <StatusBadge label={r.status} variant={r.status.startsWith('error') ? 'error' : 'neutral'} /> : <StatusBadge label={r.status} variant="success" />}</td>
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
