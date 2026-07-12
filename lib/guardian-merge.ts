// Collapse two duplicate guardian rows WITHIN one family into one — distinct
// from lib/family-merge.ts (which merges two separate families). This is the
// tool the "Same name, different login emails — within one family" cases on
// the duplicates report actually need (Roy/Morrell/Kalyan/Padiyar/Mandot/
// Chavez): one real person entered twice under two emails on the SAME family
// — most likely via the "add a second guardian" self-service flow being used
// to fix a login-email typo instead of change-email, which creates a new
// guardian row rather than updating the existing one.
//
// Survivor keeps their own login_email; the loser's login_email (and any
// other emails on the loser's row) become aliases of the survivor. Everything
// keyed by guardian_id on the loser (team_member coach assignments,
// volunteer_profile, the dormant person_role table) repoints to the survivor.
//
// waiver_signature is append-only (a trigger blocks UPDATE/DELETE, including
// the cascade from a guardian delete) — if the loser has ever signed anything,
// their guardian row can never be deleted, full stop. It's left in place as an
// inert historical shell; the alias recording means the ingestion-side
// duplicate-minting risk is closed regardless of whether the row itself goes
// away.

import { addGuardianEmailAlias } from '@/lib/guardian-lookup'

export type GuardianMergePreview = {
  loser: { id: string; name: string; email: string }
  survivor: { id: string; name: string; email: string }
  teamMemberCount: number
  loserHasVolunteerProfile: boolean
  survivorHasVolunteerProfile: boolean
  waiverSignatureCount: number
}

async function count(db: any, table: string, col: string, id: string): Promise<number> {
  return ((await db.from(table).select('*', { count: 'exact', head: true }).eq(col, id)).count ?? 0) as number
}

export async function previewGuardianMerge(db: any, loserId: string, survivorId: string): Promise<GuardianMergePreview | { error: string }> {
  if (loserId === survivorId) return { error: 'That’s the same guardian.' }
  const [{ data: loser }, { data: survivor }] = await Promise.all([
    db.from('guardian').select('id, family_id, first_name, last_name, login_email').eq('id', loserId).maybeSingle(),
    db.from('guardian').select('id, family_id, first_name, last_name, login_email').eq('id', survivorId).maybeSingle(),
  ])
  if (!loser) return { error: 'Guardian to merge away not found.' }
  if (!survivor) return { error: 'Surviving guardian not found.' }
  if (loser.family_id !== survivor.family_id) {
    return { error: 'These guardians are in different families — use "Merge into another family" on the family page instead, not this tool.' }
  }

  const [{ data: lvp }, { data: svp }] = await Promise.all([
    db.from('volunteer_profile').select('id').eq('guardian_id', loserId).maybeSingle(),
    db.from('volunteer_profile').select('id').eq('guardian_id', survivorId).maybeSingle(),
  ])

  return {
    loser: { id: loser.id, name: `${loser.first_name} ${loser.last_name}`.trim(), email: loser.login_email },
    survivor: { id: survivor.id, name: `${survivor.first_name} ${survivor.last_name}`.trim(), email: survivor.login_email },
    teamMemberCount: await count(db, 'team_member', 'guardian_id', loserId),
    loserHasVolunteerProfile: !!lvp,
    survivorHasVolunteerProfile: !!svp,
    waiverSignatureCount: await count(db, 'waiver_signature', 'guardian_id', loserId),
  }
}

export type GuardianMergeResult = { ok: true; loserRow: 'deleted' | 'kept (has signed waivers)' } | { ok: false; error: string }

export async function executeGuardianMerge(db: any, loserId: string, survivorId: string, adminId: string): Promise<GuardianMergeResult> {
  const preview = await previewGuardianMerge(db, loserId, survivorId)
  if ('error' in preview) return { ok: false, error: preview.error }

  if (preview.loserHasVolunteerProfile && preview.survivorHasVolunteerProfile) {
    return { ok: false, error: 'Both guardians have their own volunteer record — merging two volunteer histories is a manual decision. Use "Move to that guardian" on one of the volunteer records first (Duplicate cleanup panel), then retry.' }
  }

  // team_member: move each row; a (team, guardian, season) unique index means
  // the survivor may already independently hold the same coach assignment —
  // in that case the loser's row is fully redundant, so revoke it instead of
  // erroring the whole merge over one duplicate row.
  const { data: tms } = await db.from('team_member').select('id').eq('guardian_id', loserId)
  for (const tm of tms ?? []) {
    const { error } = await db.from('team_member').update({ guardian_id: survivorId }).eq('id', tm.id)
    if (error) await db.from('team_member').update({ revoked_at: new Date().toISOString() }).eq('id', tm.id)
  }

  if (preview.loserHasVolunteerProfile && !preview.survivorHasVolunteerProfile) {
    const { error } = await db.from('volunteer_profile').update({ guardian_id: survivorId }).eq('guardian_id', loserId)
    if (error) return { ok: false, error: `Failed moving volunteer profile: ${error.message}` }
  }

  // Dormant table (no code reads it), but cheap and correct to keep consistent.
  await db.from('person_role').update({ guardian_id: survivorId }).eq('guardian_id', loserId)

  // The loser's login becomes a known alias — closes the ingestion-side
  // duplicate-minting risk regardless of whether the row itself can be deleted.
  await addGuardianEmailAlias(db, survivorId, preview.loser.email, 'merged_guardian', adminId)

  if (preview.waiverSignatureCount > 0) {
    // Append-only child rows block the cascade — this guardian row can never
    // be deleted. Left in place; harmless (nothing reads a guardian by "is it
    // the alias-holder"), and the alias above means it stops causing dupes.
    return { ok: true, loserRow: 'kept (has signed waivers)' }
  }

  const { error } = await db.from('guardian').delete().eq('id', loserId)
  if (error) return { ok: false, error: `Merge completed but the duplicate guardian row failed to delete: ${error.message}` }
  return { ok: true, loserRow: 'deleted' }
}
