import { requireSection } from '@/lib/auth/admin-access'
import { createAdminClient } from '@/lib/supabase/admin'
import { AdminShell, PageHeader } from '@/components/ui'
import type { HubEmailOwner } from '@/lib/google-groups'
import CompareTool from './compare-tool'

// Google Groups reconciliation, v0 (task 1.8): paste the group's member export,
// compare against every email the Hub knows, get three buckets + CSVs.
// Flag, don't purge — removals wait until after the Aug 31 cutoff.
export default async function GoogleGroupsPage() {
  await requireSection('/admin/google-groups')
  const db = createAdminClient()

  const hubEmails: HubEmailOwner[] = []
  const add = (email: string | null | undefined, owner: string, kind: string) => {
    const e = (email ?? '').trim().toLowerCase()
    if (e) hubEmails.push({ email: e, owner, kind })
  }

  const { data: gs } = await db.from('guardian').select('first_name, last_name, login_email, communication_email, slack_email')
  for (const g of (gs ?? []) as any[]) {
    const name = `${g.first_name ?? ''} ${g.last_name ?? ''}`.trim() || 'Guardian'
    add(g.login_email, name, 'guardian login')
    add(g.communication_email, name, 'guardian communication')
    add(g.slack_email, name, 'guardian slack')
  }

  const { data: studs } = await db.from('student').select('first_name, last_name, communication_email, slack_email, fusion_education_email')
  for (const s of (studs ?? []) as any[]) {
    const name = `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim() || 'Student'
    add(s.communication_email, name, 'student communication')
    add(s.slack_email, name, 'student slack')
    add(s.fusion_education_email, name, 'student fusion')
  }

  const { data: aps } = await db.from('admin_profile').select('display_name, email')
  for (const a of (aps ?? []) as any[]) add(a.email, a.display_name || 'Admin', 'admin')

  return (
    <AdminShell activePath="/admin/google-groups">
      <PageHeader
        title="Google Groups"
        subtitle="Reconcile a Google Groups member export against Hub emails. Three buckets: unknown-to-Hub (flag), missing-from-group, matched. Flag, don't purge — final cleanup happens after Aug 31."
      />
      <CompareTool hubEmails={hubEmails} />
    </AdminShell>
  )
}
