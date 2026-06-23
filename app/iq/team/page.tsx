import { createClient } from '@/lib/supabase/server'
import { PublicShell } from '@/components/ui'
import IqSignIn from './iq-sign-in'
import IqTeamForm from './iq-team-form'

// Public so a new coach can hit the sign-in step. Shows sign-in until authed;
// once signed in, shows the IQ team application (prefilled if they're a known guardian).
export default async function IqTeamPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return (
      <PublicShell maxWidth="md">
        <IqSignIn />
      </PublicShell>
    )
  }

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
