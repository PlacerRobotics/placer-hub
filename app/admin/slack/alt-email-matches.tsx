'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ProgramBadges } from './program-badges'

// Fuzzy name-match proposals: a Slack member ("unexpected") whose display name
// closely resembles someone we're missing. Never applied automatically — an
// admin confirms each one, which records the Slack email as a known alt
// address (guardian_email_alias, or student.slack_email) so future
// reconciliation passes recognize it.
export type MatchRow = {
  slackUserId: string
  slackName: string
  slackEmail: string | null
  candidateId: string
  candidateName: string
  candidateKind: 'guardian' | 'student'
  candidatePrograms?: string[]
  candidateTeamNumbers?: string[]
  score: number
}

export default function AltEmailMatches({ rows }: { rows: MatchRow[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<Record<string, string>>({})
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  async function confirm(row: MatchRow) {
    if (!row.slackEmail) return
    setBusy(row.slackUserId)
    try {
      const res = await fetch('/api/admin/slack/confirm-alt-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slackEmail: row.slackEmail, candidateId: row.candidateId, candidateKind: row.candidateKind }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) setMsg((m) => ({ ...m, [row.slackUserId]: d.error || 'Failed.' }))
      else {
        setMsg((m) => ({ ...m, [row.slackUserId]: 'Saved — recognized next reconciliation.' }))
        router.refresh()
      }
    } catch {
      setMsg((m) => ({ ...m, [row.slackUserId]: 'Network error.' }))
    } finally {
      setBusy(null)
    }
  }

  const visible = rows.filter((r) => !dismissed.has(r.slackUserId))
  if (!visible.length) return <p style={{ margin: 0, padding: '0.875rem 1.25rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>No likely matches right now.</p>

  return (
    <div>
      {visible.map((r, i) => (
        <div key={r.slackUserId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.75rem 1.25rem', borderBottom: i < visible.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
          <span style={{ fontSize: '0.875rem' }}>
            <span style={{ fontWeight: 600 }}>{r.slackName}</span>
            <span style={{ color: 'var(--color-text-muted)' }}> ({r.slackEmail ?? 'no email visible'}) looks like </span>
            <span style={{ fontWeight: 600 }}>{r.candidateName}</span>
            <span style={{ color: 'var(--color-text-muted)' }}> · {r.candidateKind} · {Math.round(r.score * 100)}% match</span>
            <ProgramBadges programs={r.candidatePrograms} teamNumbers={r.candidateTeamNumbers} />
            {msg[r.slackUserId] && <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{msg[r.slackUserId]}</span>}
          </span>
          <span style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
            <button
              type="button"
              disabled={busy === r.slackUserId || !r.slackEmail}
              onClick={() => confirm(r)}
              style={{ padding: '6px 12px', background: 'var(--color-navy-deep)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
            >
              {busy === r.slackUserId ? 'Saving…' : 'Confirm — add as alt email'}
            </button>
            <button
              type="button"
              onClick={() => setDismissed((s) => new Set(s).add(r.slackUserId))}
              style={{ padding: '6px 12px', background: 'var(--color-surface)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)', borderRadius: 6, fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Not a match
            </button>
          </span>
        </div>
      ))}
    </div>
  )
}
