import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireSection } from '@/lib/auth/admin-access'
import { AdminShell, PageHeader, StatusBadge, EmptyState } from '@/components/ui'

const inputStyle: React.CSSProperties = { flex: 1, padding: '8px 10px', fontSize: '0.9375rem', border: '1.5px solid var(--color-border)', borderRadius: '6px', fontFamily: 'inherit', boxSizing: 'border-box', backgroundColor: 'var(--color-surface)' }

export default async function SyncPage() {
  await requireSection('/admin/sync')
  const supabase = await createClient()
  const { data: logs } = await supabase
    .from('sync_log')
    .select('id, sync_type, action, email, success, error_message, created_at')
    .order('created_at', { ascending: false })
    .limit(50)
  const { data: exclusions } = await supabase
    .from('sync_exclusion')
    .select('id, email, reason, created_at')
    .order('created_at', { ascending: false })
  const rows = (logs ?? []) as any[]
  const excl = (exclusions ?? []) as any[]

  async function addExclusion(formData: FormData) {
    'use server'
    const email = String(formData.get('email') ?? '').trim().toLowerCase()
    if (!email) return
    const db = await createClient()
    await db.from('sync_exclusion').upsert(
      { email, reason: String(formData.get('reason') ?? '').trim() || null },
      { onConflict: 'email' }
    )
    redirect('/admin/sync')
  }

  return (
    <AdminShell activePath="/admin/sync">
      <PageHeader title="Sync Issues" subtitle="Google Group and Slack synchronization log." />

      <h2 className="text-card-title" style={{ margin: '0 0 0.875rem' }}>Recent sync activity</h2>
      {rows.length === 0 ? (
        <EmptyState title="No sync activity" description="Sync log entries appear here once the Google/Slack sync runs." />
      ) : (
        <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', overflow: 'hidden', marginBottom: '2rem' }}>
          {rows.map((r, i) => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.75rem 1.25rem', borderBottom: i < rows.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.9375rem', fontWeight: 500 }}>{r.action} · {r.email}</div>
                <div className="text-help">{r.sync_type}{r.error_message ? ` · ${r.error_message}` : ''}</div>
              </div>
              <StatusBadge label={r.success ? 'Success' : 'Failed'} variant={r.success ? 'success' : 'error'} />
            </div>
          ))}
        </div>
      )}

      <h2 className="text-card-title" style={{ margin: '0 0 0.875rem' }}>Sync exclusions</h2>
      <form action={addExclusion} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', maxWidth: '640px' }}>
        <input name="email" type="email" placeholder="email to exclude from sync" required style={inputStyle} />
        <input name="reason" placeholder="reason (optional)" style={inputStyle} />
        <button type="submit" style={{ padding: '8px 16px', backgroundColor: 'var(--color-navy-deep)', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit' }}>Add</button>
      </form>
      {excl.length === 0 ? (
        <p className="text-help">No exclusions configured.</p>
      ) : (
        <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', overflow: 'hidden', maxWidth: '640px' }}>
          {excl.map((e, i) => (
            <div key={e.id} style={{ padding: '0.75rem 1.25rem', borderBottom: i < excl.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
              <div style={{ fontSize: '0.9375rem' }}>{e.email}</div>
              {e.reason && <div className="text-help">{e.reason}</div>}
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  )
}
