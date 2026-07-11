// Google Groups reconciliation (task 1.8) — pure, tested in
// tests/google-groups.test.ts. v0 per the spec: the admin pastes a Google Groups
// member export (CSV or any text), we compare against every email the Hub knows,
// and report three buckets. FLAG, DON'T PURGE — no removal actions exist here;
// unmatched group members are only surfaced until the Aug 31 cutoff.

export type HubEmailOwner = { email: string; owner: string; kind: string }

export type GroupReconciliation = {
  matched: { email: string; owner: string; kind: string }[]
  /** in the Google Group but unknown to the Hub — flag for review */
  inGroupNotHub: string[]
  /** known to the Hub but missing from the group */
  inHubNotGroup: HubEmailOwner[]
}

// Pull every email address out of pasted text (Google's CSV export, a raw
// column, or a comma-separated list all work). Lowercased + deduped.
export function extractEmails(text: string): string[] {
  const matches = text.match(/[A-Za-z0-9._%+'-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? []
  return [...new Set(matches.map((e) => e.toLowerCase()))]
}

export function reconcileGroup(groupEmails: string[], hubEmails: HubEmailOwner[]): GroupReconciliation {
  const group = new Set(groupEmails.map((e) => e.trim().toLowerCase()).filter(Boolean))

  // One Hub owner per email (a guardian's login + communication email may repeat).
  const hubByEmail = new Map<string, HubEmailOwner>()
  for (const h of hubEmails) {
    const key = h.email.trim().toLowerCase()
    if (key && !hubByEmail.has(key)) hubByEmail.set(key, { ...h, email: key })
  }

  const out: GroupReconciliation = { matched: [], inGroupNotHub: [], inHubNotGroup: [] }
  for (const email of group) {
    const hub = hubByEmail.get(email)
    if (hub) out.matched.push(hub)
    else out.inGroupNotHub.push(email)
  }
  for (const [email, hub] of hubByEmail) {
    if (!group.has(email)) out.inHubNotGroup.push(hub)
  }
  out.inGroupNotHub.sort()
  out.matched.sort((a, b) => a.email.localeCompare(b.email))
  out.inHubNotGroup.sort((a, b) => a.email.localeCompare(b.email))
  return out
}
