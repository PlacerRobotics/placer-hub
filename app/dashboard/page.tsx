import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FamilyShell, PageHeader, ActionCard, StatusBadge } from '@/components/ui'

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

  return (
    <FamilyShell familyName={user.email ?? 'Your Family'} maxWidth="lg">
      <PageHeader title="Your Dashboard" subtitle="Welcome back. Here's where Maya's enrollment stands." />

      <ActionCard
        title="Complete registration for Maya"
        description="You're one step away. Finish the registration form and submit payment to secure Maya's spot for the 2026–27 season."
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
    </FamilyShell>
  )
}
