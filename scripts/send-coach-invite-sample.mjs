// Send a sample of the IQ coach "sign in / set up your team" invite email.
//   RESEND_API_KEY=... [EMAIL_FROM='Placer Robotics Hub <noreply@placerrobotics.org>'] \
//     node scripts/send-coach-invite-sample.mjs [recipient@example.com]
//
// Renders the REAL magic-link template from lib/email.ts with a placeholder link,
// so nothing is generated in Supabase — it's purely a visual sample.
import { magicLinkHtml } from '../lib/email.ts'

const TO = process.argv[2] || 'kevin.miller@placerrobotics.org'
const FROM = process.env.EMAIL_FROM || 'Placer Robotics Hub <noreply@placerrobotics.org>'
const KEY = process.env.RESEND_API_KEY
if (!KEY) { console.error('RESEND_API_KEY is required'); process.exit(1) }

const SITE = 'https://hub.placerrobotics.org'
const SAMPLE_LINK = `${SITE}/login?redirectTo=/dashboard#access_token=SAMPLE`

// Exactly what the assign-coach / send-invite actions send.
const html = magicLinkHtml({
  heading: 'Welcome — set up your VEX IQ team',
  intro: "You've been assigned as the coach of Robo Raptors (295X). Click below to sign in and finish setting up your team — add your roster and complete the steps to get it registered for the 2026-27 season.",
  buttonLabel: 'Sign in to set up my team →',
  link: SAMPLE_LINK,
  preheader: 'Sign in to set up your VEX IQ team.',
})

const res = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ from: FROM, to: [TO], subject: '[SAMPLE] Set up your VEX IQ team — Placer Robotics', html }),
})
const body = await res.json().catch(() => ({}))
console.log(res.ok ? `Sent to ${TO} (id ${body.id})` : `Failed ${res.status}: ${JSON.stringify(body)}`)
process.exit(res.ok ? 0 : 1)
