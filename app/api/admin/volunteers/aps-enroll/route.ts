import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminProfile } from '@/lib/auth/admin'
import { enrollApsTraining, listApsRenewalCandidates } from '@/lib/aps'
import { sendEmail, apsRenewalReadyHtml } from '@/lib/email'
import { VOLUNTEER_SEASON, APS_VALID_THROUGH } from '@/lib/volunteer'

// Bulk APS renewal enrollment (task 1.10).
// GET  — preview: everyone the run would enroll (latest cert not valid through
//        season end, or no cert at all; admin-closed profiles excluded).
// POST — run it: enrollApsTraining() per volunteer (reused 1:1 logic), email
//        each volunteer their personal training link, log the run.
// body: { volunteerIds?: string[]   — subset of the preview (e.g. one test person);
//         resendExisting?: boolean  — also email volunteers whose APS enrollment
//                                     already existed (created: false). Default
//                                     emails only newly-created enrollments. }

export async function GET() {
  if (!(await getAdminProfile())) return NextResponse.json({ error: 'Not authorized.' }, { status: 401 })
  const candidates = await listApsRenewalCandidates(createAdminClient(), APS_VALID_THROUGH)
  return NextResponse.json({ ok: true, validThrough: APS_VALID_THROUGH, candidates })
}

export async function POST(req: NextRequest) {
  const admin = await getAdminProfile()
  if (!admin) return NextResponse.json({ error: 'Not authorized.' }, { status: 401 })
  const apiKey = process.env.APS_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'APS_API_KEY is not set.' }, { status: 400 })

  let body: any = {}
  try { body = await req.json() } catch { /* empty body = full run */ }
  const onlyIds: Set<string> | null = Array.isArray(body.volunteerIds) && body.volunteerIds.length
    ? new Set(body.volunteerIds.map(String))
    : null
  const resendExisting = body.resendExisting === true

  const db = createAdminClient()
  let candidates = await listApsRenewalCandidates(db, APS_VALID_THROUGH)
  if (onlyIds) candidates = candidates.filter((c) => onlyIds.has(c.volunteerId))

  const summary = { enrolled: 0, emailed: 0, skipped: 0, errors: 0 }
  const details: { volunteerId: string; name: string; status: string; error?: string }[] = []

  for (const c of candidates) {
    try {
      const r = await enrollApsTraining(db, apiKey, c.volunteerId)
      if (!r.ok) {
        summary.errors++
        details.push({ volunteerId: c.volunteerId, name: c.name, status: 'enroll failed', error: r.error })
        continue
      }
      summary.enrolled++
      // New enrollments always get the email; pre-existing ones only on explicit
      // reminder resend — never silently re-notify people already in flight.
      if (r.created || resendExisting) {
        const sent = await sendEmail({
          to: [c.email],
          subject: `Your ${VOLUNTEER_SEASON} APS renewal is ready`,
          html: apsRenewalReadyHtml({ name: c.name.split(' ')[0], url: r.url, expiry: c.latestExpiry, validThrough: APS_VALID_THROUGH, season: VOLUNTEER_SEASON }),
        })
        if (sent.ok) {
          summary.emailed++
          details.push({ volunteerId: c.volunteerId, name: c.name, status: r.created ? 'enrolled + emailed' : 'already enrolled · reminder emailed' })
        } else {
          summary.errors++
          details.push({ volunteerId: c.volunteerId, name: c.name, status: r.created ? 'enrolled, email failed' : 'already enrolled, email failed', error: sent.error })
        }
      } else {
        summary.skipped++
        details.push({ volunteerId: c.volunteerId, name: c.name, status: 'already enrolled · no email (resend not requested)' })
      }
    } catch (e: any) {
      summary.errors++
      details.push({ volunteerId: c.volunteerId, name: c.name, status: 'error', error: e?.message ?? 'failed' })
    }
  }

  const { error: logError } = await db.from('aps_enrollment_run').insert({
    ran_by: admin.id,
    season: VOLUNTEER_SEASON,
    enrolled_count: summary.enrolled,
    emailed_count: summary.emailed,
    skipped_count: summary.skipped,
    error_count: summary.errors,
    details,
  })
  // Don't fail the run over a missing log table (migration 0047 not applied yet),
  // but make it visible in the server logs.
  if (logError) console.error('[aps-enroll] run-log insert failed:', logError.message)

  return NextResponse.json({ ok: true, summary, details })
}
