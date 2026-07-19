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
  cc,
  subject,
  html,
}: {
  to: string[]
  cc?: string[]
  subject: string
  html: string
}): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM || 'Placer Robotics Hub <noreply@placerrobotics.org>'
  const recipients = [...new Set(to.filter(Boolean).map((e) => e.trim().toLowerCase()))]
  const ccRecipients = [...new Set((cc ?? []).filter(Boolean).map((e) => e.trim().toLowerCase()))].filter((e) => !recipients.includes(e))
  if (!recipients.length) return { ok: false, error: 'no_recipients' }
  if (!key) {
    console.log(`[email] RESEND_API_KEY not set — would send "${subject}" to ${recipients.join(', ')}${ccRecipients.length ? ` (cc: ${ccRecipients.join(', ')})` : ''}`)
    return { ok: false, error: 'no_api_key' }
  }
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: recipients,
        ...(ccRecipients.length ? { cc: ccRecipients } : {}),
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
export async function sendMagicLinkEmail({ email, redirectPath, subject, heading, intro, buttonLabel, preheader, details }: {
  email: string
  redirectPath: string
  subject: string
  heading: string
  intro: string
  buttonLabel: string
  preheader?: string
  details?: { label: string; value: string }[]
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
  return sendEmail({ to: [to], subject, html: magicLinkHtml({ heading, intro, buttonLabel, link, preheader, details }) })
}

// A styled "key: value" details block (Student / Parent(s) / Program / Team, etc.).
// Blank values are dropped; returns '' if nothing to show.
export function emailKeyValues(items: { label: string; value: string }[]): string {
  const rows = items
    .filter((i) => i.value && i.value.trim())
    .map((i) => `<div style="margin:3px 0;color:#3a4a63;font-size:14px;line-height:1.6;"><span style="color:#7a879c;">${i.label}:</span> <strong style="color:#0E2558;">${i.value}</strong></div>`)
    .join('')
  return rows ? `<div style="margin:0 0 18px;background-color:#f7f9fc;border:1px solid #e6eaf1;border-radius:8px;padding:12px 16px;">${rows}</div>` : ''
}

// The branded magic-link / invite email body. Extracted so it can be previewed
// without generating a live sign-in link. Optional `details` renders a context block.
export function magicLinkHtml({ heading, intro, buttonLabel, link, preheader, details }: { heading: string; intro: string; buttonLabel: string; link: string; preheader?: string; details?: { label: string; value: string }[] }): string {
  return emailShell(heading, `
    <p style="${P}">${intro}</p>
    ${details?.length ? emailKeyValues(details) : ''}
    ${emailButton(link, buttonLabel)}
    <p style="margin:22px 0 0;color:#7a879c;font-size:13px;line-height:1.6;">This link signs you in automatically and can be used once. If the button doesn't work, copy this address into your browser:</p>
    <p style="margin:6px 0 0;font-size:12px;line-height:1.5;word-break:break-all;"><a href="${link}" style="color:#0E2558;">${link}</a></p>`,
    preheader ?? intro)
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
    <p style="margin:20px 0 0;color:#3a4a63;font-size:14px;line-height:1.6;">So we can match your payment to your team, please pay using the <strong>same email</strong> you’ll use to sign in to the Hub, and enter your reference code <strong>${paymentRef}</strong> in the Zeffy form when prompted.</p>
    <p style="margin:12px 0 0;color:#3a4a63;font-size:14px;line-height:1.6;">Once payment is confirmed, our IQ Coordinator will review your team. You will receive a separate email with your login link and clearance instructions once your team is approved.</p>`)
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

export function applicationAcceptedHtml({ guardianName, studentName, programLabel, season }: { guardianName: string; studentName: string; programLabel?: string; season: string }): string {
  return emailShell('Application accepted', `
    <p style="${P}">Hi ${guardianName || 'there'}, great news — <strong>${studentName}</strong>'s application to Placer Robotics for the ${season} season has been accepted.</p>
    ${programLabel ? emailKeyValues([{ label: 'Student', value: studentName }, { label: 'Program', value: programLabel }]) : ''}
    <p style="${P}">Your next step is registration. Watch for a follow-up email with your sign-in link once you're cleared to register.</p>
    <p style="margin:0;color:#7a879c;font-size:13px;">Questions? Contact registrar@placerrobotics.org.</p>`,
    `${studentName}'s application has been accepted for the ${season} season.`)
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

// The self-enroll link to the free CA Mandated Reporter (AB 506) course at APS.
const APS_TRAINING_URL = 'https://safetysystem.abusepreventionsystems.com/training_assignments/overview/california'

// enrollUrl = the volunteer's personal APS direct_login_url (one click into their
// own training); falls back to the generic self-enroll course when not provided.
export function apsReminderHtml({ name, expiry, days, enrollUrl }: { name: string; expiry: string; days?: number; enrollUrl?: string }): string {
  const when = expiry ? `expires on <strong>${expiry}</strong>${days != null ? ` (about ${days} days)` : ''}` : 'is required before you can be cleared to volunteer'
  const url = enrollUrl || APS_TRAINING_URL
  return emailShell('Renew your APS Mandated Reporter training', `
    <p style="${P}">Hi ${name || 'volunteer'}, your APS Mandated Reporter (CA AB 506) certificate ${when}.</p>
    <p style="${P}">It only takes a few minutes and the course is free. ${enrollUrl ? 'You’re enrolled — click below to start (or finish) your training.' : 'Click below to enroll and complete it.'} Your certificate then syncs to the Hub automatically.</p>
    ${emailButton(url, enrollUrl ? 'Start my training →' : 'Enroll &amp; complete training →')}
    <p style="margin:22px 0 0;color:#7a879c;font-size:13px;line-height:1.6;">If the button doesn't work, copy this address into your browser:<br/><a href="${url}" style="color:#0E2558;word-break:break-all;">${url}</a></p>`)
}

// Bulk APS renewal-enrollment notification (task 1.10). `url` is the volunteer's
// personal direct_login_url from enrollApsTraining; falls back to the generic
// self-enroll course when APS didn't return one.
export function apsRenewalReadyHtml({ name, url, expiry, validThrough, season }: { name: string; url?: string; expiry?: string | null; validThrough: string; season: string }): string {
  const link = url || APS_TRAINING_URL
  const why = expiry
    ? `Your current certificate expires on <strong>${expiry}</strong>, and volunteers need a certificate valid through the end of the ${season} season (<strong>${validThrough}</strong>).`
    : `Volunteers need a certificate valid through the end of the ${season} season (<strong>${validThrough}</strong>), and we don't have one on file for you yet.`
  return emailShell(`Your ${season} APS renewal is ready`, `
    <p style="${P}">Hi ${name || 'volunteer'}, you're enrolled for this season's APS Mandated Reporter (CA AB 506) training — the free online course every Registered Volunteer completes to work with students.</p>
    <p style="${P}">${why}</p>
    <p style="${P}">The course only takes a few minutes. Your certificate syncs to the Hub automatically when you finish — nothing to upload.</p>
    ${emailButton(link, 'Start my training →')}
    <p style="margin:22px 0 0;color:#7a879c;font-size:13px;line-height:1.6;">If the button doesn't work, copy this address into your browser:<br/><a href="${link}" style="color:#0E2558;word-break:break-all;">${link}</a></p>
    <p style="margin:14px 0 0;color:#7a879c;font-size:13px;">Questions? Contact registrar@placerrobotics.org</p>`,
    `Complete your ${season} Mandated Reporter training — it only takes a few minutes.`)
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

// "Join us on Slack" block shared by the registration confirmation and the
// volunteer-cleared invite (task 1.6 / D11). joinEmail is the Hub sign-in email —
// PRD §19: it's the Slack identity, and changing it later needs admin action.
export function slackInviteSection({ inviteUrl, joinEmail }: { inviteUrl: string; joinEmail?: string | null }): string {
  return `<div style="margin:24px 0 0;padding:16px;background-color:#f4f6fb;border:1px solid #e6eaf1;border-radius:8px;">
      <p style="margin:0 0 10px;color:#0E2558;font-size:15px;font-weight:700;">Join us on Slack</p>
      <p style="margin:0 0 12px;color:#3a4a63;font-size:14px;line-height:1.6;">Slack is where team announcements and day-to-day coordination happen.${joinEmail ? ` Please join using <strong>${joinEmail}</strong> — the same email as your Hub account, so we can match you automatically.` : ''}</p>
      ${emailButton(inviteUrl, 'Join the Slack workspace →')}
    </div>`
}

const CHANNEL_GUIDANCE: Record<string, { channel: string; label: string }> = {
  vex_v5: { channel: '#vex', label: 'VEX V5' },
  combat: { channel: '#combat', label: 'Combat' },
}

// MS/HS "you're registered but haven't joined Slack yet" catch-up campaign
// (task: admin-triggered one-time send, /admin/slack). programs is this
// guardian's known V5/Combat affiliation(s) — empty when we can't yet tell
// (e.g. registered but no team/program set), in which case both channels are
// suggested rather than guessing wrong.
export function slackMsHsCatchUpHtml({ name, season, inviteUrl, joinEmail, programs }: {
  name: string
  season: string
  inviteUrl: string
  joinEmail?: string | null
  programs: string[]
}): string {
  const known = programs.map((p) => CHANNEL_GUIDANCE[p]).filter(Boolean) as { channel: string; label: string }[]
  const shown = known.length ? known : Object.values(CHANNEL_GUIDANCE)
  const channelList = shown
    .map((c) => `<li style="margin-bottom:4px;color:#3a4a63;font-size:14px;"><strong>${c.channel}</strong> — ${c.label} team announcements &amp; coordination</li>`)
    .join('')
  return emailShell(`Join us on Slack — Placer Robotics ${season}`, `
    <p style="${P}">Hi ${name || 'there'}, you're registered for the ${season} season, but we don't see you in the Placer Robotics Slack workspace yet — that's where we post team announcements, schedule changes, and day-to-day coordination, so you don't want to miss it.</p>
    ${slackInviteSection({ inviteUrl, joinEmail })}
    <p style="margin:20px 0 8px;color:#0E2558;font-size:14px;font-weight:700;">Once you're in, join your team's channel${shown.length > 1 ? 's' : ''}:</p>
    <ul style="margin:0 0 4px;padding-left:18px;">${channelList}</ul>
    <p style="margin:12px 0 0;color:#7a879c;font-size:13px;line-height:1.6;">You'll also be added to your specific team's channel automatically once you join — this just gets you started. Questions? Contact registrar@placerrobotics.org</p>`,
    `You're registered for ${season} — join the Slack workspace to stay in the loop.`)
}

// PART's mailing address for paper-check payments — used here and in the
// register wizard's own payment step (app/register/register-wizard.tsx).
const MAIL_ADDRESS = 'Placer Advanced Robotics and Technology, 9182 Cedar Ridge Drive, Granite Bay, CA 95746'
export const SPONSOR_CONTACT_EMAIL = 'vasu.vallurupalli@placerrobotics.org'

const FUND_METHOD_LABELS: Record<string, string> = {
  direct_donation: 'Direct contribution via Zeffy',
  corporate_match: 'Employer / corporate match',
  sponsored: 'Business sponsorship',
  paper_check: 'Paper check',
  pending: 'Financial assistance (pending)',
}

// Per-method fundraising follow-up instructions, personalized where we have the
// specifics on file (employer portal, sponsor business name). feeDue merges the
// direct_donation guidance with the registration fee into ONE Zeffy call-to-action
// (they're the same campaign/checkout) instead of two separate, confusing
// "pay via Zeffy" mentions — this is also the encouraged path: pay both at once
// whenever possible, rather than the fee now and a contribution separately later.
function fundraisingMethodGuidance({ methods, zeffyUrl, employerPortal, employerCompany, sponsorBusiness, feeDue, feeAmount, fundraisingTarget, paymentReferenceCode, employerMatchSubmittedAt, dashboardEditUrl }: {
  methods: string[]
  zeffyUrl: string | null
  employerPortal?: string | null
  employerCompany?: string | null
  sponsorBusiness?: string | null
  feeDue: boolean
  feeAmount?: number
  fundraisingTarget?: number
  paymentReferenceCode?: string | null
  employerMatchSubmittedAt?: string | null
  dashboardEditUrl?: string | null
}): string {
  if (!methods.length) {
    return `<p style="margin:0;color:#3a4a63;font-size:14px;line-height:1.6;">Let us know how you'd like to fulfill this — a direct contribution, an employer/corporate match, a business sponsorship, or a paper check are all fine. Contact registrar@placerrobotics.org any time.</p>`
  }
  const blocks = methods.map((m) => {
    if (m === 'direct_donation') {
      if (!zeffyUrl) return `<p style="margin:0 0 10px;color:#3a4a63;font-size:14px;line-height:1.6;"><strong>Direct contribution:</strong> a secure Zeffy link will be provided shortly.</p>`
      const link = `<a href="${zeffyUrl}" style="color:#0E2558;font-weight:600;">pay via Zeffy</a>`
      if (feeDue) {
        return `<p style="margin:0 0 10px;color:#3a4a63;font-size:14px;line-height:1.6;"><strong>Pay both together, when you can:</strong> ${link}${paymentReferenceCode ? ` — reference code <strong>${paymentReferenceCode}</strong>` : ''}. You can pay just the $${(feeAmount ?? 0).toFixed(0)} registration fee, or choose a higher ticket to put money toward your $${(fundraisingTarget ?? 0).toFixed(0)} fundraising commitment in the same transaction — you can always give more later.</p>`
      }
      return `<p style="margin:0 0 10px;color:#3a4a63;font-size:14px;line-height:1.6;"><strong>Direct contribution:</strong> ${link} any time — it counts toward this total.</p>`
    }
    if (m === 'corporate_match') {
      const portalLabel = employerPortal === 'benevity' ? 'Benevity' : 'giving platform'
      if (employerMatchSubmittedAt) {
        return `<p style="margin:0 0 10px;color:#3a4a63;font-size:14px;line-height:1.6;"><strong>Employer match (${portalLabel}):</strong> you logged this as submitted on <strong>${new Date(employerMatchSubmittedAt).toLocaleDateString()}</strong> — thanks! We're watching for the match to arrive; no need to do anything else unless it's rejected or needs more info.</p>`
      }
      const editLink = dashboardEditUrl ? `<a href="${dashboardEditUrl}" style="color:#0E2558;font-weight:600;">log the date on your Hub account</a>` : 'let us know the date'
      const submitAction = employerPortal === 'benevity'
        ? `log into your ${employerCompany ? `<strong>${employerCompany}</strong> ` : ''}Benevity portal and submit a matching-gift request to <strong>Placer Advanced Robotics &amp; Technology</strong>`
        : `submit a matching-gift request through your ${employerCompany ? `<strong>${employerCompany}</strong> ` : ''}employer's giving platform for <strong>Placer Advanced Robotics &amp; Technology</strong>`
      return `<p style="margin:0 0 10px;color:#3a4a63;font-size:14px;line-height:1.6;"><strong>Employer match (${portalLabel}):</strong> ${submitAction}. Once it's in, ${editLink} so we can track it — that's the "Date you submitted the match request" field under your fundraising info.</p>`
    }
    if (m === 'sponsored') {
      return sponsorBusiness
        ? `<p style="margin:0 0 10px;color:#3a4a63;font-size:14px;line-height:1.6;"><strong>Business sponsorship:</strong> we have <strong>${sponsorBusiness}</strong> on file as a sponsor in progress — reach out to <a href="mailto:${SPONSOR_CONTACT_EMAIL}" style="color:#0E2558;font-weight:600;">${SPONSOR_CONTACT_EMAIL}</a> to finalize the details.</p>`
        : `<p style="margin:0 0 10px;color:#3a4a63;font-size:14px;line-height:1.6;"><strong>Business sponsorship:</strong> we don't have a sponsor on file for you yet — email the business name and contact to <a href="mailto:${SPONSOR_CONTACT_EMAIL}" style="color:#0E2558;font-weight:600;">${SPONSOR_CONTACT_EMAIL}</a> and he can help line one up.</p>`
    }
    if (m === 'paper_check') {
      return `<p style="margin:0 0 10px;color:#3a4a63;font-size:14px;line-height:1.6;"><strong>Paper check:</strong> make it payable to <strong>Placer Advanced Robotics and Technology</strong> and either drop it in the metal drop box at the lab, or mail it to ${MAIL_ADDRESS}. Please include your reference code in the memo.</p>`
    }
    if (m === 'pending') {
      return `<p style="margin:0 0 10px;color:#3a4a63;font-size:14px;line-height:1.6;"><strong>Financial assistance:</strong> if you haven't submitted a financial aid request yet, that's the next step — contact registrar@placerrobotics.org and we'll send you the link. We don't have one on file for you yet.</p>`
    }
    return ''
  })
  return blocks.join('')
}

export type ReminderStudent = {
  name: string
  registerUrl?: string | null
  program?: string | null
  feeAmount?: number
  feePaid?: boolean
  feeStatus?: 'unpaid' | 'paid' | 'waived'
  paymentReferenceCode?: string | null
  zeffyUrl?: string | null
  fundraisingTarget?: number
  fundraisingDone?: boolean
  fundraisingMethods?: string[]
  employerPortal?: string | null
  employerCompany?: string | null
  employerMatchSubmittedAt?: string | null
  sponsorBusiness?: string | null
}

// Personalized "finish your registration" reminder — one email per family,
// covering every student who isn't fully done (not yet registered, fee
// unpaid, and/or fundraising commitment not yet marked received). A student
// with registerUrl set is treated as not-yet-registered (steps-to-register
// branch); otherwise the fee/fundraising follow-up branch applies.
export function registrationReminderHtml({ guardianName, season, dueDate, students, dashboardEditUrl }: {
  guardianName: string
  season: string
  dueDate: string
  students: ReminderStudent[]
  dashboardEditUrl?: string | null
}): string {
  const notRegistered = students.filter((s) => s.registerUrl)
  const needsFollowUp = students.filter((s) => !s.registerUrl)

  const registerBlock = notRegistered.length ? `
    <p style="margin:0 0 8px;color:#0E2558;font-size:15px;font-weight:700;">Finish registration</p>
    ${notRegistered.map((s) => `
      <div style="margin:0 0 14px;padding:14px 16px;background-color:#f4f6fb;border:1px solid #e6eaf1;border-radius:8px;">
        <p style="margin:0 0 10px;color:#3a4a63;font-size:14px;line-height:1.6;"><strong>${s.name}</strong> is cleared to register but hasn't started yet — it takes about 10 minutes (student details, waivers, and choosing how you'll cover the fee and fundraising commitment).</p>
        ${emailButton(s.registerUrl!, `Register ${s.name} →`)}
      </div>`).join('')}` : ''

  let totalDue = 0
  const followUpBlock = needsFollowUp.length ? `
    <p style="margin:${notRegistered.length ? '20px' : '0'} 0 8px;color:#0E2558;font-size:15px;font-weight:700;">Complete your payment &amp; fundraising commitment</p>
    ${needsFollowUp.map((s) => {
      const feeDue = s.feeStatus === 'unpaid'
      const fundDue = !s.fundraisingDone && (s.fundraisingTarget ?? 0) > 0
      if (feeDue) totalDue += s.feeAmount ?? 0
      if (fundDue) totalDue += s.fundraisingTarget ?? 0
      const feeRow = `<div style="margin:0 0 4px;color:#3a4a63;font-size:14px;">Registration fee: <strong>$${(s.feeAmount ?? 0).toFixed(0)}</strong> — <span style="color:${feeDue ? '#B54708' : '#1a7f37'};font-weight:700;">${s.feeStatus === 'waived' ? 'WAIVED' : feeDue ? 'DUE' : 'PAID'}</span></div>`
      const fundRow = (s.fundraisingTarget ?? 0) > 0
        ? `<div style="margin:0 0 10px;color:#3a4a63;font-size:14px;">Fundraising commitment: <strong>$${(s.fundraisingTarget ?? 0).toFixed(0)}</strong> — <span style="color:${fundDue ? '#B54708' : '#1a7f37'};font-weight:700;">${fundDue ? 'OPEN' : 'DONE'}</span></div>`
        : ''
      // If fundraising is also open via direct_donation, that guidance below
      // already covers the fee in the SAME Zeffy call-to-action — a standalone
      // "pay the fee" line first would just repeat it. Otherwise (fee due with
      // no open direct-donation fundraising to merge into) it stands alone.
      const feeMergesIntoDirectDonation = feeDue && fundDue && (s.fundraisingMethods ?? []).includes('direct_donation')
      const zeffyRow = feeDue && !feeMergesIntoDirectDonation
        ? `<p style="margin:0 0 10px;color:#3a4a63;font-size:14px;line-height:1.6;">Pay the registration fee${s.paymentReferenceCode ? ` — reference code <strong>${s.paymentReferenceCode}</strong>` : ''}: ${s.zeffyUrl ? `<a href="${s.zeffyUrl}" style="color:#0E2558;font-weight:600;">pay via Zeffy</a>` : 'a secure link will be provided shortly'}.</p>`
        : ''
      const fundGuidance = fundDue ? fundraisingMethodGuidance({
        methods: s.fundraisingMethods ?? [], zeffyUrl: s.zeffyUrl ?? null,
        employerPortal: s.employerPortal, employerCompany: s.employerCompany, sponsorBusiness: s.sponsorBusiness,
        feeDue, feeAmount: s.feeAmount, fundraisingTarget: s.fundraisingTarget, paymentReferenceCode: s.paymentReferenceCode,
        employerMatchSubmittedAt: s.employerMatchSubmittedAt, dashboardEditUrl,
      }) : ''
      return `
      <div style="margin:0 0 14px;padding:14px 16px;background-color:#f4f6fb;border:1px solid #e6eaf1;border-radius:8px;">
        <p style="margin:0 0 8px;color:#0E2558;font-size:14px;font-weight:700;">${s.name}${s.program ? ` · ${s.program}` : ''}</p>
        ${feeRow}${fundRow}${zeffyRow}${fundGuidance}
      </div>`
    }).join('')}` : ''

  const totalDueBlock = totalDue > 0 ? `
    <div style="margin:4px 0 20px;padding:12px 16px;background-color:#fff8ea;border:1px solid #f2e2b8;border-radius:8px;">
      <span style="color:#0E2558;font-size:15px;font-weight:700;">Total due: $${totalDue.toFixed(0)}</span>
    </div>` : ''

  return emailShell(`Complete your ${season} registration by ${dueDate}`, `
    <p style="${P}">Hi ${guardianName || 'there'}, a quick check-in on your ${season} Placer Robotics registration — here's what's still outstanding.</p>
    <div style="margin:0 0 18px;padding:12px 16px;background-color:#fdeeee;border:1px solid #f3c9c9;border-radius:8px;">
      <span style="color:#8a2c2c;font-size:14px;font-weight:700;">Please complete these steps by ${dueDate}.</span>
    </div>
    ${registerBlock}
    ${totalDueBlock}
    ${followUpBlock}
    <p style="margin:18px 0 0;color:#7a879c;font-size:13px;line-height:1.6;">Questions about any of this? Contact registrar@placerrobotics.org.</p>`,
    `Please complete these steps by ${dueDate}.`)
}

// Student-facing companion to registrationReminderHtml — informational only, no
// login-gated action links. Registration, payment, and fundraising all require a
// guardian's session (matched by guardian.login_email), so a student clicking a
// "Register"/"Pay" button here would just dead-end at a sign-in wall. This tells
// them where things stand and points them to their parent(s) instead.
export function registrationReminderStudentHtml({ name, season, dueDate, notRegistered, feeDue, fundraisingDue }: {
  name: string
  season: string
  dueDate: string
  notRegistered: boolean
  feeDue: boolean
  fundraisingDue: boolean
}): string {
  const items: string[] = []
  if (notRegistered) items.push('Registration isn’t finished yet')
  if (feeDue) items.push('Registration fee not yet paid')
  if (fundraisingDue) items.push('Fundraising commitment still open')
  const list = items.map((i) => `<li style="margin-bottom:4px;color:#3a4a63;font-size:14px;">${i}</li>`).join('')
  return emailShell(`A few ${season} registration steps left — due ${dueDate}`, `
    <p style="${P}">Hi ${name || 'there'}, here's where things stand with your Placer Robotics registration for ${season} — everything needs to be wrapped up by <strong>${dueDate}</strong>:</p>
    <ul style="margin:0 0 16px;padding-left:18px;">${list}</ul>
    <p style="margin:0;color:#3a4a63;font-size:14px;line-height:1.6;">These steps happen through your parent/guardian's account, so check in with them to help get this finished up before ${dueDate}. Thanks for being part of the team!</p>`,
    `Due ${dueDate} — check in with your parent(s).`)
}

export function registrationConfirmationHtml({
  studentName,
  programLabel,
  paymentRef,
  zeffyUrl,
  season,
  guardianNames,
  teamNumber,
  requiresPayment = true,
  slackInviteUrl,
  slackJoinEmail,
}: {
  studentName: string
  programLabel: string
  paymentRef: string
  zeffyUrl: string | null
  season: string
  guardianNames?: string
  teamNumber?: string | null
  requiresPayment?: boolean
  slackInviteUrl?: string | null
  slackJoinEmail?: string | null
}): string {
  const details = emailKeyValues([
    { label: 'Student', value: studentName },
    { label: 'Program', value: programLabel },
    { label: 'Parent(s)', value: guardianNames ?? '' },
    { label: 'Team', value: teamNumber ?? '' },
  ])
  const payBlock = zeffyUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background-color:#F2C352;border-radius:8px;">
         <a href="${zeffyUrl}" style="display:inline-block;padding:13px 28px;color:#0E2558;font-size:15px;font-weight:700;text-decoration:none;">Pay online via Zeffy &rarr;</a>
       </td></tr></table>`
    : `<p style="margin:0;color:#3a4a63;font-size:14px;">A secure online payment link will be provided shortly.</p>`
  // VEX IQ campers don't pay individually — the coach pays one $1,200 team fee. Only
  // V5/Combat registrations carry an individual fee + payment step.
  const paymentSection = requiresPayment === false
    ? `<p style="margin:0;color:#3a4a63;font-size:15px;line-height:1.6;">Your VEX IQ team coach handles the team fee — there is <strong>no individual payment</strong> for your camper. You're all set for the ${season} season!</p>`
    : `<p style="margin:0 0 8px;color:#3a4a63;font-size:15px;line-height:1.6;">Your spot is secured once payment is received. Include this payment reference with your payment:</p>
        <p style="margin:0 0 20px;"><span style="display:inline-block;background-color:#f4f6fb;border:1px solid #e6eaf1;border-radius:6px;padding:8px 14px;color:#0E2558;font-size:16px;font-weight:700;letter-spacing:0.04em;">${paymentRef}</span></p>
        ${payBlock}
        <p style="margin:20px 0 0;color:#7a879c;font-size:13px;line-height:1.6;">To pay by check, make it payable to Placer Advanced Robotics and Technology and mail to 9182 Cedar Ridge Drive, Granite Bay, CA 95746, with your reference code in the memo.</p>`
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background-color:#eef1f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef1f7;padding:24px 0;"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:12px;overflow:hidden;">
      <tr><td style="background-color:#0E2558;padding:24px 32px;">
        <div style="color:#F2C352;font-size:12px;font-weight:700;letter-spacing:0.09em;text-transform:uppercase;">Placer Robotics</div>
        <div style="color:#ffffff;font-size:22px;font-weight:700;margin-top:3px;">Placer Robotics Hub</div>
      </td></tr>
      <tr><td style="padding:32px;">
        <h1 style="margin:0 0 12px;color:#0E2558;font-size:20px;font-weight:700;">Registration received</h1>
        <p style="margin:0 0 16px;color:#3a4a63;font-size:15px;line-height:1.6;">We've received the ${season} registration. Thank you!</p>
        ${details}
        ${paymentSection}
        ${slackInviteUrl ? slackInviteSection({ inviteUrl: slackInviteUrl, joinEmail: slackJoinEmail }) : ''}
      </td></tr>
      <tr><td style="padding:20px 32px;border-top:1px solid #e6eaf1;">
        <p style="margin:0;color:#9aa6ba;font-size:12px;">Placer Advanced Robotics &amp; Technology &middot; Roseville, CA &middot; 501(c)(3) nonprofit</p>
      </td></tr>
    </table>
  </td></tr></table></body></html>`
}

// Volunteer cleared → Slack invite (task 1.6): the "right moment" for a
// volunteer's workspace invite is the moment an admin marks them cleared.
export function volunteerClearedSlackHtml({ name, season, inviteUrl, joinEmail }: { name: string; season: string; inviteUrl: string; joinEmail?: string | null }): string {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background-color:#eef1f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef1f7;padding:24px 0;"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:12px;overflow:hidden;">
      <tr><td style="background-color:#0E2558;padding:24px 32px;">
        <div style="color:#F2C352;font-size:12px;font-weight:700;letter-spacing:0.09em;text-transform:uppercase;">Placer Robotics</div>
        <div style="color:#ffffff;font-size:22px;font-weight:700;margin-top:3px;">Placer Robotics Hub</div>
      </td></tr>
      <tr><td style="padding:32px;">
        <h1 style="margin:0 0 12px;color:#0E2558;font-size:20px;font-weight:700;">You're cleared to volunteer!</h1>
        <p style="margin:0 0 16px;color:#3a4a63;font-size:15px;line-height:1.6;">Hi ${name}, your volunteer clearance for the ${season} season is complete. Welcome aboard!</p>
        ${slackInviteSection({ inviteUrl, joinEmail })}
      </td></tr>
      <tr><td style="padding:20px 32px;border-top:1px solid #e6eaf1;">
        <p style="margin:0;color:#9aa6ba;font-size:12px;">Placer Advanced Robotics &amp; Technology &middot; Roseville, CA &middot; 501(c)(3) nonprofit</p>
      </td></tr>
    </table>
  </td></tr></table></body></html>`
}
