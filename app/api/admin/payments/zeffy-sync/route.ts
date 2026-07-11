import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireWriteAdmin } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncRegistrationPayments } from '@/lib/zeffy-sync'

// POST { apply?: boolean } — pulls the registration campaign's Zeffy payments and
// matches each ticket to an enrollment by guardian email + student name + program.
// apply=false (default) previews; apply=true records payments + marks fees paid.
export async function POST(req: NextRequest) {
  const admin = await requireWriteAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: any = {}
  try { body = await req.json() } catch {}
  const apply = body?.apply === true

  const r = await syncRegistrationPayments(createAdminClient(), { apply, adminId: admin.id })
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.error?.startsWith('Zeffy API') ? 502 : 400 })
  return NextResponse.json({ ok: true, apply, fetched: r.fetched, summary: r.summary, results: r.results })
}
