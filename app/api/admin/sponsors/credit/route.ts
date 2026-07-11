import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireWriteAdmin } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const admin = await requireWriteAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }
  const sponsorCommitmentId = String(body.sponsorCommitmentId ?? '')
  const familySeasonId = String(body.familySeasonId ?? '')
  const amount = Number(body.amount)
  if (!sponsorCommitmentId || !familySeasonId) return NextResponse.json({ error: 'Missing ids.' }, { status: 400 })
  if (!(amount > 0)) return NextResponse.json({ error: 'Amount must be greater than zero.' }, { status: 400 })

  const db = createAdminClient()
  const { error: insErr } = await db.from('enrollment_sponsor_credit').insert({
    sponsor_commitment_id: sponsorCommitmentId,
    family_season_id: familySeasonId,
    amount_credited: amount,
    credited_by: admin.id,
    notes: String(body.notes ?? '').trim() || null,
  })
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

  // Reflect the sponsorship in the family's fundraising methods — add 'sponsored'
  // without clobbering any other methods they selected.
  const { data: fsRow } = await db.from('family_season').select('fundraising_methods').eq('id', familySeasonId).maybeSingle()
  const methods = new Set<string>(((fsRow?.fundraising_methods ?? []) as string[]))
  methods.add('sponsored')
  await db.from('family_season').update({ fundraising_method: 'sponsored', fundraising_methods: [...methods] }).eq('id', familySeasonId)
  return NextResponse.json({ ok: true })
}
