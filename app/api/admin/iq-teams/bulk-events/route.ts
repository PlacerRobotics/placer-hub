import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireWriteAdmin } from '@/lib/auth/admin'
import { hasAnyRole } from '@/lib/auth/roles'

const ROLES = ['iq_coordinator', 'super_admin', 'payment_admin', 'registration_admin']

// POST /api/admin/iq-teams/bulk-events — set events_vex_com_registered for many IQ
// teams at once. Body: { teamIds: string[], value: boolean }.
export async function POST(req: NextRequest) {
  const admin = await requireWriteAdmin()
  if (!admin) return NextResponse.json({ error: 'Not authorized.' }, { status: 401 })
  const db = createAdminClient()
  if (!(await hasAnyRole(db, admin.id, ROLES))) return NextResponse.json({ error: 'Not authorized.' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const teamIds = (Array.isArray(body.teamIds) ? body.teamIds : []).filter((x: any) => typeof x === 'string')
  const value = body.value === true
  if (!teamIds.length) return NextResponse.json({ error: 'No teams selected.' }, { status: 400 })

  await db.from('team').update({ events_vex_com_registered: value }).in('id', teamIds).eq('program', 'vex_iq')
  return NextResponse.json({ ok: true, updated: teamIds.length })
}
