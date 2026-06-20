import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { FamilyShell, PageHeader, StatusBadge, EmptyState } from '@/components/ui'
import AidRequestForm from './aid-request-form'

const SEASON = '2026-27'
const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'error' | 'neutral'> = {
  pending: 'warning',
  approved: 'success',
  denied: 'error',
  withdrawn: 'neutral',
}

export default async function FinancialAidPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: guardian } = await supabase
    .from('guardian')
    .select('family_id, first_name, last_name')
    .ilike('login_email', user.email ?? '')
    .maybeSingle()

  const familyName = guardian ? `${guardian.first_name} ${guardian.last_name}` : user.email ?? 'Your account'

  if (!guardian) {
    return (
      <FamilyShell familyName={familyName} maxWidth="md">
        <PageHeader title="Financial Aid" subtitle="Need-based assistance for families." />
        <EmptyState
          title="No family account found"
          description="Financial aid is requested from a family account. Apply to a program first to create one."
          action={{ label: 'Apply', href: '/apply' }}
        />
      </FamilyShell>
    )
  }

  const { data: existing } = await supabase
    .from('financial_aid')
    .select('status, requested_at')
    .eq('family_id', guardian.family_id)
    .eq('season', SEASON)
    .order('requested_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (
    <FamilyShell familyName={familyName} maxWidth="md">
      <PageHeader title="Financial Aid" subtitle="Need-based assistance for the 2026–27 season." />

      {existing && existing.status !== 'pending' && (
        <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.9375rem', fontWeight: 500 }}>Your latest request:</span>
          <StatusBadge label={existing.status} variant={STATUS_VARIANT[existing.status] ?? 'neutral'} />
        </div>
      )}

      <AidRequestForm alreadyPending={existing?.status === 'pending'} />
    </FamilyShell>
  )
}
