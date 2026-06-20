import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FamilyShell, PageHeader, StepChecklist, EmptyState, InfoAlert } from '@/components/ui'

type StepStatus = 'complete' | 'in_progress' | 'pending' | 'blocked' | 'skipped'

const STEP_LABELS: Record<string, string> = {
  policy_acknowledgment: 'Policy Acknowledgment',
  background_check: 'Background Check',
  aps_youth_protection: 'APS Youth Protection',
  youth_protection_quiz: 'Youth Protection Quiz',
  lab_use_quiz: 'Lab Use Quiz',
  lab_orientation: 'Lab Orientation',
  custom: 'Additional requirement',
}

const STATUS_MAP: Record<string, StepStatus> = {
  complete: 'complete',
  in_progress: 'in_progress',
  pending: 'pending',
  waived: 'skipped',
}

export default async function VolunteerPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: guardian } = await supabase
    .from('guardian')
    .select('id, first_name, last_name')
    .ilike('login_email', user.email ?? '')
    .maybeSingle()

  const familyName = guardian
    ? `${guardian.first_name} ${guardian.last_name}`
    : user.email ?? 'Volunteer'

  const { data: profile } = guardian
    ? await supabase
        .from('volunteer_profile')
        .select('id, status')
        .eq('guardian_id', guardian.id)
        .maybeSingle()
    : { data: null }

  if (!profile) {
    return (
      <FamilyShell familyName={familyName} maxWidth="md">
        <PageHeader title="Volunteer Clearance" subtitle="Get cleared to work with students at events and practices." />
        <EmptyState
          title="You haven’t applied to volunteer yet"
          description="Volunteer clearance includes a background check and youth protection training. It only takes a few minutes to start."
          action={{ label: 'Apply to volunteer', href: '/volunteer/apply' }}
        />
      </FamilyShell>
    )
  }

  const { data: steps } = await supabase
    .from('volunteer_step')
    .select('id, step, status, sort_order')
    .eq('volunteer_id', profile.id)
    .order('sort_order', { ascending: true })

  const checklistSteps: Array<{ id: string; label: string; status: StepStatus }> = (steps ?? []).map(
    (st: any) => ({
      id: st.id,
      label: STEP_LABELS[st.step] ?? st.step,
      status: STATUS_MAP[st.status] ?? 'pending',
    })
  )

  return (
    <FamilyShell familyName={familyName} maxWidth="md">
      <PageHeader title="Volunteer Clearance" subtitle="Required before working directly with students." />
      <div style={{ marginBottom: '1.5rem' }}>
        <InfoAlert title={`Clearance status: ${profile.status}`}>
          Complete each step below to get cleared for the season. We’ll update your status as steps
          are verified.
        </InfoAlert>
      </div>
      <StepChecklist title="Your clearance steps" steps={checklistSteps} />
    </FamilyShell>
  )
}
