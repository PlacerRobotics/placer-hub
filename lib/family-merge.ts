// Merge Families — design: docs/design_email_identity_v1_0.md §3 (the Shu
// case: one real family split across two records, one parent+kid on each).
//
// Survivor A absorbs family B. Repointed to A: guardian, volunteer_profile,
// student, student_application, emergency_contact, enrollment,
// payment_transaction, financial_aid — all verified mutable, none append-only.
// family_season is reconciled per season (the further-along status wins; B's
// row is dropped). waiver_signature is append-only (a trigger blocks UPDATE/
// DELETE, including the cascade) and is left pointing at B — safe, because
// nothing in the app reads a signature by family_id, only by student_id/
// guardian_id, both of which still resolve correctly after the merge. That
// means B can virtually never be a clean delete afterward if anyone in it ever
// signed anything; the caller should archive B in that case (same fallback
// the family-delete route already uses).
//
// Both parents keep their own guardian rows and login emails — a merge is a
// family_id repoint, never a guardian identity change.

import { logRegAudit } from '@/lib/admin/reg-audit'

// Rank for "who's further along" when both families have a row for the same
// season — higher wins. Terminal/negative statuses never outrank an active one.
const STATUS_RANK: Record<string, number> = {
  registered: 5,
  cleared_to_register: 4,
  accepted: 3,
  applied: 2,
  prospect: 1,
  declined: 0,
  suspended: 0,
  cancelled: 0,
}
function rank(status: string): number {
  return STATUS_RANK[status] ?? 0
}

export type MergePreview = {
  source: { familyId: string; label: string }
  target: { familyId: string; label: string }
  guardians: { id: string; name: string; email: string }[]
  students: { id: string; name: string }[]
  volunteers: { id: string; guardianName: string }[]
  enrollmentCount: number
  paymentCount: number
  financialAidCount: number
  waiverSignatureCount: number
  seasons: { season: string; sourceStatus: string | null; targetStatus: string | null; winner: string | null }[]
}

async function count(db: any, table: string, familyId: string): Promise<number> {
  return ((await db.from(table).select('*', { count: 'exact', head: true }).eq('family_id', familyId)).count ?? 0) as number
}

export async function previewFamilyMerge(db: any, sourceFamilyId: string, targetFamilyId: string): Promise<MergePreview | { error: string }> {
  if (sourceFamilyId === targetFamilyId) return { error: 'Source and target are the same family.' }
  const [{ data: source }, { data: target }] = await Promise.all([
    db.from('family').select('id, display_name, primary_email').eq('id', sourceFamilyId).maybeSingle(),
    db.from('family').select('id, display_name, primary_email').eq('id', targetFamilyId).maybeSingle(),
  ])
  if (!source) return { error: 'Source family not found.' }
  if (!target) return { error: 'Target family not found.' }

  const [{ data: sGuardians }, { data: sStudents }, { data: sVps }, { data: sSeasons }, { data: tSeasons }] = await Promise.all([
    db.from('guardian').select('id, first_name, last_name, login_email').eq('family_id', sourceFamilyId),
    db.from('student').select('id, first_name, last_name').eq('family_id', sourceFamilyId),
    db.from('volunteer_profile').select('id, guardian_id').eq('family_id', sourceFamilyId),
    db.from('family_season').select('season, status').eq('family_id', sourceFamilyId),
    db.from('family_season').select('season, status').eq('family_id', targetFamilyId),
  ])
  const guardianNameById: Record<string, string> = Object.fromEntries((sGuardians ?? []).map((g: any) => [g.id, `${g.first_name} ${g.last_name}`.trim()]))

  const tByseason: Record<string, string> = Object.fromEntries((tSeasons ?? []).map((f: any) => [f.season, f.status]))
  const sByseason: Record<string, string> = Object.fromEntries((sSeasons ?? []).map((f: any) => [f.season, f.status]))
  const allSeasons = [...new Set([...Object.keys(sByseason), ...Object.keys(tByseason)])].sort()
  const seasons = allSeasons.map((season) => {
    const sourceStatus = sByseason[season] ?? null
    const targetStatus = tByseason[season] ?? null
    const winner = !targetStatus ? 'source' : !sourceStatus ? 'target' : rank(sourceStatus) > rank(targetStatus) ? 'source' : 'target'
    return { season, sourceStatus, targetStatus, winner }
  })

  return {
    source: { familyId: sourceFamilyId, label: source.display_name ?? source.primary_email },
    target: { familyId: targetFamilyId, label: target.display_name ?? target.primary_email },
    guardians: (sGuardians ?? []).map((g: any) => ({ id: g.id, name: `${g.first_name} ${g.last_name}`.trim(), email: g.login_email })),
    students: (sStudents ?? []).map((s: any) => ({ id: s.id, name: `${s.first_name} ${s.last_name}`.trim() })),
    volunteers: (sVps ?? []).map((v: any) => ({ id: v.id, guardianName: guardianNameById[v.guardian_id] ?? 'Guardian' })),
    enrollmentCount: await count(db, 'enrollment', sourceFamilyId),
    paymentCount: await count(db, 'payment_transaction', sourceFamilyId),
    financialAidCount: await count(db, 'financial_aid', sourceFamilyId),
    waiverSignatureCount: await count(db, 'waiver_signature', sourceFamilyId),
    seasons,
  }
}

