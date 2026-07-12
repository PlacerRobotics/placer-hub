// Normalizes a user-typed/pasted email string before it's ever compared or
// persisted. Every ingestion point in the app already does `String(x).trim().
// toLowerCase()` at the point it reads an email off a request body — this is a
// drop-in replacement for that idiom, so swapping it in is behavior-preserving
// for already-clean input.
//
// Incident (2026-07-11): a coach pasted parent contact info from her email
// client into the IQ roster-add form and it landed as "mailto:name@ex.com" —
// browsers can include the `mailto:` scheme when the copied text originated
// from a mailto hyperlink rather than plain text. Because every guardian
// lookup/creation path does an exact-ish match on the cleaned email
// (`ilike('login_email', pEmail)`), the corrupted value silently failed to
// match the parent's real account and created a SECOND, unreachable family
// record instead (login_email is `unique`, so the real account was untouched
// — but the coach's team now points partly at a duplicate that can never sign
// in, and the real parent never got an invite for this student).
//
// Also strips the "Name <email@ex.com>" wrapper produced by copying a mail
// header / contact card, which has the same failure mode.
export function cleanEmail(raw: string | null | undefined): string {
  let s = (raw ?? '').trim()
  if (!s) return ''
  const angled = s.match(/<([^<>]+)>\s*$/)
  if (angled) s = angled[1].trim()
  s = s.replace(/^mailto:/i, '').trim()
  return s.toLowerCase()
}

export function isLikelyEmail(s: string): boolean {
  return /^[^\s@:]+@[^\s@:]+\.[^\s@:]+$/.test(s)
}
