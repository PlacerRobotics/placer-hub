import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FamilyShell, PageHeader } from '@/components/ui'
import { getCurrentVolunteer } from '@/lib/volunteer'
import WaiverSignForm from './sign-form'

const WAIVER_PARAS = [
  'By signing below, I acknowledge that I have read, understand, and agree to follow and enforce the Placer Robotics Youth Protection and Abuse Prevention Policy, the Robotics Center Use Policy, and all associated training requirements for the 2026-27 program season.',
  'I understand that:',
]
const WAIVER_POINTS = [
  'I am required to complete CA AB506 mandated reporter training and maintain a valid certificate through May 31, 2027.',
  'I must pass the annual Robotics Center Use Safety Quiz and Youth Protection Supplemental Quiz with a score of 90% or higher.',
  'I must follow the Two-Adult Rule at all times when interacting with youth in any Placer Robotics program or facility.',
  'I must report any suspicion of child abuse or neglect directly to Child Protective Services or law enforcement.',
  'Violations of these policies may result in suspension or revocation of my Registered Volunteer status.',
]

export default async function VolunteerWaiverPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const vol = await getCurrentVolunteer()
  if (!vol) redirect('/volunteer')

  return (
    <FamilyShell familyName={vol.name || vol.email} maxWidth="md">
      <PageHeader title="Youth Protection & Abuse Prevention Policy" subtitle="Annual acknowledgment · 2026-27 season" />
      <div style={{ border: '1px solid var(--color-border)', borderRadius: 10, padding: '1.25rem 1.5rem', fontSize: '0.9375rem', lineHeight: 1.6, color: 'var(--color-text-muted)' }}>
        {WAIVER_PARAS.map((p, i) => <p key={i} style={{ margin: '0 0 0.75rem' }}>{p}</p>)}
        <ul style={{ margin: '0 0 0.75rem', paddingLeft: '1.25rem' }}>
          {WAIVER_POINTS.map((p, i) => <li key={i} style={{ marginBottom: '0.5rem' }}>{p}</li>)}
        </ul>
        <p style={{ margin: 0 }}>I understand that my electronic signature below constitutes a legally binding acknowledgment of these policies.</p>
      </div>
      <WaiverSignForm volunteerName={vol.name} />
    </FamilyShell>
  )
}
