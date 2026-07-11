import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireSection } from '@/lib/auth/admin-access'
import { AdminShell, PageHeader, EmptyState, InfoAlert, StatusBadge } from '@/components/ui'
import { findDuplicateGroups, nearMissDomain, type GuardianLike } from '@/lib/duplicates'

type GuardianRow = GuardianLike & { role: string; created_at: string }

const cell: React.CSSProperties = { padding: '0.6rem 0.75rem', fontSize: '0.8125rem', borderBottom: '1px solid var(--color-border)', textAlign: 'left', verticalAlign: 'top' }
const th: React.CSSProperties = { ...cell, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', fontSize: '0.6875rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }
const tableWrap: React.CSSProperties = { overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: '10px', marginBottom: '1.5rem' }
const table: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', backgroundColor: 'var(--color-surface)' }

export default async function SuspectedDuplicatesPage() {
  await requireSection('/admin/families/duplicates')
  const supabase = await createClient()

  const { data: guardians } = await supabase
    .from('guardian')
    .select('id, family_id, first_name, last_name, login_email, role, created_at')
    .order('created_at', { ascending: true })
  const all = (guardians ?? []) as GuardianRow[]

  const familyIds = [...new Set(all.map((g) => g.family_id))]
  const { data: families } = familyIds.length
    ? await supabase.from('family').select('id, display_name, primary_email').in('id', familyIds)
    : { data: [] as any[] }
  const familyName: Record<string, string> = Object.fromEntries(
    (families ?? []).map((f: any) => [f.id, f.display_name ?? f.primary_email ?? f.id])
  )

  const groups = findDuplicateGroups(all)
  const inDupGroup = new Set(groups.flatMap((g) => g.guardians.map((x) => x.id)))
  // Typo'd-domain emails are suspicious even without a same-name twin (the twin
  // may not have been imported yet) — list them separately when not already shown.
  const typoDomains = all
    .map((g) => ({ guardian: g, miss: nearMissDomain(g.login_email) }))
    .filter((x): x is { guardian: GuardianRow; miss: NonNullable<ReturnType<typeof nearMissDomain>> } => x.miss != null && !inDupGroup.has(x.guardian.id))

  return (
    <AdminShell activePath="/admin/families">
      <PageHeader
        title="Suspected duplicate guardians"
        subtitle="Read-only report — same name under different login emails, plus likely email-domain typos. Review and fix from the family detail pages; nothing is merged automatically."
      />

      <div style={{ marginBottom: '1.25rem' }}>
        <Link href="/admin/families" style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-navy)' }}>← Back to Families</Link>
      </div>

      {groups.length === 0 && typoDomains.length === 0 ? (
        <EmptyState title="No suspected duplicates" description="No guardians share a name under different login emails, and no email domains look like provider typos." />
      ) : (
        <>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem' }}>
            Same name, different login emails ({groups.length})
          </h2>
          {groups.length === 0 ? (
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>None found.</p>
          ) : (
            groups.map((group) => (
              <div key={group.nameKey} style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.9375rem', fontWeight: 700 }}>{group.displayName}</span>
                  <StatusBadge
                    label={group.crossFamily ? `${group.familyIds.length} families` : 'within one family'}
                    variant={group.crossFamily ? 'warning' : 'error'}
                  />
                </div>
                <div style={tableWrap}>
                  <table style={table}>
                    <thead><tr><th style={th}>Login email</th><th style={th}>Domain check</th><th style={th}>Role</th><th style={th}>Family</th><th style={th}>Created</th></tr></thead>
                    <tbody>
                      {group.guardians.map((g) => {
                        const miss = nearMissDomain(g.login_email)
                        return (
                          <tr key={g.id}>
                            <td style={cell}>{g.login_email}</td>
                            <td style={cell}>{miss ? <StatusBadge label={`${miss.domain} → ${miss.suggestion}?`} variant="warning" /> : '—'}</td>
                            <td style={cell}>{(g as GuardianRow).role}</td>
                            <td style={cell}>
                              <Link href={`/admin/families/${g.family_id}`} style={{ fontWeight: 600, color: 'var(--color-navy)' }}>
                                {familyName[g.family_id] ?? g.family_id}
                              </Link>
                            </td>
                            <td style={cell}>{new Date((g as GuardianRow).created_at).toLocaleDateString()}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}

          <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem' }}>
            Likely email-domain typos ({typoDomains.length})
          </h2>
          {typoDomains.length === 0 ? (
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>None found.</p>
          ) : (
            <div style={tableWrap}>
              <table style={table}>
                <thead><tr><th style={th}>Guardian</th><th style={th}>Login email</th><th style={th}>Did you mean</th><th style={th}>Family</th></tr></thead>
                <tbody>
                  {typoDomains.map(({ guardian: g, miss }) => (
                    <tr key={g.id}>
                      <td style={cell}>{g.first_name} {g.last_name}</td>
                      <td style={cell}>{g.login_email}</td>
                      <td style={cell}><StatusBadge label={`@${miss.suggestion}?`} variant="warning" /></td>
                      <td style={cell}>
                        <Link href={`/admin/families/${g.family_id}`} style={{ fontWeight: 600, color: 'var(--color-navy)' }}>
                          {familyName[g.family_id] ?? g.family_id}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <InfoAlert title="How to resolve">
            Duplicates must be merged by hand: pick the surviving guardian, move students/enrollments on the family detail page, then remove the extra guardian. Since login_email is the magic-link identity, confirm which address the parent actually uses before deleting anything.
          </InfoAlert>
        </>
      )}
    </AdminShell>
  )
}
