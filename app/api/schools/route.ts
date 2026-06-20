import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Public list of canonical schools for the application form dropdown.
// Uses the service-role client because anon users cannot read `school` under RLS.
export async function GET() {
  const db = createAdminClient()
  const { data, error } = await db
    .from('school')
    .select('id, name, grade_min, grade_max')
    .eq('active', true)
    .order('name', { ascending: true })

  if (error) {
    return NextResponse.json({ schools: [] })
  }
  return NextResponse.json({ schools: data ?? [] })
}
