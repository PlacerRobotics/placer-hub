import { redirect } from 'next/navigation'
import { requireSection } from '@/lib/auth/admin-access'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AdminShell, PageHeader, EmptyState } from '@/components/ui'

const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', fontSize: '0.9375rem', border: '1.5px solid var(--color-border)', borderRadius: '6px', fontFamily: 'inherit', boxSizing: 'border-box', backgroundColor: 'var(--color-surface)' }
const formPanel: React.CSSProperties = { backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '1.25rem', marginBottom: '2rem', maxWidth: '760px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.875rem', alignItems: 'end' }
const submitStyle: React.CSSProperties = { padding: '10px 18px', backgroundColor: 'var(--color-navy-deep)', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, fontSize: '0.9375rem', cursor: 'pointer', fontFamily: 'inherit', minHeight: '40px' }
const th: React.CSSProperties = { textAlign: 'left', padding: '0.5rem 1.25rem', fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }
const td: React.CSSProperties = { padding: '0.625rem 1.25rem', fontSize: '0.875rem', borderBottom: '1px solid var(--color-border)' }
const panel: React.CSSProperties = { backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden' }

const WEIGHT_CLASSES = [
  { value: 'plastic_ant', label: 'Plastic Antweight' },
  { value: 'antweight', label: 'Antweight' },
  { value: '15lb', label: '15lb' },
  { value: 'beetleweight', label: 'Beetleweight' },
]
const SERIES = [
  { value: 'SBB', label: 'SBB' },
  { value: 'IRL', label: 'IRL' },
  { value: 'NHRL', label: 'NHRL' },
  { value: 'other', label: 'Other' },
]

function slugify(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'x'
}
function toIntOrNull(v: FormDataEntryValue | null) {
  const s = String(v ?? '').trim()
  return s ? parseInt(s, 10) : null
}

// Manual entry for combat competition results (Challonge/RCE/IRL integrations
// are later phases — see docs/combat-results-capture.md). Writes go through
// the admin (service-role) client: this section's RLS write policy is
// is_super_admin()-only, but any admin with /admin/combat access (gated by
// requireSection, same as every admin mutation in this app) should be able
// to log a result — so authorization is enforced here in app code, and the
// write itself bypasses RLS via the admin client, same pattern as
// app/admin/teams/page.tsx's createTeam action already establishes.
export default async function CombatAdminPage() {
  await requireSection('/admin/combat')
  const supabase = await createClient()

  const { data: events } = await supabase
    .from('combat_event')
    .select('event_slug, name, event_date, series')
    .order('event_date', { ascending: false })

  const { data: results } = await supabase
    .from('combat_result')
    .select('event_slug, bot_slug, weight_class, placement, wins, losses, ko_wins, award, source, combat_bot(name), combat_event(name, event_date)')
    .order('id', { ascending: false })
    .limit(100)

  async function createEvent(formData: FormData) {
    'use server'
    await requireSection('/admin/combat')
    const name = String(formData.get('name') ?? '').trim()
    const event_date = String(formData.get('event_date') ?? '').trim() || null
    const location = String(formData.get('location') ?? '').trim() || null
    const series = String(formData.get('series') ?? '')
    if (!name || !SERIES.some((s) => s.value === series)) return
    const event_slug = slugify(`${series}-${event_date ?? name}`)
    const db = createAdminClient()
    await db.from('combat_event').upsert(
      { event_slug, name, event_date, location, series, source: 'manual' },
      { onConflict: 'event_slug' }
    )
    redirect('/admin/combat')
  }

  async function logResult(formData: FormData) {
    'use server'
    await requireSection('/admin/combat')
    const event_slug = String(formData.get('event_slug') ?? '')
    const bot_name = String(formData.get('bot_name') ?? '').trim()
    const weight_class = String(formData.get('weight_class') ?? '')
    if (!event_slug || !bot_name || !WEIGHT_CLASSES.some((w) => w.value === weight_class)) return
    const bot_slug = slugify(bot_name)

    const db = createAdminClient()
    await db.from('combat_bot').upsert(
      { bot_slug, name: bot_name, weight_class },
      { onConflict: 'bot_slug', ignoreDuplicates: true }
    )
    await db.from('combat_result').upsert(
      {
        event_slug, bot_slug, weight_class,
        placement: toIntOrNull(formData.get('placement')),
        wins: toIntOrNull(formData.get('wins')) ?? 0,
        losses: toIntOrNull(formData.get('losses')) ?? 0,
        ko_wins: toIntOrNull(formData.get('ko_wins')),
        award: String(formData.get('award') ?? '').trim() || null,
        notes: String(formData.get('notes') ?? '').trim() || null,
        source: 'manual',
      },
      { onConflict: 'event_slug,bot_slug,weight_class' }
    )
    redirect('/admin/combat')
  }

  return (
    <AdminShell activePath="/admin/combat">
      <PageHeader
        title="Combat Results"
        subtitle="Manual entry for combat competition results — not in the VEX/RobotEvents API. Import full history with scripts/import_combat.py."
      />

      <h2 className="text-section-title" style={{ margin: '0 0 0.75rem' }}>New event</h2>
      <form action={createEvent} style={formPanel}>
        <div>
          <label style={labelStyle}>Series</label>
          <select name="series" style={inputStyle}>
            {SERIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div><label style={labelStyle}>Event name *</label><input name="name" required style={inputStyle} placeholder="SoCal Bot Battles Nov 2025" /></div>
        <div><label style={labelStyle}>Date</label><input name="event_date" type="date" style={inputStyle} /></div>
        <div><label style={labelStyle}>Location</label><input name="location" style={inputStyle} placeholder="Los Angeles, CA" /></div>
        <div><button type="submit" style={submitStyle}>Add event</button></div>
      </form>

      <h2 className="text-section-title" style={{ margin: '0 0 0.75rem' }}>Log a result</h2>
      {(!events || events.length === 0) ? (
        <EmptyState title="Add an event first" description="Create an event above before logging a result against it." />
      ) : (
        <form action={logResult} style={formPanel}>
          <div>
            <label style={labelStyle}>Event *</label>
            <select name="event_slug" style={inputStyle}>
              {events.map((e) => (
                <option key={e.event_slug} value={e.event_slug}>
                  {e.name}{e.event_date ? ` (${e.event_date})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div><label style={labelStyle}>Bot name *</label><input name="bot_name" required style={inputStyle} placeholder="Kinetic KO" /></div>
          <div>
            <label style={labelStyle}>Weight class *</label>
            <select name="weight_class" style={inputStyle}>
              {WEIGHT_CLASSES.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
            </select>
          </div>
          <div><label style={labelStyle}>Placement</label><input name="placement" type="number" min={1} style={inputStyle} /></div>
          <div><label style={labelStyle}>Wins</label><input name="wins" type="number" min={0} defaultValue={0} style={inputStyle} /></div>
          <div><label style={labelStyle}>Losses</label><input name="losses" type="number" min={0} defaultValue={0} style={inputStyle} /></div>
          <div><label style={labelStyle}>KO wins</label><input name="ko_wins" type="number" min={0} style={inputStyle} /></div>
          <div><label style={labelStyle}>Award</label><input name="award" style={inputStyle} placeholder="Best Engineered" /></div>
          <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Notes</label><input name="notes" style={inputStyle} /></div>
          <div><button type="submit" style={submitStyle}>Log result</button></div>
        </form>
      )}

      <h2 className="text-section-title" style={{ margin: '0 0 0.75rem' }}>Recent results</h2>
      {(!results || results.length === 0) ? (
        <EmptyState title="No combat results yet" description="Log one above, or import history with scripts/import_combat.py." />
      ) : (
        <div style={panel}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Event</th>
                <th style={th}>Bot</th>
                <th style={th}>Weight class</th>
                <th style={th}>Placement</th>
                <th style={th}>W–L</th>
                <th style={th}>Award</th>
                <th style={th}>Source</th>
              </tr>
            </thead>
            <tbody>
              {(results as any[]).map((r, i) => {
                const last = i === results.length - 1
                const cellStyle = { ...td, ...(last ? { borderBottom: 'none' } : {}) }
                return (
                  <tr key={`${r.event_slug}-${r.bot_slug}-${r.weight_class}`}>
                    <td style={cellStyle}>{r.combat_event?.name ?? r.event_slug}</td>
                    <td style={cellStyle}>{r.combat_bot?.name ?? r.bot_slug}</td>
                    <td style={cellStyle}>{WEIGHT_CLASSES.find((w) => w.value === r.weight_class)?.label ?? r.weight_class}</td>
                    <td style={cellStyle}>{r.placement ?? '—'}</td>
                    <td style={cellStyle}>{r.wins}–{r.losses}{r.ko_wins ? ` (${r.ko_wins} KO)` : ''}</td>
                    <td style={{ ...cellStyle, fontWeight: r.award ? 700 : 400 }}>{r.award ?? '—'}</td>
                    <td style={cellStyle}>{r.source}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  )
}
