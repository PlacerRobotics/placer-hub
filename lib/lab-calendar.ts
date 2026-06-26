// Placer Robotics lab calendar (Google). The public calendar is heavily recurring,
// so the branded agenda uses the Google Calendar API with singleEvents=true (which
// expands recurrences). It needs GOOGLE_CALENDAR_API_KEY; without it, callers fall
// back to the public embed (which renders everything, no key required).

export const LAB_CALENDAR_ID = 'placerrobotics.org_55jm6hlkgktdptma4f1jboptb4@group.calendar.google.com'
export const LAB_TZ = 'America/Los_Angeles'
// Public embed (no key) + the human "add/open" link + our official competition events.
export const LAB_CALENDAR_EMBED_URL = `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(LAB_CALENDAR_ID)}&ctz=${encodeURIComponent(LAB_TZ)}&mode=MONTH&showTitle=0&showPrint=0&showCalendars=0`
export const LAB_CALENDAR_PUBLIC_URL = `https://calendar.google.com/calendar/u/0/r?cid=${Buffer.from(LAB_CALENDAR_ID).toString('base64')}`
export const COMPETITION_EVENTS_URL = 'https://placerrobotics.org/events'

export type LabEvent = {
  id: string
  title: string
  start: string // ISO
  end: string | null
  allDay: boolean
  location: string | null
  link: string | null
}

// Upcoming events via the Calendar API (recurrences expanded). Returns null when no
// API key is configured so callers can fall back to the embed. Cached ~15 min.
export async function fetchUpcomingLabEvents(maxResults = 12): Promise<LabEvent[] | null> {
  const key = process.env.GOOGLE_CALENDAR_API_KEY
  if (!key) return null
  const params = new URLSearchParams({
    key,
    singleEvents: 'true',
    orderBy: 'startTime',
    timeMin: new Date().toISOString(),
    maxResults: String(maxResults),
    timeZone: LAB_TZ,
  })
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(LAB_CALENDAR_ID)}/events?${params}`
  try {
    const res = await fetch(url, { next: { revalidate: 900 } })
    if (!res.ok) return null
    const json: any = await res.json()
    return ((json.items ?? []) as any[])
      .filter((e) => e.status !== 'cancelled' && (e.start?.dateTime || e.start?.date))
      .map((e) => ({
        id: String(e.id),
        title: String(e.summary ?? '(busy)'),
        start: e.start.dateTime ?? e.start.date,
        end: e.end?.dateTime ?? e.end?.date ?? null,
        allDay: !e.start.dateTime,
        location: e.location ?? null,
        link: e.htmlLink ?? null,
      }))
  } catch {
    return null
  }
}
