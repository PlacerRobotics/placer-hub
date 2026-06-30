import { redirect } from 'next/navigation'
import { getAdminProfile } from '@/lib/auth/admin'

// Central gate for the whole /admin area: only provisioned admins may enter. Anyone
// else — including a family/coach user being viewed via "act as" / impersonation —
// is bounced to their dashboard, so the admin sidebar and pages never render for them.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminProfile()
  if (!admin) redirect('/dashboard')
  return <>{children}</>
}
