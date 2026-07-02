// Admin role enum values + labels, and a super-admin check shared by the
// roles-management routes.
export const ADMIN_ROLES: { value: string; label: string }[] = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'registration_admin', label: 'Registration Admin' },
  { value: 'financial_aid_admin', label: 'Financial Aid Admin' },
  { value: 'payment_admin', label: 'Payment Admin' },
  { value: 'volunteer_admin', label: 'Volunteer Admin' },
  { value: 'iq_coordinator', label: 'IQ Coordinator' },
  { value: 'program_lead', label: 'Program Lead' },
  { value: 'board_member', label: 'Board Member' },
  { value: 'communications_admin', label: 'Communications Admin' },
  { value: 'student_director', label: 'Student Director' },
  { value: 'read_only_admin', label: 'Read-only Admin' },
]
export const ROLE_VALUES = new Set(ADMIN_ROLES.map((r) => r.value))
export const ROLE_LABEL: Record<string, string> = Object.fromEntries(ADMIN_ROLES.map((r) => [r.value, r.label]))

export async function hasAnyRole(db: any, adminProfileId: string, roles: string[]): Promise<boolean> {
  const { data } = await db
    .from('admin_role_assignment')
    .select('id')
    .eq('admin_profile_id', adminProfileId)
    .in('role', roles)
    .is('revoked_at', null)
    .limit(1)
  return (data ?? []).length > 0
}

// Which roles may open each admin section (super_admin implicitly gets all). The
// landing (/admin "Needs Attention") is broad but excludes single-purpose roles like
// the IQ coordinator, whose home is their own section. Edit here to change access.
export const ADMIN_SECTION_ROLES: Record<string, string[]> = {
  '/admin': ['registration_admin', 'financial_aid_admin', 'payment_admin', 'volunteer_admin', 'program_lead', 'board_member', 'communications_admin', 'student_director', 'read_only_admin'],
  '/admin/applications': ['registration_admin', 'program_lead', 'board_member', 'read_only_admin'],
  '/admin/financial-aid': ['financial_aid_admin', 'read_only_admin'],
  '/admin/registrations': ['registration_admin', 'read_only_admin'],
  '/admin/payments': ['payment_admin', 'read_only_admin'],
  '/admin/sponsors': ['payment_admin', 'communications_admin', 'read_only_admin'],
  '/admin/teams': ['registration_admin', 'program_lead', 'read_only_admin'],
  '/admin/iq-teams': ['iq_coordinator', 'payment_admin', 'registration_admin'],
  '/admin/families': ['registration_admin', 'read_only_admin'],
  '/admin/volunteers': ['volunteer_admin', 'read_only_admin'],
  '/admin/sync': [],
  '/admin/settings': [],
  '/admin/admins': [],
  '/admin/import': ['registration_admin'],
  '/admin/import-applicants': ['registration_admin'],
  '/admin/import-volunteers': ['volunteer_admin'],
  '/admin/import-teams': ['registration_admin'],
}

// True if the given roles may open an admin path. Longest-prefix match so nested
// routes (e.g. /admin/iq-teams/members) inherit their section's access.
export function canAccessAdmin(roles: string[], isSuper: boolean, href: string): boolean {
  if (isSuper) return true
  const keys = Object.keys(ADMIN_SECTION_ROLES).sort((a, b) => b.length - a.length)
  const key = keys.find((k) => href === k || href.startsWith(k + '/')) ?? '/admin'
  return (ADMIN_SECTION_ROLES[key] ?? []).some((r) => roles.includes(r))
}

// The best landing path for an admin: the general dashboard if allowed, else their
// first accessible section, else the family dashboard.
export function adminHome(roles: string[], isSuper: boolean): string {
  if (canAccessAdmin(roles, isSuper, '/admin')) return '/admin'
  for (const href of ['/admin/iq-teams', '/admin/volunteers', '/admin/payments', '/admin/financial-aid', '/admin/registrations', '/admin/families', '/admin/teams', '/admin/sponsors', '/admin/applications']) {
    if (canAccessAdmin(roles, isSuper, href)) return href
  }
  return '/dashboard'
}

export async function isSuperAdmin(db: any, adminProfileId: string): Promise<boolean> {
  const { data } = await db
    .from('admin_role_assignment')
    .select('id')
    .eq('admin_profile_id', adminProfileId)
    .eq('role', 'super_admin')
    .is('revoked_at', null)
    .limit(1)
  return (data ?? []).length > 0
}
