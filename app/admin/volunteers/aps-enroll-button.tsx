'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Candidate = { volunteerId: string; name: string; email: string; hasApsAccount: boolean; latestExpiry: string | null }
type RunDetail = { volunteerId: string; name: string; status: string; error?: string }

const btn: React.CSSProperties = { padding: '8px 16px', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: '0.875rem', fontFamily: 'inherit', cursor: 'pointer' }

// Bulk APS renewal enrollment (task 1.10): preview exactly who will be enrolled
// (with per-row selection — run one test volunteer first), then confirm.
export default function ApsEnrollButton({ count }: { count: number }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [candidates, setCandidates] = useState<Candidate[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [resendExisting, setResendExisting] = useState(false)
  const [result, setResult] = useState<{ summary: Record<string, number>; details: RunDetail[] } | null>(null)

  async function openPreview() {
    setOpen(true); setErr(''); setResult(null)
    if (candidates) return
    try {
      const res = await fetch('/api/admin/volunteers/aps-enroll')
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setErr(d.error || 'Could not load the preview.'); return }
      setCandidates(d.candidates)
      setSelected(new Set(d.candidates.map((c: Candidate) => c.volunteerId)))
    } catch { setErr('Network error.') }
  }

  function toggle(id: string) {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  async function run() {
    if (busy || !selected.size) return
    setBusy(true); setErr('')
    try {
      const res = await fetch('/api/admin/volunteers/aps-enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ volunteerIds: [...selected], resendExisting }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setErr(d.error || 'Enrollment run failed.'); setBusy(false); return }
      setResult({ summary: d.summary, details: d.details })
      setCandidates(null) // stale after a run — refetch next open
      setBusy(false)
      router.refresh()
    } catch { setErr('Network error.'); setBusy(false) }
  }

  return (
    <>
      <button type="button" onClick={openPreview} style={{ ...btn, backgroundColor: 'var(--color-gold)', color: 'var(--color-navy-darker)' }}>
        Enroll {count} volunteer{count === 1 ? '' : 's'} needing APS renewal…
      </button>

      {open && (
        <div onClick={() => !busy && setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ backgroundColor: 'var(--color-surface)', borderRadius: 12, padding: '1.25rem 1.5rem', width: '100%', maxWidth: 640, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.25)' }}>
            <h3 className="text-card-title" style={{ margin: '0 0 0.375rem' }}>Bulk APS renewal enrollment</h3>

            {result ? (
              <>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: '0 0 0.75rem' }}>
                  Enrolled {result.summary.enrolled} · emailed {result.summary.emailed} · skipped {result.summary.skipped} · errors {result.summary.errors}
                </p>
                <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
                  {result.details.map((r) => (
                    <div key={r.volunteerId} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--color-border)', fontSize: '0.8125rem' }}>
                      <span style={{ fontWeight: 600 }}>{r.name}</span>
                      <span style={{ color: r.error ? 'var(--color-error)' : 'var(--color-text-muted)' }}>{r.status}{r.error ? ` — ${r.error}` : ''}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                  <button type="button" onClick={() => setOpen(false)} style={{ ...btn, backgroundColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>Close</button>
                </div>
              </>
            ) : !candidates && !err ? (
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>Loading preview…</p>
            ) : candidates ? (
              <>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: '0 0 0.75rem' }}>
                  These volunteers have no APS certificate valid through season end. Each selected volunteer is enrolled via the APS API and — for new enrollments — emailed their personal training link. Uncheck rows to run a smaller batch (e.g. one person as a test).
                </p>
                <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
                  {candidates.length === 0 && <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', padding: '0.75rem' }}>Nobody needs enrollment — all certificates are valid through season end.</p>}
                  {candidates.map((c) => (
                    <label key={c.volunteerId} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--color-border)', fontSize: '0.8125rem', cursor: 'pointer' }}>
                      <input type="checkbox" checked={selected.has(c.volunteerId)} onChange={() => toggle(c.volunteerId)} style={{ width: 15, height: 15, flexShrink: 0 }} />
                      <span style={{ fontWeight: 600, minWidth: 140 }}>{c.name}</span>
                      <span style={{ color: 'var(--color-text-muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.email}</span>
                      <span style={{ color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{c.latestExpiry ? `expires ${c.latestExpiry}` : 'no cert'}{c.hasApsAccount ? ' · in APS' : ''}</span>
                    </label>
                  ))}
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem', fontSize: '0.8125rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={resendExisting} onChange={(e) => setResendExisting(e.target.checked)} style={{ width: 15, height: 15 }} />
                  Also email volunteers already enrolled in APS (reminder resend)
                </label>
                {err && <p style={{ color: 'var(--color-error)', fontSize: '0.8125rem', margin: '0.5rem 0 0' }}>{err}</p>}
                <div style={{ display: 'flex', gap: '0.625rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setOpen(false)} disabled={busy} style={{ ...btn, backgroundColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>Cancel</button>
                  <button type="button" onClick={run} disabled={busy || !selected.size} style={{ ...btn, backgroundColor: 'var(--color-navy-deep)', color: '#fff', opacity: selected.size ? 1 : 0.6 }}>
                    {busy ? 'Enrolling…' : `Enroll ${selected.size} volunteer${selected.size === 1 ? '' : 's'}`}
                  </button>
                </div>
              </>
            ) : (
              <p style={{ color: 'var(--color-error)', fontSize: '0.875rem' }}>{err}</p>
            )}
          </div>
        </div>
      )}
    </>
  )
}
