// Supporter tier from total amount paid (dashboard badge). Pure + unit-tested.
export function supporterLevel(amount: number): string | null {
  if (amount >= 1040) return 'Champion'
  if (amount >= 790) return 'Standard'
  if (amount >= 590) return 'Minimum'
  return null
}
