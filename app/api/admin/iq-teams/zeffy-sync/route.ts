import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAdminProfile } from '@/lib/auth/admin'
import { hasAnyRole } from '@/lib/auth/roles'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchZeffyPayments, zeffyAnswer } from '@/lib/zeffy'

const SEASON = '2026-27'
const REF_RE = /IQT-[A-Z0-9]{8}/i

function epochToIso(created: any): string | null {
  const n = Number(created)
  if (!n) return null
  const ms = n < 1e12 ? n * 1000 : n
  const d = new Date(ms)
  return isNaN(d.getTime()) ? null : d.toISOString()
}
function safeIso(v: any): string {
  if (!v) return new Date().toISOString()
  const d = new Date(v)
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
}
// Search every buyer/item answer for an IQ team reference code (IQT-XXXXXXXX).
function findRefCode(p: any): string | null {
  const pools: any[] = [p.buyer_questions, ...(p.items ?? []).map((it: any) => it.questions)]
  for (const qs of pools) {
    for (const q of qs ?? []) {
      const m = REF_RE.exec(String(q?.answer ?? ''))
      if (m) return m[0].toUpperCase()
    }
  }
  return null
}

// POST { apply?: boolean } — pull the IQ team-fee Zeffy campaign and match each
// payment to an IQ team by (1) team reference code, (2) coach sign-in email, or
// (3) team number. apply=false previews; apply=true records the payment, marks the
// team fee paid, and advances pending_payment → pending_admin_confirmation.
export async function POST(req: NextRequest) {
  const admin = await getAdminProfile()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const db = createAdminClient()
  if (!(await hasAnyRole(db, admin.id, ['iq_coordinator', 'super_admin', 'payment_admin']))) {
    return NextResponse.json({ error: 'Only the IQ Coordinator or a payment admin can sync IQ payments.' }, { status: 403 })
  }

  const apiKey = process.env.ZEFFY_API_KEY
  const campaignId = process.env.ZEFFY_IQ_TEAM_CAMPAIGN_ID
  if (!apiKey || !campaignId) {
    return NextResponse.json({ error: 'IQ Zeffy not configured — set ZEFFY_API_KEY and ZEFFY_IQ_TEAM_CAMPAIGN_ID.' }, { status: 400 })
  }

  let body: any = {}
  try { body = await req.json() } catch {}
  const apply = body?.apply === true

  let payments
  try {
    payments = await fetchZeffyPayments(apiKey, campaignId)
  } catch (e: any) {
    return NextResponse.json({ error: `Zeffy API: ${e.message}` }, { status: 502 })
  }

  const results: any[] = []
  let matched = 0, unmatched = 0, already = 0, applied = 0

  for (const p of payments as any[]) {
    if (p.status && p.status !== 'succeeded') continue
    const paymentId = String(p.id ?? '').trim()
    if (!paymentId) continue

    const buyerEmail = (p.buyer?.email ?? '').trim().toLowerCase()
    const signInEmail = (zeffyAnswer(p.buyer_questions, 'sign-in email') || zeffyAnswer(p.buyer_questions, 'coach email') || zeffyAnswer(p.buyer_questions, 'guardian email')).toLowerCase()
    const email = signInEmail || buyerEmail
    const refCode = findRefCode(p)
    const teamNumber = (zeffyAnswer(p.buyer_questions, 'team number') || zeffyAnswer(p.buyer_questions, 'team #') || zeffyAnswer((p.items ?? [])[0]?.questions, 'team number')).trim()
    const label = `${p.buyer?.first_name ?? ''} ${p.buyer?.last_name ?? ''}`.trim() || email || paymentId

    // Dedup by source_payment_id (re-syncs don't double-record).
    const { data: existing } = await db.from('payment_transaction').select('id').eq('source', 'zeffy').eq('source_payment_id', paymentId).maybeSingle()
    if (existing) {
      already++
      results.push({ paymentId, coach: label, email, ref: refCode, status: 'already_recorded' })
      continue
    }

    // Resolve the IQ team.
    let team: any = null
    let reason = ''
    if (refCode) {
      const { data: t } = await db.from('team').select('id, status, team_payment_reference_code, team_number').eq('program', 'vex_iq').eq('season', SEASON).eq('team_payment_reference_code', refCode).maybeSingle()
      if (t) team = t; else reason = `no IQ team for ref ${refCode}`
    }
    if (!team && email) {
      const { data: g } = await db.from('guardian').select('id').ilike('login_email', email).maybeSingle()
      if (g) {
        const { data: tms } = await db.from('team_member')
          .select('team:team_id ( id, status, team_payment_reference_code, team_number, program, season )')
          .eq('guardian_id', g.id).eq('team_role', 'coach').eq('program', 'vex_iq').is('revoked_at', null)
        const teams = (tms ?? []).map((r: any) => (Array.isArray(r.team) ? r.team[0] : r.team)).filter((t: any) => t && t.program === 'vex_iq' && t.season === SEASON)
        // Prefer a team still awaiting payment.
        team = teams.find((t: any) => t.status === 'pending_payment') || teams[0] || null
        if (!team && !reason) reason = `no IQ team coached by ${email}`
      } else if (!reason) reason = `no guardian for ${email}`
    }
    if (!team && teamNumber) {
      const { data: t } = await db.from('team').select('id, status, team_payment_reference_code, team_number').eq('program', 'vex_iq').eq('season', SEASON).eq('team_number', teamNumber).maybeSingle()
      if (t) team = t; else if (!reason) reason = `no IQ team #${teamNumber}`
    }
    if (!team) {
      unmatched++
      results.push({ paymentId, coach: label, email, ref: refCode, status: 'unmatched', reason: reason || 'no reference code, coach email, or team number on payment' })
      continue
    }

    matched++
    results.push({ paymentId, coach: label, email, ref: team.team_payment_reference_code, teamNumber: team.team_number, status: 'matched' })

    if (apply) {
      // payment_transaction.family_id is NOT NULL — use the coach's family.
      const { data: coachTm } = await db.from('team_member').select('guardian:guardian_id ( family_id )').eq('team_id', team.id).eq('team_role', 'coach').is('revoked_at', null).maybeSingle()
      const cg: any = coachTm ? (Array.isArray((coachTm as any).guardian) ? (coachTm as any).guardian[0] : (coachTm as any).guardian) : null
      if (!cg?.family_id) {
        results[results.length - 1].status = 'unmatched'
        results[results.length - 1].reason = 'matched a team but it has no coach family on file'
        matched--; unmatched++
        continue
      }
      const amt = (Number((p.items ?? [])[0]?.amount ?? p.amount ?? p.totalAmount ?? 0) || 0) / 100 // Zeffy amounts are in cents
      const { error: payErr } = await db.from('payment_transaction').insert({
        family_id: cg.family_id,
        team_id: team.id,
        season: SEASON,
        source: 'zeffy',
        source_payment_id: paymentId,
        amount: amt,
        payment_type: 'iq_team_fee',
        payment_reference_code: team.team_payment_reference_code,
        donor_name: `${p.buyer?.first_name ?? ''} ${p.buyer?.last_name ?? ''}`.trim() || null,
        donor_email: buyerEmail || null,
        received_at: epochToIso(p.created) ?? safeIso(p.createdAt ?? p.created_at),
        matched_status: 'auto_matched',
        matched_by: admin.id,
        matched_at: new Date().toISOString(),
        raw_payload: p,
      })
      if (!payErr) {
        const newStatus = team.status === 'pending_payment' ? 'pending_admin_confirmation' : team.status
        await db.from('team').update({ team_fee_status: 'paid', status: newStatus }).eq('id', team.id)
        applied++
      }
    }
  }

  return NextResponse.json({ ok: true, apply, fetched: payments.length, summary: { matched, unmatched, alreadyRecorded: already, applied }, results })
}
