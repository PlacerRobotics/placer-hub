// Slack integration (task 1.6 / decision D11).
//
// Standard-plan Slack has no public invite API, so nothing here provisions
// accounts. The design is: invite LINKS delivered at the right moment (register
// confirmation / volunteer cleared — see lib/email.ts), a nightly reconciliation
// that reports drift, and additive-only bot actions (channel placement via
// conversations.invite). Channel REMOVAL is never automatic — flagged members go
// to the /admin/slack queue and an admin confirms each kick.
//
// The reconcile logic is pure (tests/slack-reconcile.test.ts); only the fetch
// wrappers talk to Slack. Everything is gated on SLACK_MAIN_BOT_TOKEN and fails
// soft, mirroring the RESEND_API_KEY pattern in lib/email.ts.

const SLACK_API = 'https://slack.com/api'

export type SlackUser = {
  id: string
  email: string | null
  name: string
  deleted: boolean
  isBot: boolean
}

async function slackCall(token: string, method: string, params: Record<string, string> = {}): Promise<any> {
  const body = new URLSearchParams(params)
  const res = await fetch(`${SLACK_API}/${method}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  return res.json().catch(() => ({ ok: false, error: `http_${res.status}` }))
}

// All workspace members (paginated). Emails require the users:read.email scope.
export async function listSlackUsers(token: string): Promise<SlackUser[]> {
  const users: SlackUser[] = []
  let cursor = ''
  for (let page = 0; page < 50; page++) {
    const data = await slackCall(token, 'users.list', { limit: '200', ...(cursor ? { cursor } : {}) })
    if (!data.ok) throw new Error(`Slack users.list failed: ${data.error}`)
    for (const m of data.members ?? []) {
      users.push({
        id: m.id,
        email: m.profile?.email ? String(m.profile.email).toLowerCase() : null,
        name: m.profile?.real_name || m.real_name || m.name || m.id,
        deleted: !!m.deleted,
        isBot: !!m.is_bot || m.id === 'USLACKBOT',
      })
    }
    cursor = data.response_metadata?.next_cursor ?? ''
    if (!cursor) break
  }
  return users
}

// Additive channel placement. already_in_channel is success, not an error.
export async function inviteToChannel(token: string, channelId: string, slackUserId: string): Promise<{ ok: boolean; error?: string; alreadyIn?: boolean }> {
  const data = await slackCall(token, 'conversations.invite', { channel: channelId, users: slackUserId })
  if (data.ok) return { ok: true }
  if (data.error === 'already_in_channel') return { ok: true, alreadyIn: true }
  return { ok: false, error: data.error }
}

// Admin-confirmed channel removal (D11 queue). not_in_channel is a no-op success.
export async function kickFromChannel(token: string, channelId: string, slackUserId: string): Promise<{ ok: boolean; error?: string }> {
  const data = await slackCall(token, 'conversations.kick', { channel: channelId, user: slackUserId })
  if (data.ok || data.error === 'not_in_channel') return { ok: true }
  return { ok: false, error: data.error }
}

// ── Pure reconciliation ───────────────────────────────────────────────────────

export type HubPerson = {
  email: string
  name: string
  kind: 'guardian' | 'volunteer'
  guardianId: string | null
}

export type SlackReconciliation = {
  /** expected in the workspace but no active Slack account matches */
  notJoined: HubPerson[]
  /** expected member whose Slack account is deactivated */
  departed: { person: HubPerson; slackUserId: string }[]
  /** active Slack account matching an under-13 student email — removal queue */
  under13Present: { email: string; slackUserId: string; slackName: string }[]
  /** active human account matching no expected member — review, never auto-removed */
  unexpected: { email: string | null; slackUserId: string; slackName: string }[]
  matched: { person: HubPerson; slackUserId: string }[]
}

export function normalizeEmail(e: string | null | undefined): string {
  return (e ?? '').trim().toLowerCase()
}

export function reconcileSlack(input: {
  expected: HubPerson[]
  under13Emails: Iterable<string>
  slackUsers: SlackUser[]
}): SlackReconciliation {
  const under13 = new Set([...input.under13Emails].map(normalizeEmail).filter(Boolean))
  const humans = input.slackUsers.filter((u) => !u.isBot)
  const activeByEmail = new Map<string, SlackUser>()
  const deletedByEmail = new Map<string, SlackUser>()
  for (const u of humans) {
    if (!u.email) continue
    const key = normalizeEmail(u.email)
    if (u.deleted) { if (!deletedByEmail.has(key)) deletedByEmail.set(key, u) }
    else if (!activeByEmail.has(key)) activeByEmail.set(key, u)
  }

  // Dedupe expected people by email — one person can be guardian AND volunteer.
  const expectedByEmail = new Map<string, HubPerson>()
  for (const p of input.expected) {
    const key = normalizeEmail(p.email)
    if (key && !expectedByEmail.has(key)) expectedByEmail.set(key, { ...p, email: key })
  }

  const out: SlackReconciliation = { notJoined: [], departed: [], under13Present: [], unexpected: [], matched: [] }

  for (const [email, person] of expectedByEmail) {
    const active = activeByEmail.get(email)
    if (active) out.matched.push({ person, slackUserId: active.id })
    else if (deletedByEmail.has(email)) out.departed.push({ person, slackUserId: deletedByEmail.get(email)!.id })
    else out.notJoined.push(person)
  }

  for (const u of humans) {
    if (u.deleted) continue
    const email = normalizeEmail(u.email)
    if (email && under13.has(email)) out.under13Present.push({ email, slackUserId: u.id, slackName: u.name })
    // An under-13 match is already in its own (more urgent) bucket.
    else if (!email || !expectedByEmail.has(email)) out.unexpected.push({ email: u.email, slackUserId: u.id, slackName: u.name })
  }

  return out
}
