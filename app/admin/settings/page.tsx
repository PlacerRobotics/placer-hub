import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireSection } from '@/lib/auth/admin-access'
import { AdminShell, PageHeader, StatusBadge } from '@/components/ui'

const SEASON = '2026-27'
const FLAGS: { key: string; label: string; help: string }[] = [
  { key: 'registration_active', label: 'Registration open', help: 'Families can complete the registration wizard.' },
  { key: 'sync_active', label: 'Sync active', help: 'This season drives Google Group / Slack membership.' },
  { key: 'program_year_active', label: 'Program year active', help: 'The competition season is running.' },
  { key: 'active', label: 'Current season', help: 'Default platform season for display and new records.' },
]
const ALLOWED = FLAGS.map((f) => f.key)

export default async function SettingsPage() {
  await requireSection('/admin/settings')
  const supabase = await createClient()
  const { data: config, error } = await supabase
    .from('season_config')
    .select('*')
    .eq('season', SEASON)
    .maybeSingle()

  async function toggleFlag(formData: FormData) {
    'use server'
    const flag = String(formData.get('flag') ?? '')
    const value = String(formData.get('value') ?? '') === 'true'
    if (!ALLOWED.includes(flag)) return
    const db = await createClient()
    await db.from('season_config').update({ [flag]: value }).eq('season', SEASON)
    redirect('/admin/settings')
  }

  return (
    <AdminShell activePath="/admin/settings">
      <PageHeader title="Settings" subtitle={`Season configuration for ${SEASON}. Super admin only.`} />

      {error || !config ? (
        <p style={{ color: 'var(--color-error)' }}>
          {error ? `Couldn’t load settings: ${error.message}` : `No season_config row for ${SEASON}.`}
        </p>
      ) : (
        <>
          <h2 className="text-card-title" style={{ margin: '0 0 0.875rem' }}>Season flags</h2>
          <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', overflow: 'hidden', marginBottom: '2rem' }}>
            {FLAGS.map((f, i) => {
              const on = !!config[f.key]
              return (
                <div key={f.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.875rem 1.25rem', borderBottom: i < FLAGS.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                  <div>
                    <div style={{ fontSize: '0.9375rem', fontWeight: 500 }}>{f.label}</div>
                    <div className="text-help">{f.help}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <StatusBadge label={on ? 'On' : 'Off'} variant={on ? 'success' : 'neutral'} />
                    <form action={toggleFlag}>
                      <input type="hidden" name="flag" value={f.key} />
                      <input type="hidden" name="value" value={(!on).toString()} />
                      <button type="submit" style={{ padding: '6px 14px', backgroundColor: 'transparent', color: 'var(--color-navy-deep)', border: '1.5px solid var(--color-navy-deep)', borderRadius: '6px', fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                        Turn {on ? 'off' : 'on'}
                      </button>
                    </form>
                  </div>
                </div>
              )
            })}
          </div>

          <h2 className="text-card-title" style={{ margin: '0 0 0.875rem' }}>Fees &amp; targets</h2>
          <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '1.25rem' }}>
            <dl style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '0.5rem', margin: 0, fontSize: '0.9375rem' }}>
              <dt className="text-help">V5/Combat registration fee</dt><dd style={{ margin: 0 }}>${config.v5_combat_registration_fee}</dd>
              <dt className="text-help">Cavitt Jr. High V5 fee</dt><dd style={{ margin: 0 }}>{config.cavitt_v5_registration_fee != null ? `$${config.cavitt_v5_registration_fee}` : `$${config.v5_combat_registration_fee} (standard — not set)`}</dd>
              <dt className="text-help">IQ student registration fee</dt><dd style={{ margin: 0 }}>${config.iq_student_registration_fee}</dd>
              <dt className="text-help">IQ team fee</dt><dd style={{ margin: 0 }}>${config.iq_team_fee}</dd>
              <dt className="text-help">One-program fundraising target</dt><dd style={{ margin: 0 }}>${config.one_program_fundraising_target}</dd>
            </dl>
            <p className="text-help" style={{ marginTop: '0.875rem' }}>Fee editing UI is read-only here for now — update via SQL or a future settings form.</p>
          </div>
        </>
      )}
    </AdminShell>
  )
}
