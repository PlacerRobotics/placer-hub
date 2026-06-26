import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FamilyShell, PageHeader } from '@/components/ui'
import { fetchUpcomingLabEvents, LAB_CALENDAR_EMBED_URL, LAB_CALENDAR_PUBLIC_URL, COMPETITION_EVENTS_URL, LAB_TZ, type LabEvent } from '@/lib/lab-calendar'

export const dynamic = 'force-dynamic'

const fmtDay = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: LAB_TZ })
const fmtTime = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: LAB_TZ })
const dayKey = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: LAB_TZ }) // YYYY-MM-DD in LA

const linkBtn: React.CSSProperties = { display: 'inline-block', padding: '9px 16px', borderRadius: 8, fontSize: '0.875rem', fontWeight: 700, textDecoration: 'none' }

function Agenda({ events }: { events: LabEvent[] }) {
  // Group by local day.
  const groups: { key: string; label: string; items: LabEvent[] }[] = []
  for (const e of events) {
    const d = new Date(e.start)
    const k = dayKey(d)
    let g = groups.find((x) => x.key === k)
    if (!g) { g = { key: k, label: fmtDay(d), items: [] }; groups.push(g) }
    g.items.push(e)
  }
  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden', marginBottom: '1.5rem' }}>
      <h3 style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', margin: 0, padding: '0.875rem 1.25rem', borderBottom: '1px solid var(--color-border)' }}>Upcoming at the lab</h3>
      {groups.map((g) => (
        <div key={g.key} style={{ display: 'flex', gap: '1rem', padding: '0.875rem 1.25rem', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ flexShrink: 0, width: 92, fontWeight: 700, fontSize: '0.8125rem', color: 'var(--color-navy-deep)' }}>{g.label}</div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {g.items.map((e) => (
              <div key={e.id}>
                <div style={{ fontSize: '0.9375rem', fontWeight: 600 }}>{e.title}</div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                  {e.allDay ? 'All day' : `${fmtTime(new Date(e.start))}${e.end ? ` – ${fmtTime(new Date(e.end))}` : ''}`}
                  {e.location ? ` · ${e.location}` : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export default async function CalendarPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const events = await fetchUpcomingLabEvents(14)

  return (
    <FamilyShell familyName={user.email ?? ''} maxWidth="lg">
      <PageHeader title="Lab Calendar" subtitle="Open lab hours, practices, and camps at the Placer Robotics center." breadcrumb={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Calendar' }]} />

      <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <a href={LAB_CALENDAR_PUBLIC_URL} target="_blank" rel="noopener noreferrer" style={{ ...linkBtn, background: 'var(--color-gold)', color: 'var(--color-navy-darker)' }}>Open in Google Calendar →</a>
        <a href={COMPETITION_EVENTS_URL} target="_blank" rel="noopener noreferrer" style={{ ...linkBtn, background: 'transparent', color: 'var(--color-navy-deep)', border: '1.5px solid var(--color-border)' }}>Competition events →</a>
      </div>

      {events && events.length > 0 && <Agenda events={events} />}

      <div style={{ border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden' }}>
        <iframe
          src={LAB_CALENDAR_EMBED_URL}
          title="Placer Robotics Lab Calendar"
          style={{ border: 0, width: '100%', height: 640, display: 'block' }}
          loading="lazy"
        />
      </div>
      <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: '0.75rem' }}>
        Competition events we’re attending are posted at <a href={COMPETITION_EVENTS_URL} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-navy-deep)', fontWeight: 600 }}>placerrobotics.org/events</a>.
      </p>
    </FamilyShell>
  )
}
