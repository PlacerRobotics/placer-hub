import { redirect } from 'next/navigation'
import { getAdminAccess } from '@/lib/auth/admin-access'
import { AdminAccessProvider } from '@/components/ui/admin-access-context'

// Central gate for the whole /admin area: only provisioned admins may enter (anyone
// else — including a family/coach viewed via "act as" — is sent to their dashboard).
// The admin's roles are provided to the client so the sidebar shows only permitted
// sections; each page additionally guards itself with requireSection().
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const access = await getAdminAccess()
  if (!access) redirect('/dashboard')
  return (
    <AdminAccessProvider roles={access.roles} isSuper={access.isSuper}>
      {children}
    </AdminAccessProvider>
  )
}
