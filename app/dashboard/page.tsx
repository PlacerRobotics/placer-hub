import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FamilyShell, PageHeader, ActionCard, StatusBadge } from '@/components/ui'
import { FinancialAidCallout } from '@/components/FinancialAidCallout'

// Bootstrap super-admin. A proper check would query admin_role_assignment;
// this email match mirrors the seed's bootstrap trigger for now.
const ADMIN_EMAIL = 'kevin.miller@placerrobotics.org'

const CHECKLIST: Array<{
  label: string
  status: string
  variant: 'success' | 'warning' | 'error' | 'info' | 'neutral'
}> = [
  { label: 'Application', status: 'Accepted', variant: 'success' },
  { label: 'Financial Aid', status: 'Not requested', variant: 'neutral' },
  { label: 'Registration', status: 'Not started', variant: 'warning' },
  { label: 'Waivers', status: 'Not signed', variant: 'warning' },
  { label: 'Payment', status: 'Not paid', variant: 'warning' },
  { label: 'Team', status: 'Pending', variant: 'info' },
]

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const email = user.email ?? 'your account'
  const isAdmin = user.email === ADMIN_EMAIL
  // Families cannot read financial_aid under RLS (rule 3), so this keys off the
  // (mock) checklist status for now. Show the callout when aid isn't requested.
  const showAidCallout =
    CHECKLIST.find((c) => c.label === 'Financial Aid')?.status === 'Not requested'

  return (
    <FamilyShell familyName={email} maxWidth="lg">
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
