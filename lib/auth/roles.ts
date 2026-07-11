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
  '/admin': ['registration_admin', 'financial_aid_admin', 'payment_admin', 'volunteer_admin', 'program_lead', 'board_member', 'communications_admin', 'read_only_admin'],
  '/admin/applications': ['registration_admin', 'program_lead', 'board_member', 'read_only_admin'],
  '/admin/financial-aid': ['financial_aid_admin', 'read_only_admin'],
  '/admin/registrations': ['registration_admin', 'program_lead', 'read_only_admin'],
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

// The section an admin path belongs to: longest-prefix match so nested routes
// (e.g. /admin/iq-teams/members, /admin/teams/<id>) inherit their section.
export function sectionKeyFor(href: string): string {
  const keys = Object.keys(ADMIN_SECTION_ROLES).sort((a, b) => b.length - a.length)
  return keys.find((k) => href === k || href.startsWith(k + '/')) ?? '/admin'
}

// True if the given roles may open an admin path.
export function canAccessAdmin(roles: string[], isSuper: boolean, href: string): boolean {
  if (isSuper) return true
  return (ADMIN_SECTION_ROLES[sectionKeyFor(href)] ?? []).some((r) => roles.includes(r))
}

// ── Program scoping (task 1.3 / decision D5) ─────────────────────────────────
//
// D5 defers the capability engine; the hedge is (a) every check lives HERE, and
// (b) admin_role_assignment.program_scope (already in the initial schema) limits
// a role to one program. A role value + its optional scope travel together as a
// RoleGrant; pages ask programScopeFor() what they may show and never branch on
// role names themselves.

export type RoleGrant = { role: string; programScope: string | null }

// Programs a grant can be pinned to (single programs only — never 'both'/'not_sure').
export const PROGRAM_SCOPE_VALUES = new Set(['vex_v5', 'combat', 'vex_iq'])
export const PROGRAM_SCOPE_LABELS: Record<string, string> = { vex_v5: 'VEX V5', combat: 'Combat', vex_iq: 'VEX IQ' }

// Roles whose access can be limited by program_scope. A scope on any other role
// is ignored rather than enforced — add the role here to make its scope real.
export const PROGRAM_SCOPED_ROLES = new Set(['program_lead'])

// Sections where a program-scoped admin sees only their programs' rows.
export const PROGRAM_SCOPED_SECTIONS = new Set(['/admin/teams', '/admin/registrations'])

// The programs the acting admin is limited to for a path, or null for
// unrestricted. Unrestricted when: super admin; the section isn't scope-aware;
// any of their section-granting roles is not program-scoped (e.g. also a
// registration_admin); or a program_lead grant carries no scope (org-wide lead).
export function programScopeFor(a: { grants: RoleGrant[]; isSuper: boolean }, href: string): string[] | null {
  if (a.isSuper) return null
  const key = sectionKeyFor(href)
  if (!PROGRAM_SCOPED_SECTIONS.has(key)) return null
  const sectionRoles = ADMIN_SECTION_ROLES[key] ?? []
  const granting = a.grants.filter((g) => sectionRoles.includes(g.role))
  if (!granting.length) return null // entry is canAccessAdmin's job, not scoping's
  if (granting.some((g) => !PROGRAM_SCOPED_ROLES.has(g.role) || !g.programScope)) return null
  return [...new Set(granting.map((g) => g.programScope as string))]
}

// Does a row's program fall inside a scope? 'both' is application shorthand for
// vex_v5 + combat enrollments, so it matches either. Rows with no program yet
// ('not_sure', '—', null) are registrar work and stay hidden from scoped leads.
export function programInScope(program: string | null | undefined, scope: string[] | null): boolean {
  if (!scope) return true
  if (!program) return false
  if (program === 'both') return scope.includes('vex_v5') || scope.includes('combat')
  return scope.includes(program)
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
