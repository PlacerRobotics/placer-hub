// Suspected-duplicate guardian detection. Two import patterns motivated this
// (the "Wheeler" cases): the same person imported as a guardian in two families
// under different emails (login_email is the only match key), and the same
// guardian duplicated inside one family by a typo'd email domain
// (angela_romero@hotmil.com vs @hotmail.com). Pure functions — no DB access —
// so the grouping rules are unit-testable.

export type GuardianLike = {
  id: string
  family_id: string
  first_name: string
  last_name: string
  login_email: string
}

export type DuplicateGroup<G extends GuardianLike = GuardianLike> = {
  nameKey: string
  displayName: string
  guardians: G[]
  crossFamily: boolean
  familyIds: string[]
}

export type DomainNearMiss = { domain: string; suggestion: string }

// Providers whose misspellings we flag. Kept to high-volume consumer domains —
// a 1-edit neighbor of a small org domain is usually a different real domain.
export const COMMON_EMAIL_DOMAINS = [
  'gmail.com',
  'hotmail.com',
  'yahoo.com',
  'aol.com',
  'outlook.com',
  'icloud.com',
  'comcast.net',
  'live.com',
  'msn.com',
  'me.com',
  'att.net',
  'sbcglobal.net',
]

// Optimal-string-alignment (restricted Damerau-Levenshtein) distance: edits are
// insert/delete/substitute/adjacent-transposition. Plain Levenshtein misses the
// most common typo class — transpositions like gamil→gmail (distance 2 there, 1 here).
export function editDistance(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (Math.abs(m - n) > 2) return Math.abs(m - n) // cheap lower bound; callers only care about ≤1
  const d: number[][] = Array.from({ length: m + 1 }, (_, i) => {
    const row = new Array<number>(n + 1)
    row[0] = i
    return row
  })
  for (let j = 0; j <= n; j++) d[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
      }
    }
  }
  return d[m][n]
}

export function emailDomain(email: string): string | null {
  const at = email.lastIndexOf('@')
  if (at < 0) return null
  const domain = email.slice(at + 1).trim().toLowerCase()
  return domain || null
}

// If the email's domain is one edit away from (but not equal to) a common
// provider, return the suspected typo and the likely intended domain.
export function nearMissDomain(email: string): DomainNearMiss | null {
  const domain = emailDomain(email)
  if (!domain) return null
  if (COMMON_EMAIL_DOMAINS.includes(domain)) return null
  for (const common of COMMON_EMAIL_DOMAINS) {
    if (editDistance(domain, common) === 1) return { domain, suggestion: common }
  }
  return null
}

function nameKey(g: GuardianLike): string {
  return `${g.first_name.trim().toLowerCase()}|${g.last_name.trim().toLowerCase()}`
}

// Org staff logins (task: docs/design_email_identity_v1_0.md §2 — Amity Chavez
// case): a person can legitimately hold an @placerrobotics.org admin login
// AND a personal family login. That's an intentional two-identity setup, not
// a duplicate to clean up, and must never flag here.
export const STAFF_EMAIL_DOMAIN = 'placerrobotics.org'
function isStaffLogin(email: string): boolean {
  return email.trim().toLowerCase().endsWith(`@${STAFF_EMAIL_DOMAIN}`)
}

// Guardians sharing first+last name (case/whitespace-insensitive) but holding
// different login_emails — across families or within one. Guardians with a
// blank name component, or an @placerrobotics.org staff login, are excluded.
export function findDuplicateGroups<G extends GuardianLike>(guardians: G[]): DuplicateGroup<G>[] {
  const byName = new Map<string, G[]>()
  for (const g of guardians) {
    if (!g.first_name.trim() || !g.last_name.trim()) continue
    if (isStaffLogin(g.login_email)) continue
    const key = nameKey(g)
    const list = byName.get(key)
    if (list) list.push(g)
    else byName.set(key, [g])
  }

  const groups: DuplicateGroup<G>[] = []
  for (const [key, list] of byName) {
    if (list.length < 2) continue
    const emails = new Set(list.map((g) => g.login_email.trim().toLowerCase()))
    if (emails.size < 2) continue // same email in two families is a different (FK) problem, not this report's
    const familyIds = [...new Set(list.map((g) => g.family_id))]
    groups.push({
      nameKey: key,
      displayName: `${list[0].first_name.trim()} ${list[0].last_name.trim()}`,
      guardians: list,
      crossFamily: familyIds.length > 1,
      familyIds,
    })
  }
  return groups.sort((a, b) => a.displayName.localeCompare(b.displayName))
}
