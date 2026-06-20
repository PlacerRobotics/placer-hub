import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAdminProfile } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'

const sel =
  'id, payment_reference_code, program, family_id, student:student_id ( first_name, last_name )'

export async function GET(request: NextRequest) {
  const admin = await getAdminProfile()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const q = (new URL(request.url).searchParams.get('q') ?? '').replace(/[,()%*]/g, '').trim()
  if (q.length < 2) return NextResponse.json({ enrollments: [] })

  const db = createAdminClient()
  const like = `%${q}%`

  const byRef = await db.from('enrollment').select(sel).ilike('payment_reference_code', like).limit(10)

  const students = await db
    .from('student')
    .select('id')
    .or(`first_name.ilike.${like},last_name.ilike.${like}`)
    .limit(15)
  const studentIds = ((students.data ?? []) as any[]).map((s) => s.id)
  let byName: { data: any[] } = { data: [] }
  if (studentIds.length) {
    const r = await db.from('enrollment').select(sel).in('student_id', studentIds).limit(10)
    byName = { data: (r.data ?? []) as any[] }
  }

  const seen = new Set<string>()
  const enrollments: { enrollmentId: string; label: string }[] = []
  for (const e of [...((byRef.data ?? []) as any[]), ...byName.data]) {
    if (seen.has(e.id)) continue
    seen.add(e.id)
    const name = e.student ? `${e.student.first_name} ${e.student.last_name}` : 'Unknown student'
    enrollments.push({
      enrollmentId: e.id,
      label: `${name} — ${e.payment_reference_code} (${e.program})`,
    })
  }
  return NextResponse.json({ enrollments })
}
