import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ageFromDob } from '@/lib/compliance'
import { cleanEmail } from '@/lib/email-input'

const SEASON = '2026-27'
const TSHIRT = new Set(['ym', 'yl', 'xs', 's', 'm', 'l', 'xl', 'xxl', 'xxxl'])

// POST /api/family/students/[id] — a family edits their own student:
// t-shirt size (student.tshirt_size) + priority-1 emergency contact
// (emergency_contact table). Verifies the student belongs to the caller's family.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await createClient()
  const { data: { user } } = await session.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  const { id: studentId } = await params

  const db = createAdminClient()
  const { data: guardian } = await db.from('guardian').select('family_id').ilike('login_email', user.email).maybeSingle()
  if (!guardian) return NextResponse.json({ error: 'No family found.' }, { status: 403 })

  const { data: student } = await db.from('student').select('id, family_id, slack_email, birthdate').eq('id', studentId).maybeSingle()
  if (!student || student.family_id !== guardian.family_id) {
    return NextResponse.json({ error: 'Student not found for this family.' }, { status: 403 })
  }

  // No student emails for VEX IQ or any under-13 participant (parent-managed).
  const { data: enrs } = await db.from('enrollment').select('program').eq('student_id', studentId).eq('season', SEASON)
  const age = ageFromDob((student as any).birthdate ?? '')
  const noStudentEmail = (enrs ?? []).some((e: any) => e.program === 'vex_iq') || (age != null && age < 13)

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body.' }, { status: 400 }) }

  // T-shirt size
  if (body.tshirt_size !== undefined) {
    const v = String(body.tshirt_size || '').toLowerCase()
    if (v && !TSHIRT.has(v)) return NextResponse.json({ error: 'Invalid t-shirt size.' }, { status: 400 })
    const { error } = await db.from('student').update({ tshirt_size: v || null }).eq('id', studentId)
    if (error) return NextResponse.json({ error: `Could not save t-shirt size: ${error.message}` }, { status: 500 })
  }

  // Emails — only for 13+ V5/Combat. Google Workspace (communication) + Fusion are
  // freely editable; Slack email is settable once, then needs an admin (Slack can't
  // rename/merge). For IQ / under-13 students, student email edits are ignored.
  if (!noStudentEmail) {
    const emailUpd: Record<string, unknown> = {}
    if (body.communication_email !== undefined) emailUpd.communication_email = cleanEmail(body.communication_email) || null
    if (body.fusion_education_email !== undefined) emailUpd.fusion_education_email = cleanEmail(body.fusion_education_email) || null
    if (body.slack_email !== undefined) {
      const newVal = cleanEmail(body.slack_email) || null
      const current = (student as any).slack_email ?? null
      if (newVal !== current) {
        if (current) return NextResponse.json({ error: 'Changing the Slack email requires an admin — contact info@placerrobotics.org.' }, { status: 400 })
        emailUpd.slack_email = newVal
      }
    }
    if (Object.keys(emailUpd).length) {
      const { error } = await db.from('student').update(emailUpd).eq('id', studentId)
      if (error) return NextResponse.json({ error: `Could not save emails: ${error.message}` }, { status: 500 })
    }
  }

  // Priority-1 emergency contact (own table). first_name/last_name/phone are NOT NULL.
  if (body.ec_first !== undefined || body.ec_last !== undefined || body.ec_phone !== undefined || body.ec_relationship !== undefined) {
    const { data: ec } = await db.from('emergency_contact').select('id, first_name, last_name, phone').eq('student_id', studentId).eq('priority', 1).maybeSingle()
    const first = String(body.ec_first ?? ec?.first_name ?? '').trim()
    const last = String(body.ec_last ?? ec?.last_name ?? '').trim()
    const phone = String(body.ec_phone ?? ec?.phone ?? '').trim()
    const relationship = body.ec_relationship !== undefined ? String(body.ec_relationship).trim() || null : undefined
    if (ec) {
      const upd: Record<string, unknown> = { first_name: first || ec.first_name, last_name: last || ec.last_name, phone: phone || ec.phone }
      if (relationship !== undefined) upd.relationship = relationship
      const { error } = await db.from('emergency_contact').update(upd).eq('id', ec.id)
      if (error) return NextResponse.json({ error: `Could not save emergency contact: ${error.message}` }, { status: 500 })
    } else if (first && last && phone) {
      const { error } = await db.from('emergency_contact').insert({
        family_id: guardian.family_id, student_id: studentId, first_name: first, last_name: last, phone,
        relationship: relationship ?? null, priority: 1,
      })
      if (error) return NextResponse.json({ error: `Could not save emergency contact: ${error.message}` }, { status: 500 })
    } else {
      return NextResponse.json({ error: 'Emergency contact needs a first name, last name, and phone.' }, { status: 400 })
    }
  }

  return NextResponse.json({ ok: true })
}