export type MergeResult = { ok: true; sourceRemains: 'deleted' | 'archived'; blockers?: Record<string, number> } | { ok: false; error: string }

export async function executeFamilyMerge(db: any, sourceFamilyId: string, targetFamilyId: string, adminId: string): Promise<MergeResult> {
  if (sourceFamilyId === targetFamilyId) return { ok: false, error: 'Source and target are the same family.' }
  const [{ data: source }, { data: target }] = await Promise.all([
    db.from('family').select('id').eq('id', sourceFamilyId).maybeSingle(),
    db.from('family').select('id').eq('id', targetFamilyId).maybeSingle(),
  ])
  if (!source) return { ok: false, error: 'Source family not found.' }
  if (!target) return { ok: false, error: 'Target family not found.' }

  // Repoint every mutable family-scoped table. Order doesn't matter — none of
  // these reference each other by family_id, only independently by family_id.
  for (const table of ['guardian', 'volunteer_profile', 'student', 'student_application', 'emergency_contact', 'enrollment', 'payment_transaction', 'financial_aid']) {
    const { error } = await db.from(table).update({ family_id: targetFamilyId }).eq('family_id', sourceFamilyId)
    if (error) return { ok: false, error: `Failed moving ${table}: ${error.message}` }
  }

  // Reconcile family_season per season — the further-along status wins.
  const [{ data: sSeasons }, { data: tSeasons }] = await Promise.all([
    db.from('family_season').select('id, season, status').eq('family_id', sourceFamilyId),
    db.from('family_season').select('id, season, status').eq('family_id', targetFamilyId),
  ])
  const tRowBySeason: Record<string, any> = Object.fromEntries((tSeasons ?? []).map((f: any) => [f.season, f]))
  for (const sRow of sSeasons ?? []) {
    const tRow = tRowBySeason[sRow.season]
    if (!tRow) {
      // Target has no row for this season — the source's row simply moves.
      const { error } = await db.from('family_season').update({ family_id: targetFamilyId }).eq('id', sRow.id)
      if (error) return { ok: false, error: `Failed moving family_season ${sRow.season}: ${error.message}` }
      continue
    }
    if (rank(sRow.status) > rank(tRow.status)) {
      const targetOldStatus = tRow.status // capture before the update below mutates it
      const { error } = await db.from('family_season').update({ status: sRow.status }).eq('id', tRow.id)
      if (error) return { ok: false, error: `Failed updating family_season ${sRow.season}: ${error.message}` }
      await logRegAudit(db, { familySeasonId: tRow.id, field: 'status', oldValue: targetOldStatus, newValue: sRow.status, changedBy: adminId, notes: `merged from family ${sourceFamilyId} (season ${sRow.season})` })
    }
    // Source's row for this season is superseded either way — drop it.
    await db.from('family_season').delete().eq('id', sRow.id)
  }

  // waiver_signature is append-only (trigger blocks UPDATE/DELETE) — cannot
  // move. Left pointing at sourceFamilyId; harmless (nothing reads it by
  // family_id) but means source can only be archived, not deleted, if any exist.
  const blockers = {
    students: await count(db, 'student', sourceFamilyId),
    enrollments: await count(db, 'enrollment', sourceFamilyId),
    payments: await count(db, 'payment_transaction', sourceFamilyId),
    waiver_signatures: await count(db, 'waiver_signature', sourceFamilyId),
    volunteer_profiles: await count(db, 'volunteer_profile', sourceFamilyId),
    financial_aid: await count(db, 'financial_aid', sourceFamilyId),
  }
  const remaining = Object.entries(blockers).filter(([, c]) => c > 0)

  if (remaining.length === 0) {
    const { error } = await db.from('family').delete().eq('id', sourceFamilyId)
    if (error) return { ok: false, error: `Merge completed but the empty shell failed to delete: ${error.message}` }
    return { ok: true, sourceRemains: 'deleted' }
  }
  if (remaining.every(([k]) => k === 'waiver_signatures')) {
    const { error } = await db.from('family').update({ status: 'archived' }).eq('id', sourceFamilyId)
    if (error) return { ok: false, error: `Merge completed but the shell failed to archive: ${error.message}` }
    return { ok: true, sourceRemains: 'archived' }
  }
  // Shouldn't happen — every other table was just moved above — but never
  // silently leave orphaned data unreported.
  return { ok: false, error: `Merge completed but the source family unexpectedly still has: ${remaining.map(([k, c]) => `${c} ${k.replace(/_/g, ' ')}`).join(', ')}.` }
}
