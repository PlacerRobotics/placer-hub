// Route handlers transitively import `@/lib/env`, which throws at module load if
// required env vars are missing. Tests mock the Supabase/email modules, but keep this
// as a belt-and-suspenders so any non-mocked transitive import can't fail the suite.
process.env.SKIP_ENV_VALIDATION = 'true'
