import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { FamilyShell, PageHeader, SuccessAlert, WarningAlert } from '@/components/ui'
import { getCurrentVolunteer, VOLUNTEER_SEASON, VOLUNTEER_WAIVER_TYPES, VOLUNTEER_REMINDER_TYPES } from '@/lib/volunteer'
import WaiverSignForm from './sign-form'

export default async function VolunteerWaiverPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const vol = await getCurrentVolunteer()
  if (!vol) redirect('/volunteer')

  const db = createAdminClient()
  // The real, versioned documents volunteers sign — the same agreements families sign,
  // EXCEPT the student-facing Student & Family Expectations (shown as a reminder only).
  const signTypes = VOLUNTEER_WAIVER_TYPES as unknown as string[]
  const reminderTypes = VOLUNTEER_REMINDER_TYPES as unknown as string[]
  const { data: tmplRows } = await db
    .from('waiver_template')
    .select('id, waiver_type, version, title, body_markdown, body_hash')
    .eq('active', true)
    .in('waiver_type', [...signTypes, ...reminderTypes])
  const rows = (tmplRows ?? []) as any[]
  const templates = rows.filter((t) => signTypes.includes(t.waiver_type)).sort((a, b) => signTypes.indexOf(a.waiver_type) - signTypes.indexOf(b.waiver_type))
  const reminders = rows.filter((t) => reminderTypes.includes(t.waiver_type))

  // Which has this volunteer already signed this season?
  const { data: sigs } = await db
    .from('waiver_signature')
    .select('waiver_template_id')
    .eq('volunteer_id', vol.profileId)
    .eq('season', VOLUNTEER_SEASON)
  const signedIds = new Set((sigs ?? []).map((s: any) => s.waiver_template_id))
  const allSigned = templates.length > 0 && templates.every((t: any) => signedIds.has(t.id))

  return (
    <FamilyShell familyName={vol.name || vol.email} maxWidth="lg">
      <PageHeader title="Volunteer agreements" subtitle={`Annual acknowledgment · ${VOLUNTEER_SEASON} season`} breadcrumb={[{ label: 'Volunteer Portal', href: '/volunteer' }, { label: 'Agreements' }]} />

      {templates.length === 0 ? (
        <WarningAlert title="Agreements unavailable">
          The volunteer agreements aren’t published yet. Please contact info@placerrobotics.org.
        </WarningAlert>
      ) : allSigned ? (
        <SuccessAlert title="All signed">
          You’ve signed all {templates.length} volunteer agreements for {VOLUNTEER_SEASON}. A copy of each is retained on file.
        </SuccessAlert>
      ) : (
        <WaiverSignForm
          waivers={templates.map((t: any) => ({ id: t.id, title: t.title, body_markdown: t.body_markdown }))}
          alreadySigned={[...signedIds] as string[]}
          defaultFirst={vol.firstName}
          defaultLast={vol.lastName}
        />
      )}

      {reminders.map((r: any) => (
        <div key={r.id} style={{ backgroundColor: 'var(--color-surface)', border: '1px dashed var(--color-border)', borderRadius: 10, padding: '1.25rem', marginTop: '1.25rem' }}>
          <h3 className="text-card-title" style={{ marginBottom: '0.25rem' }}>{r.title}</h3>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: '0 0 0.625rem' }}>
            For your awareness — no signature required from volunteers, but please review the expectations you’ll help uphold.
          </p>
          <details style={{ border: '1px solid var(--color-border)', borderRadius: 6, padding: '0.875rem' }}>
            <summary style={{ cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-navy-deep)' }}>Read the {r.title}</summary>
            <div style={{ fontSize: '0.875rem', lineHeight: 1.7, color: 'var(--color-text-primary)', whiteSpace: 'pre-wrap', marginTop: '0.875rem' }}>{r.body_markdown}</div>
          </details>
        </div>
      ))}
    </FamilyShell>
  )
}
