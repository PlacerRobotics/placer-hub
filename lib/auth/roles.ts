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
