/**
 * App-sent email via Resend's REST API (no SDK dependency).
 *
 * Gated on RESEND_API_KEY: if it's not set, sendEmail logs and no-ops rather
 * than throwing, so callers (e.g. registration) never fail because email isn't
 * configured yet. Set RESEND_API_KEY (and optionally EMAIL_FROM) in the
 * environment, and verify the sender domain in Resend, to actually deliver.
 *
 * All app mail rides Resend — both notifications (receipts, reminders) and
 * sign-in / invite magic links (see sendMagicLinkEmail below). Supabase SMTP is
 * not used.
 */
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'

const RESEND_ENDPOINT = 'https://api.resend.com/emails'
const REPLY_TO = process.env.EMAIL_REPLY_TO || 'registrar@placerrobotics.org'

// A plain-text alternative materially improves deliverability — HTML-only mail is a
// common spam signal. Derive a readable text part from the HTML, preserving link URLs.
function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href, label) => {
      const text = String(label).replace(/<[^>]+>/g, '').trim()
      return text && !href.includes(text) ? `${text} (${href})` : href
    })
    .replace(/<\/(p|div|tr|h1|h2|h3|h4|li|td)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&middot;/g, '·').replace(/&rarr;/g, '->').replace(/&mdash;/g, '—').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .split('\n').map((l) => l.trim()).join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string[]
  subject: string
  html: string
}): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM || 'Placer Robotics Hub <noreply@placerrobotics.org>'
  const recipients = [...new Set(to.filter(Boolean).map((e) => e.trim().toLowerCase()))]
  if (!recipients.length) return { ok: false, error: 'no_recipients' }
  if (!key) {
    console.log(`[email] RESEND_API_KEY not set — would send "${subject}" to ${recipients.join(', ')}`)
    return { ok: false, error: 'no_api_key' }
  }
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: recipients,
        subject,
        html,
        text: htmlToText(html),
        reply_to: REPLY_TO,
        headers: { 'List-Unsubscribe': `<mailto:${REPLY_TO}?subject=unsubscribe>` },
      }),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.error('[email] Resend error', res.status, detail)
      return { ok: false, error: `resend_${res.status}` }
    }
    return { ok: true }
  } catch (e: any) {
    console.error('[email] send failed:', e?.message)
    return { ok: false, error: 'exception' }
  }
}

// Shared branded shell for notification emails. Mobile-friendly, light-mode (most
// clients), navy/gold brand, a gold accent rule, and a hidden preheader that sets
// the inbox preview line. heading + inner keep the same signature; preheader is opt-in.
function emailShell(heading: string, inner: string, preheader = ''): string {
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta http-equiv="X-UA-Compatible" content="IE=edge"/><meta name="x-apple-disable-message-reformatting"/>
<title>${heading}</title></head>
<body style="margin:0;padding:0;background-color:#eef1f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;opacity:0;color:transparent;">${preheader}</div>` : ''}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef1f7;"><tr><td align="center" style="padding:28px 12px;">
    <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="width:100%;max-width:520px;background-color:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e3e8f0;">
      <tr><td style="background-color:#0E2558;padding:26px 36px;">
        <div style="color:#F2C352;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">Placer Robotics</div>
        <div style="color:#ffffff;font-size:21px;font-weight:700;margin-top:4px;letter-spacing:-0.01em;">Placer Robotics Hub</div>
      </td></tr>
      <tr><td style="height:4px;line-height:4px;font-size:0;background-color:#F2C352;">&nbsp;</td></tr>
      <tr><td style="padding:34px 36px 30px;">
        <h1 style="margin:0 0 16px;color:#0E2558;font-size:20px;font-weight:700;line-height:1.3;">${heading}</h1>
        ${inner}
      </td></tr>
      <tr><td style="padding:22px 36px;background-color:#f7f9fc;border-top:1px solid #e6eaf1;">
        <p style="margin:0 0 4px;color:#5f6b80;font-size:12px;line-height:1.5;">Placer Advanced Robotics &amp; Technology &middot; Roseville, CA</p>
        <p style="margin:0;color:#9aa6ba;font-size:12px;line-height:1.5;">501(c)(3) nonprofit &middot; <a href="mailto:registrar@placerrobotics.org" style="color:#5f6b80;">registrar@placerrobotics.org</a></p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`
}

