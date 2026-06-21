/**
 * Append a row to registration_audit_log. `db` is a service-role admin client.
 */
export async function logRegAudit(
  db: any,
  entry: {
    familySeasonId: string
    field: string
    oldValue?: string | null
    newValue?: string | null
    changedBy: string
    notes?: string | null
  }
) {
  await db.from('registration_audit_log').insert({
    family_season_id: entry.familySeasonId,
    field_changed: entry.field,
    old_value: entry.oldValue ?? null,
    new_value: entry.newValue ?? null,
    changed_by: entry.changedBy,
    notes: entry.notes ?? null,
  })
}
