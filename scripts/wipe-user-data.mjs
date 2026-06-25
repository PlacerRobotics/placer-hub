// Wipe all user-created data for a clean reload — DESTRUCTIVE.
//
// Dry-run by default (prints what WOULD be deleted). To actually wipe:
//   node scripts/wipe-user-data.mjs --yes-wipe-production
//
// PRESERVES: all admins (auth.users referenced by admin_profile, + their profiles and
// role assignments) and seed/reference data (season_config, school, waiver_template).
// DELETES: every family/guardian/student/registration/team/volunteer/sponsor record,
// and every non-admin auth user. pg-only — reads SUPABASE_DB_URL from .env.local.

import { readFileSync } from 'node:fs'
import pg from 'pg'

const dbUrl = (readFileSync(new URL('../.env.local', import.meta.url), 'utf8').match(/^SUPABASE_DB_URL=(.*)$/m)?.[1] ?? '')
  .trim().replace(/^["']|["']$/g, '')
if (!dbUrl) { console.error('SUPABASE_DB_URL not found in .env.local'); process.exit(1) }

const EXECUTE = process.argv.includes('--yes-wipe-production')

// User-data tables to clear (CASCADE handles FK order + any dependents not listed).
// season_config / school / waiver_template / admin_profile / admin_role_assignment are
// intentionally NOT here.
const WIPE_TABLES = [
  'family', 'family_season', 'guardian', 'student', 'student_application', 'enrollment',
  'emergency_contact', 'waiver_signature', 'financial_aid', 'family_sponsor_interest',
  'team', 'team_member', 'iq_team_kit',
  'volunteer_profile', 'volunteer_clearance', 'volunteer_step', 'youth_protection_cert',
  'payment_transaction', 'notification_log', 'registration_audit_log', 'sync_log', 'error_log',
  'sponsor', 'sponsor_commitment', 'enrollment_sponsor_credit',
]

const c = new pg.Client({ connectionString: dbUrl })
await c.connect()
try {
  // Which of those tables actually exist?
  const { rows: existRows } = await c.query(
    `select table_name from information_schema.tables where table_schema = 'public' and table_name = any($1)`,
    [WIPE_TABLES]
  )
  const existing = WIPE_TABLES.filter((t) => existRows.some((r) => r.table_name === t))

  // Admins to preserve.
  const { rows: admins } = await c.query(
    `select ap.email, ap.auth_user_id,
            coalesce(array_agg(ara.role::text) filter (where ara.revoked_at is null), '{}') as roles
     from admin_profile ap left join admin_role_assignment ara on ara.admin_profile_id = ap.id
     group by ap.email, ap.auth_user_id order by ap.email`
  )
  const preservedIds = admins.map((a) => a.auth_user_id).filter(Boolean)

  console.log(`\n${EXECUTE ? '🔴 EXECUTING WIPE' : '🟡 DRY RUN (no changes)'} — ${new Date().toISOString()}\n`)
  console.log(`Preserving ${admins.length} admin(s):`)
  for (const a of admins) console.log(`  • ${a.email}  [${a.roles.join(', ') || 'no active roles'}]`)
  console.log('Preserving reference data: season_config, school, waiver_template\n')

  console.log('Rows to delete:')
  let total = 0
  for (const t of existing) {
    const { rows } = await c.query(`select count(*)::int as n from ${t}`)
    if (rows[0].n) { console.log(`  ${t.padEnd(26)} ${rows[0].n}`); total += rows[0].n }
  }
  const { rows: au } = await c.query(`select count(*)::int as n from auth.users where not (id = any($1::uuid[]))`, [preservedIds])
  console.log(`  ${'auth.users (non-admin)'.padEnd(26)} ${au[0].n}`)
  console.log(`\n  TOTAL public rows: ${total}\n`)

  if (!EXECUTE) {
    console.log('Dry run only. Re-run with  --yes-wipe-production  to delete the above.\n')
  } else {
    if (!preservedIds.length) { console.error('ABORT: no admin auth users found to preserve — refusing to delete all auth.users.'); process.exit(1) }
    await c.query('begin')
    await c.query(`truncate ${existing.join(', ')} restart identity cascade`)
    await c.query(`delete from auth.users where not (id = any($1::uuid[]))`, [preservedIds])
    await c.query('commit')
    // Verify
    const { rows: famN } = await c.query('select count(*)::int as n from family')
    const { rows: usrN } = await c.query('select count(*)::int as n from auth.users')
    const { rows: adminN } = await c.query('select count(*)::int as n from admin_profile')
    console.log(`✅ Wiped. family=${famN[0].n}, auth.users=${usrN[0].n}, admin_profile=${adminN[0].n} (expected ${admins.length}).\n`)
  }
} catch (e) {
  console.error('ERROR:', e.message)
  try { await c.query('rollback') } catch {}
  process.exitCode = 1
} finally {
  await c.end()
}
