import Link from 'next/link'
import { PublicShell } from '@/components/ui'

export const metadata = { title: 'Privacy Policy — Placer Robotics' }

const h2: React.CSSProperties = { fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-navy-deep)', margin: '1.75rem 0 0.5rem' }
const p: React.CSSProperties = { fontSize: '0.9375rem', lineHeight: 1.7, color: 'var(--color-text-primary)', margin: '0 0 0.75rem' }
const li: React.CSSProperties = { ...p, margin: '0 0 0.375rem' }

// Public-facing privacy policy referenced by the registration/consent flows.
// NOTE: starting template — the organization should have this reviewed by counsel and
// adjust specifics (retention periods, contact, exact third parties) as needed.
export default function PrivacyPage() {
  return (
    <PublicShell maxWidth="md">
      <h1 className="text-page-title">Privacy Policy</h1>
      <p style={{ ...p, color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>Placer Advanced Robotics &amp; Technology (&ldquo;Placer Robotics,&rdquo; &ldquo;we&rdquo;) &middot; Effective July 2026</p>

      <p style={p}>Placer Robotics is a 501(c)(3) nonprofit youth robotics program. We collect personal information only to run our programs, keep participants safe, and communicate with families. We do not sell personal information.</p>

      <h2 style={h2}>Information we collect</h2>
      <p style={li}>&bull; <strong>Participants (students):</strong> name, grade, school, date of birth, t-shirt size, and — for our older programs only — an optional student email. For our elementary VEX IQ program we do <strong>not</strong> collect student emails; all communication and access is handled through a parent/guardian.</p>
      <p style={li}>&bull; <strong>Parents/guardians:</strong> name, email, phone, and mailing address.</p>
      <p style={li}>&bull; <strong>Emergency contacts:</strong> name, relationship, and phone.</p>
      <p style={li}>&bull; <strong>Volunteers:</strong> the above plus background-check and youth-protection training status.</p>
      <p style={li}>&bull; <strong>Payments &amp; fundraising:</strong> handled by our payment processor; we retain a record of amounts, dates, and reference codes, not full card/bank details.</p>

      <h2 style={h2}>How we use it</h2>
      <p style={p}>To register participants and teams; place students on teams; process registration fees and fundraising; communicate schedules, events, and safety information; screen and clear volunteers; and meet legal and insurance requirements.</p>

      <h2 style={h2}>Children&rsquo;s privacy</h2>
      <p style={p}>Our participants are minors. We collect a child&rsquo;s information only with the consent of a parent or legal guardian, and only what is needed to run the program. In our elementary VEX IQ program we do not collect any email or online account for the child — all access and messaging goes through the parent. A parent may review or request deletion of their child&rsquo;s information at any time (see Contact below). Slack and similar tools require users to be 13 or older; students under 13 are not invited to them.</p>

      <h2 style={h2}>How we share it</h2>
      <p style={p}>We share information only with service providers that help us operate — for example our payment processor (Zeffy), background-check/youth-protection provider (Abuse Prevention Systems), and communication/workspace tools (Slack, Google) — and only as needed to provide those services. We may disclose information if required by law or to protect the safety of a participant. We do not sell or rent personal information.</p>

      <h2 style={h2}>Data security &amp; retention</h2>
      <p style={p}>Information is stored in access-controlled systems. We keep it for as long as needed to run the program and meet legal/insurance obligations, then remove it. No system is perfectly secure, but we take reasonable measures to protect your data.</p>

      <h2 style={h2}>Your choices</h2>
      <p style={p}>You may review, correct, or request deletion of your family&rsquo;s information, and opt out of non-essential communications, by contacting us. Some information is required to participate; if it is removed, we may be unable to keep a participant enrolled.</p>

      <h2 style={h2}>Contact</h2>
      <p style={p}>Questions or requests: <a href="mailto:registrar@placerrobotics.org" style={{ color: 'var(--color-navy-deep)', fontWeight: 600 }}>registrar@placerrobotics.org</a>.</p>

      <div style={{ marginTop: '2rem' }}><Link href="/" style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-navy-deep)' }}>&larr; Back to Placer Robotics</Link></div>
    </PublicShell>
  )
}
