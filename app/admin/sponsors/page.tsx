import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireSection } from '@/lib/auth/admin-access'
import { AdminShell, PageHeader, StatusBadge, EmptyState } from '@/components/ui'

const SEASON = '2026-27'
const TYPE_LABELS: Record<string, string> = { company: 'Company', family: 'Family', individual: 'Individual' }

function money(n: number | null | undefined) {
  if (n == null) return '—'
  return Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function paymentStatus(committed: number, received: number): [string, 'success' | 'warning' | 'neutral'] {
  if (committed > 0 && received >= committed) return ['Paid', 'success']
  if (received > 0) return ['Partial', 'warning']
  return ['Pending', 'neutral']
}

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'season', label: SEASON },
  { key: 'company', label: 'Company' },
  { key: 'family', label: 'Family' },
]

export default async function SponsorsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  await requireSection('/admin/sponsors')
  const { filter = 'all' } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('sponsor')
    .select('id, name, sponsor_type, logo_url, part_contact, active, commitments:sponsor_commitment ( season, tier, amount_committed, amount_received )')
    .order('name', { ascending: true })
  if (filter === 'company') query = query.eq('sponsor_type', 'company')
  if (filter === 'family') query = query.eq('sponsor_type', 'family')

  const { data, error } = await query
  let sponsors = (data ?? []) as any[]
  if (filter === 'season') {
    sponsors = sponsors.filter((s) => (s.commitments ?? []).some((c: any) => c.season === SEASON))
  }

  return (
    <AdminShell activePath="/admin/sponsors">
      <PageHeader
        title="Sponsors"
        subtitle="Sponsorships, commitments, and enrollment credits."
        actions={
          <Link href="/admin/sponsors/new" style={{ display: 'inline-block', padding: '10px 18px', backgroundColor: 'var(--color-gold)', color: 'var(--color-navy-darker)', borderRadius: '6px', fontWeight: 600, fontSize: '0.9375rem', textDecoration: 'none' }}>
            Add Sponsor
          </Link>
        }
      />

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {TABS.map((t) => {
          const active = filter === t.key
          return (
            <Link key={t.key} href={`/admin/sponsors?filter=${t.key}`} style={{ padding: '6px 14px', borderRadius: '999px', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none', backgroundColor: active ? 'var(--color-navy-deep)' : 'var(--color-surface)', color: active ? '#fff' : 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>
              {t.label}
            </Link>
          )
        })}
      </div>

      {error ? (
        <p style={{ color: 'var(--color-error)' }}>Couldn’t load sponsors: {error.message}</p>
      ) : sponsors.length === 0 ? (
        <EmptyState title="No sponsors yet" description="Add your first sponsor to get started." action={{ label: 'Add Sponsor', href: '/admin/sponsors/new' }} />
      ) : (
        <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '52px 2fr 1fr 1fr 1fr 1fr 1fr', gap: '1rem', padding: '0.75rem 1.25rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}>
            <span>Logo</span><span>Name</span><span>Type</span><span>Tier</span><span>Committed</span><span>Received</span><span>Status</span>
          </div>
          {sponsors.map((s, i) => {
            const c = (s.commitments ?? []).find((x: any) => x.season === SEASON)
            const committed = Number(c?.amount_committed ?? 0)
            const received = Number(c?.amount_received ?? 0)
            const [statusLabel, statusVariant] = paymentStatus(committed, received)
            return (
              <Link key={s.id} href={`/admin/sponsors/${s.id}`} style={{ display: 'grid', gridTemplateColumns: '52px 2fr 1fr 1fr 1fr 1fr 1fr', gap: '1rem', padding: '0.75rem 1.25rem', alignItems: 'center', textDecoration: 'none', color: 'inherit', borderBottom: i < sponsors.length - 1 ? '1px solid var(--color-border)' : 'none', fontSize: '0.875rem' }}>
                <span>
                  {s.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.logo_url} alt="" width={40} height={40} style={{ width: 40, height: 40, objectFit: 'contain', borderRadius: 6, background: '#fff', border: '1px solid var(--color-border)' }} />
                  ) : (
                    <span style={{ display: 'inline-flex', width: 40, height: 40, borderRadius: 6, backgroundColor: 'var(--color-bg-light)', border: '1px solid var(--color-border)', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>{(s.name?.[0] ?? '?').toUpperCase()}</span>
                  )}
                </span>
                <span style={{ fontWeight: 500 }}>{s.name}{s.part_contact ? <span className="text-help" style={{ display: 'block' }}>PART: {s.part_contact}</span> : null}</span>
                <span>{TYPE_LABELS[s.sponsor_type] ?? s.sponsor_type}</span>
                <span style={{ textTransform: 'capitalize' }}>{c?.tier ? String(c.tier).replace('_', ' ') : '—'}</span>
                <span>{money(committed || null)}</span>
                <span>{money(received)}</span>
                <span><StatusBadge label={statusLabel} variant={statusVariant} /></span>
              </Link>
            )
          })}
        </div>
      )}
    </AdminShell>
  )
}