// Standard gold CTA button for emails (bulletproof table button).
export function emailButton(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0;"><tr><td style="background-color:#F2C352;border-radius:8px;">
    <a href="${href}" style="display:inline-block;padding:14px 30px;color:#0E2558;font-size:15px;font-weight:700;text-decoration:none;">${label}</a></td></tr></table>`
}

const P = 'margin:0 0 16px;color:#3a4a63;font-size:15px;line-height:1.65;'

/**
 * Generate a Supabase magic link server-side and deliver it via Resend (branded),
 * so sign-in / invite email never depends on Supabase's own SMTP. The link lands on
 * /login, which consumes the implicit-flow tokens (hash) and forwards to redirectPath.
 * Creates the auth user if needed (magiclink requires an existing user).
 */
export async function sendMagicLinkEmail({ email, redirectPath, subject, heading, intro, buttonLabel, preheader }: {
  email: string
  redirectPath: string
  subject: string
  heading: string
  intro: string
  buttonLabel: string
  preheader?: string
}): Promise<{ ok: boolean; error?: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const to = email.trim().toLowerCase()
  if (!url || !serviceKey || !to.includes('@')) return { ok: false, error: 'config' }
  const admin = createSupabaseAdmin(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  // magiclink requires an existing auth user — create one (ignore "already registered").
  try { await admin.auth.admin.createUser({ email: to, email_confirm: true }) } catch { /* user already exists */ }
  const landing = `${site}/login?redirectTo=${encodeURIComponent(redirectPath)}`
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email: to, options: { redirectTo: landing } })
  const link = (data as { properties?: { action_link?: string } } | null)?.properties?.action_link
  if (error || !link) return { ok: false, error: error?.message ?? 'no_link' }
  const html = emailShell(heading, `
    <p style="${P}">${intro}</p>
    ${emailButton(link, buttonLabel)}
    <p style="margin:22px 0 0;color:#7a879c;font-size:13px;line-height:1.6;">This link signs you in automatically and can be used once. If the button doesn't work, copy this address into your browser:</p>
    <p style="margin:6px 0 0;font-size:12px;line-height:1.5;word-break:break-all;"><a href="${link}" style="color:#0E2558;">${link}</a></p>`,
    preheader ?? intro)
  return sendEmail({ to: [to], subject, html })
}

export function iqTeamSubmittedHtml({ coachName, teamName, season, paymentRef, zeffyUrl, fee }: { coachName: string; teamName: string | null; season: string; paymentRef: string; zeffyUrl: string | null; fee: number }): string {
  const team = teamName ? ` <strong>${teamName}</strong>` : ''
  const payBtn = zeffyUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background-color:#F2C352;border-radius:8px;">
         <a href="${zeffyUrl}" style="display:inline-block;padding:13px 28px;color:#0E2558;font-size:15px;font-weight:700;text-decoration:none;">Pay the $${fee} team fee via Zeffy &rarr;</a></td></tr></table>`
    : `<p style="${P}">A secure online payment link will be provided shortly.</p>`
  return emailShell('IQ team created — payment needed', `
    <p style="${P}">Hi ${coachName || 'Coach'}, your VEX IQ team${team} has been created for the ${season} season.</p>
    <p style="margin:0 0 8px;color:#3a4a63;font-size:15px;line-height:1.6;">Include this payment reference with your payment:</p>
    <p style="margin:0 0 20px;"><span style="display:inline-block;background-color:#f4f6fb;border:1px solid #e6eaf1;border-radius:6px;padding:8px 14px;color:#0E2558;font-size:16px;font-weight:700;letter-spacing:0.04em;">${paymentRef}</span></p>
    ${payBtn}
    <p style="margin:20px 0 0;color:#3a4a63;font-size:14px;line-height:1.6;">Once payment is confirmed, our IQ Coordinator will review your team. You will receive a separate email with your login link and clearance instructions once your team is approved.</p>`)
}

export function iqTeamApprovedHtml({ coachName, teamName, season, volunteerUrl }: { coachName: string; teamName: string | null; season: string; volunteerUrl: string }): string {
  const team = teamName || 'your team'
  return emailShell('Your IQ team is approved', `
    <p style="${P}">Congratulations${coachName ? ` ${coachName}` : ''}! Your VEX IQ team <strong>${team}</strong> has been approved for the ${season} season.</p>
    <p style="margin:0 0 8px;color:#3a4a63;font-size:14px;font-weight:700;">Next steps for you:</p>
    <ol style="margin:0 0 16px;padding-left:18px;color:#3a4a63;font-size:14px;line-height:1.6;">
      <li>Complete your Registered Volunteer clearance at <a href="${volunteerUrl}" style="color:#0E2558;font-weight:600;">the volunteer portal</a>.</li>
      <li>Your students' families will receive registration invitations shortly.</li>
    </ol>
    <p style="margin:0 0 16px;color:#3a4a63;font-size:14px;line-height:1.6;">Team details:<br/>Team name: ${team}<br/>Season: ${season}</p>
    <p style="margin:0;color:#7a879c;font-size:13px;">Questions? Contact registrar@placerrobotics.org</p>`)
}

