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

const AID_DISPLAY: Record<string, [string, 'success' | 'warning' | 'error' | 'info' | 'neutral']> = {
  not_requested: ['Not requested', 'neutral'],
  pending: ['Requested', 'info'],
  approved: ['Approved', 'success'],
  denied: ['Denied', 'error'],
  withdrawn: ['Withdrawn', 'neutral'],
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

  if (!user) {
    redirect('/login')
  }

  const { notice } = await searchParams
  const email = user.email ?? 'your account'
  const isAdmin = user.email === ADMIN_EMAIL

  // Real financial-aid status for this family (family can read its own per RLS).
  const { data: guardian } = await supabase
    .from('guardian')
    .select('family_id')
    .ilike('login_email', user.email ?? '')
    .maybeSingle()
  let aidStatus = 'not_requested'
  if (guardian) {
    const { data: aid } = await supabase
      .from('financial_aid')
      .select('status')
      .eq('family_id', guardian.family_id)
      .eq('season', SEASON)
      .order('requested_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (aid) aidStatus = aid.status
  }
  const [aidLabel, aidVariant] = AID_DISPLAY[aidStatus] ?? AID_DISPLAY.not_requested
  const showAidCallout = aidStatus === 'not_requested'

  const CHECKLIST: Array<{
    label: string
    status: string
    variant: 'success' | 'warning' | 'error' | 'info' | 'neutral'
  }> = [
    { label: 'Application', status: 'Accepted', variant: 'success' },
    { label: 'Financial Aid', status: aidLabel, variant: aidVariant },
    { label: 'Registration', status: 'Not started', variant: 'warning' },
    { label: 'Waivers', status: 'Not signed', variant: 'warning' },
    { label: 'Payment', status: 'Not paid', variant: 'warning' },
    { label: 'Team', status: 'Pending', variant: 'info' },
  ]

  return (
    <FamilyShell familyName={email} maxWidth="lg">
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
          <Link
            href="/admin"
            style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-navy-deep)' }}
          >
            Admin dashboard →
          </Link>
        </div>
      )}

      <PageHeader title="Your Dashboard" subtitle={`Signed in as ${email}. Here's where your enrollment stands.`} />

      <ActionCard
        title={`Complete registration for ${email}`}
        description="You're one step away. Finish the registration form and submit payment to secure your spot for the 2026–27 season."
        ctaLabel="Continue registration"
        href="/register"
      />

      <h2 className="text-section-title" style={{ margin: '2rem 0 1rem' }}>
        Enrollment checklist
      </h2>
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '10px',
          overflow: 'hidden',
        }}
      >
        {CHECKLIST.map((item, i) => (
          <div
            key={item.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              padding: '0.875rem 1.25rem',
              borderBottom: i < CHECKLIST.length - 1 ? '1px solid var(--color-border)' : 'none',
            }}
          >
            <span style={{ fontSize: '0.9375rem', fontWeight: 500, color: 'var(--color-text-primary)' }}>
              {item.label}
            </span>
            <StatusBadge label={item.status} variant={item.variant} />
          </div>
        ))}
      </div>

      {showAidCallout && (
        <div style={{ marginTop: '1.5rem' }}>
          <FinancialAidCallout />
        </div>
      )}
    </FamilyShell>
  )
}
