// Bootstrap admins (idempotent). Reusable for the clean-load. pg-only: connects with
// SUPABASE_DB_URL from .env.local — no service key needed.
//
// Usage:  node scripts/bootstrap-super-admins.mjs email1@... email2@... [--role=super_admin]
//
// For each email it: finds-or-creates the auth user (confirmed, email identity for
// magic-link sign-in), upserts admin_profile, and ensures a non-revoked role
// assignment (default super_admin). Emails are lowercased.

import { readFileSync } from 'node:fs'
import pg from 'pg'

const dbUrl = (readFileSync(new URL('../.env.local', import.meta.url), 'utf8').match(/^SUPABASE_DB_URL=(.*)$/m)?.[1] ?? '')
  .trim().replace(/^["']|["']$/g, '')
if (!dbUrl) { console.error('SUPABASE_DB_URL not found in .env.local'); process.exit(1) }

const args = process.argv.slice(2)
const role = (args.find((a) => a.startsWith('--role=')) ?? '--role=super_admin').split('=')[1]
const emails = args.filter((a) => !a.startsWith('--')).map((e) => e.trim().toLowerCase())
if (!emails.length) { console.error('Pass at least one email.'); process.exit(1) }

const nameFromEmail = (e) =>
  e.split('@')[0].split(/[._-]/).filter(Boolean).map((s) => s[0].toUpperCase() + s.slice(1)).join(' ')

const c = new pg.Client({ connectionString: dbUrl })
await c.connect()

for (const email of emails) {
  try {
    let { rows } = await c.query('select id from auth.users where lower(email) = $1', [email])
    let userId = rows[0]?.id
    let created = false
    if (!userId) {
      // The token columns MUST be '' (not NULL) — GoTrue scans them into non-nullable
      // Go strings, so NULLs break magic-link generation for the user.
      const ins = await c.query(
        `insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at,
           raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
           confirmation_token, recovery_token, email_change_token_new, email_change,
           email_change_token_current, phone_change, phone_change_token, reauthentication_token)
         values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated',
           'authenticated', $1, now(), '{"provider":"email","providers":["email"]}'::jsonb,
           '{}'::jsonb, now(), now(),
           '', '', '', '', '', '', '', '')
         returning id`,
        [email]
      )
      userId = ins.rows[0].id
      created = true
    }
    // Ensure an email identity exists (required for magic-link sign-in) — idempotent,
    // also repairs any user left without one by a partial earlier run.
    const idn = await c.query(`select 1 from auth.identities where user_id = $1::uuid and provider = 'email' limit 1`, [userId])
    if (!idn.rows.length) {
      await c.query(
        `insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
         values ($1::text, $1::uuid, jsonb_build_object('sub', $1::text, 'email', $2::text), 'email', now(), now(), now())`,
        [userId, email]
      )
    }

    const pr = await c.query(
      `insert into admin_profile (auth_user_id, email, display_name, active)
       values ($1, $2, $3, true)
       on conflict (auth_user_id) do update set email = excluded.email,
         display_name = coalesce(admin_profile.display_name, excluded.display_name), active = true
       returning id`,
      [userId, email, nameFromEmail(email)]
    )
    const profileId = pr.rows[0].id

    const ex = await c.query(
      `select id from admin_role_assignment where admin_profile_id = $1 and role = $2 and revoked_at is null limit 1`,
      [profileId, role]
    )
    let roleAdded = false
    if (!ex.rows.length) {
      await c.query(`insert into admin_role_assignment (admin_profile_id, role) values ($1, $2)`, [profileId, role])
      roleAdded = true
    }
    console.log(`✓ ${email} — auth user ${created ? 'created' : 'existing'}, profile ${profileId}, ${role} ${roleAdded ? 'granted' : 'already present'}`)
  } catch (e) {
    console.log(`✗ ${email} — ${e.message}`)
  }
}

await c.end()
console.log('Done.')
