import { requireSection } from '@/lib/auth/admin-access'
import { createAdminClient } from '@/lib/supabase/admin'
import { AdminShell, PageHeader, WarningAlert } from '@/components/ui'
import { SLACK_MAIN_BOT_TOKEN } from '@/lib/env'
import { runSlackReconciliation, type SlackReconRun } from '@/lib/slack-recon'
import RemovalQueue, { type FlaggedRow } from './removal-queue'

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
  if (SLACK_MAIN_BOT_TOKEN) {
    try {
      run = await runSlackReconciliation(createAdminClient(), SLACK_MAIN_BOT_TOKEN, SEASON, false)
    } catch (e: any) {
      error = e?.message ?? 'Slack reconciliation failed.'
    }
  }

  const panel: React.CSSProperties = { backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden', marginBottom: '1.25rem' }
  const subhead: React.CSSProperties = { fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)', fontWeight: 700, margin: '0 0 0.5rem' }
  const statCard: React.CSSProperties = { backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '0.875rem 1.125rem', minWidth: 120 }
  const listRow: React.CSSProperties = { padding: '0.625rem 1.25rem', fontSize: '0.875rem', borderBottom: '1px solid var(--color-border)' }

  const removalRows: FlaggedRow[] = run
    ? run.recon.under13Present.map((u) => ({ slackUserId: u.slackUserId, email: u.email, name: u.slackName, reason: 'matches an under-13 student email' }))
    : []

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
              { label: 'Unexpected', value: run.recon.unexpected.length, color: 'var(--color-text-muted)' },
            ].map((s) => (
              <div key={s.label} style={statCard}>
                <div style={{ fontSize: '1.375rem', fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{s.label}</div>
              </div>
            ))}
          </div>

          <div style={subhead}>Removal queue — confirm each (never automatic)</div>
          <div style={panel}>
            <RemovalQueue rows={removalRows} />
          </div>

          <div style={subhead}>Not joined — expected members without a Slack account</div>
          <div style={panel}>
            {run.recon.notJoined.length === 0 ? (
              <p style={{ margin: 0, padding: '0.875rem 1.25rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>Everyone expected has joined.</p>
            ) : (
              run.recon.notJoined.map((p, i) => (
                <div key={`${p.email}-${i}`} style={{ ...listRow, borderBottom: i < run!.recon.notJoined.length - 1 ? listRow.borderBottom : 'none' }}>
                  <span style={{ fontWeight: 600 }}>{p.name}</span>
                  <span style={{ color: 'var(--color-text-muted)' }}> · {p.email} · {p.kind}</span>
                </div>
              ))
            )}
          </div>

          <div style={subhead}>Departed — expected members whose Slack account is deactivated</div>
          <div style={panel}>
            {run.recon.departed.length === 0 ? (
              <p style={{ margin: 0, padding: '0.875rem 1.25rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>None.</p>
            ) : (
              run.recon.departed.map((d, i) => (
                <div key={d.slackUserId} style={{ ...listRow, borderBottom: i < run!.recon.departed.length - 1 ? listRow.borderBottom : 'none' }}>
                  <span style={{ fontWeight: 600 }}>{d.person.name}</span>
                  <span style={{ color: 'var(--color-text-muted)' }}> · {d.person.email} · {d.person.kind}</span>
                </div>
              ))
            )}
          </div>

          <div style={subhead}>In Slack but not expected — review only</div>
          <div style={panel}>
            {run.recon.unexpected.length === 0 ? (
              <p style={{ margin: 0, padding: '0.875rem 1.25rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>None.</p>
            ) : (
              run.recon.unexpected.map((u, i) => (
                <div key={u.slackUserId} style={{ ...listRow, borderBottom: i < run!.recon.unexpected.length - 1 ? listRow.borderBottom : 'none' }}>
                  <span style={{ fontWeight: 600 }}>{u.slackName}</span>
                  <span style={{ color: 'var(--color-text-muted)' }}> · {u.email ?? 'email not visible'}</span>
                </div>
              ))
            )}
          </div>

          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
            "Unexpected" includes alumni, board members, and helpers who are fine to keep — flag, don't purge.
            Workspace deactivation has no API on the standard plan; use Slack admin for that.
          </p>
        </>
      )}
    </AdminShell>
  )
}