export function iqTeamPaidNotifyHtml({ teamName, amount, hubUrl }: { teamName: string; amount: number; hubUrl: string }): string {
  return emailShell('IQ Team Payment Received', `
    <p style="${P}">Payment of $${amount} received for IQ team <strong>${teamName}</strong>.</p>
    <p style="${P}">The team is now pending your review and approval.</p>
    <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background-color:#F2C352;border-radius:8px;">
      <a href="${hubUrl}/admin/iq-teams" style="display:inline-block;padding:13px 28px;color:#0E2558;font-size:15px;font-weight:700;text-decoration:none;">Review at the Hub &rarr;</a></td></tr></table>`)
}

export function studentApplicationReceivedHtml({ guardianName, studentName, programLabel, season }: { guardianName: string; studentName: string; programLabel: string; season: string }): string {
  return emailShell('Application received', `
    <p style="${P}">Hi ${guardianName || 'there'}, thank you for applying to Placer Robotics for the ${season} season.</p>
    <p style="${P}">We've received the application for <strong>${studentName}</strong>${programLabel ? ` (${programLabel})` : ''}. Our team will review it and follow up with next steps — including how to register once a spot is offered.</p>
    <p style="margin:0;color:#7a879c;font-size:13px;">Questions? Contact registrar@placerrobotics.org.</p>`,
    `We received ${studentName}'s application for the ${season} season.`)
}

export function applicationAcceptedHtml({ guardianName, studentName, season }: { guardianName: string; studentName: string; season: string }): string {
  return emailShell('Application accepted', `
    <p style="${P}">Hi ${guardianName || 'there'}, great news — <strong>${studentName}</strong>'s application to Placer Robotics for the ${season} season has been accepted.</p>
    <p style="${P}">Your next step is registration. Watch for a follow-up email with your sign-in link once you're cleared to register.</p>
    <p style="margin:0;color:#7a879c;font-size:13px;">Questions? Contact registrar@placerrobotics.org.</p>`,
    `${studentName}'s application has been accepted for the ${season} season.`)
}

export function clearedToRegisterHtml({ guardianName, season, loginUrl }: { guardianName: string; season: string; loginUrl: string }): string {
  return emailShell('You’re cleared to register', `
    <p style="${P}">Hi ${guardianName || 'there'}, you're cleared to register for the ${season} Placer Robotics season. Sign in to complete your student's registration — details, waivers, and payment.</p>
    ${emailButton(loginUrl, 'Sign in to register →')}
    <p style="margin:22px 0 0;color:#7a879c;font-size:13px;line-height:1.6;">Sign in with the email on your account — we'll send a one-time sign-in link.</p>
    <p style="margin:8px 0 0;color:#7a879c;font-size:13px;">Questions? Contact registrar@placerrobotics.org.</p>`,
    `You're cleared to register for the ${season} season — sign in to complete it.`)
}

export function volunteerApplicationReceivedHtml({ name, season }: { name: string; season: string }): string {
  return emailShell('Volunteer application received', `
    <p style="${P}">Thank you ${name || 'volunteer'} for submitting your volunteer application for the ${season} season.</p>
    <p style="${P}">We'll review your application and contact you with next steps (background check, training, quizzes, and the annual waiver). Questions? Contact <a href="mailto:registrar@placerrobotics.org" style="color:#0E2558;">registrar@placerrobotics.org</a>.</p>`)
}

export function volunteerAdminNotifyHtml({ name, email, programs, role, season, hubUrl }: { name: string; email: string; programs: string; role: string; season: string; hubUrl: string }): string {
  return emailShell('New volunteer application', `
    <p style="${P}"><strong>${name}</strong> (${email}) submitted a volunteer application for ${season}.</p>
    <p style="${P}">Programs: ${programs || '—'} · Role: ${role || '—'}</p>
    <p style="${P}"><a href="${hubUrl}/admin/volunteers" style="color:#0E2558;font-weight:700;">Review at the Hub &rarr;</a></p>`)
}

export function apsReminderHtml({ name, expiry, days }: { name: string; expiry: string; days: number }): string {
  return emailShell('Your APS certificate is expiring', `
    <p style="${P}">Hi ${name || 'volunteer'}, your APS Mandated Reporter certificate expires on <strong>${expiry}</strong> (about ${days} days).</p>
    <p style="${P}">Renew the free course at <a href="https://abusepreventionsystems.com" style="color:#0E2558;font-weight:700;">abusepreventionsystems.com</a> to stay cleared to volunteer.</p>`)
}

