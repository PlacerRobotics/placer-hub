# Supabase auth email templates — Placer Robotics Hub

Branded (navy `#0E2558` / gold `#F2C352`) HTML for the Supabase auth emails.
These are **not applied by code** — paste each file's contents into the Supabase
dashboard: **Authentication → Email Templates → [template] → Message body**, and
set the matching subject line below.

| Supabase template      | File                   | Subject line                                          | Used by current flows? |
|------------------------|------------------------|-------------------------------------------------------|------------------------|
| Magic Link             | `magic-link.html`      | Your Placer Robotics Hub sign-in link                 | **Yes** — returning sign-ins |
| Confirm signup         | `confirm-signup.html`  | Confirm your email & sign in to Placer Robotics Hub   | **Yes** — first-time sign-in (email confirmation on) |
| Invite user            | `invite.html`          | You're invited to the Placer Robotics Hub             | No (we use signInWithOtp, not admin invite) — branded for consistency |
| Change Email Address   | `change-email.html`    | Confirm your new email for Placer Robotics Hub        | No (no email-change UI yet) — branded for consistency |
| Reset Password         | `reset-password.html`  | Reset your Placer Robotics Hub password               | No (magic-link auth, no passwords) — branded for consistency |
| Reauthentication       | `reauthentication.html`| Your Placer Robotics Hub verification code            | No (no sensitive re-auth flow yet) — branded for consistency |

## Notes
- Links use `{{ .ConfirmationURL }}` to stay compatible with the current
  sign-in flow (implicit-flow tokens are consumed on `/login`). Do **not**
  switch to `{{ .TokenHash }}` without also updating `app/api/auth/callback`.
- `change-email.html` uses `{{ .NewEmail }}`; `reauthentication.html` uses
  `{{ .Token }}` (a code, not a link).
- Goldman (the brand heading font) is intentionally **not** used — email
  clients strip web fonts, so a system sans-serif stack is used instead.
- Colors are hard-coded hex (not CSS variables) because email clients don't
  support CSS custom properties.
