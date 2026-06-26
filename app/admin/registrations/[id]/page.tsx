import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AdminShell, PageHeader, AdminDetailPanel, StatusBadge } from '@/components/ui'
import RegistrationEdit from './edit-modal'
import TeamAssign, { type AssignTeam } from './team-assign'
import FundraisingReceived from './fundraising-received'
import StatusControl from './status-control'

const SEASON = '2026-27'
const PROGRAM_LABELS: Record<string, string> = { vex_v5: 'VEX V5', combat: 'Combat', both: 'VEX V5 & Combat', vex_iq: 'VEX IQ', not_sure: 'Not sure' }
const STATUS_LABELS: Record<string, string> = { cleared_to_register: 'Cleared to Register', registered: 'Registered', cancelled: 'Cancelled' }
const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'error' | 'info' | 'neutral'> = { cleared_to_register: 'info', registered: 'success', cancelled: 'neutral' }
const FUND_LABELS: Record<string, string> = { direct_donation: 'Direct contribution', corporate_match: 'Employer / corporate match', sponsored: 'Business sponsorship', paper_check: 'Paper check', pending: 'Financial assistance' }

export default async function RegistrationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ student?: string }>
}) {
  const { id } = await params
  const { student: studentParam } = await searchParams
  const supabase = await createClient()

  const { data: fs } = await supabase
    .from('family_season')
    .select('id, family_id, status, magic_link_sent, updated_at, fundraising_method, fundraising_methods')
    .eq('id', id)
    .maybeSingle()
  if (!fs) {
    return (
      <AdminShell activePath="/admin/registrations">
        <PageHeader title="Registration not found" breadcrumb={[{ label: 'Registrations', href: '/admin/registrations' }, { label: 'Not found' }]} />
      </AdminShell>
    )
  }

  let sq = supabase.from('student').select('id, first_name, last_name, grade, preferred_name, tshirt_size, school_raw, family_id, school:school_id ( name )').eq('family_id', fs.family_id)
  if (studentParam) sq = sq.eq('id', studentParam)
  const { data: studs } = await sq
  const student: any = studs?.[0] ?? null

  const { data: guardian } = await supabase
    .from('guardian')
    .select('first_name, last_name, login_email, phone, last_login_at')
    .eq('family_id', fs.family_id)
    .eq('role', 'primary')
    .maybeSingle()

  // A 'both' student has two enrollment rows (vex_v5 + combat); fetch all.
  const { data: enrs } = student
    ? await supabase.from('enrollment').select('id, program, division, fundraising_methods, fundraising_received_at, fundraising_received_amount, fundraising_received_note').eq('student_id', student.id).eq('season', SEASON)
    : { data: [] as any[] }
  const enrList = (enrs ?? []) as any[]
  const programVal = enrList.length > 1 ? 'both' : (enrList[0]?.program ?? '')
  const divisionVal = enrList[0]?.division ?? null

  let teamId: string | null = null
  let teamLabel = '—'
  let teamPending = false
  if (student) {
    const { data: tms } = await supabase.from('team_member').select('team_id').eq('student_id', student.id).eq('season', SEASON).eq('team_role', 'student').is('revoked_at', null)
    const teamIds = [...new Set(((tms ?? []) as any[]).map((t) => t.team_id).filter(Boolean))]
    if (teamIds.length) {
      teamId = teamIds[0]
    } else {
      // Not registered yet — show the pending team pointer from the application.
      const { data: appn } = await supabase.from('student_application').select('triage_notes').eq('student_id', student.id).eq('season', SEASON).maybeSingle()
      const mt = String(appn?.triage_notes ?? '').match(/(?:iq_team|team):([0-9a-f-]{36})/i)
      if (mt) { teamId = mt[1]; teamPending = true }
    }
    if (teamId) {
      const { data: t0 } = await supabase.from('team').select('team_number, team_name').eq('id', teamId).maybeSingle()
      teamLabel = t0 ? (`${t0.team_number ?? ''}${t0.team_name ? ` · ${t0.team_name}` : ''}`.trim() || '—') + (teamPending ? ' (pending)' : '') : '—'
    }
  }

  const { data: wsig } = student
    ? await supabase.from('waiver_signature').select('signed_at').eq('student_id', student.id).eq('season', SEASON).order('signed_at', { ascending: false }).limit(1).maybeSingle()
    : { data: null as any }
  const { data: ec } = student
    ? await supabase.from('emergency_contact').select('first_name, last_name, phone').eq('student_id', student.id).eq('priority', 1).maybeSingle()
    : { data: null as any }
  const { data: pay } = await supabase.from('payment_transaction').select('amount, source, matched_status, payment_reference_code').eq('family_id', fs.family_id).order('created_at', { ascending: false }).limit(1).maybeSingle()
  const { data: audit } = await supabase.from('registration_audit_log').select('field_changed, old_value, new_value, changed_at, notes').eq('family_season_id', id).order('changed_at', { ascending: false })
  const { data: allTeams } = await supabase.from('team').select('id, team_number, team_name, program, division').eq('season', SEASON).eq('active', true).order('team_number', { ascending: true })

  // Fundraising (Part 5) — method on family_season; employer-match on family;
  // sponsorship interest in family_sponsor_interest. Read via service role (admin).
  const adb = createAdminClient()
  const { data: fam } = await adb.from('family').select('employer_match_company, employer_match_pct, employer_match_portal').eq('id', fs.family_id).maybeSingle()
  const { data: sponsor } = student
    ? await adb.from('family_sponsor_interest').select('business_name, contact_name, estimated_amount, status').eq('family_id', fs.family_id).eq('season', SEASON).eq('student_id', student.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
    : { data: null as any }
  // Per-student fundraising — from this student's enrollment(s).
  const fundMethods = [...new Set(enrList.flatMap((e: any) => (e.fundraising_methods ?? []) as string[]))]

  const name = student ? `${student.first_name} ${student.last_name}` : 'Registration'
  const assignTeams: AssignTeam[] = (allTeams ?? []).map((t: any) => ({ id: t.id, number: t.team_number ?? '', name: t.team_name ?? '', program: t.program }))

  const studentFields = [
    { label: 'Name', value: name },
    { label: 'Grade', value: student?.grade ?? '—' },
    { label: 'School', value: student?.school?.name ?? student?.school_raw ?? '—' },
    { label: 'Program', value: PROGRAM_LABELS[programVal] ?? programVal ?? '—' },
    { label: 'Division', value: divisionVal ?? '—' },
    { label: 'Team', value: student ? <TeamAssign familySeasonId={fs.id} studentId={student.id} studentProgram={programVal} hasEnrollment={enrList.length > 0} current={teamId ? { id: teamId, label: teamLabel } : null} teams={assignTeams} /> : '—' },
    { label: 'Status', value: <StatusBadge label={STATUS_LABELS[fs.status] ?? fs.status} variant={STATUS_VARIANT[fs.status] ?? 'neutral'} /> },
  ]
  const guardianFields = [
    { label: 'Name', value: guardian ? `${guardian.first_name} ${guardian.last_name}` : '—' },
    { label: 'Email', value: guardian?.login_email ?? '—' },
    { label: 'Phone', value: guardian?.phone ?? '—' },
    { label: 'Magic link', value: fs.magic_link_sent ? 'Sent' : 'Not sent' },
    { label: 'Login status', value: guardian?.last_login_at ? 'Logged in' : fs.magic_link_sent ? 'Invited, not logged in' : 'Not invited' },
    { label: 'Last sign-in', value: guardian?.last_login_at ? new Date(guardian.last_login_at).toLocaleString() : '—' },
  ]
  const regFields = [
    { label: 'Waiver signed', value: wsig?.signed_at ? new Date(wsig.signed_at).toLocaleString() : 'Not signed' },
    { label: 'Emergency contact', value: ec ? `${ec.first_name} ${ec.last_name}` : '—' },
    { label: 'Emergency phone', value: ec?.phone ?? '—' },
    { label: 'T-shirt size', value: student?.tshirt_size ? String(student.tshirt_size).toUpperCase() : '—' },
    { label: 'Payment', value: pay ? `$${pay.amount} · ${pay.source} · ${pay.matched_status}${pay.payment_reference_code ? ` · ${pay.payment_reference_code}` : ''}` : 'No payment on file' },
  ]
  const fundMethodLabel = fundMethods.length ? fundMethods.map((m) => FUND_LABELS[m] ?? m).join(', ') : '—'
  const fundraisingFields = [{ label: 'Method(s)', value: fundMethodLabel }]
  if (fundMethods.includes('corporate_match')) {
    fundraisingFields.push(
      { label: 'Employer', value: fam?.employer_match_company ?? '—' },
      { label: 'Match %', value: fam?.employer_match_pct != null ? `${fam.employer_match_pct}%` : '—' },
      { label: 'Submitted via', value: fam?.employer_match_portal ?? '—' },
    )
  }
  if (fundMethods.includes('sponsored')) {
    fundraisingFields.push(
      { label: 'Business', value: sponsor?.business_name ?? '—' },
      { label: 'Contact', value: sponsor?.contact_name ?? '—' },
      { label: 'Estimated amount', value: sponsor?.estimated_amount != null ? `$${sponsor.estimated_amount}` : '—' },
      { label: 'Sponsor status', value: sponsor?.status ?? '—' },
    )
  }

  return (
    <AdminShell activePath="/admin/registrations">
      <PageHeader title={name} subtitle="Registration detail" breadcrumb={[{ label: 'Registrations', href: '/admin/registrations' }, { label: name }]} />

      {student && (
        <div style={{ marginBottom: '1.25rem' }}>
          <RegistrationEdit
            familySeasonId={fs.id}
            studentId={student.id}
            current={{
              tshirt_size: student.tshirt_size ?? '',
              program: programVal,
              division: divisionVal ?? '',
              emergency_name: ec ? `${ec.first_name} ${ec.last_name}` : '',
              emergency_phone: ec?.phone ?? '',
              fundraising_methods: fundMethods,
              employer_company: fam?.employer_match_company ?? '',
              employer_pct: fam?.employer_match_pct != null ? String(fam.employer_match_pct) : '',
              employer_portal: fam?.employer_match_portal ?? '',
              sponsor_business: sponsor?.business_name ?? '',
              sponsor_contact: sponsor?.contact_name ?? '',
              sponsor_amount: sponsor?.estimated_amount != null ? String(sponsor.estimated_amount) : '',
            }}
          />
        </div>
      )}

      <AdminDetailPanel title="Student" fields={studentFields} />
      <AdminDetailPanel title="Guardian" fields={guardianFields} />
      <AdminDetailPanel title="Registration" fields={regFields} />
      <StatusControl familySeasonId={fs.id} current={fs.status} />
      <AdminDetailPanel title="Fundraising" fields={fundraisingFields} />
      {student && enrList.length > 0 && (
        <div style={{ marginTop: '-0.75rem', marginBottom: '1.25rem' }}>
          <FundraisingReceived
            familySeasonId={fs.id}
            studentId={student.id}
            current={{
              receivedAt: (enrList[0] as any).fundraising_received_at ?? null,
              amount: (enrList[0] as any).fundraising_received_amount != null ? String((enrList[0] as any).fundraising_received_amount) : '',
              note: (enrList[0] as any).fundraising_received_note ?? '',
            }}
          />
        </div>
      )}

      <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-light)' }}>
          <h3 className="text-card-title">Status history</h3>
        </div>
        {(audit ?? []).length === 0 ? (
          <p className="text-help" style={{ padding: '1.25rem' }}>No changes logged yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Field', 'From', 'To', 'When'].map((h) => <th key={h} style={{ padding: '0.6rem 1.25rem', textAlign: 'left', fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}>{h}</th>)}</tr></thead>
            <tbody>
              {(audit ?? []).map((a: any, i: number) => (
                <tr key={i}>
                  <td style={{ padding: '0.6rem 1.25rem', fontSize: '0.8125rem', borderBottom: '1px solid var(--color-border)' }}>{a.field_changed}</td>
                  <td style={{ padding: '0.6rem 1.25rem', fontSize: '0.8125rem', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>{a.old_value ?? '—'}</td>
                  <td style={{ padding: '0.6rem 1.25rem', fontSize: '0.8125rem', borderBottom: '1px solid var(--color-border)' }}>{a.new_value ?? '—'}</td>
                  <td style={{ padding: '0.6rem 1.25rem', fontSize: '0.8125rem', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>{new Date(a.changed_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ marginTop: '1.25rem' }}>
        <Link href="/admin/registrations" style={{ fontSize: '0.875rem' }}>← Back to registrations</Link>
      </div>
    </AdminShell>
  )
}
