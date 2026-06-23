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
const TSHIRT_LABELS: Record<string, string> = {
  ym: 'Youth Medium', yl: 'Youth Large', xs: 'Adult XS', s: 'Adult Small', m: 'Adult Medium',
  l: 'Adult Large', xl: 'Adult XL', xxl: 'Adult 2XL', xxxl: 'Adult 3XL',
}
const AID_DISPLAY: Record<string, [string, Variant]> = {
  not_requested: ['Not requested', 'neutral'],
  pending: ['Requested', 'info'],
  approved: ['Approved', 'success'],
  denied: ['Denied', 'error'],
  withdrawn: ['Withdrawn', 'neutral'],
}

type Variant = 'success' | 'warning' | 'error' | 'info' | 'neutral'
type Row = { label: string; value: string; variant?: Variant; href?: string; hrefLabel?: string }

function supporterLevel(amount: number): string | null {
  if (amount >= 1040) return 'Champion'
  if (amount >= 790) return 'Standard'
  if (amount >= 590) return 'Minimum'
  return null
}

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
    .select('id, family_id, first_name, last_name')
    .ilike('login_email', user.email ?? '')
    .maybeSingle()
  const familyLabel = guardian?.last_name ? `${guardian.last_name} Family` : email

  let aidStatus = 'not_requested'
  let fsStatus = ''
  let guardian2: { name: string; email: string } | null = null
  const cards: { name: string; complete: boolean; pending: string[]; rows: Row[] }[] = []
  let firstUnregisteredName = ''
  let guardianHasSigned = false
  let hasActiveWaivers = false

  if (guardian) {
    const familyId = guardian.family_id

    const { data: fs } = await supabase
      .from('family_season')
      .select('status')
      .eq('family_id', familyId)
      .eq('season', SEASON)
      .maybeSingle()
    fsStatus = fs?.status ?? ''

    const { data: aid } = await supabase
      .from('financial_aid')
      .select('status')
      .eq('family_id', familyId)
      .eq('season', SEASON)
      .order('requested_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (aid) aidStatus = aid.status

    // Second guardian (any guardian on the family other than the one logged in).
    const { data: gAll } = await supabase
      .from('guardian')
      .select('id, first_name, last_name, login_email, communication_email')
      .eq('family_id', familyId)
      .order('created_at', { ascending: true })
    const g2 = (gAll ?? []).find((g: any) => g.id !== guardian.id)
    guardian2 = g2 ? { name: `${g2.first_name} ${g2.last_name}`.trim(), email: g2.communication_email || g2.login_email || '' } : null

    const { data: studs } = await supabase
      .from('student')
      .select('id, first_name, last_name, preferred_name, tshirt_size')
      .eq('family_id', familyId)
      .order('created_at', { ascending: true })
    const students = studs ?? []
    const studentIds = students.map((s: any) => s.id)

    if (studentIds.length) {
      const { data: enrollments } = await supabase
        .from('enrollment')
        .select('id, student_id, program, registration_fee_status, submitted_at')
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
      const { data: ecs } = await supabase
        .from('emergency_contact')
        .select('student_id, first_name, last_name, phone')
        .eq('priority', 1)
        .in('student_id', studentIds)
      const { data: pays } = await supabase
        .from('payment_transaction')
        .select('enrollment_id, amount, received_at, raw_payload')
        .eq('family_id', familyId)
        .eq('season', SEASON)
        .eq('payment_type', 'registration_fee')

      const teamIds = [...new Set((tms ?? []).map((t: any) => t.team_id).filter(Boolean))]
      const { data: teams } = teamIds.length
        ? await supabase.from('team').select('id, team_number, team_name').in('id', teamIds)
        : { data: [] as any[] }
      const teamById: Record<string, any> = Object.fromEntries((teams ?? []).map((t: any) => [t.id, t]))

      const enrByStudent: Record<string, any[]> = {}
      for (const e of enrollments ?? []) (enrByStudent[e.student_id] ??= []).push(e)
      const progByStudent: Record<string, string> = Object.fromEntries((apps ?? []).map((a: any) => [a.student_id, a.program_interest]))
      const signed = new Set((sigs ?? []).map((s: any) => s.student_id))
      const teamByStudent: Record<string, any> = {}
      for (const t of tms ?? []) if (!teamByStudent[t.student_id]) teamByStudent[t.student_id] = teamById[t.team_id]
      const ecByStudent: Record<string, any> = Object.fromEntries((ecs ?? []).map((e: any) => [e.student_id, e]))
      const payByEnrollment: Record<string, any> = Object.fromEntries((pays ?? []).map((p: any) => [p.enrollment_id, p]))

      for (const s of students) {
        const enrs = enrByStudent[s.id] ?? []
        const registered = enrs.some((e: any) => e.submitted_at)
        const programVal = enrs.length > 1 ? 'both' : (enrs[0]?.program ?? progByStudent[s.id] ?? 'not_sure')
        const feeStatuses = enrs.map((e: any) => e.registration_fee_status)
        const paid = enrs.length > 0 && !feeStatuses.includes('unpaid')
        const isSigned = signed.has(s.id)
        const team = teamByStudent[s.id]
        const hasTeam = !!team
        const ec = ecByStudent[s.id]
        const pay = enrs.map((e: any) => payByEnrollment[e.id]).find(Boolean)
        const level = pay ? supporterLevel(Number(pay.amount)) : null
        const receiptUrl = pay?.raw_payload?.receipt_url ?? null

        let paymentValue: string
        let paymentVariant: Variant
        if (!enrs.length) { paymentValue = '—'; paymentVariant = 'neutral' }
        else if (feeStatuses.includes('unpaid')) { paymentValue = 'Not paid'; paymentVariant = 'warning' }
        else if (feeStatuses.includes('waived')) { paymentValue = 'Waived'; paymentVariant = 'success' }
        else { paymentValue = level ? `Paid · ${level}` : 'Paid'; paymentVariant = 'success' }

        const rows: Row[] = [
          { label: 'Program', value: PROGRAM_LABELS[programVal] ?? programVal, variant: 'info' },
          { label: 'Registration', value: registered ? 'Complete' : 'Not started', variant: registered ? 'success' : 'warning' },
          { label: 'Waivers', value: isSigned ? 'Signed' : 'Not signed', variant: isSigned ? 'success' : 'warning' },
          {
            label: 'Payment',
            value: paymentValue,
            variant: paymentVariant,
            ...(paid && receiptUrl ? { href: receiptUrl, hrefLabel: 'View receipt' }
              : paid && pay ? { value: `${paymentValue} · $${Number(pay.amount).toFixed(2)} on ${new Date(pay.received_at).toLocaleDateString()}` } : {}),
          },
          { label: 'Team', value: hasTeam ? (team.team_number || team.team_name || 'Assigned') : 'Pending assignment', variant: hasTeam ? 'success' : 'info' },
          { label: 'Emergency contact', value: ec ? `${ec.first_name} ${ec.last_name} · ${ec.phone}` : 'Not added', variant: ec ? 'neutral' : 'warning', href: '/dashboard/edit', hrefLabel: 'Edit' },
          { label: 'T-shirt size', value: s.tshirt_size ? (TSHIRT_LABELS[s.tshirt_size] ?? s.tshirt_size) : 'Not set', variant: 'neutral', href: '/dashboard/edit', hrefLabel: 'Edit' },
        ]

        const pending: string[] = []
        if (!registered) pending.push('registration')
        if (!isSigned) pending.push('waivers')
        if (!paid) pending.push('payment')
        if (!hasTeam) pending.push('team assignment')
        const complete = registered && isSigned && paid && hasTeam

        const name = `${s.first_name} ${s.last_name}`.trim()
        if (!registered && !firstUnregisteredName) firstUnregisteredName = name
        cards.push({ name, complete, pending, rows })
      }
    }

    const { data: mySig } = await supabase
      .from('waiver_signature')
      .select('id')
      .eq('guardian_id', guardian.id)
      .eq('season', SEASON)
      .limit(1)
    guardianHasSigned = (mySig ?? []).length > 0
    const { data: activeW } = await supabase.from('waiver_template').select('id').eq('active', true).limit(1)
    hasActiveWaivers = (activeW ?? []).length > 0
  }

  const [aidLabel, aidVariant] = AID_DISPLAY[aidStatus] ?? AID_DISPLAY.not_requested
  const fullyComplete = cards.length > 0 && fsStatus === 'registered' && cards.every((c) => c.complete)
  const anyRegistered = cards.some((c) => c.rows.find((r) => r.label === 'Registration')?.value === 'Complete')
  const showSignPrompt = !!guardian && !guardianHasSigned && anyRegistered && hasActiveWaivers
  // (3) aid callout only before registration is complete.
  const showAidCallout = aidStatus === 'not_requested' && fsStatus !== 'registered'
  const pendingSummary = [...new Set(cards.flatMap((c) => c.pending))]

  return (
    <FamilyShell familyName={familyLabel} maxWidth="lg">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
        <Link href="/dashboard/edit" style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-navy-deep)' }}>
          My Account →
        </Link>
      </div>

      {notice === 'not_cleared' && (
        <div style={{ marginBottom: '1rem' }}>
          <WarningAlert title="Not cleared to register yet">You need to be accepted before registering.</WarningAlert>
        </div>
      )}
      {notice === 'registered' && (
        <div style={{ marginBottom: '1rem' }}>
          <SuccessAlert title="Registration submitted">We received your registration. Complete payment to secure the spot.</SuccessAlert>
        </div>
      )}
      {notice === 'signed' && (
        <div style={{ marginBottom: '1rem' }}>
          <SuccessAlert title="Agreements signed">Thank you — your signatures were recorded.</SuccessAlert>
        </div>
      )}

      {isAdmin && (
        <div style={{ marginBottom: '1rem' }}>
          <Link href="/admin" style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-navy-deep)' }}>Admin dashboard →</Link>
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
      {fullyComplete ? (
        <div style={{ marginBottom: '0.5rem' }}>
          <SuccessAlert title="Registration complete">
            Every student is registered, signed, paid, and assigned to a team for {SEASON}. You&apos;re all set!
          </SuccessAlert>
        </div>
      ) : cards.length > 0 && !firstUnregisteredName && (
        <div style={{ marginBottom: '0.5rem' }}>
          <WarningAlert title="Registration in progress">
            Still pending: {pendingSummary.join(', ')}.
          </WarningAlert>
        </div>
      )}
      {showSignPrompt && (
        <ActionCard
          title="Sign your agreements"
          description="You haven't signed this season's participation and policy agreements yet. Each parent or legal guardian can review and sign from their own account."
          ctaLabel="Review & sign"
          href="/waivers"
        />
      )}

      {cards.length === 0 ? (
        <div style={{ marginTop: '1.5rem' }}>
          <WarningAlert title="No students yet">
            We don&apos;t have a student on your account for {SEASON} yet. If you applied, an admin will clear you to register soon.
          </WarningAlert>
        </div>
      ) : (
        cards.map((card) => (
          <div key={card.name} style={{ marginTop: '1.5rem' }}>
            <h2 className="text-section-title" style={{ margin: '0 0 0.75rem' }}>{card.name}</h2>
            <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', overflow: 'hidden' }}>
              {card.rows.map((item, i) => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.875rem 1.25rem', borderBottom: i < card.rows.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                  <span style={{ fontSize: '0.9375rem', fontWeight: 500, color: 'var(--color-text-primary)' }}>{item.label}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {item.variant ? <StatusBadge label={item.value} variant={item.variant} /> : <span style={{ fontSize: '0.875rem' }}>{item.value}</span>}
                    {item.href && (
                      <Link href={item.href} target={item.href.startsWith('http') ? '_blank' : undefined} style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-navy-deep)' }}>
                        {item.hrefLabel}
                      </Link>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {guardian && (
        <div style={{ marginTop: '1.5rem' }}>
          <h2 className="text-section-title" style={{ margin: '0 0 0.75rem' }}>Household</h2>
          <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.875rem 1.25rem', borderBottom: '1px solid var(--color-border)' }}>
              <span style={{ fontSize: '0.9375rem', fontWeight: 500 }}>Second guardian</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>{guardian2 ? `${guardian2.name}${guardian2.email ? ` · ${guardian2.email}` : ''}` : 'Not added'}</span>
                <Link href="/dashboard/edit" style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-navy-deep)' }}>{guardian2 ? 'Edit' : 'Add'}</Link>
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.875rem 1.25rem' }}>
              <span style={{ fontSize: '0.9375rem', fontWeight: 500 }}>Financial aid</span>
              <StatusBadge label={aidLabel} variant={aidVariant} />
            </div>
          </div>
        </div>
      )}

      {showAidCallout && (
        <div style={{ marginTop: '1.5rem' }}>
          <FinancialAidCallout />
        </div>
      )}
    </FamilyShell>
  )
}
