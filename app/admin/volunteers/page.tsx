import { createClient } from '@/lib/supabase/server'
import { AdminShell, PageHeader } from '@/components/ui'
import VolunteersQueue, { type VolunteerItem } from './volunteers-queue'

export default async function AdminVolunteersPage() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('volunteer_profile')
    .select(
      'id, status, created_at, guardian:guardian_id ( first_name, last_name, login_email ), steps:volunteer_step ( status )'
    )
    .order('created_at', { ascending: false })

  const items: VolunteerItem[] = (data ?? []).map((v: any) => {
    const steps = v.steps ?? []
    const done = steps.filter((s: any) => s.status === 'complete').length
    return {
      id: v.id,
      name: v.guardian ? `${v.guardian.first_name} ${v.guardian.last_name}` : 'Unknown volunteer',
      email: v.guardian?.login_email ?? '—',
      status: v.status,
      progress: `${done}/${steps.length} steps`,
    }
  })

  return (
    <AdminShell activePath="/admin/volunteers">
      <PageHeader title="Volunteers" subtitle="Volunteer clearance profiles." />
      {error ? (
        <p style={{ color: 'var(--color-error)' }}>Couldn’t load volunteers: {error.message}</p>
      ) : (
        <VolunteersQueue items={items} />
      )}
    </AdminShell>
  )
}
