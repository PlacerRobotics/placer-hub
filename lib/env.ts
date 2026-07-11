/**
 * Environment variable validation.
 * Fails fast at startup if required vars are missing.
 * Never import this in client components — server-side only for secrets.
 */

const skipValidation = process.env.SKIP_ENV_VALIDATION === 'true'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value && !skipValidation) {
    throw new Error(
      `Missing required environment variable: ${name}\n` +
      `See docs/environment.md for setup instructions.`
    )
  }
  return value ?? ''
}

function optionalEnv(name: string): string | undefined {
  return process.env[name]
}

// ── Public (safe for browser) ──────────────────────────────────────────────
export const NEXT_PUBLIC_SUPABASE_URL = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
export const NEXT_PUBLIC_SUPABASE_ANON_KEY = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
export const NEXT_PUBLIC_SITE_URL = requireEnv('NEXT_PUBLIC_SITE_URL')
export const NEXT_PUBLIC_SLACK_MAIN_INVITE = optionalEnv('NEXT_PUBLIC_SLACK_MAIN_INVITE')
export const NEXT_PUBLIC_SLACK_IQ_INVITE = optionalEnv('NEXT_PUBLIC_SLACK_IQ_INVITE')
// Feature flags (browser-safe; NEXT_PUBLIC so client components can read them too).
// Default OFF: the family-facing financial-aid feature is hidden unless explicitly
// set to 'true'. Admin views (/admin/financial-aid) + the API are never gated by this.
export const FEATURE_FINANCIAL_AID = optionalEnv('NEXT_PUBLIC_FEATURE_FINANCIAL_AID') === 'true'

// ── Server-side only ───────────────────────────────────────────────────────
// These must never be imported in client components ('use client')
export const SUPABASE_SERVICE_ROLE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
export const BOOTSTRAP_ADMIN_EMAIL = requireEnv('BOOTSTRAP_ADMIN_EMAIL')

// ── Optional (required per release) ───────────────────────────────────────
export const RESEND_API_KEY = optionalEnv('RESEND_API_KEY')
export const EMAIL_FROM = optionalEnv('EMAIL_FROM') ?? 'noreply@placerrobotics.org'
export const ZEFFY_API_KEY = optionalEnv('ZEFFY_API_KEY')
export const ZEFFY_WEBHOOK_SECRET = optionalEnv('ZEFFY_WEBHOOK_SECRET')
export const ZEFFY_STUDENT_CAMPAIGN_ID = optionalEnv('ZEFFY_STUDENT_CAMPAIGN_ID')
export const ZEFFY_IQ_TEAM_CAMPAIGN_ID = optionalEnv('ZEFFY_IQ_TEAM_CAMPAIGN_ID')
export const GOOGLE_ADMIN_EMAIL = optionalEnv('GOOGLE_ADMIN_EMAIL')
export const GOOGLE_SERVICE_ACCOUNT_KEY = optionalEnv('GOOGLE_SERVICE_ACCOUNT_KEY')
export const SLACK_MAIN_BOT_TOKEN = optionalEnv('SLACK_MAIN_BOT_TOKEN')
export const SLACK_IQ_BOT_TOKEN = optionalEnv('SLACK_IQ_BOT_TOKEN')
export const APS_API_KEY = optionalEnv('APS_API_KEY')
export const APS_API_BASE_URL = optionalEnv('APS_API_BASE_URL')
export const UNIFI_ACCESS_API_KEY = optionalEnv('UNIFI_ACCESS_API_KEY')
export const UNIFI_ACCESS_BASE_URL = optionalEnv('UNIFI_ACCESS_BASE_URL')
