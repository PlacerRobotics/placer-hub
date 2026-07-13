import { requireSection } from '@/lib/auth/admin-access'
import { createAdminClient } from '@/lib/supabase/admin'
import { AdminShell, PageHeader, WarningAlert } from '@/components/ui'
import { SLACK_MAIN_BOT_TOKEN } from '@/lib/env'
import { runSlackReconciliation, computeFuzzyMatches, gatherSlackDispositions, type SlackReconRun } from '@/lib/slack-recon'
import { type FlaggedRow } from './removal-queue'
import { type MatchRow } from './alt-email-matches'
import SlackDashboard from './dashboard'

const SEASON = '2026-27'

export const dynamic = 'force-dynamic'

// Live Slack ↔ Hub reconciliation view (task 1.6 / D11). This page only READS —
// it recomputes the same buckets the nightly cron acts on. The cron does the
// additive work (match recording, channel placement); removals happen only here,
// one confirmed click at a time.
export default async function SlackAdminPage() {
  await requireSection('/admin/slack')

  let run: SlackReconRun | null = null
  let error: string | null = null
  let fuzzyMatches: MatchRow[] = []
  let dispositions: Record<string, { tags: string[]; notes: string | null }> = {}
  if (SLACK_MAIN_BOT_TOKEN) {
    try {
      const db = createAdminClient()
      run = await runSlackReconciliation(db, SLACK_MAIN_BOT_TOKEN, SEASON, false)
      ;[fuzzyMatches, dispositions] = await Promise.all([
        computeFuzzyMatches(db, SEASON, run.recon),
        gatherSlackDispositions(db),
      ])
    } catch (e: any) {
      error = e?.message ?? 'Slack reconciliation failed.'
    }
  }

  const statCard: React.CSSProperties = { backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '0.875rem 1.125rem', minWidth: 120 }

  const removalRows: FlaggedRow[] = run
    ? run.recon.under13Present.map((u) => ({ slackUserId: u.slackUserId, email: u.email, name: u.slackName, reason: 'matches an under-13 student email' }))
    : []
  const needsReviewCount = run ? run.recon.unexpected.filter((u) => !dispositions[u.slackUserId]?.tags.length).length : 0

  return (
    <AdminShell activePath="/admin/slack">
      <PageHeader title="Slack" subtitle={`Workspace reconciliation for ${SEASON}. Nightly job records matches and places members into team channels; removals are confirmed here (D11).`} />

      {!SLACK_MAIN_BOT_TOKEN && (
        <WarningAlert title="Slack is not configured">
          Set <code>SLACK_MAIN_BOT_TOKEN</code> (bot scopes: users:read, users:read.email, channels:manage or groups:write) to enable reconciliation. Invite links in emails are controlled separately by <code>NEXT_PUBLIC_SLACK_MAIN_INVITE</code> / <code>NEXT_PUBLIC_SLACK_IQ_INVITE</code>.
        </WarningAlert>
      )}
      {error && <WarningAlert title="Reconciliation failed">{error}</WarningAlert>}

      {run && (
        <>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', margin: '0 0 1.5rem' }}>
            {[
              { label: 'Expected members', value: run.expectedCount, color: 'var(--color-text-primary)' },
              { label: 'Matched', value: run.recon.matched.length, color: 'var(--color-success)' },
              { label: 'Not joined', value: run.recon.notJoined.length, color: '#C9971B' },
              { label: 'Departed', value: run.recon.departed.length, color: '#C9971B' },
              { label: 'Under-13 present', value: run.recon.under13Present.length, color: 'var(--color-error)' },
              { label: 'Unexpected — needs review', value: needsReviewCount, color: needsReviewCount ? '#C9971B' : 'var(--color-text-muted)' },
            ].map((s) => (
              <div key={s.label} style={statCard}>
                <div style={{ fontSize: '1.375rem', fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{s.label}</div>
              </div>
            ))}
          </div>

          <SlackDashboard
            removalRows={removalRows}
            notJoined={run.recon.notJoined}
            departed={run.recon.departed}
            fuzzyMatches={fuzzyMatches}
            unexpectedRows={run.recon.unexpected.map((u) => ({ slackUserId: u.slackUserId, email: u.email, name: u.slackName }))}
            dispositions={dispositions}
          />
        </>
      )}
    </AdminShell>
  )
}
