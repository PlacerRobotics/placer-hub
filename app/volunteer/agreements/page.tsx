import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { FamilyShell, PageHeader, EmptyState } from '@/components/ui'
import { getCurrentVolunteer, VOLUNTEER_SEASON } from '@/lib/volunteer'

// View-only record of the exact agreements this volunteer signed: each signature
// points at the immutable template version that was signed, so the body shown is a
// faithful copy of what was accepted, with the date and typed name.
export default async function VolunteerSignedAgreementsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const vol = await getCurrentVolunteer()
  if (!vol) redirect('/volunteer')

  const db = createAdminClient()
  const { data: sigs } = await db
    .from('waiver_signature')
    .select('signed_at, typed_name, waiver_version, waiver_type, template:waiver_template_id ( title, body_markdown )')
    .eq('volunteer_id', vol.profileId)
    .eq('season', VOLUNTEER_SEASON)
    .order('signed_at', { ascending: true })
  const rows = (sigs ?? []) as any[]

  return (
    <FamilyShell familyName={vol.name || vol.email} maxWidth="lg">
      <PageHeader
        title="Signed agreements"
        subtitle={`Your signed ${VOLUNTEER_SEASON} agreements — view only`}
        breadcrumb={[{ label: 'Volunteer Portal', href: '/volunteer' }, { label: 'Signed agreements' }]}
      />

      {rows.length === 0 ? (
        <EmptyState title="No signed agreements yet" description="You haven’t signed this season’s volunteer agreements." action={{ label: 'Sign agreements', href: '/volunteer/waiver' }} />
      ) : (
        rows.map((s, i) => {
          const tmpl = Array.isArray(s.template) ? s.template[0] : s.template
          return (
            <div key={i} style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '1.25rem', marginBottom: '1.25rem' }}>
              <h3 className="text-card-title" style={{ marginBottom: '0.25rem' }}>{tmpl?.title ?? s.waiver_type}</h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: '0 0 0.75rem' }}>
                Signed {new Date(s.signed_at).toLocaleDateString()} by <strong>{s.typed_name}</strong> · version {s.waiver_version}
              </p>
              <details style={{ border: '1px solid var(--color-border)', borderRadius: 6, padding: '0.875rem' }}>
                <summary style={{ cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-navy-deep)' }}>View the signed document</summary>
                <div style={{ fontSize: '0.875rem', lineHeight: 1.7, color: 'var(--color-text-primary)', whiteSpace: 'pre-wrap', marginTop: '0.875rem' }}>{tmpl?.body_markdown ?? '(document text unavailable)'}</div>
              </details>
            </div>
          )
        })
      )}
    </FamilyShell>
  )
}
