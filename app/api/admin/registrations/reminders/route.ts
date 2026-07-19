import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireWriteAdmin } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, registrationReminderHtml, registrationReminderStudentHtml, SPONSOR_CONTACT_EMAIL } from '@/lib/email'
import { gatherRegistrationReminders } from '@/lib/registration-reminders'
import { NEXT_PUBLIC_SITE_URL } from '@/lib/env'

const SEASON = '2026-27'
// Fixed for this round — not derived from anywhere, since there's no "deadline"
// concept anywhere else in the schema. Two separate deadlines: registration
// itself (including the $40 fee) closes first; the fundraising commitment
// (sponsor/Benevity submissions etc., which take longer to process) closes
// later. Update here if a future reminder round needs different dates.
const REGISTRATION_DUE_DATE = 'July 31, 2026'
const FUNDRAISING_DUE_DATE = 'August 14, 2026'

// POST /api/admin/registrations/reminders — one-time "finish your registration"
// campaign for cleared-to-register/registered MS/HS families with outstanding
// steps. body: { mode: 'sample' | 'send' }.
export async function POST(req: NextRequest) {
  const admin = await requireWriteAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body.' }, { status: 400 }) }
  const mode = body.mode === 'send' ? 'send' : 'sample'
  const siteUrl = NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')
  const dashboardEditUrl = `${siteUrl}/dashboard/edit`

  if (mode === 'sample') {
    const guardianHtml = registrationReminderHtml({
      guardianName: 'Kevin', season: SEASON, registrationDueDate: REGISTRATION_DUE_DATE, fundraisingDueDate: FUNDRAISING_DUE_DATE, dashboardEditUrl,
      students: [
        { name: 'Sample Student A', registerUrl: `${siteUrl}/register?student=SAMPLE` },
        {
          name: 'Sample Student B', program: 'VEX V5', feeAmount: 40, feeStatus: 'unpaid',
          paymentReferenceCode: 'PART-202627-SB-0000', zeffyUrl: `${siteUrl}`,
          fundraisingTarget: 550, fundraisingDone: false, fundraisingMethods: ['corporate_match'],
          employerPortal: 'benevity', employerCompany: 'Sample Employer',
        },
      ],
    })
    const studentHtml = registrationReminderStudentHtml({
      name: 'Sample Student B', season: SEASON, registrationDueDate: REGISTRATION_DUE_DATE, fundraisingDueDate: FUNDRAISING_DUE_DATE, notRegistered: false, feeDue: true, fundraisingDue: true,
    })
    const [g, s] = await Promise.all([
      sendEmail({ to: ['kevin.miller@placerrobotics.org'], subject: `[SAMPLE] Complete your ${SEASON} registration`, html: guardianHtml }),
      sendEmail({ to: ['kevin.miller@placerrobotics.org'], subject: `[SAMPLE] A few ${SEASON} registration steps left`, html: studentHtml }),
    ])
    if (!g.ok || !s.ok) return NextResponse.json({ error: (g.error === 'no_api_key' || s.error === 'no_api_key') ? "Email isn't configured yet." : 'Send failed.' }, { status: 500 })
    return NextResponse.json({ ok: true, sent: 2 })
  }

  // mode === 'send' — the real, one-time campaign.
  const db = createAdminClient()
  const { families } = await gatherRegistrationReminders(db, SEASON, siteUrl)

  let guardianEmailsSent = 0, guardianEmailsFailed = 0, studentEmailsSent = 0, studentEmailsFailed = 0

  for (const fam of families) {
    const html = registrationReminderHtml({
      guardianName: fam.guardianFirstName, season: SEASON, registrationDueDate: REGISTRATION_DUE_DATE, fundraisingDueDate: FUNDRAISING_DUE_DATE, dashboardEditUrl, students: fam.students,
    })
    const res = await sendEmail({
      to: fam.guardianEmails,
      cc: fam.needsSponsorCc ? [SPONSOR_CONTACT_EMAIL] : undefined,
      subject: `Complete your ${SEASON} registration`,
      html,
    })
    if (res.ok) {
      guardianEmailsSent++
      for (const email of fam.guardianEmails) {
        await db.from('notification_log').insert({ family_id: fam.familyId, recipient_email: email, notification_type: 'registration_reminder_guardian', subject: 'Registration reminder', provider: 'resend', status: 'sent', sent_at: new Date().toISOString() })
      }
    } else guardianEmailsFailed++

    for (const sr of fam.studentRecipients) {
      const shtml = registrationReminderStudentHtml({ name: sr.name, season: SEASON, registrationDueDate: REGISTRATION_DUE_DATE, fundraisingDueDate: FUNDRAISING_DUE_DATE, notRegistered: sr.notRegistered, feeDue: sr.feeDue, fundraisingDue: sr.fundraisingDue })
      const sres = await sendEmail({ to: [sr.email], subject: `A few ${SEASON} registration steps left`, html: shtml })
      if (sres.ok) {
        studentEmailsSent++
        await db.from('notification_log').insert({ family_id: fam.familyId, recipient_email: sr.email, notification_type: 'registration_reminder_student', subject: 'Registration reminder', provider: 'resend', status: 'sent', sent_at: new Date().toISOString() })
      } else studentEmailsFailed++
    }
  }

  return NextResponse.json({ ok: true, families: families.length, guardianEmailsSent, guardianEmailsFailed, studentEmailsSent, studentEmailsFailed })
}
