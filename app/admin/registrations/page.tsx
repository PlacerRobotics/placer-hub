import { createClient } from '@/lib/supabase/server'
import { requireSection } from '@/lib/auth/admin-access'
import { programScopeFor, programInScope, PROGRAM_SCOPE_LABELS } from '@/lib/auth/roles'
import { AdminShell, PageHeader } from '@/components/ui'
import RegistrationsManager from './registrations-manager'
import ReminderCampaign from './reminder-campaign'
import { gatherRegistrationReminders } from '@/lib/registration-reminders'
import { gatherAllRegistrationRows, toTeamOpts } from '@/lib/admin/registration-rows'
import { NEXT_PUBLIC_SITE_URL } from '@/lib/env'

const SEASON = '2026-27'

// V5/Combat MS/HS registrations only — VEX IQ has its own page
// (/admin/registrations-iq), since it's a different program with a different
// fee/team model (coach pays one team fee, not per-student). The combined
// roster export covering every program lives on /admin/reports.
export default async function AdminRegistrationsPage() {
  const access = await requireSection('/admin/registrations')
  // Program-scoped leads (D5) see only students/teams in their program; students
  // with no program yet (not_sure / no application) stay registrar-only.
  const scope = programScopeFor(access, '/admin/registrations')
  const supabase = await createClient()

  // Registration-reminder campaign summary — full registrar view only (spans
  // V5/Combat; already excludes IQ on its own terms).
  const reminderSummary = scope ? null : (await gatherRegistrationReminders(supabase, SEASON, NEXT_PUBLIC_SITE_URL.replace(/\/$/, ''))).summary

  const { allRows, allTeams } = await gatherAllRegistrationRows(supabase)
  const rows = allRows.filter((r) => r.program !== 'vex_iq' && programInScope(r.program, scope))

  const schools = [...new Set(rows.map((r) => r.school).filter((x) => x && x !== '—'))].sort()
  const teamOpts = toTeamOpts(allTeams, (p) => p !== 'vex_iq' && programInScope(p, scope))

  return (
    <AdminShell activePath="/admin/registrations">
      <PageHeader
        title="Registrations"
        subtitle={scope
          ? `${scope.map((p) => PROGRAM_SCOPE_LABELS[p] ?? p).join(' + ')} registrations for ${SEASON} (your program scope).`
          : `V5/Combat registration lifecycle for the ${SEASON} season. VEX IQ lives on its own page.`}
      />
      {reminderSummary && (
        <ReminderCampaign
          notRegistered={reminderSummary.notRegistered}
          unpaid={reminderSummary.unpaid}
          fundraisingOpen={reminderSummary.fundraisingOpen}
          fullyDone={reminderSummary.fullyDone}
        />
      )}
      <RegistrationsManager rows={rows} teams={teamOpts} schools={schools} />
    </AdminShell>
  )
}
