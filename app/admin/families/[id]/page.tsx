import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { AdminShell, PageHeader, AdminDetailPanel } from '@/components/ui'
import FamilyActions from './family-actions'
import FamilyMaintenance from './family-maintenance'
import { formatPhoneDisplay } from '@/lib/phone-input'

const SEASON = '2026-27'
const PROGRAM_LABELS: Record<string, string> = { vex_v5: 'VEX V5', combat: 'Combat', vex_iq: 'VEX IQ', not_sure: 'Not sure', both: 'VEX V5 & Combat' }

const td: React.CSSProperties = { padding: '0.5rem 0.9rem', fontSize: '0.8125rem', borderBottom: '1px solid var(--color-border)', textAlign: 'left' }
const thh: React.CSSProperties = { ...td, fontWeight: 700, textTransform: 'uppercase', fontSize: '0.6875rem', color: 'var(--color-text-muted)' }

export default async function FamilyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: family } = await supabase.from('family').select('id, display_name, primary_email, status').eq('id', id).maybeSingle()
  if (!family) {
    return (
      <AdminShell activePath="/admin/families">
        <PageHeader title="Family not found" breadcrumb={[{ label: 'Families', href: '/admin/families' }, { label: 'Not found' }]} />
      </AdminShell>
    )
  }

  const { data: guardians } = await supabase.from('guardian').select('id, first_name, last_name, login_email, communication_email, phone, role, created_at').eq('family_id', id).order('created_at', { ascending: true })
  const gList = guardians ?? []
  const g1 = gList[0]
  const g2 = gList[1]

  const { data: studs } = await supabase.from('student').select('id, first_name, last_name, grade, tshirt_size, school_raw, school:school_id ( name )').eq('family_id', id).order('created_at', { ascending: true })
  const students = studs ?? []
  const studentIds = students.map((s: any) => s.id)

  const { data: enrollments } = studentIds.length ? await supabase.from('enrollment').select('student_id, program, division, registration_fee_status').eq('season', SEASON).in('student_id', studentIds) : { data: [] as any[] }
  const { data: tms } = studentIds.length ? await supabase.from('team_member').select('student_id, team:team_id ( team_number, team_name )').eq('season', SEASON).eq('team_role', 'student').is('revoked_at', null).in('student_id', studentIds) : { data: [] as any[] }
  const { data: ecs } = studentIds.length ? await supabase.from('emergency_contact').select('student_id, first_name, last_name, phone').eq('priority', 1).in('student_id', studentIds) : { data: [] as any[] }
  const enrByStu: Record<string, any[]> = {}; for (const e of enrollments ?? []) (enrByStu[e.student_id] ??= []).push(e)
  const teamByStu: Record<string, any> = {}; for (const t of tms ?? []) if (!teamByStu[t.student_id]) teamByStu[t.student_id] = t.team
  const ecByStu: Record<string, any> = Object.fromEntries((ecs ?? []).map((e: any) => [e.student_id, e]))

  const { data: fsHistory } = await supabase.from('family_season').select('season, status, magic_link_sent').eq('family_id', id).order('season', { ascending: false })
  const { data: payments } = await supabase.from('payment_transaction').select('amount, source, payment_type, received_at, matched_status, payment_reference_code').eq('family_id', id).order('received_at', { ascending: false })

  // Delete-blocker counts for the duplicate-cleanup panel (same set the delete
  // API enforces — deleting a family cascades all of these away).
  const cnt = async (table: string) => ((await supabase.from(table).select('*', { count: 'exact', head: true }).eq('family_id', id)).count ?? 0) as number
  const blockers = {
    students: students.length,
    enrollments: await cnt('enrollment'),
    payments: (payments ?? []).length,
    waiver_signatures: await cnt('waiver_signature'),
    volunteer_profiles: await cnt('volunteer_profile'),
    financial_aid: await cnt('financial_aid'),
  }
  // "Registered" for move-eligibility means an enrollment in ANY season (the
  // move API checks the same), not just the current one shown above.
  const { data: anyEnrs } = studentIds.length ? await supabase.from('enrollment').select('student_id').in('student_id', studentIds) : { data: [] as any[] }
  const registeredStudentIds = new Set((anyEnrs ?? []).map((e: any) => e.student_id))

  // Volunteer records on this family — movable to the person's real guardian
  // (all history keys off volunteer_id, so the move carries everything).
  const { data: vps } = await supabase.from('volunteer_profile').select('id, guardian_id, status, aps_user_id').eq('family_id', id)
  const gNameById: Record<string, string> = Object.fromEntries(gList.map((g: any) => [g.id, `${g.first_name} ${g.last_name}`.trim()]))

  const familyName = g1?.last_name ? `${g1.last_name} Family` : family.display_name ?? family.primary_email

  return (
    <AdminShell activePath="/admin/families">
      <PageHeader title={familyName} subtitle="Family detail" breadcrumb={[{ label: 'Families', href: '/admin/families' }, { label: familyName }]} />

      <FamilyActions
        familyId={id}
        guardian1={g1 ? { id: g1.id, first_name: g1.first_name, last_name: g1.last_name, login_email: g1.login_email, communication_email: g1.communication_email ?? '', phone: g1.phone ?? '' } : null}
        students={students.map((s: any) => ({ id: s.id, first_name: s.first_name, last_name: s.last_name, grade: s.grade ?? '', tshirt_size: s.tshirt_size ?? '' }))}
      />

      <AdminDetailPanel
        title="Guardian 1 (login)"
        fields={[
          { label: 'Name', value: g1 ? `${g1.first_name} ${g1.last_name}` : '—' },
          { label: 'Login email', value: g1?.login_email ?? '—' },
          { label: 'Phone', value: g1?.phone ? formatPhoneDisplay(g1.phone) : '—' },
        ]}
      />
      <AdminDetailPanel
        title="Guardian 2"
        fields={[
          { label: 'Name', value: g2 ? `${g2.first_name} ${g2.last_name}` : 'Not added' },
          { label: 'Email', value: g2?.communication_email || g2?.login_email || '—' },
          { label: 'Phone', value: g2?.phone ? formatPhoneDisplay(g2.phone) : '—' },
        ]}
      />

      <h2 className="text-section-title" style={{ margin: '1.5rem 0 0.75rem' }}>Students</h2>
      {students.length === 0 ? (
        <p className="text-help">No students on this family.</p>
      ) : students.map((s: any) => {
        const enrs = enrByStu[s.id] ?? []
        const program = enrs.length > 1 ? 'both' : (enrs[0]?.program ?? '—')
        const team = teamByStu[s.id]
        const ec = ecByStu[s.id]
        return (
          <AdminDetailPanel
            key={s.id}
            title={`${s.first_name} ${s.last_name}`}
            fields={[
              { label: 'Grade', value: s.grade ?? '—' },
              { label: 'School', value: s.school?.name ?? s.school_raw ?? '—' },
              { label: 'Program', value: PROGRAM_LABELS[program] ?? program },
              { label: 'Division', value: enrs[0]?.division ?? '—' },
              { label: 'Team', value: team ? (team.team_number || team.team_name || 'Assigned') : 'Pending' },
              { label: 'Fee status', value: enrs[0]?.registration_fee_status ?? '—' },
              { label: 'T-shirt', value: s.tshirt_size ?? '—' },
              { label: 'Emergency contact', value: ec ? `${ec.first_name} ${ec.last_name} · ${formatPhoneDisplay(ec.phone)}` : '—' },
            ]}
          />
        )
      })}

      <h2 className="text-section-title" style={{ margin: '1.5rem 0 0.75rem' }}>Season history</h2>
      <div style={{ border: '1px solid var(--color-border)', borderRadius: '10px', overflow: 'hidden', marginBottom: '1.5rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'var(--color-surface)' }}>
          <thead><tr><th style={thh}>Season</th><th style={thh}>Status</th><th style={thh}>Invite sent</th></tr></thead>
          <tbody>
            {(fsHistory ?? []).length === 0 ? <tr><td style={td} colSpan={3}>No season records.</td></tr> :
              (fsHistory ?? []).map((f: any) => <tr key={f.season}><td style={td}>{f.season}</td><td style={td}>{f.status}</td><td style={td}>{f.magic_link_sent ? 'Yes' : 'No'}</td></tr>)}
          </tbody>
        </table>
      </div>

      <h2 className="text-section-title" style={{ margin: '0 0 0.75rem' }}>Payment history</h2>
      <div style={{ border: '1px solid var(--color-border)', borderRadius: '10px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'var(--color-surface)' }}>
          <thead><tr><th style={thh}>Date</th><th style={thh}>Amount</th><th style={thh}>Source</th><th style={thh}>Type</th><th style={thh}>Status</th><th style={thh}>Ref</th></tr></thead>
          <tbody>
            {(payments ?? []).length === 0 ? <tr><td style={td} colSpan={6}>No payments.</td></tr> :
              (payments ?? []).map((p: any, i: number) => (
                <tr key={i}>
                  <td style={td}>{p.received_at ? new Date(p.received_at).toLocaleDateString() : '—'}</td>
                  <td style={td}>${Number(p.amount).toFixed(2)}</td>
                  <td style={td}>{p.source}</td>
                  <td style={td}>{p.payment_type}</td>
                  <td style={td}>{p.matched_status}</td>
                  <td style={td}>{p.payment_reference_code ?? '—'}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <FamilyMaintenance
        familyId={id}
        familyLabel={familyName}
        familyStatus={family.status ?? 'active'}
        students={students.map((s: any) => ({ id: s.id, name: `${s.first_name} ${s.last_name}`.trim(), registered: registeredStudentIds.has(s.id) }))}
        volunteers={(vps ?? []).map((v: any) => ({ id: v.id, guardianName: gNameById[v.guardian_id] ?? 'Guardian', status: v.status, hasAps: !!v.aps_user_id }))}
        blockers={blockers}
      />

      <div style={{ marginTop: '1.25rem' }}>
        <Link href="/admin/families" style={{ fontSize: '0.875rem' }}>← Back to families</Link>
      </div>
    </AdminShell>
  )
}
