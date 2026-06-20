import { FamilyShell, PageHeader, StepChecklist } from '@/components/ui'

export default function VolunteerPage() {
  return (
    <FamilyShell familyName="Miller Family" maxWidth="md">
      <PageHeader
        title="Volunteer Clearance"
        subtitle="Required before working directly with students at events or practices."
        breadcrumb={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Volunteer clearance' }]}
      />

      <StepChecklist
        title="Your clearance steps"
        steps={[
          {
            id: 'policy',
            label: 'Policy Acknowledgment',
            status: 'complete',
          },
          {
            id: 'background',
            label: 'Background Check',
            status: 'in_progress',
            owner: 'placer_robotics',
            detail: 'Submitted to our screening partner. Typically clears in 3–5 business days.',
          },
          {
            id: 'aps',
            label: 'APS Training',
            status: 'pending',
            owner: 'you',
            detail: 'Adult & Pupil Safety training — a short online course.',
            action: { label: 'Start APS training', href: '#' },
          },
          {
            id: 'quiz',
            label: 'Youth Protection Quiz',
            status: 'pending',
            owner: 'you',
            detail: 'A brief quiz to confirm understanding of youth protection policies.',
          },
          {
            id: 'orientation',
            label: 'Lab Orientation',
            status: 'pending',
            owner: 'placer_robotics',
            detail: 'In-person walkthrough of lab safety and equipment.',
          },
        ]}
      />
    </FamilyShell>
  )
}
