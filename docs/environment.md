# Environment Variables

All configuration is via environment variables. No secrets in code or Git.

## Required for all environments

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (safe for browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only, never expose to browser) |
| `NEXT_PUBLIC_SITE_URL` | Full URL of the site (used for magic links) |
| `BOOTSTRAP_ADMIN_EMAIL` | `kevin.miller@placerrobotics.org` — granted Super Admin on first migration |

## Required for Release 1

| Variable | Description |
|---|---|
| `RESEND_API_KEY` (or equivalent) | Transactional email provider API key |
| `EMAIL_FROM` | Sender address, e.g. `noreply@placerrobotics.org` |

## Required for Release 2

| Variable | Description |
|---|---|
| `ZEFFY_API_KEY` | Zeffy API key for payment polling |
| `ZEFFY_WEBHOOK_SECRET` | Zeffy webhook signing secret (check Zeffy dashboard) |
| `ZEFFY_STUDENT_CAMPAIGN_ID` | Zeffy campaign ID for student fundraising |
| `ZEFFY_IQ_TEAM_CAMPAIGN_ID` | Zeffy campaign ID for IQ team fee |

## Required for Release 3 (volunteer)

| Variable | Description |
|---|---|
| `SLACK_MAIN_BOT_TOKEN` | Slack bot token for main workspace |
| `SLACK_IQ_BOT_TOKEN` | Slack bot token for IQ workspace |
| `NEXT_PUBLIC_SLACK_MAIN_INVITE` | Shared-invite URL for the main Slack workspace (V5 & Combat) — family dashboard hides the "Join our Slack" link if unset |
| `NEXT_PUBLIC_SLACK_IQ_INVITE` | Shared-invite URL for the VEX IQ Slack workspace — family dashboard hides the "Join the VEX IQ Slack" link if unset |
| `APS_API_KEY` | APS/MinistrySafe API key |
| `APS_API_BASE_URL` | APS API base URL |
| `UNIFI_ACCESS_API_KEY` | UniFi Access API key (scope to Access only) |
| `UNIFI_ACCESS_BASE_URL` | UniFi Access controller URL or Site Manager proxy URL |

## Required for Release 4 (Google Group sync)

| Variable | Description |
|---|---|
| `GOOGLE_ADMIN_EMAIL` | Google Workspace admin email for SDK delegation |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Service account JSON, base64-encoded |

## Supabase environments

Production and development **must** use separate Supabase projects. Never point a development environment at the production Supabase project.

| Environment | Supabase project |
|---|---|
| Production | Separate production project |
| Preview (Vercel) | Separate development project |
| Local | Separate development project (or local Supabase) |

## Vercel setup

In Vercel project settings → Environment Variables:
- Set all production variables under "Production" environment
- Set dev/preview variables under "Preview" environment
- `NEXT_PUBLIC_SITE_URL` should be `https://hub.placerrobotics.org` in production and the Vercel preview URL in preview

## Email setup (Resend only)

**All email goes through Resend** — app notifications *and* sign-in / invite magic
links. Magic links are generated server-side (`sendMagicLinkEmail` → `admin.generateLink`)
and delivered via Resend with the branded shell, so **Supabase SMTP is not used** and
`signInWithOtp` has been retired. Set `RESEND_API_KEY` and you're done.

### Resend (all email)

1. **Verify the domain** — [resend.com](https://resend.com) → Domains → Add `placerrobotics.org`. Add the DNS records Resend provides (MX + SPF on the send subdomain, DKIM TXT, and a recommended DMARC TXT) to the domain's DNS. Wait for **Verified**. Until verified you can only send to your own Resend account email.
2. **API key** — Resend → API Keys → Create (Sending permission). Copy the `re_…` key.
3. **Env vars** (Vercel Production + Preview, and `.env.local` for local testing):
   ```
   RESEND_API_KEY=re_xxxxxxxxxxxxxxxx
   EMAIL_FROM=Placer Robotics Hub <noreply@placerrobotics.org>
   ```
   `EMAIL_FROM` is optional (defaults to `Placer Robotics Hub <noreply@placerrobotics.org>`); the from address **must be on the verified domain**. Redeploy after setting.
4. **Behavior** — `lib/email.ts` is gated on `RESEND_API_KEY`: unset → `sendEmail` no-ops and logs `"RESEND_API_KEY not set — would send …"` (flows never break); set → it sends. Verify deliveries in **Resend → Logs**.

### Supabase Auth (the one required setting)

Since magic links are delivered by Resend, the **only** Supabase email-related setting
needed is the redirect allowlist. **Authentication → URL Configuration → Redirect URLs**
must allow the login landing:
```
https://hub.placerrobotics.org/**
```
Without it, magic links fail with "redirect_to is not allowed." No Supabase SMTP or auth
email templates are required (they were removed).
