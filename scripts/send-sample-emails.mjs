// Send one sample of EVERY hub email to a single address for review.
//   RESEND_API_KEY=... [EMAIL_FROM='Placer Robotics Hub <noreply@placerrobotics.org>'] \
//     node scripts/send-sample-emails.mjs [recipient@example.com]
//
// Renders the REAL templates from lib/email.ts (no mock-ups). The magic-link email
// uses a placeholder link so nothing is generated in Supabase.
import {
  magicLinkHtml,
  iqTeamSubmittedHtml,
  iqTeamApprovedHtml,
  iqTeamPaidNotifyHtml,
  studentApplicationReceivedHtml,
  applicationAcceptedHtml,
  clearedToRegisterHtml,
  volunteerApplicationReceivedHtml,
  volunteerAdminNotifyHtml,
  apsReminderHtml,
  volunteerWaiverReminderHtml,
  volunteerRenewalReminderHtml,
  registrationConfirmationHtml,
} from '../lib/email.ts'

const TO = process.argv[2] || 'kevin.miller@placerrobotics.org'
const FROM = process.env.EMAIL_FROM || 'Placer Robotics Hub <noreply@placerrobotics.org>'
const KEY = process.env.RESEND_API_KEY
if (!KEY) { console.error('RESEND_API_KEY is required'); process.exit(1) }

const SEASON = '2026-27'
const SITE = 'https://hub.placerrobotics.org'
const ZEFFY = 'https://www.zeffy.com/en-US/ticketing/2026-27-placer-robotics-mshs-registration'
const ZEFFY_IQ = 'https://www.zeffy.com/en-US/ticketing/2026-27-placer-robotics-vex-iq-registration'
const SAMPLE_LINK = `${SITE}/login?redirectTo=/register#access_token=SAMPLE`

// [subject, html] for each real template, with representative sample data.
const samples = [
  ['Magic link — register invite', magicLinkHtml({ heading: 'You’re invited to register', intro: "You're cleared to register for the 2026-27 Placer Robotics season. Click below to sign in and complete your student's registration.", buttonLabel: 'Sign in to register →', link: SAMPLE_LINK, preheader: 'Sign in to complete your Placer Robotics registration.' })],
  ['Registration confirmation', registrationConfirmationHtml({ studentName: 'Sally Sample', programLabel: 'VEX V5', paymentRef: 'REG-1A2B3C4D', zeffyUrl: ZEFFY, season: SEASON })],
  ['Application received', studentApplicationReceivedHtml({ guardianName: 'Jordan Sample', studentName: 'Sally Sample', programLabel: 'VEX V5', season: SEASON })],
  ['Application accepted', applicationAcceptedHtml({ guardianName: 'Jordan Sample', studentName: 'Sally Sample', season: SEASON })],
  ['Cleared to register', clearedToRegisterHtml({ guardianName: 'Jordan Sample', season: SEASON, loginUrl: `${SITE}/login` })],
  ['IQ team created — payment needed', iqTeamSubmittedHtml({ coachName: 'Coach Sample', teamName: 'Robo Raptors', season: SEASON, paymentRef: 'IQT-D42B1FF6', zeffyUrl: ZEFFY_IQ, fee: 1200 })],
  ['IQ team approved', iqTeamApprovedHtml({ coachName: 'Coach Sample', teamName: 'Robo Raptors', season: SEASON, volunteerUrl: `${SITE}/volunteer` })],
  ['IQ team fee received (admin notify)', iqTeamPaidNotifyHtml({ teamName: 'Robo Raptors', amount: 1200, hubUrl: `${SITE}/admin/iq-teams` })],
  ['Volunteer application received', volunteerApplicationReceivedHtml({ name: 'Coach Sample', season: SEASON })],
  ['Volunteer application (admin notify)', volunteerAdminNotifyHtml({ name: 'Coach Sample', email: 'coach@example.com', programs: 'VEX V5, VEX IQ', role: 'Head Coach', season: SEASON, hubUrl: `${SITE}/admin/volunteers` })],
  ['APS expiry reminder', apsReminderHtml({ name: 'Coach Sample', expiry: '2026-09-03', days: 30 })],
  ['Volunteer waiver reminder', volunteerWaiverReminderHtml({ name: 'Coach Sample', season: SEASON, waiverUrl: `${SITE}/volunteer/waiver` })],
  ['Volunteer renewal reminder', volunteerRenewalReminderHtml({ name: 'Coach Sample', season: SEASON, statusLines: ['APS: renew (expires 2026-09-03)', 'Robotics Center Use Quiz: not passed', 'Annual agreement: not signed'], renewUrl: `${SITE}/volunteer/renew` })],
]

let ok = 0, fail = 0
for (const [label, html] of samples) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [TO], subject: `[SAMPLE] ${label}`, html, reply_to: 'registrar@placerrobotics.org' }),
  })
  if (res.ok) { ok++; console.log(`✓ ${label}`) }
  else { fail++; console.log(`✗ ${label} — ${res.status} ${(await res.text()).slice(0, 200)}`) }
}
console.log(`\nDone → ${TO}. Sent ${ok}, failed ${fail}, of ${samples.length}.`)
