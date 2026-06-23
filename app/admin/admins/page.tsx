import { getAdminProfile } from '@/lib/auth/admin'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth/roles'
import { AdminShell, PageHeader, WarningAlert } from '@/components/ui'
import RolesManager, { type AdminRow } from './roles-manager'

export default async function AdminsPage() {
  const admin = await getAdminProfile()
  const supabase = await createClient()

  if (!admin) {
    return (
      <AdminShell activePath="/admin/admins">
        <PageHeader title="Admins" />
        <WarningAlert title="Admins only">You don&apos;t have admin access.</WarningAlert>
      </AdminShell>
    )
  }
  const superA = await isSuperAdmin(supabase, admin.id)
  if (!superA) {
    return (
      <AdminShell activePath="/admin/admins">
        <PageHeader title="Admins" subtitle="Manage admin roles." />
        <WarningAlert title="Super admin only">Only a super admin can view and change role assignments.</WarningAlert>
      </AdminShell>
    )
  }

  const { data: profiles } = await supabase.from('admin_profile').select('id, email, display_name, active').order('email', { ascending: true })
  const { data: assignments } = await supabase
    .from('admin_role_assignment')
    .select('id, admin_profile_id, role, program_scope')
    .is('revoked_at', null)

  const rolesByProfile: Record<string, { id: string; role: string; program_scope: string | null }[]> = {}
  for (const a of assignments ?? []) (rolesByProfile[a.admin_profile_id] ??= []).push({ id: a.id, role: a.role, program_scope: a.program_scope })

  const admins: AdminRow[] = (profiles ?? []).map((p: any) => ({
    id: p.id,
    email: p.email,
    displayName: p.display_name ?? '',
    active: p.active,
    roles: rolesByProfile[p.id] ?? [],
  }))

  return (
    <AdminShell activePath="/admin/admins">
      <PageHeader title="Admins" subtitle="Grant and revoke admin roles." />
      <RolesManager admins={admins} />
    </AdminShell>
  )
}
