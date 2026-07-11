'use client'

import { useState } from 'react'
import { extractEmails, reconcileGroup, type HubEmailOwner, type GroupReconciliation } from '@/lib/google-groups'

// Paste-and-compare tool (task 1.8). Comparison runs entirely in the browser
// against the Hub email list the server page provides — nothing is uploaded.
export default function CompareTool({ hubEmails }: { hubEmails: HubEmailOwner[] }) {
  const [text, setText] = useState('')
  const [result, setResult] = useState<GroupReconciliation | null>(null)
  const [groupCount, setGroupCount] = useState(0)

  function compare() {
    const emails = extractEmails(text)
    setGroupCount(emails.length)
    setResult(reconcileGroup(emails, hubEmails))
  }

  function downloadCsv(name: string, rows: string[][]) {
    const csv = rows.map((r) => r.map((c) => (/[",\n\r]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    URL.revokeObjectURL(url)
  }

  const panel: React.CSSProperties = { backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden', marginBottom: '1.25rem' }
  const subhead: React.CSSProperties = { fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)', fontWeight: 700, margin: '0 0 0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }
  const listRow: React.CSSProperties = { padding: '0.5rem 1.25rem', fontSize: '0.8125rem', borderBottom: '1px solid var(--color-border)' }
  const dlBtn: React.CSSProperties = { border: 'none', background: 'transparent', color: 'var(--color-navy-deep)', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit', textTransform: 'none', letterSpacing: 0 }

  function bucket(title: string, count: number, rows: React.ReactNode, onDownload?: () => void) {
    return (
      <div>
        <div style={subhead}>
          <span>{title} · {count}</span>
          {onDownload && count > 0 && <button type="button" style={dlBtn} onClick={onDownload}>Download CSV</button>}
        </div>
        <div style={panel}>
          {count === 0 ? <p style={{ margin: 0, padding: '0.75rem 1.25rem', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>None.</p> : rows}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ ...panel, padding: '1.25rem' }}>
        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>
          Paste the Google Groups member export (CSV or the email column — any text with emails works)
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          placeholder={'Email address,Nickname,Group status\nparent@example.com,,member\n…'}
          style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', fontSize: '0.8125rem', fontFamily: 'ui-monospace, monospace', border: '1.5px solid var(--color-border)', borderRadius: 6, backgroundColor: 'var(--color-bg-light)' }}
        />
        <button
          type="button"
          onClick={compare}
          disabled={!text.trim()}
          style={{ marginTop: '0.75rem', padding: '9px 18px', backgroundColor: 'var(--color-navy-deep)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Compare against Hub ({hubEmails.length.toLocaleString()} known emails)
        </button>
        {result && <span style={{ marginLeft: '0.75rem', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>{groupCount} group member email{groupCount === 1 ? '' : 's'} parsed</span>}
      </div>

      {result && (
        <>
          {bucket(
            'In group, NOT in Hub — flag for review (do not purge before Aug 31)',
            result.inGroupNotHub.length,
            result.inGroupNotHub.map((e, i) => (
              <div key={e} style={{ ...listRow, borderBottom: i < result.inGroupNotHub.length - 1 ? listRow.borderBottom : 'none' }}>{e}</div>
            )),
            () => downloadCsv('group-not-in-hub.csv', [['Email'], ...result.inGroupNotHub.map((e) => [e])]),
          )}
          {bucket(
            'In Hub, NOT in group — candidates to add',
            result.inHubNotGroup.length,
            result.inHubNotGroup.map((h, i) => (
              <div key={h.email} style={{ ...listRow, borderBottom: i < result.inHubNotGroup.length - 1 ? listRow.borderBottom : 'none' }}>
                {h.email} <span style={{ color: 'var(--color-text-muted)' }}>· {h.owner} ({h.kind})</span>
              </div>
            )),
            () => downloadCsv('hub-not-in-group.csv', [['Email', 'Owner', 'Kind'], ...result.inHubNotGroup.map((h) => [h.email, h.owner, h.kind])]),
          )}
          {bucket(
            'Matched',
            result.matched.length,
            result.matched.map((h, i) => (
              <div key={h.email} style={{ ...listRow, borderBottom: i < result.matched.length - 1 ? listRow.borderBottom : 'none' }}>
                {h.email} <span style={{ color: 'var(--color-text-muted)' }}>· {h.owner} ({h.kind})</span>
              </div>
            )),
            () => downloadCsv('group-matched.csv', [['Email', 'Owner', 'Kind'], ...result.matched.map((h) => [h.email, h.owner, h.kind])]),
          )}
        </>
      )}
    </div>
  )
}
