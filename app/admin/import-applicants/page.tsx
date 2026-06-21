'use client'

import { useState } from 'react'
import { AdminShell, PageHeader, StatusBadge, ErrorAlert, SuccessAlert, InfoAlert } from '@/components/ui'

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

function actionOf(status: string) {
  const s = (status || '').trim().toLowerCase()
  if (s === 'approved') return 'invite'
  if (s === 'rejected' || s === 'declined') return 'skip'
  return 'hold'
}
function programOf(r: Row) {
  const u = ((r['Final Program'] || '').trim() || (r['Which programs are you interested in?'] || '').trim()).toUpperCase()
  const out: string[] = []
  if (u.includes('V5')) out.push('VEX V5')
  if (u.includes('IQ')) out.push('VEX IQ')
  if (u.includes('COMBAT')) out.push('Combat')
  return out.length ? out.join(', ') : '—'
}
function guardianEmailOf(r: Row) {
  const pg = (r['Parent/Guardian Email'] || '').trim()
  return (pg ? pg.split(/[/,]/)[0].trim() : (r['Email Address'] || '').trim())
}

const cell: React.CSSProperties = { padding: '0.5rem 0.75rem', fontSize: '0.8125rem', borderBottom: '1px solid var(--color-border)', textAlign: 'left' }
const th: React.CSSProperties = { ...cell, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.6875rem', color: 'var(--color-text-muted)' }

export default function ImportApplicantsPage() {
  const [fileText, setFileText] = useState('')
  const [rows, setRows] = useState<Row[] | null>(null)
  const [parseError, setParseError] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState('')

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setRows(null); setResult(null); setParseError(''); setSendResult('')
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

  const counts = rows ? rows.reduce((c, r) => {
    const a = actionOf(r['Review Status'])
    if (a === 'invite') c.invite++; else if (a === 'skip') c.skip++; else c.hold++
    return c
  }, { invite: 0, hold: 0, skip: 0 }) : null

  async function runImport() {
    if (!rows || importing) return
    setImporting(true); setResult(null)
    try {
      const res = await fetch('/api/admin/import-applicants', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows }) })
      setResult(await res.json())
    } catch { setResult({ error: 'Import failed — network error.' }) }
    finally { setImporting(false) }
  }
  async function sendInvites() {
    if (!SEND_INVITES_ENABLED || sending) return
    setSending(true); setSendResult('')
    try {
      const res = await fetch('/api/admin/import/send-invites', { method: 'POST' })
      const data = await res.json()
      setSendResult(res.ok ? `Sent ${data.sent} invite(s).` : data.error || 'Failed.')
    } catch { setSendResult('Network error.') } finally { setSending(false) }
  }

  return (
    <AdminShell activePath="/admin/import-applicants">
      <PageHeader title="Import Applicants" subtitle="Import reviewed applicants from the Google Form export. No magic links are sent during import." />

      <div style={{ marginBottom: '1.25rem' }}>
        <InfoAlert title="Driven by Review Status">
          Approved → cleared to register · blank → on hold (pending) · Rejected/Declined → skipped (no records). Invites are sent separately, only after you enable the button below.
        </InfoAlert>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <input type="file" accept=".csv,text/csv" onChange={onFile} />
        <button type="button" onClick={preview} disabled={!fileText} style={{ padding: '8px 16px', backgroundColor: 'var(--color-navy-deep)', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, fontSize: '0.875rem', cursor: fileText ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>Preview</button>
        <button type="button" onClick={runImport} disabled={!rows || importing} style={{ padding: '8px 16px', backgroundColor: 'var(--color-gold)', color: 'var(--color-navy-darker)', border: 'none', borderRadius: '6px', fontWeight: 600, fontSize: '0.875rem', cursor: rows && !importing ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>{importing ? 'Importing…' : 'Run Import'}</button>
      </div>

      {parseError && <div style={{ marginBottom: '1rem' }}><ErrorAlert>{parseError}</ErrorAlert></div>}

      {rows && !result && counts && (
        <>
          <p style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '0.875rem' }}>
            {counts.invite} to invite (Approved), {counts.hold} on hold (pending review), {counts.skip} to skip (rejected)
          </p>
          <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: '10px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'var(--color-surface)' }}>
              <thead><tr><th style={th}>Student</th><th style={th}>Grade</th><th style={th}>School</th><th style={th}>Program</th><th style={th}>Team</th><th style={th}>Guardian Email</th><th style={th}>Review Status</th><th style={th}>Action</th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td style={cell}>{r['Student First Name']} {r['Student Last Name']}</td>
                    <td style={cell}>{r['Grade Entering (Fall 2026)']}</td>
                    <td style={cell}>{r['School Attending (Fall 2026)']}</td>
                    <td style={cell}>{programOf(r)}</td>
                    <td style={cell}>{r['26-27 Team']}</td>
                    <td style={cell}>{guardianEmailOf(r)}</td>
                    <td style={cell}>{r['Review Status'] || '—'}</td>
                    <td style={cell}>{actionOf(r['Review Status'])}</td>
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
              {result.summary.familiesCreated} families · {result.summary.studentsCreated} students · {result.summary.recordsCreated} applicant records · {result.summary.skipped} skipped · {result.summary.errors} errors
            </SuccessAlert>
          </div>
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
                        : r.status.startsWith('created') ? <StatusBadge label={r.status} variant="warning" />
                        : r.status.startsWith('error') ? <StatusBadge label={r.status} variant="error" />
                        : <StatusBadge label={r.status} variant="neutral" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-start' }}>
            <button type="button" onClick={sendInvites} disabled={!SEND_INVITES_ENABLED || sending} style={{ padding: '10px 20px', backgroundColor: SEND_INVITES_ENABLED ? 'var(--color-gold)' : 'var(--color-border)', color: SEND_INVITES_ENABLED ? 'var(--color-navy-darker)' : 'var(--color-text-muted)', border: 'none', borderRadius: '6px', fontWeight: 600, fontSize: '0.9375rem', cursor: SEND_INVITES_ENABLED && !sending ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>{sending ? 'Sending…' : 'Send Invites'}</button>
            {!SEND_INVITES_ENABLED && <span className="text-help">Enable after testing end-to-end flow (set SEND_INVITES_ENABLED = true in code).</span>}
            {sendResult && <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>{sendResult}</span>}
          </div>
        </>
      ))}
    </AdminShell>
  )
}
