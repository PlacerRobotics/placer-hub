'use client'

import { useState } from 'react'
import { AdminShell, PageHeader, StatusBadge, ErrorAlert, SuccessAlert, InfoAlert, WarningAlert } from '@/components/ui'

// Flip to true ONLY after the end-to-end flow has been tested in production.
const SEND_INVITES_ENABLED = false

type Row = Record<string, string>

function parseCSV(text: string): Row[] {
  const grid: string[][] = []
  let cur: string[] = []
  let field = ''
  let q = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (q) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else q = false
      } else field += ch
    } else if (ch === '"') q = true
    else if (ch === ',') { cur.push(field); field = '' }
    else if (ch === '\n') { cur.push(field); grid.push(cur); cur = []; field = '' }
    else if (ch !== '\r') field += ch
  }
  if (field.length || cur.length) { cur.push(field); grid.push(cur) }
  const header = (grid.shift() ?? []).map((h) => h.trim())
  return grid
    .filter((r) => r.some((c) => c.trim() !== ''))
    .map((r) => {
      const o: Row = {}
      header.forEach((h, idx) => { o[h] = (r[idx] ?? '').trim() })
      return o
    })
}

const PROGRAM_LABELS: Record<string, string> = { vex_v5: 'VEX V5', combat: 'Combat', vex_iq: 'VEX IQ' }
const cell: React.CSSProperties = { padding: '0.5rem 0.75rem', fontSize: '0.8125rem', borderBottom: '1px solid var(--color-border)', textAlign: 'left' }
const th: React.CSSProperties = { ...cell, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.6875rem', color: 'var(--color-text-muted)' }

export default function ImportPage() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [parseError, setParseError] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<string>('')
  const [fileText, setFileText] = useState<string>('')

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setRows(null); setResult(null); setParseError(''); setSendResult('')
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setFileText(String(reader.result ?? ''))
    reader.readAsText(file)
  }

  function preview() {
    try {
      const parsed = parseCSV(fileText)
      if (!parsed.length) { setParseError('No data rows found in the file.'); return }
      setRows(parsed); setParseError(''); setResult(null)
    } catch {
      setParseError('Could not parse the CSV.')
    }
  }

  const counts = rows
    ? (() => {
        const c = { invite: 0, hold: 0, skip: 0, duplicates: 0 }
        const seen = new Set<string>()
        for (const r of rows) {
          const a = (r.import_action || 'invite').toLowerCase()
          if (a === 'skip') c.skip++
          else if (a === 'hold') c.hold++
          else c.invite++
          const key = `${(r.student_email || `${r.student_first_name} ${r.student_last_name}`).toLowerCase()}|${(r.program_26_27 || '').toLowerCase()}`
          if (seen.has(key)) c.duplicates++
          else seen.add(key)
        }
        return c
      })()
    : null

  async function runImport() {
    if (!rows || importing) return
    setImporting(true); setResult(null)
    try {
      const res = await fetch('/api/admin/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      })
      const data = await res.json()
      setResult(data)
    } catch {
      setResult({ error: 'Import failed — network error.' })
    } finally {
      setImporting(false)
    }
  }

  async function sendInvites() {
    if (!SEND_INVITES_ENABLED || sending) return
    setSending(true); setSendResult('')
    try {
      const res = await fetch('/api/admin/import/send-invites', { method: 'POST' })
      const data = await res.json()
      setSendResult(res.ok ? `Sent ${data.sent} invite(s).` : data.error || 'Failed.')
    } catch {
      setSendResult('Network error.')
    } finally {
      setSending(false)
    }
  }

  return (
    <AdminShell activePath="/admin/import">
      <PageHeader title="Bulk Import" subtitle="Create records from a CSV. No magic links are ever sent during import." />

      <div style={{ marginBottom: '1.25rem' }}>
        <InfoAlert title="Records only">
          Import creates families, students, applications, and family-season records. It never emails
          anyone. Invites are sent separately, only after you enable the button below.
        </InfoAlert>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <input type="file" accept=".csv,text/csv" onChange={onFile} />
        <button type="button" onClick={preview} disabled={!fileText} style={{ padding: '8px 16px', backgroundColor: 'var(--color-navy-deep)', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, fontSize: '0.875rem', cursor: fileText ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>Preview</button>
        <button type="button" onClick={runImport} disabled={!rows || importing} style={{ padding: '8px 16px', backgroundColor: 'var(--color-gold)', color: 'var(--color-navy-darker)', border: 'none', borderRadius: '6px', fontWeight: 600, fontSize: '0.875rem', cursor: rows && !importing ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>{importing ? 'Importing…' : 'Run Import'}</button>
      </div>

      {parseError && <div style={{ marginBottom: '1rem' }}><ErrorAlert>{parseError}</ErrorAlert></div>}

      {/* Preview */}
      {rows && !result && counts && (
        <>
          <p style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '0.875rem' }}>
            {counts.invite} to invite, {counts.hold} on hold, {counts.skip} to skip, {counts.duplicates} duplicates
          </p>
          <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: '10px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'var(--color-surface)' }}>
              <thead><tr><th style={th}>Student</th><th style={th}>Grade</th><th style={th}>School</th><th style={th}>Program</th><th style={th}>Guardian 1 Email</th><th style={th}>T-Shirt</th><th style={th}>Employer Match</th><th style={th}>Action</th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td style={cell}>{r.student_first_name} {r.student_last_name}</td>
                    <td style={cell}>{r.grade_fall_2026}</td>
                    <td style={cell}>{r.school}</td>
                    <td style={cell}>{PROGRAM_LABELS[(r.program_26_27 || '').toLowerCase()] ?? r.program_26_27}</td>
                    <td style={cell}>{r.guardian1_email}</td>
                    <td style={cell}>{(r.tshirt_size || '').toUpperCase()}</td>
                    <td style={cell}>{(r.employer_match || '').toLowerCase() === 'yes' ? `Yes${r.employer_match_company ? ` (${r.employer_match_company})` : ''}` : 'No'}</td>
                    <td style={cell}>{(r.import_action || 'invite')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Results */}
      {result && (result.error ? (
        <ErrorAlert title="Import failed">{result.error}</ErrorAlert>
      ) : (
        <>
          <div style={{ marginBottom: '1.25rem' }}>
            <SuccessAlert title="Import complete">
              {result.summary.familiesCreated} families created · {result.summary.studentsCreated} students created ·{' '}
              {result.summary.recordsCreated} family-season records created · {result.summary.skipped} skipped ·{' '}
              {result.summary.errors} errors
            </SuccessAlert>
          </div>

          {result.warnings?.length > 0 && (
            <div style={{ marginBottom: '1.25rem' }}>
              <WarningAlert title="Possible email typos">
                <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                  {result.warnings.map((w: any, i: number) => (
                    <li key={i}>Row {w.row}: {w.message}</li>
                  ))}
                </ul>
              </WarningAlert>
            </div>
          )}

          <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: '10px', marginBottom: '1.5rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'var(--color-surface)' }}>
              <thead><tr><th style={th}>Student</th><th style={th}>Action</th><th style={th}>Status</th></tr></thead>
              <tbody>
                {result.results.map((r: any, i: number) => (
                  <tr key={i}>
                    <td style={cell}>{r.student}</td>
                    <td style={cell}>{r.action}</td>
                    <td style={cell}>
                      {r.status === 'created' ? <StatusBadge label="created" variant="success" />
                        : r.status === 'skipped' || r.status === 'already exists' ? <StatusBadge label={r.status} variant="neutral" />
                        : <StatusBadge label={r.status} variant="error" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-start' }}>
            <button type="button" onClick={sendInvites} disabled={!SEND_INVITES_ENABLED || sending}
              style={{ padding: '10px 20px', backgroundColor: SEND_INVITES_ENABLED ? 'var(--color-gold)' : 'var(--color-border)', color: SEND_INVITES_ENABLED ? 'var(--color-navy-darker)' : 'var(--color-text-muted)', border: 'none', borderRadius: '6px', fontWeight: 600, fontSize: '0.9375rem', cursor: SEND_INVITES_ENABLED && !sending ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
              {sending ? 'Sending…' : 'Send Invites'}
            </button>
            {!SEND_INVITES_ENABLED && <span className="text-help">Enable after testing end-to-end flow (set SEND_INVITES_ENABLED = true in code).</span>}
            {sendResult && <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>{sendResult}</span>}
          </div>
        </>
      ))}
    </AdminShell>
  )
}
