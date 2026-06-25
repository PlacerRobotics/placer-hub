// Fundraising commitment deadline: July 31, 2026 — or 2 weeks after the family is
// accepted, whichever is later (so late-accepted families still get two weeks).

export const FUNDRAISING_DUE = '2026-07-31'

const fmt = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })

export function fundraisingDeadline(reviewedAt: string | null | undefined): string {
  const base = new Date(FUNDRAISING_DUE + 'T00:00:00')
  if (reviewedAt) {
    const plus2 = new Date(reviewedAt)
    plus2.setDate(plus2.getDate() + 14)
    if (plus2 > base) return fmt(plus2.toISOString().slice(0, 10))
  }
  return fmt(FUNDRAISING_DUE)
}
