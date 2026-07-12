// Alias-aware guardian lookup (task: docs/design_email_identity_v1_0.md §1).
//
// Every cross-person guardian lookup in the app — an admin/coach typing
// someone ELSE's email (roster-add, coach-add, import, move-family target,
// Zeffy payment matching) — must check `guardian_email_alias` as a fallback,
// or a known-alternate address (APS-era yahoo, an abandoned login) silently
// fails to match and mints a duplicate family. login_email is ALWAYS checked
// first and wins on conflict; aliases are a fallback, never authoritative.
//
// Self-lookups (matching the SIGNED-IN session's own auth email) do not need
// this — a session's email is definitionally that guardian's login_email.

export type GuardianMatch = { id: string; family_id: string; matchedVia: 'login_email' | 'alias' }

export async function findGuardianByEmail(db: any, email: string): Promise<GuardianMatch | null> {
  const clean = (email ?? '').trim().toLowerCase()
  if (!clean) return null

  const { data: g } = await db.from('guardian').select('id, family_id').ilike('login_email', clean).maybeSingle()
  if (g) return { id: g.id, family_id: g.family_id, matchedVia: 'login_email' }

  const { data: alias } = await db.from('guardian_email_alias').select('guardian_id').ilike('email', clean).maybeSingle()
  if (!alias) return null
  const { data: gu } = await db.from('guardian').select('id, family_id').eq('id', alias.guardian_id).maybeSingle()
  return gu ? { id: gu.id, family_id: gu.family_id, matchedVia: 'alias' } : null
}

// Record a known-alternate email for a guardian. Silently no-ops on a unique
// collision (the email is already an alias — of this guardian or another;
// either way there's nothing new to record, and this must never be the thing
// that blocks the caller's actual operation) or if it equals the guardian's
// current login_email (redundant).
export async function addGuardianEmailAlias(db: any, guardianId: string, email: string, source: string, createdBy?: string): Promise<void> {
  const clean = (email ?? '').trim().toLowerCase()
  if (!clean) return
  const { data: g } = await db.from('guardian').select('login_email').eq('id', guardianId).maybeSingle()
  if (g && (g.login_email ?? '').toLowerCase() === clean) return
  await db.from('guardian_email_alias').insert({ guardian_id: guardianId, email: clean, source, created_by: createdBy ?? null })
  // Insert errors (unique collision) are intentionally swallowed — see above.
}
