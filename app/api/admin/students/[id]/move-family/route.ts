import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireWriteAdmin } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { cleanEmail } from '@/lib/email-input'

// POST /api/admin/students/[id]/move-family — the duplicate-family merge
// primitive: move a NOT-YET-REGISTERED student (a stub created by an import or
// the IQ roster-add flow, e.g. under a duplicate family born from the mailto:
// email bug) to their real family. Moves the student row plus its
// student_application and emergency_contact rows (all carry family_id).
//
// Deliberately refuses registered students: enrollment carries family_id and
// payment reference codes, waiver signatures are family-scoped legal records —
// moving those is a real merge decision that shouldn't hide behind one button.
// body: { target_guardian_email } (resolves the family) or { target_family_id }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireWriteAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id: studentId } = await params

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body.' }, { status: 400 }) }

  const db = createAdminClient()
  const { data: student } = await db.from('student').select('id, family_id, first_name, last_name').eq('id', studentId).maybeSingle()
  if (!student) return NextResponse.json({ error: 'Student not found.' }, { status: 404 })

  // Resolve the target family.
  let targetFamilyId = String(body.target_family_id ?? '').trim()
  if (!targetFamilyId) {
    const email = cleanEmail(body.target_guardian_email)
    if (!email) return NextResponse.json({ error: 'Provide a target family or a target guardian email.' }, { status: 400 })
    const { data: g } = await db.from('guardian').select('family_id').ilike('login_email', email).maybeSingle()
    if (!g) return NextResponse.json({ error: `No guardian found with login email ${email}.` }, { status: 404 })
    targetFamilyId = g.family_id
  } else {
    const { data: fam } = await db.from('family').select('id').eq('id', targetFamilyId).maybeSingle()
    if (!fam) return NextResponse.json({ error: 'Target family not found.' }, { status: 404 })
  }
  if (targetFamilyId === student.family_id) return NextResponse.json({ error: 'Student is already in that family.' }, { status: 400 })

  // Registered students are a manual merge, not a one-click move.
  const { count: enrCount } = await db.from('enrollment').select('*', { count: 'exact', head: true }).eq('student_id', studentId)
  if ((enrCount ?? 0) > 0) {
    return NextResponse.json({ error: 'This student has enrollment records (they registered) — moving them would strand fee/payment references. Contact-move is only for unregistered students; handle a registered merge manually.' }, { status: 409 })
  }
  const { count: sigCount } = await db.from('waiver_signature').select('*', { count: 'exact', head: true }).eq('student_id', studentId)
  if ((sigCount ?? 0) > 0) {
    return NextResponse.json({ error: 'This student has signed waivers on file — those are family-scoped legal records. Handle this merge manually.' }, { status: 409 })
  }

  // Move the student and every child row that carries family_id.
  const { error: e1 } = await db.from('student').update({ family_id: targetFamilyId }).eq('id', studentId)
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })
  const { error: e2 } = await db.from('student_application').update({ family_id: targetFamilyId }).eq('student_id', studentId)
  if (e2) return NextResponse.json({ error: `Student moved but application update failed: ${e2.message}` }, { status: 500 })
  const { error: e3 } = await db.from('emergency_contact').update({ family_id: targetFamilyId }).eq('student_id', studentId)
  if (e3) return NextResponse.json({ error: `Student moved but emergency-contact update failed: ${e3.message}` }, { status: 500 })

  console.log(`[admin students/move-family] admin ${admin.id} moved student ${studentId} (${student.first_name} ${student.last_name}) from family ${student.family_id} to ${targetFamilyId}`)
  return NextResponse.json({ ok: true, from: student.family_id, to: targetFamilyId })
}
