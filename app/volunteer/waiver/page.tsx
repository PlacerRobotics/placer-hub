import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { FamilyShell, PageHeader, SuccessAlert, WarningAlert } from '@/components/ui'
import { getCurrentVolunteer, VOLUNTEER_SEASON, VOLUNTEER_WAIVER_TYPES } from '@/lib/volunteer'
import WaiverSignForm from './sign-form'

export default async function VolunteerWaiverPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const vol = await getCurrentVolunteer()
  if (!vol) redirect('/volunteer')

  const db = createAdminClient()
  // The two REAL, versioned documents volunteers sign: the Release of Liability
  // (same as guardians) + the Registered Volunteer policy acknowledgment.
  const { data: tmplRows } = await db
    .from('waiver_template')
    .select('id, waiver_type, version, title, body_markdown, body_hash')
    .eq('active', true)
    .in('waiver_type', VOLUNTEER_WAIVER_TYPES as unknown as string[])
  // Order: liability first, policy acknowledgment second.
  const order = VOLUNTEER_WAIVER_TYPES as unknown as string[]
  const templates = (tmplRows ?? []).slice().sort((a: any, b: any) => order.indexOf(a.waiver_type) - order.indexOf(b.waiver_type))

  // Which has this volunteer already signed this season?
  const { data: sigs } = await db
    .from('waiver_signature')
    .select('waiver_template_id')
    .eq('volunteer_id', vol.profileId)
    .eq('season', VOLUNTEER_SEASON)
  const signedIds = new Set((sigs ?? []).map((s: any) => s.waiver_template_id))
  const allSigned = templates.length > 0 && templates.every((t: any) => signedIds.has(t.id))

  return (
    <FamilyShell familyName={vol.name || vol.email} maxWidth="md">
      <PageHeader title="Volunteer agreements" subtitle={`Annual acknowledgment · ${VOLUNTEER_SEASON} season`} breadcrumb={[{ label: 'Volunteer Portal', href: '/volunteer' }, { label: 'Agreements' }]} />

      {templates.length === 0 ? (
        <WarningAlert title="Agreements unavailable">
          The volunteer agreements aren’t published yet. Please contact info@placerrobotics.org.
        </WarningAlert>
      ) : allSigned ? (
        <SuccessAlert title="All signed">
          You’ve signed both volunteer agreements for {VOLUNTEER_SEASON}. A copy of each is retained on file.
        </SuccessAlert>
      ) : (
        <WaiverSignForm
          waivers={templates.map((t: any) => ({ id: t.id, title: t.title, body_markdown: t.body_markdown }))}
          alreadySigned={[...signedIds] as string[]}
          defaultFirst={vol.firstName}
          defaultLast={vol.lastName}
        />
      )}
    </FamilyShell>
  )
}
