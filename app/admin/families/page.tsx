import { createClient } from '@/lib/supabase/server'
import { requireSection } from '@/lib/auth/admin-access'
import { AdminShell, PageHeader } from '@/components/ui'
import FamiliesTable, { type FamilyRow } from './families-table'

const SEASON = '2026-27'

export default async function AdminFamiliesPage() {
  await requireSection('/admin/families')
  const supabase = await createClient()

  const { data: families } = await supabase.from('family').select('id, display_name, primary_email')
  const familyIds = (families ?? []).map((f: any) => f.id)

  const { data: guardians } = familyIds.length
    ? await supabase.from('guardian').select('family_id, first_name, last_name, login_email, created_at').in('family_id', familyIds).order('created_at', { ascending: true })
    : { data: [] as any[] }
  const { data: students } = familyIds.length
    ? await supabase.from('student').select('family_id, first_name, last_name').in('family_id', familyIds)
    : { data: [] as any[] }
  const { data: fseasons } = familyIds.length
    ? await supabase.from('family_season').select('family_id, status').eq('season', SEASON).in('family_id', familyIds)
    : { data: [] as any[] }
  const { data: enrolls } = familyIds.length
    ? await supabase.from('enrollment').select('family_id, program, division').eq('season', SEASON).in('family_id', familyIds)
    : { data: [] as any[] }

  const g1ByFamily: Record<string, any> = {}
  for (const g of guardians ?? []) if (!g1ByFamily[g.family_id]) g1ByFamily[g.family_id] = g
  const studentsByFamily: Record<string, string[]> = {}
  for (const s of students ?? []) (studentsByFamily[s.family_id] ??= []).push(`${s.first_name} ${s.last_name}`.trim())
  const statusByFamily: Record<string, string> = Object.fromEntries((fseasons ?? []).map((f: any) => [f.family_id, f.status]))
  const programsByFamily: Record<string, Set<string>> = {}
  const divisionsByFamily: Record<string, Set<string>> = {}
  for (const e of enrolls ?? []) {
    (programsByFamily[e.family_id] ??= new Set()).add(e.program)
    if (e.division) (divisionsByFamily[e.family_id] ??= new Set()).add(e.division)
  }

  const rows: FamilyRow[] = (families ?? []).map((f: any) => {
    const g1 = g1ByFamily[f.id]
    const studentNames = studentsByFamily[f.id] ?? []
    return {
      id: f.id,
      familyName: g1?.last_name ? `${g1.last_name} Family` : f.display_name ?? f.primary_email ?? '—',
      guardianEmail: g1?.login_email ?? f.primary_email ?? '—',
      students: studentNames,
      status: statusByFamily[f.id] ?? '—',
      programs: [...(programsByFamily[f.id] ?? [])],
      divisions: [...(divisionsByFamily[f.id] ?? [])],
    }
  }).sort((a, b) => a.familyName.localeCompare(b.familyName))

  return (
    <AdminShell activePath="/admin/families">
      <PageHeader title="Families" subtitle="Search and manage family accounts." />
      <FamiliesTable rows={rows} />
    </AdminShell>
  )
}
