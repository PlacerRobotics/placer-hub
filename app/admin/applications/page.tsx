import { createClient } from '@/lib/supabase/server'
import { AdminShell, PageHeader } from '@/components/ui'
import ApplicationsQueue, { type QueueItem } from './applications-queue'

export default async function AdminApplicationsPage() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('student_application')
    .select(
      'id, program_interest, status, submitted_at, student:student_id ( first_name, last_name, school_raw, school:school_id ( name ) )'
    )
    .in('status', ['submitted', 'needs_follow_up', 'program_pending'])
    .order('submitted_at', { ascending: true })

  const items: QueueItem[] = (data ?? []).map((a: any) => ({
    id: a.id,
    name: a.student ? `${a.student.first_name} ${a.student.last_name}` : 'Unknown applicant',
    program: a.program_interest,
    school: a.student?.school?.name ?? a.student?.school_raw ?? '—',
    submitted: a.submitted_at,
  }))

  return (
    <AdminShell activePath="/admin/applications">
      <PageHeader title="Applications" subtitle="New applicants awaiting a decision." />
      {error ? (
        <p style={{ color: 'var(--color-error)' }}>Couldn’t load applications: {error.message}</p>
      ) : (
        <ApplicationsQueue items={items} />
      )}
    </AdminShell>
  )
}
