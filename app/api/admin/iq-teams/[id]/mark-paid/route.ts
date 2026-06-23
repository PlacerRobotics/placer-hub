import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminProfile } from '@/lib/auth/admin'
import { hasAnyRole } from '@/lib/auth/roles'

const SEASON = '2026-27'

// POST /api/admin/iq-teams/[id]/mark-paid — manual fallback when the Zeffy team-fee
// payment didn't auto-match (offline check, or webhook didn't deliver). Records the
// team-fee payment and advances the team from pending_payment → pending_admin_confirmation.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminProfile()
  if (!admin) return NextResponse.json({ error: 'Not authorized.' }, { status: 401 })
  const db = createAdminClient()
  if (!(await hasAnyRole(db, admin.id, ['iq_coordinator', 'super_admin', 'payment_admin']))) {
    return NextResponse.json({ error: 'Only the IQ Coordinator or a payment admin can mark the fee paid.' }, { status: 403 })
  }

  const { id: teamId } = await params
  const { data: team } = await db.from('team').select('id, program, status, team_fee_status, team_fee_amount, team_payment_reference_code').eq('id', teamId).maybeSingle()
  if (!team || team.program !== 'vex_iq') return NextResponse.json({ error: 'IQ team not found.' }, { status: 404 })
  if (team.team_fee_status === 'paid') return NextResponse.json({ error: 'This team’s fee is already marked paid.' }, { status: 400 })

  // Record the team-fee payment (manually matched) + advance to admin review.
  await db.from('payment_transaction').insert({
    season: SEASON,
    source: 'manual_adjustment',
    amount: team.team_fee_amount ?? 1200,
    payment_type: 'iq_team_fee',
    payment_reference_code: team.team_payment_reference_code ?? null,
    matched_status: 'manually_matched',
    matched_by: admin.id,
    matched_at: new Date().toISOString(),
    notes: 'IQ team fee — manually marked paid by admin',
    created_by: admin.id,
  })
  // Advance to admin review only if it was still awaiting payment; an
  // already-approved (active) team just gets its fee marked paid.
  const newStatus = team.status === 'pending_payment' ? 'pending_admin_confirmation' : team.status
  await db.from('team').update({ team_fee_status: 'paid', status: newStatus }).eq('id', teamId)

  return NextResponse.json({ ok: true })
}
