'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// Duplicate-family cleanup actions (the "meaningful" half of the duplicates
// report): move an unregistered student or a volunteer record to the real
// family, delete the family once it's an empty shell — or archive it when
// append-only waiver signatures make deletion permanently impossible. The API
// enforces every guard server-side; this UI just explains them.
export type MaintStudent = { id: string; name: string; registered: boolean }
export type MaintVolunteer = { id: string; guardianName: string; status: string; hasAps: boolean }
export type Blockers = Record<string, number>

const card: React.CSSProperties = { border: '1.5px solid var(--color-error)', borderRadius: 10, padding: '1rem 1.25rem', margin: '1.5rem 0', backgroundColor: 'var(--color-surface)' }
const input: React.CSSProperties = { padding: '7px 10px', fontSize: '0.8125rem', border: '1.5px solid var(--color-border)', borderRadius: 6, fontFamily: 'inherit', minWidth: 240 }
const dangerBtn: React.CSSProperties = { padding: '7px 14px', backgroundColor: 'var(--color-error)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'inherit' }
const outlineBtn: React.CSSProperties = { padding: '6px 12px', background: 'var(--color-surface)', color: 'var(--color-navy-deep)', border: '1.5px solid var(--color-navy-deep)', borderRadius: 6, fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'inherit' }

type MergePreview = {
  source: { familyId: string; label: string }
  target: { familyId: string; label: string }
  guardians: { id: string; name: string; email: string }[]
  students: { id: string; name: string }[]
  volunteers: { id: string; guardianName: string }[]
  enrollmentCount: number
  paymentCount: number
  financialAidCount: number
  waiverSignatureCount: number
  seasons: { season: string; sourceStatus: string | null; targetStatus: string | null; winner: string | null }[]
}

export default function FamilyMaintenance({ familyId, familyLabel, familyStatus, students, volunteers, blockers }: { familyId: string; familyLabel: string; familyStatus: string; students: MaintStudent[]; volunteers: MaintVolunteer[]; blockers: Blockers }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [moveTarget, setMoveTarget] = useState<Record<string, string>>({})
  const [mergeEmail, setMergeEmail] = useState('')
  const [mergePreview, setMergePreview] = useState<MergePreview | null>(null)

  const blocking = Object.entries(blockers).filter(([, c]) => c > 0)
  const deletable = blocking.length === 0
  // Signatures are append-only — a shell that only they block can never be
  // deleted; archiving is its terminal state.
  const archivable = !deletable && blocking.every(([k]) => k === 'waiver_signatures')

  async function post(url: string, body?: unknown) {
    setBusy(true); setMsg('')
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : '{}' })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setMsg(d.error || 'Action failed.'); return false }
      return true
    } catch { setMsg('Network error.'); return false } finally { setBusy(false) }
  }

  async function moveStudent(s: MaintStudent) {
    const email = (moveTarget[s.id] ?? '').trim()
    if (!email) { setMsg('Enter the target guardian’s login email first.'); return }
    if (!window.confirm(`Move ${s.name} (and their application + emergency contacts) to the family whose guardian signs in as ${email}?`)) return
    if (await post(`/api/admin/students/${s.id}/move-family`, { target_guardian_email: email })) {
      setMsg(`${s.name} moved.`)
      router.refresh()
    }
  }

  async function moveVolunteer(v: MaintVolunteer) {
    const email = (moveTarget[`v-${v.id}`] ?? '').trim()
    if (!email) { setMsg('Enter the target guardian’s login email first.'); return }
    if (!window.confirm(`Move ${v.guardianName}'s volunteer record (clearances, APS history) to the guardian who signs in as ${email}?\n\nAPS sync keys off the MinistrySafe account id, so the history stays linked.`)) return
    if (await post(`/api/admin/volunteers/${v.id}/move-guardian`, { target_guardian_email: email })) {
      setMsg('Volunteer record moved.')
      router.refresh()
    }
  }

  async function deleteFamily() {
    if (!window.confirm(`Delete ${familyLabel}?\n\nThis removes the family record and its guardian/season rows. It cannot be undone.`)) return
    if (await post(`/api/admin/families/${familyId}/delete`)) {
      window.location.href = '/admin/families?notice=deleted'
    }
  }

  async function archiveFamily() {
    if (!window.confirm(`Archive ${familyLabel}?\n\nSigned waivers are permanent records, so this duplicate can't be deleted — archiving parks it out of active use instead.`)) return
    if (await post(`/api/admin/families/${familyId}/delete`, { archive: true })) {
      setMsg('Family archived.')
      router.refresh()
    }
  }

  async function previewMerge() {
    if (!mergeEmail.trim()) { setMsg('Enter the surviving family’s guardian login email first.'); return }
    setMergePreview(null)
    setBusy(true); setMsg('')
    try {
      const res = await fetch(`/api/admin/families/${familyId}/merge`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target_guardian_email: mergeEmail.trim() }) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setMsg(d.error || 'Preview failed.'); return }
      setMergePreview(d.preview)
    } catch { setMsg('Network error.') } finally { setBusy(false) }
  }

  async function confirmMerge() {
    if (!mergePreview) return
    const summary = `${mergePreview.guardians.length} guardian(s), ${mergePreview.students.length} student(s), ${mergePreview.volunteers.length} volunteer record(s), ${mergePreview.enrollmentCount} enrollment(s), ${mergePreview.paymentCount} payment(s)`
    if (!window.confirm(`Merge "${mergePreview.source.label}" into "${mergePreview.target.label}"?\n\nMoves: ${summary}.\n\nThis cannot be undone.`)) return
    if (await post(`/api/admin/families/${familyId}/merge`, { target_guardian_email: mergeEmail.trim(), confirm: true })) {
      window.location.href = '/admin/families?notice=merged'
    }
  }

  return (
    <div style={card}>
      <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, margin: '0 0 0.25rem', color: 'var(--color-error)' }}>Duplicate cleanup</h3>
      <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: '0 0 0.875rem' }}>
        For spurious duplicate families (bad-email imports, the mailto: bug). Move any real students to the correct family first — then the empty shell can be deleted.
      </p>

      {familyStatus === 'archived' && (
        <p style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text-muted)', margin: '0 0 0.75rem' }}>This family is ARCHIVED.</p>
      )}

      {students.map((s) => (
        <div key={s.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, minWidth: 140 }}>{s.name}</span>
          {s.registered ? (
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>registered — has enrollment/waiver records; merge manually, not movable here</span>
          ) : (
            <>
              <input
                style={input}
                type="email"
                placeholder="target guardian's login email"
                value={moveTarget[s.id] ?? ''}
                onChange={(e) => setMoveTarget((m) => ({ ...m, [s.id]: e.target.value }))}
              />
              <button type="button" style={outlineBtn} disabled={busy} onClick={() => moveStudent(s)}>Move to that family</button>
            </>
          )}
        </div>
      ))}

      {volunteers.map((v) => (
        <div key={v.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, minWidth: 140 }}>
            Volunteer record — {v.guardianName}
            <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}> · {v.status}{v.hasAps ? ' · APS linked' : ''}</span>
          </span>
          <input
            style={input}
            type="email"
            placeholder="target guardian's login email"
            value={moveTarget[`v-${v.id}`] ?? ''}
            onChange={(e) => setMoveTarget((m) => ({ ...m, [`v-${v.id}`]: e.target.value }))}
          />
          <button type="button" style={outlineBtn} disabled={busy} onClick={() => moveVolunteer(v)}>Move to that guardian</button>
        </div>
      ))}

      <div style={{ marginTop: '0.875rem', paddingTop: '0.875rem', borderTop: '1px solid var(--color-border)' }}>
        <div style={{ fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.375rem' }}>Merge into another family</div>
        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '0 0 0.5rem' }}>
          For a real family split across two records (both parents/students correct, just in separate rows) — everything here (guardians, students, enrollments, payments, volunteer records) moves to the surviving family in one step.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input style={input} type="email" placeholder="surviving family's guardian login email" value={mergeEmail} onChange={(e) => { setMergeEmail(e.target.value); setMergePreview(null) }} />
          <button type="button" style={outlineBtn} disabled={busy} onClick={previewMerge}>Preview merge</button>
        </div>

        {mergePreview && (
          <div style={{ marginTop: '0.75rem', padding: '0.75rem 1rem', border: '1px solid var(--color-border)', borderRadius: 8, backgroundColor: 'var(--color-bg-light)', fontSize: '0.8125rem' }}>
            <div style={{ fontWeight: 700, marginBottom: '0.4rem' }}>"{mergePreview.source.label}" → "{mergePreview.target.label}"</div>
            {mergePreview.guardians.length > 0 && <div>Guardians: {mergePreview.guardians.map((g) => `${g.name} (${g.email})`).join(', ')}</div>}
            {mergePreview.students.length > 0 && <div>Students: {mergePreview.students.map((s) => s.name).join(', ')}</div>}
            {mergePreview.volunteers.length > 0 && <div>Volunteer records: {mergePreview.volunteers.map((v) => v.guardianName).join(', ')}</div>}
            <div>Enrollments: {mergePreview.enrollmentCount} · Payments: {mergePreview.paymentCount} · Financial aid: {mergePreview.financialAidCount}</div>
            {mergePreview.waiverSignatureCount > 0 && (
              <div style={{ color: '#C9971B', marginTop: '0.25rem' }}>
                {mergePreview.waiverSignatureCount} signed waiver(s) can't move (append-only) — after merging, this shell will be archived rather than deleted.
              </div>
            )}
            {mergePreview.seasons.map((s) => (
              <div key={s.season} style={{ marginTop: '0.25rem' }}>
                {s.season}: source {s.sourceStatus ?? '—'} vs. target {s.targetStatus ?? '—'} → keeps <strong>{s.winner === 'source' ? s.sourceStatus : s.targetStatus}</strong>
              </div>
            ))}
            <button type="button" style={{ ...dangerBtn, marginTop: '0.625rem' }} disabled={busy} onClick={confirmMerge}>Confirm merge</button>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.875rem', paddingTop: '0.875rem', borderTop: '1px solid var(--color-border)' }}>
        {archivable && familyStatus !== 'archived' ? (
          <button type="button" style={dangerBtn} disabled={busy} onClick={archiveFamily}>Archive this family</button>
        ) : (
          <button type="button" style={{ ...dangerBtn, opacity: deletable ? 1 : 0.5, cursor: deletable ? 'pointer' : 'not-allowed' }} disabled={busy || !deletable} onClick={deleteFamily}>
            Delete this family
          </button>
        )}
        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
          {deletable
            ? 'This family is an empty shell (no students, enrollments, payments, waivers, volunteers, or aid records) — safe to delete.'
            : archivable
            ? 'Only signed waivers remain — those are permanent records, so this shell can never be deleted. Archive it instead.'
            : `Blocked — still has ${blocking.map(([k, c]) => `${c} ${k.replace(/_/g, ' ')}`).join(', ')}.`}
        </span>
      </div>
      {msg && <p style={{ fontSize: '0.8125rem', color: msg.endsWith('moved.') ? 'var(--color-success)' : 'var(--color-error)', margin: '0.625rem 0 0' }}>{msg}</p>}
    </div>
  )
}
