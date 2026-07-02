import { createAdminClient } from '@/lib/supabase/admin'
import { requireSection } from '@/lib/auth/admin-access'
import { AdminShell, PageHeader } from '@/components/ui'
import VolunteersDashboard, { type VolRow } from './volunteers-dashboard'
import ApsSyncButton from './aps-sync-button'
import { VOLUNTEER_SEASON as SEASON, APS_VALID_THROUGH } from '@/lib/volunteer'
import { volunteerBucket } from '@/lib/volunteer-buckets'

// Reads live data via the service-role client (no cookies), so Next would otherwise
// prerender this page static and freeze the volunteer list at deploy time.
export const dynamic = 'force-dynamic'

export default async function AdminVolunteersPage() {
  await requireSection('/admin/volunteers')
  const db = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)

  const { data: profiles, error } = await db
    .from('volunteer_profile')
    .select('id, status, guardian:guardian_id ( first_name, last_name, login_email )')
    .order('created_at', { ascending: false })
  const ids = (profiles ?? []).map((p: any) => p.id)

  // Load all clearance/cert/DOJ rows for the season and join in memory. We
  // deliberately do NOT filter with .in('volunteer_id', ids): with 100+ volunteers
  // that array blows past PostgREST's URL-length limit and the request silently
  // returns nothing (which made every field read as ✗ on the dashboard).
  const { data: clears } = ids.length
    ? await db.from('volunteer_clearance').select('volunteer_id, status, rc_quiz_passed, yp_quiz_passed, waiver_signed_date').eq('season', SEASON)
    : { data: [] as any[] }
  const { data: certs } = ids.length
    ? await db.from('youth_protection_cert').select('volunteer_id, expiration_date').order('expiration_date', { ascending: false })
    : { data: [] as any[] }
  const { data: steps } = ids.length
    ? await db.from('volunteer_step').select('volunteer_id, status').eq('step', 'background_check')
    : { data: [] as any[] }

  const clearByVol: Record<string, any> = {}
  for (const c of clears ?? []) clearByVol[c.volunteer_id] = c
  const certByVol: Record<string, string> = {}
  for (const c of certs ?? []) if (!certByVol[c.volunteer_id]) certByVol[c.volunteer_id] = c.expiration_date // latest (desc)
  const dojByVol: Record<string, boolean> = {}
  for (const s of steps ?? []) if (s.status === 'complete') dojByVol[s.volunteer_id] = true

  const rows: VolRow[] = (profiles ?? []).map((p: any) => {
    const g = Array.isArray(p.guardian) ? p.guardian[0] : p.guardian
    const c = clearByVol[p.id]
    const exp = certByVol[p.id] ?? null
    let aps: VolRow['aps'] = 'none'
    if (exp) aps = exp >= APS_VALID_THROUGH ? 'valid' : exp >= today ? 'expiring' : 'expired'
    const doj = !!dojByVol[p.id]
    const rc = !!c?.rc_quiz_passed
    const yp = !!c?.yp_quiz_passed
    const waiver = !!c?.waiver_signed_date

    const bucket = volunteerBucket({ profileStatus: p.status, doj, apsState: aps, rc, yp, waiver })

    return {
      id: p.id,
      name: g ? `${g.first_name} ${g.last_name}`.trim() : 'Unknown volunteer',
      email: g?.login_email ?? '—',
      status: c?.status ?? p.status ?? 'pending',
      bucket,
      doj, aps, apsExpiry: exp, rc, yp, waiver,
    }
  })

  return (
    <AdminShell activePath="/admin/volunteers">
      <PageHeader title="Volunteers" subtitle={`Registered Volunteer clearance — ${rows.length} people · ${SEASON} season`} />
      <div style={{ marginBottom: '1.25rem' }}><ApsSyncButton /></div>
      {error ? (
        <p style={{ color: 'var(--color-error)' }}>Couldn’t load volunteers: {error.message}</p>
      ) : (
        <VolunteersDashboard rows={rows} />
      )}
    </AdminShell>
  )
}
