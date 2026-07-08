import Link from 'next/link'
import { PublicShell } from '@/components/ui'

export const metadata = { title: 'Privacy Policy — Placer Robotics' }

const h2: React.CSSProperties = { fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-navy-deep)', margin: '1.75rem 0 0.5rem' }
const p: React.CSSProperties = { fontSize: '0.9375rem', lineHeight: 1.7, color: 'var(--color-text-primary)', margin: '0 0 0.75rem' }
const li: React.CSSProperties = { ...p, margin: '0 0 0.375rem' }

// Organization-wide public privacy policy referenced by registration/consent flows.
// NOTE: starting template — the organization should have this reviewed by counsel and
// adjust specifics (retention periods, media release, exact providers) as needed.
export default function PrivacyPage() {
  return (
    <PublicShell maxWidth="md">
      <h1 className="text-page-title">Privacy Policy</h1>
      <p style={{ ...p, color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>Placer Advanced Robotics and Technology d/b/a Placer Robotics (&ldquo;Placer Robotics,&rdquo; &ldquo;we&rdquo;) &middot; Effective July 2026</p>

      <p style={p}>Placer Robotics is a 501(c)(3) nonprofit youth robotics organization. This policy applies to our teams, summer camps, workshops, events, volunteers, family accounts, and related online systems, and covers participants, campers, families, volunteers, and program applicants. We collect personal information only to run our programs, keep participants safe, and communicate with families. We do not sell personal information.</p>

      <h2 style={h2}>Information we collect</h2>
      <p style={li}>&bull; <strong>Participants and campers (students):</strong> name, grade, school, date of birth, t-shirt size, and — for our older programs only — an optional student email. For our elementary VEX IQ program we do <strong>not</strong> collect student emails; all communication and access is handled through a parent/guardian.</p>
      <p style={li}>&bull; <strong>Parents/guardians:</strong> name, email, phone, and mailing address.</p>
      <p style={li}>&bull; <strong>Emergency contacts:</strong> name, relationship, and phone.</p>
      <p style={li}>&bull; <strong>Summer camps, workshops, and short-term programs:</strong> session enrollment, attendance and check-in records, authorized pickup information, allergy or medical notes provided by a parent/guardian, emergency instructions, and incident or safety records when needed.</p>
      <p style={li}>&bull; <strong>Volunteers:</strong> the above plus background-check and youth-protection training status.</p>
      <p style={li}>&bull; <strong>Payments &amp; fundraising:</strong> handled by our payment processor; we retain a record of amounts, dates, and reference codes, not full card/bank details.</p>
      <p style={li}>&bull; <strong>Photos and video:</strong> we may take photos or video at programs and events for safety, documentation, and promotional purposes, subject to any media-release choices or restrictions a parent/guardian provides.</p>

      <h2 style={h2}>How we use it</h2>
      <p style={p}>To register participants, campers, and teams; manage attendance, check-in, and authorized pickup; place students on teams; process registration fees and fundraising; communicate schedules, events, and safety information; respond to allergies, medical needs, and emergencies; screen and clear volunteers; and meet legal and insurance requirements.</p>

      <h2 style={h2}>Children&rsquo;s privacy</h2>
      <p style={p}>Our participants are minors. We collect a child&rsquo;s information only with the consent of a parent or legal guardian, and only what is needed to run the program safely. In our elementary VEX IQ program we do not collect any email or online account for the child — all access and messaging goes through the parent. A parent may review or request deletion of their child&rsquo;s information at any time (see Contact below). Slack and similar tools require users to be 13 or older; students under 13 are not invited to them.</p>

      <h2 style={h2}>How we share it</h2>
      <p style={p}>We share information only with service providers that help us operate, and only as needed to provide those services. Examples include registration and payment tools (such as Zeffy), background-check and youth-protection providers (such as Abuse Prevention Systems), email or messaging platforms, workspace tools (such as Slack and Google), and cloud storage providers. We may also use or share limited information when needed to protect a participant&rsquo;s health or safety, respond to an emergency, comply with law, or work with our insurers or legal advisors. We do not sell or rent personal information.</p>

      <h2 style={h2}>Data security &amp; retention</h2>
      <p style={p}>Information is stored in access-controlled systems. We keep it for as long as needed to run our programs and meet our obligations. Some records — such as waivers, payment records, attendance, incident reports, volunteer screening records, and insurance-related records — may be kept longer where needed for legal, accounting, safety, or insurance purposes. No system is perfectly secure, but we take reasonable measures to protect your data.</p>

      <h2 style={h2}>Your choices</h2>
      <p style={p}>You may review, correct, or request deletion of your family&rsquo;s information, and opt out of non-essential communications, by contacting us. Some information is required to participate; if it is removed, we may be unable to keep a participant enrolled.</p>

      <h2 style={h2}>Contact</h2>
      <p style={p}>Questions or requests: <a href="mailto:registrar@placerrobotics.org" style={{ color: 'var(--color-navy-deep)', fontWeight: 600 }}>registrar@placerrobotics.org</a>.</p>

      <div style={{ marginTop: '2rem' }}><Link href="/" style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-navy-deep)' }}>&larr; Back to Placer Robotics</Link></div>
    </PublicShell>
  )
}