export function volunteerWaiverReminderHtml({ name, season, waiverUrl }: { name: string; season: string; waiverUrl: string }): string {
  return emailShell(`Sign your ${season} volunteer agreement`, `
    <p style="${P}">Hi ${name || 'volunteer'}, please review and sign the ${season} Youth Protection &amp; Abuse Prevention policy agreement to complete your Registered Volunteer clearance.</p>
    <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background-color:#F2C352;border-radius:8px;">
      <a href="${waiverUrl}" style="display:inline-block;padding:13px 28px;color:#0E2558;font-size:15px;font-weight:700;text-decoration:none;">Review &amp; sign &rarr;</a></td></tr></table>
    <p style="margin:18px 0 0;color:#7a879c;font-size:13px;">Questions? Contact registrar@placerrobotics.org</p>`)
}

export function volunteerRenewalReminderHtml({ name, season, statusLines, renewUrl }: { name: string; season: string; statusLines: string[]; renewUrl: string }): string {
  const items = statusLines.map((l) => `<li style="margin-bottom:4px;color:#3a4a63;font-size:14px;">${l}</li>`).join('')
  return emailShell(`${season} volunteer renewal`, `
    <p style="${P}">Hi ${name || 'volunteer'}, it's time to renew your Registered Volunteer status for the ${season} season.</p>
    <p style="margin:0 0 8px;color:#3a4a63;font-size:14px;">Your current status:</p>
    <ul style="margin:0 0 16px;padding-left:18px;">${items}</ul>
    <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background-color:#F2C352;border-radius:8px;">
      <a href="${renewUrl}" style="display:inline-block;padding:13px 28px;color:#0E2558;font-size:15px;font-weight:700;text-decoration:none;">Complete your renewal &rarr;</a></td></tr></table>
    <p style="margin:18px 0 0;color:#7a879c;font-size:13px;">Questions? Contact registrar@placerrobotics.org</p>`)
}

export function registrationConfirmationHtml({
  studentName,
  programLabel,
  paymentRef,
  zeffyUrl,
  season,
}: {
  studentName: string
  programLabel: string
  paymentRef: string
  zeffyUrl: string | null
  season: string
}): string {
  const payBlock = zeffyUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background-color:#F2C352;border-radius:8px;">
         <a href="${zeffyUrl}" style="display:inline-block;padding:13px 28px;color:#0E2558;font-size:15px;font-weight:700;text-decoration:none;">Pay online via Zeffy &rarr;</a>
       </td></tr></table>`
    : `<p style="margin:0;color:#3a4a63;font-size:14px;">A secure online payment link will be provided shortly.</p>`
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background-color:#eef1f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef1f7;padding:24px 0;"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:12px;overflow:hidden;">
      <tr><td style="background-color:#0E2558;padding:24px 32px;">
        <div style="color:#F2C352;font-size:12px;font-weight:700;letter-spacing:0.09em;text-transform:uppercase;">Placer Robotics</div>
        <div style="color:#ffffff;font-size:22px;font-weight:700;margin-top:3px;">Placer Robotics Hub</div>
      </td></tr>
      <tr><td style="padding:32px;">
        <h1 style="margin:0 0 12px;color:#0E2558;font-size:20px;font-weight:700;">Registration received</h1>
        <p style="margin:0 0 16px;color:#3a4a63;font-size:15px;line-height:1.6;">We've received the ${season} registration for <strong>${studentName}</strong> (${programLabel}). Thank you!</p>
        <p style="margin:0 0 8px;color:#3a4a63;font-size:15px;line-height:1.6;">Your spot is secured once payment is received. Include this payment reference with your payment:</p>
        <p style="margin:0 0 20px;"><span style="display:inline-block;background-color:#f4f6fb;border:1px solid #e6eaf1;border-radius:6px;padding:8px 14px;color:#0E2558;font-size:16px;font-weight:700;letter-spacing:0.04em;">${paymentRef}</span></p>
        ${payBlock}
        <p style="margin:20px 0 0;color:#7a879c;font-size:13px;line-height:1.6;">To pay by check, make it payable to Placer Advanced Robotics and Technology and mail to 9182 Cedar Ridge Drive, Granite Bay, CA 95746, with your reference code in the memo.</p>
      </td></tr>
      <tr><td style="padding:20px 32px;border-top:1px solid #e6eaf1;">
        <p style="margin:0;color:#9aa6ba;font-size:12px;">Placer Advanced Robotics &amp; Technology &middot; Roseville, CA &middot; 501(c)(3) nonprofit</p>
      </td></tr>
    </table>
  </td></tr></table></body></html>`
}
