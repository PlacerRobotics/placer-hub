import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireWriteAdmin } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { cleanEmail } from '@/lib/email-input'
import { findGuardianByEmail } from '@/lib/guardian-lookup'
import { previewFamilyMerge, executeFamilyMerge } from '@/lib/family-merge'

// POST /api/admin/families/[id]/merge — merge family [id] (the SOURCE) into
// another family (the TARGET). [id]'s guardians, students, enrollments,
// payments, volunteer records, and financial aid all move to the target;
// family_season is reconciled per season (further-along status wins). See
// docs/design_email_identity_v1_0.md §3 and lib/family-merge.ts.
//
// body: { target_family_id? | target_guardian_email?, confirm?: boolean }
// Without confirm:true, returns a PREVIEW only (nothing is changed) — the
// caller must show it to the admin and re-POST with confirm:true to execute.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireWriteAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id: sourceFamilyId } = await params

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body.' }, { status: 400 }) }

  let targetFamilyId = String(body.target_family_id ?? '').trim()
  if (!targetFamilyId) {
    const email = cleanEmail(body.target_guardian_email)
    if (!email) return NextResponse.json({ error: 'Provide a target family or a target guardian email.' }, { status: 400 })
    const match = await findGuardianByEmail(createAdminClient(), email)
    if (!match) return NextResponse.json({ error: `No guardian found with login (or known alternate) email ${email}.` }, { status: 404 })
    targetFamilyId = match.family_id
  }

  const db = createAdminClient()

  if (body.confirm !== true) {
    const preview = await previewFamilyMerge(db, sourceFamilyId, targetFamilyId)
    if ('error' in preview) return NextResponse.json({ error: preview.error }, { status: 400 })
    return NextResponse.json({ ok: true, preview })
  }

  const result = await executeFamilyMerge(db, sourceFamilyId, targetFamilyId, admin.id)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 })
  console.log(`[admin families/merge] admin ${admin.id} merged family ${sourceFamilyId} into ${targetFamilyId} (source ${result.sourceRemains})`)
  return NextResponse.json({ ok: true, sourceRemains: result.sourceRemains })
}
