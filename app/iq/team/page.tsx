import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PublicShell } from '@/components/ui'
import IqTeamForm from './iq-team-form'

// Authenticated (PRD FR-IQ-001): a coach must have a family account to create an IQ
// team. Unauthenticated visitors are redirected to /login (which shows a coach
// message and returns them here after sign-in).
export default async function IqTeamPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirectTo=/iq/team')

  const [{ data: g }, { data: schools }] = await Promise.all([
    supabase.from('guardian').select('first_name, last_name, phone').ilike('login_email', user.email ?? '').maybeSingle(),
    supabase.from('school').select('id, name, grade_min, grade_max').order('name'),
  ])

  return (
    <PublicShell maxWidth="md">
      <IqTeamForm
        email={user.email ?? ''}
        coach={{ first_name: g?.first_name ?? '', last_name: g?.last_name ?? '', phone: g?.phone ?? '' }}
        schools={schools ?? []}
      />
    </PublicShell>
  )
}
