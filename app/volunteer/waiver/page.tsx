import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { FamilyShell, PageHeader, SuccessAlert, WarningAlert } from '@/components/ui'
import { getCurrentVolunteer, VOLUNTEER_SEASON } from '@/lib/volunteer'
import WaiverSignForm from './sign-form'

export default async function VolunteerWaiverPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const vol = await getCurrentVolunteer()
  if (!vol) redirect('/volunteer')

  const db = createAdminClient()
  // The REAL, versioned waiver text (seeded in waiver_template).
  const { data: tmpl } = await db
    .from('waiver_template')
    .select('id, version, title, body_markdown, body_hash')
    .eq('waiver_type', 'volunteer')
    .eq('active', true)
    .order('effective_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Has this volunteer already signed THIS version this season?
  const { data: sig } = tmpl
    ? await db
        .from('waiver_signature')
        .select('signed_at, typed_name, waiver_version')
        .eq('volunteer_id', vol.profileId)
        .eq('waiver_template_id', tmpl.id)
        .eq('season', VOLUNTEER_SEASON)
        .order('signed_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null as any }

  return (
    <FamilyShell familyName={vol.name || vol.email} maxWidth="md">
      <PageHeader title={tmpl?.title ?? 'Registered Volunteer Agreement'} subtitle={`Annual acknowledgment · ${VOLUNTEER_SEASON} season${tmpl ? ` · v${tmpl.version}` : ''}`} breadcrumb={[{ label: 'Volunteer Portal', href: '/volunteer' }, { label: 'Agreement' }]} />

      {!tmpl ? (
        <WarningAlert title="Agreement unavailable">
          The volunteer agreement isn’t published yet. Please contact info@placerrobotics.org.
        </WarningAlert>
      ) : sig ? (
        <SuccessAlert title="Already signed">
          You signed this agreement (v{sig.waiver_version}) on {new Date(sig.signed_at).toLocaleDateString()} as “{sig.typed_name}”. A copy is retained on file.
        </SuccessAlert>
      ) : (
        <>
          <div
            style={{
              maxHeight: 360,
              overflowY: 'auto',
              border: '1px solid var(--color-border)',
              borderRadius: 10,
              padding: '1.25rem 1.5rem',
              fontSize: '0.9375rem',
              lineHeight: 1.6,
              color: 'var(--color-text-muted)',
              whiteSpace: 'pre-wrap',
            }}
          >
            {tmpl.body_markdown}
          </div>
          <WaiverSignForm
            templateId={tmpl.id}
            version={tmpl.version}
            bodyHash={tmpl.body_hash}
            defaultFirst={vol.firstName}
            defaultLast={vol.lastName}
          />
        </>
      )}
    </FamilyShell>
  )
}
