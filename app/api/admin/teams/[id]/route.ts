import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAdminProfile } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'

const PROGRAMS = new Set(['vex_v5', 'vex_iq', 'combat'])
const DIVISIONS = new Set(['ES', 'MS', 'HS'])

/**
 * Admin team record editing.
 * PATCH  — update an existing team by id (admin only).
 * DELETE — soft delete: set active = false (admin only).
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminProfile()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if (typeof body.team_number === 'string') updates.team_number = body.team_number.trim() || null
  if (typeof body.team_name === 'string') updates.team_name = body.team_name.trim() || null
  if (typeof body.season === 'string' && body.season.trim()) updates.season = body.season.trim()
  if (typeof body.school_org === 'string') {
    const s = body.school_org.trim()
    if (!s) return NextResponse.json({ error: 'School / org is required.' }, { status: 400 })
    updates.school_org = s
  }
  if (body.program !== undefined) {
    if (!PROGRAMS.has(body.program)) return NextResponse.json({ error: 'Invalid program.' }, { status: 400 })
    updates.program = body.program
  }
  if (body.division !== undefined) {
    if (!DIVISIONS.has(body.division)) return NextResponse.json({ error: 'Invalid division (ES/MS/HS).' }, { status: 400 })
    updates.division = body.division
  }
  if (body.active !== undefined) updates.active = !!body.active
  if (body.notes !== undefined) updates.notes = typeof body.notes === 'string' ? body.notes.trim() || null : null

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update.' }, { status: 400 })
  }

  const db = createAdminClient()
  const { error } = await db.from('team').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminProfile()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params

  const db = createAdminClient()
  const { error } = await db.from('team').update({ active: false }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
