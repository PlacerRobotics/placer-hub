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
  /** Other known-good addresses for this same person (guardian_email_alias) —
   * a match on any of these counts the same as matching `email` itself. */
  altEmails?: string[]
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

  // Dedupe expected people by identity (guardianId when known, else email) — one
  // person can be guardian AND volunteer, and can have several known-good emails
  // (login_email, slack_email, guardian_email_alias rows). A match on ANY of
  // their emails counts; they must appear in exactly one bucket, not once per email.
  const byIdentity = new Map<string, { person: HubPerson; emails: Set<string> }>()
  for (const p of input.expected) {
    const emails = [p.email, ...(p.altEmails ?? [])].map(normalizeEmail).filter(Boolean)
    if (!emails.length) continue
    const key = p.guardianId ?? emails[0]
    const entry = byIdentity.get(key)
    if (entry) emails.forEach((e) => entry.emails.add(e))
    else byIdentity.set(key, { person: { ...p, email: emails[0] }, emails: new Set(emails) })
  }
  const allExpectedEmails = new Set([...byIdentity.values()].flatMap((e) => [...e.emails]))

  const out: SlackReconciliation = { notJoined: [], departed: [], under13Present: [], unexpected: [], matched: [] }

  for (const { person, emails } of byIdentity.values()) {
    const activeMatch = [...emails].map((e) => activeByEmail.get(e)).find(Boolean)
    const deletedMatch = [...emails].map((e) => deletedByEmail.get(e)).find(Boolean)
    if (activeMatch) out.matched.push({ person, slackUserId: activeMatch.id })
    else if (deletedMatch) out.departed.push({ person, slackUserId: deletedMatch.id })
    else out.notJoined.push(person)
  }

  for (const u of humans) {
    if (u.deleted) continue
    const email = normalizeEmail(u.email)
    if (email && under13.has(email)) out.under13Present.push({ email, slackUserId: u.id, slackName: u.name })
    // An under-13 match is already in its own (more urgent) bucket.
    else if (!email || !allExpectedEmails.has(email)) out.unexpected.push({ email: u.email, slackUserId: u.id, slackName: u.name })
  }

  return out
}

// ── Fuzzy name matching for "unexpected" Slack members ─────────────────────
//
// Most of the "unexpected" entries aren't strangers — they're registered
// guardians/students already on Slack under a personal address that doesn't
// match what's on file (gmail vs. work email, a maiden name, etc.). Matching
// by NAME against people we're specifically missing (notJoined) surfaces those
// so an admin can confirm and record the address as a known alias — see
// lib/slack-recon.ts's gatherFuzzyMatchCandidates and
// app/api/admin/slack/confirm-alt-email/route.ts for the write side.

function normalizeName(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim()
}

function bigrams(s: string): string[] {
  const out: string[] = []
  for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2))
  return out
}

// Dice's coefficient over character bigrams — tolerant of typos/spelling variants.
function bigramDice(a: string, b: string): number {
  const bgA = bigrams(a)
  const bgB = bigrams(b)
  if (!bgA.length || !bgB.length) return a === b ? 1 : 0
  const counts = new Map<string, number>()
  for (const bg of bgA) counts.set(bg, (counts.get(bg) ?? 0) + 1)
  let overlap = 0
  for (const bg of bgB) {
    const c = counts.get(bg) ?? 0
    if (c > 0) { overlap++; counts.set(bg, c - 1) }
  }
  return (2 * overlap) / (bgA.length + bgB.length)
}

// Similarity between two individual name tokens. A single-letter token (an
// initial, e.g. Slack showing "J Doe") is scored on first-letter match rather
// than bigrams, which are meaningless below length 2.
function tokenScore(a: string, b: string): number {
  if (a === b) return 1
  if (a.length <= 1 || b.length <= 1) return a[0] === b[0] ? 1 : 0
  return bigramDice(a, b)
}

/**
 * 0–1 similarity between two display names. Every token on EACH side must
 * find a good partner on the other side (the worst-matched token sets the
 * score, both directions) — this is deliberately strict, not an average.
 *
 * Whole-string bigram comparison (the earlier version of this function) lets
 * a long shared surname dominate the score even when the given name is
 * completely different — "Arjun Dhillon" vs "Robin Dhillon" scored 0.67 on
 * shared surname alone, a false match between two different real people
 * (sibling/parent/spouse), the exact mistake this tool exists to avoid making.
 * Requiring every token to independently match closes that hole while still
 * tolerating reordering ("Smith, John" vs "John Smith") and typos.
 */
export function nameSimilarity(a: string, b: string): number {
  const na = normalizeName(a)
  const nb = normalizeName(b)
  if (!na || !nb) return 0
  if (na === nb) return 1

  const tokensA = na.split(' ').filter(Boolean)
  const tokensB = nb.split(' ').filter(Boolean)
  const bestFor = (token: string, others: string[]) => Math.max(0, ...others.map((o) => tokenScore(token, o)))
  const minA = Math.min(...tokensA.map((t) => bestFor(t, tokensB)))
  const minB = Math.min(...tokensB.map((t) => bestFor(t, tokensA)))
  return Math.min(minA, minB)
}

export const FUZZY_MATCH_THRESHOLD = 0.5

export type FuzzyMatchCandidate = { id: string; name: string; kind: 'guardian' | 'student' }
export type FuzzyMatch = {
  slackUserId: string
  slackName: string
  slackEmail: string | null
  candidateId: string
  candidateName: string
  candidateKind: 'guardian' | 'student'
  score: number
}

// Best-candidate name match per unexpected Slack member, above threshold. Never
// auto-applies anything — this only proposes; a human confirms each one.
export function fuzzyMatchUnexpected(
  unexpected: { email: string | null; slackUserId: string; slackName: string }[],
  candidates: FuzzyMatchCandidate[]
): FuzzyMatch[] {
  const out: FuzzyMatch[] = []
  for (const u of unexpected) {
    let best: { c: FuzzyMatchCandidate; score: number } | null = null
    for (const c of candidates) {
      const score = nameSimilarity(u.slackName, c.name)
      if (score >= FUZZY_MATCH_THRESHOLD && (!best || score > best.score)) best = { c, score }
    }
    if (best) {
      out.push({
        slackUserId: u.slackUserId, slackName: u.slackName, slackEmail: u.email,
        candidateId: best.c.id, candidateName: best.c.name, candidateKind: best.c.kind,
        score: Math.round(best.score * 100) / 100,
      })
    }
  }
  return out.sort((a, b) => b.score - a.score)
}
