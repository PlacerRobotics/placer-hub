import { createClient } from '@/lib/supabase/server'
import { requireSection } from '@/lib/auth/admin-access'
import { AdminShell, PageHeader } from '@/components/ui'
import RegistrationsManager from '../registrations/registrations-manager'
import { gatherAllRegistrationRows, toTeamOpts } from '@/lib/admin/registration-rows'

const SEASON = '2026-27'

// VEX IQ registrations only — same family_season lifecycle view as
// /admin/registrations (status, magic link, bulk actions, team assignment),
// scoped to VEX IQ instead of V5/Combat. IQ has its own fee model (the coach
// pays one team fee, not a per-student one), which is why it's split out
// rather than mixed into the main registrations table.
export default async function AdminRegistrationsIqPage() {
  await requireSection('/admin/registrations-iq')
  const supabase = await createClient()

  const { allRows, allTeams } = await gatherAllRegistrationRows(supabase)
  const rows = allRows.filter((r) => r.program === 'vex_iq')

  const schools = [...new Set(rows.map((r) => r.school).filter((x) => x && x !== '—'))].sort()
  const teamOpts = toTeamOpts(allTeams, (p) => p === 'vex_iq')

  return (
    <AdminShell activePath="/admin/registrations-iq">
      <PageHeader
        title="IQ Registrations"
        subtitle={`VEX IQ registration lifecycle for the ${SEASON} season. Team roster, waivers, and kit tracking live on IQ Teams.`}
      />
      <RegistrationsManager rows={rows} teams={teamOpts} schools={schools} />
    </AdminShell>
  )
}
