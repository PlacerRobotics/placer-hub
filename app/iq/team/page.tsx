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

  const [{ data: g }, { data: schools }, { data: cfg }, { data: iqTeams }] = await Promise.all([
    supabase.from('guardian').select('first_name, last_name, phone').ilike('login_email', user.email ?? '').maybeSingle(),
    supabase.from('school').select('id, name, grade_min, grade_max').order('name'),
    supabase.from('season_config').select('zeffy_iq_team_url, iq_team_fee').eq('season', '2026-27').maybeSingle(),
    supabase.from('team').select('team_number').eq('program', 'vex_iq').eq('season', '2026-27').not('team_number', 'is', null),
  ])
  const takenNumbers = [...new Set((iqTeams ?? []).map((t: any) => String(t.team_number).trim().toUpperCase()).filter(Boolean))]

  return (
    <PublicShell maxWidth="md">
      <IqTeamForm
        email={user.email ?? ''}
        coach={{ first_name: g?.first_name ?? '', last_name: g?.last_name ?? '', phone: g?.phone ?? '' }}
        schools={schools ?? []}
        zeffyUrl={cfg?.zeffy_iq_team_url ?? null}
        fee={Number(cfg?.iq_team_fee ?? 1200)}
        takenNumbers={takenNumbers}
      />
    </PublicShell>
  )
}
