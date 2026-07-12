import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireWriteAdmin } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { previewGuardianMerge, executeGuardianMerge } from '@/lib/guardian-merge'

// POST /api/admin/guardians/[id]/merge — collapse guardian [id] (the one to
// merge away) into another guardian ON THE SAME FAMILY. See lib/guardian-
// merge.ts — this is NOT for two separate families (use
// /api/admin/families/[id]/merge for that).
// body: { survivor_guardian_id, confirm?: boolean }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireWriteAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id: loserId } = await params

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body.' }, { status: 400 }) }
  const survivorId = String(body.survivor_guardian_id ?? '').trim()
  if (!survivorId) return NextResponse.json({ error: 'Provide survivor_guardian_id.' }, { status: 400 })

  const db = createAdminClient()

  if (body.confirm !== true) {
    const preview = await previewGuardianMerge(db, loserId, survivorId)
    if ('error' in preview) return NextResponse.json({ error: preview.error }, { status: 400 })
    return NextResponse.json({ ok: true, preview })
  }

  const result = await executeGuardianMerge(db, loserId, survivorId, admin.id)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 })
  console.log(`[admin guardians/merge] admin ${admin.id} merged guardian ${loserId} into ${survivorId} (${result.loserRow})`)
  return NextResponse.json({ ok: true, loserRow: result.loserRow })
}
