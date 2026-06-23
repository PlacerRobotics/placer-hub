/**
 * App-sent email via Resend's REST API (no SDK dependency).
 *
 * Gated on RESEND_API_KEY: if it's not set, sendEmail logs and no-ops rather
 * than throwing, so callers (e.g. registration) never fail because email isn't
 * configured yet. Set RESEND_API_KEY (and optionally EMAIL_FROM) in the
 * environment, and verify the sender domain in Resend, to actually deliver.
 *
 * This is separate from Supabase Auth's magic-link email (that uses Supabase's
 * configured SMTP); this is for app-generated mail like registration receipts.
 */
const RESEND_ENDPOINT = 'https://api.resend.com/emails'

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
      body: JSON.stringify({ from, to: recipients, subject, html }),
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

// Shared branded shell for simple notification emails.
function emailShell(heading: string, inner: string): string {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background-color:#eef1f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef1f7;padding:24px 0;"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:12px;overflow:hidden;">
      <tr><td style="background-color:#0E2558;padding:24px 32px;">
        <div style="color:#F2C352;font-size:12px;font-weight:700;letter-spacing:0.09em;text-transform:uppercase;">Placer Robotics</div>
        <div style="color:#ffffff;font-size:22px;font-weight:700;margin-top:3px;">Placer Robotics Hub</div>
      </td></tr>
      <tr><td style="padding:32px;">
        <h1 style="margin:0 0 12px;color:#0E2558;font-size:20px;font-weight:700;">${heading}</h1>
        ${inner}
      </td></tr>
      <tr><td style="padding:20px 32px;border-top:1px solid #e6eaf1;">
        <p style="margin:0;color:#9aa6ba;font-size:12px;">Placer Advanced Robotics &amp; Technology &middot; Roseville, CA &middot; 501(c)(3) nonprofit</p>
      </td></tr>
    </table>
  </td></tr></table></body></html>`
}

const P = 'margin:0 0 16px;color:#3a4a63;font-size:15px;line-height:1.6;'

export function iqTeamSubmittedHtml({ coachName, teamName, memberCount, season }: { coachName: string; teamName: string | null; memberCount: number; season: string }): string {
  const team = teamName ? ` <strong>${teamName}</strong>` : ''
  return emailShell('IQ team submitted for approval', `
    <p style="${P}">Hi ${coachName || 'Coach'}, your VEX IQ team${team} has been submitted for the ${season} season with ${memberCount} member${memberCount === 1 ? '' : 's'}.</p>
    <p style="${P}">It's now pending <strong>IQ Coordinator approval</strong>. Once approved, each parent receives a magic link to register their student — and we'll email you to confirm. Nothing is sent to parents until then.</p>`)
}

export function iqTeamApprovedHtml({ coachName, teamName, season, hubUrl }: { coachName: string; teamName: string | null; season: string; hubUrl: string }): string {
  const team = teamName ? ` <strong>${teamName}</strong>` : ''
  const btn = hubUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background-color:#F2C352;border-radius:8px;">
         <a href="${hubUrl}" style="display:inline-block;padding:13px 28px;color:#0E2558;font-size:15px;font-weight:700;text-decoration:none;">Open the Hub &rarr;</a></td></tr></table>`
    : ''
  return emailShell('Your IQ team is approved', `
    <p style="${P}">Hi ${coachName || 'Coach'}, great news — your VEX IQ team${team} is approved for the ${season} season!</p>
    <p style="${P}">We've emailed each parent a magic link to register their student. You can register your own child and track your roster from the Hub.</p>
    ${btn}`)
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
