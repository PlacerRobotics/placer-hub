import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  FamilyShell,
  PageHeader,
  ActionCard,
  StatusBadge,
  WarningAlert,
  SuccessAlert,
} from '@/components/ui'
import { FinancialAidCallout } from '@/components/FinancialAidCallout'

const ADMIN_EMAIL = 'kevin.miller@placerrobotics.org'
const SEASON = '2026-27'

const PROGRAM_LABELS: Record<string, string> = {
  vex_v5: 'VEX V5',
  combat: 'Combat',
  vex_iq: 'VEX IQ',
  not_sure: 'Not sure',
  both: 'VEX V5 & Combat',
}

const AID_DISPLAY: Record<string, [string, 'success' | 'warning' | 'error' | 'info' | 'neutral']> = {
  not_requested: ['Not requested', 'neutral'],
  pending: ['Requested', 'info'],
  approved: ['Approved', 'success'],
  denied: ['Denied', 'error'],
  withdrawn: ['Withdrawn', 'neutral'],
}

type Variant = 'success' | 'warning' | 'error' | 'info' | 'neutral'
type Row = { label: string; status: string; variant: Variant }

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { notice } = await searchParams
  const email = user.email ?? 'your account'
  const isAdmin = user.email === ADMIN_EMAIL

  const { data: guardian } = await supabase
    .from('guardian')
    .select('family_id, first_name, last_name')
    .ilike('login_email', user.email ?? '')
    .maybeSingle()

  const familyLabel = guardian?.last_name ? `${guardian.last_name} Family` : email

  // Financial-aid status (family can read its own per RLS).
  let aidStatus = 'not_requested'
  // Per-student registration state.
  const students: any[] = []
  const studentCards: { name: string; registered: boolean; rows: Row[] }[] = []
  let firstUnregisteredName = ''

  if (guardian) {
    const familyId = guardian.family_id

    const { data: aid } = await supabase
      .from('financial_aid')
      .select('status')
      .eq('family_id', familyId)
      .eq('season', SEASON)
      .order('requested_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (aid) aidStatus = aid.status

    const { data: studs } = await supabase
      .from('student')
      .select('id, first_name, last_name, preferred_name')
      .eq('family_id', familyId)
      .order('created_at', { ascending: true })
    students.push(...(studs ?? []))
    const studentIds = students.map((s) => s.id)

    if (studentIds.length) {
      const { data: enrollments } = await supabase
        .from('enrollment')
        .select('student_id, program, registration_fee_status, submitted_at')
        .eq('season', SEASON)
        .in('student_id', studentIds)
      const { data: apps } = await supabase
        .from('student_application')
        .select('student_id, program_interest')
        .eq('season', SEASON)
        .in('student_id', studentIds)
      const { data: sigs } = await supabase
        .from('waiver_signature')
        .select('student_id')
        .eq('season', SEASON)
        .in('student_id', studentIds)
      const { data: tms } = await supabase
        .from('team_member')
        .select('student_id, team_id')
        .eq('season', SEASON)
        .eq('team_role', 'student')
        .is('revoked_at', null)
        .in('student_id', studentIds)
      const teamIds = [...new Set((tms ?? []).map((t: any) => t.team_id).filter(Boolean))]
      const { data: teams } = teamIds.length
        ? await supabase.from('team').select('id, team_number, team_name').in('id', teamIds)
        : { data: [] as any[] }
      const teamById: Record<string, any> = Object.fromEntries((teams ?? []).map((t: any) => [t.id, t]))

      const enrByStudent: Record<string, any[]> = {}
      for (const e of enrollments ?? []) (enrByStudent[e.student_id] ??= []).push(e)
      const progByStudent: Record<string, string> = Object.fromEntries(
        (apps ?? []).map((a: any) => [a.student_id, a.program_interest])
      )
      const signed = new Set((sigs ?? []).map((s: any) => s.student_id))
      const teamByStudent: Record<string, any> = {}
      for (const t of tms ?? []) if (!teamByStudent[t.student_id]) teamByStudent[t.student_id] = teamById[t.team_id]

      for (const s of students) {
        const enrs = enrByStudent[s.id] ?? []
        const registered = enrs.some((e) => e.submitted_at)
        const programVal = enrs.length > 1 ? 'both' : (enrs[0]?.program ?? progByStudent[s.id] ?? 'not_sure')
        const feeStatuses = enrs.map((e) => e.registration_fee_status)
        const team = teamByStudent[s.id]

        let payment: Row
        if (!enrs.length) payment = { label: 'Payment', status: '—', variant: 'neutral' }
        else if (feeStatuses.includes('unpaid')) payment = { label: 'Payment', status: 'Not paid', variant: 'warning' }
        else if (feeStatuses.includes('waived')) payment = { label: 'Payment', status: 'Waived', variant: 'success' }
        else payment = { label: 'Payment', status: 'Paid', variant: 'success' }

        const rows: Row[] = [
          { label: 'Program', status: PROGRAM_LABELS[programVal] ?? programVal, variant: 'info' },
          registered
            ? { label: 'Registration', status: 'Complete', variant: 'success' }
            : { label: 'Registration', status: 'Not started', variant: 'warning' },
          signed.has(s.id)
            ? { label: 'Waivers', status: 'Signed', variant: 'success' }
            : { label: 'Waivers', status: 'Not signed', variant: 'warning' },
          payment,
          team
            ? { label: 'Team', status: team.team_number || team.team_name || 'Assigned', variant: 'success' }
            : { label: 'Team', status: 'Pending', variant: 'info' },
        ]

        const name = `${s.first_name} ${s.last_name}`.trim()
        if (!registered && !firstUnregisteredName) firstUnregisteredName = name
        studentCards.push({ name, registered, rows })
      }
    }
  }

  const [aidLabel, aidVariant] = AID_DISPLAY[aidStatus] ?? AID_DISPLAY.not_requested
  const showAidCallout = aidStatus === 'not_requested'
  const allRegistered = studentCards.length > 0 && studentCards.every((c) => c.registered)

  return (
    <FamilyShell familyName={familyLabel} maxWidth="lg">
      {notice === 'not_cleared' && (
        <div style={{ marginBottom: '1rem' }}>
          <WarningAlert title="Not cleared to register yet">
            You need to be accepted before registering.
          </WarningAlert>
        </div>
      )}
      {notice === 'registered' && (
        <div style={{ marginBottom: '1rem' }}>
          <SuccessAlert title="Registration submitted">
            We received your registration. Complete payment to secure the spot.
          </SuccessAlert>
        </div>
      )}

      {isAdmin && (
        <div style={{ marginBottom: '1rem' }}>
          <Link href="/admin" style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-navy-deep)' }}>
            Admin dashboard →
          </Link>
        </div>
      )}

      <PageHeader title="Your Dashboard" subtitle={`Signed in as ${email}. Here's where each student stands.`} />

      {firstUnregisteredName && (
        <ActionCard
          title={`Complete registration for ${firstUnregisteredName}`}
          description="Finish the registration form and submit payment to secure the spot for the 2026–27 season."
          ctaLabel="Continue registration"
          href="/register"
        />
      )}
      {allRegistered && (
        <div style={{ marginBottom: '0.5rem' }}>
          <SuccessAlert title="All students registered">
            Every student on your account is registered for {SEASON}. Make sure each registration fee is paid to
            secure the spot.
          </SuccessAlert>
        </div>
      )}

      {studentCards.length === 0 ? (
        <div style={{ marginTop: '1.5rem' }}>
          <WarningAlert title="No students yet">
            We don&apos;t have a student on your account for {SEASON} yet. If you applied, an admin will clear you to
            register soon.
          </WarningAlert>
        </div>
      ) : (
        studentCards.map((card) => (
          <div key={card.name} style={{ marginTop: '1.5rem' }}>
            <h2 className="text-section-title" style={{ margin: '0 0 0.75rem' }}>{card.name}</h2>
            <div
              style={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: '10px',
                overflow: 'hidden',
              }}
            >
              {card.rows.map((item, i) => (
                <div
                  key={item.label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    padding: '0.875rem 1.25rem',
                    borderBottom: i < card.rows.length - 1 ? '1px solid var(--color-border)' : 'none',
                  }}
                >
                  <span style={{ fontSize: '0.9375rem', fontWeight: 500, color: 'var(--color-text-primary)' }}>
                    {item.label}
                  </span>
                  <StatusBadge label={item.status} variant={item.variant} />
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <span style={{ fontSize: '0.9375rem', fontWeight: 500 }}>Financial aid</span>
        <StatusBadge label={aidLabel} variant={aidVariant} />
      </div>

      {showAidCallout && (
        <div style={{ marginTop: '1rem' }}>
          <FinancialAidCallout />
        </div>
      )}
    </FamilyShell>
  )
}
