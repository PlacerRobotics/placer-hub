import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireWriteAdmin } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'

// POST /api/admin/families/[id]/delete — remove a SPURIOUS family record
// (empty duplicate shells created by bad-email lookups, e.g. the mailto: bug,
// or double imports). Every child table cascades on family delete — including
// payment_transaction and waiver_signature (legal records) — so this refuses
// to delete anything that isn't an empty shell: no students, no enrollments,
// no payments, no signed waivers, no volunteer profile, no financial aid.
// Guardians and family_season rows DO cascade away (they're the shell).
// Real duplicate families with data get merged by hand (move the students
// with /api/admin/students/[id]/move-family first, then delete the shell).
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireWriteAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id: familyId } = await params

  const db = createAdminClient()
  const { data: family } = await db.from('family').select('id, primary_email').eq('id', familyId).maybeSingle()
  if (!family) return NextResponse.json({ error: 'Family not found.' }, { status: 404 })

  const n = async (table: string) =>
    ((await db.from(table).select('*', { count: 'exact', head: true }).eq('family_id', familyId)).count ?? 0) as number

  const blockers: Record<string, number> = {
    students: await n('student'),
    enrollments: await n('enrollment'),
    payments: await n('payment_transaction'),
    waiver_signatures: await n('waiver_signature'),
    volunteer_profiles: await n('volunteer_profile'),
    financial_aid: await n('financial_aid'),
  }
  const blocking = Object.entries(blockers).filter(([, c]) => c > 0)
  if (blocking.length) {
    return NextResponse.json(
      {
        error: `This family isn't an empty shell — it has ${blocking.map(([k, c]) => `${c} ${k.replace(/_/g, ' ')}`).join(', ')}. Move or resolve those first; deletion would cascade them away.`,
        blockers,
      },
      { status: 409 },
    )
  }

  const { error } = await db.from('family').delete().eq('id', familyId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  console.log(`[admin families/delete] admin ${admin.id} deleted empty family ${familyId} (${family.primary_email})`)
  return NextResponse.json({ ok: true })
}
