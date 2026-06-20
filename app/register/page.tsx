'use client'

import {
  FamilyShell,
  PageHeader,
  FormSection,
  FormField,
  TextInput,
  PrimaryButton,
} from '@/components/ui'

export default function RegisterPage() {
  return (
    <FamilyShell familyName="Miller Family" maxWidth="lg">
      <PageHeader
        title="Complete Registration"
        subtitle="Registering Maya Miller for the 2026–27 season"
        breadcrumb={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Registration' }]}
      />

      <FormSection title="Student Information" description="Tell us about the student you're registering.">
        <FormField label="Student name" htmlFor="studentName" required>
          <TextInput id="studentName" name="studentName" defaultValue="Maya Miller" />
        </FormField>
        <FormField label="Grade" htmlFor="grade" required helpText="Grade for the 2026–27 school year.">
          <TextInput id="grade" name="grade" placeholder="e.g. 7" />
        </FormField>
        <FormField label="School" htmlFor="school">
          <TextInput id="school" name="school" placeholder="School name" />
        </FormField>
      </FormSection>

      <FormSection title="Guardian Information" description="The primary contact for this student.">
        <FormField label="Guardian name" htmlFor="guardianName" required>
          <TextInput id="guardianName" name="guardianName" defaultValue="Kevin Miller" />
        </FormField>
        <FormField label="Email" htmlFor="guardianEmail" required>
          <TextInput id="guardianEmail" name="guardianEmail" type="email" defaultValue="kevin.miller@placerrobotics.org" />
        </FormField>
        <FormField label="Mobile phone" htmlFor="guardianPhone" required helpText="Used for urgent practice and event updates.">
          <TextInput id="guardianPhone" name="guardianPhone" type="tel" placeholder="(916) 555-0142" />
        </FormField>
      </FormSection>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
        <PrimaryButton>Continue</PrimaryButton>
      </div>
    </FamilyShell>
  )
}
