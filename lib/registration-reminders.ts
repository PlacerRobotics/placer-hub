// Registration/payment reminder campaign — data gathering for cleared-to-register
// or registered MS/HS families who haven't finished every step (task: admin-
// triggered one-time send, /admin/registrations). Mirrors the same "positive
// evidence of V5/Combat, not just absence-of-IQ-proof" scoping fix already
// applied to the Slack catch-up campaign (lib/slack-recon.ts) — VEX IQ is
// elementary-only and out of scope here, same as there.
import { ageFromDob, isUnder13 } from './compliance'
import type { ReminderStudent } from './email'

const MAIN_PROGRAMS = new Set(['vex_v5', 'combat'])

export type StudentRecipient = { email: string; name: string; notRegistered: boolean; feeDue: boolean; fundraisingDue: boolean }

export type FamilyReminder = {
  familyId: string
  guardianEmails: string[]
  guardianFirstName: string
  students: ReminderStudent[]
  studentRecipients: StudentRecipient[]
  needsSponsorCc: boolean
}

export type ReminderSummary = { notRegistered: number; unpaid: number; fundraisingOpen: number; fullyDone: number }

function divisionFor(grade: number | null): 'ES' | 'MS' | 'HS' | null {
  if (grade == null) return null
  return grade <= 5 ? 'ES' : grade <= 8 ? 'MS' : 'HS'
}

export async function gatherRegistrationReminders(db: any, season: string, siteUrl: string): Promise<{ families: FamilyReminder[]; summary: ReminderSummary }> {
  const { data: fseasons } = await db.from('family_season').select('family_id, status').eq('season', season).in('status', ['registered', 'cleared_to_register'])
  const familyIds = [...new Set(((fseasons ?? []) as any[]).map((f) => f.family_id).filter(Boolean))]
  const summary: ReminderSummary = { notRegistered: 0, unpaid: 0, fundraisingOpen: 0, fullyDone: 0 }
  if (!familyIds.length) return { families: [], summary }

  const [{ data: guardians }, { data: students }, { data: fams }, { data: sponsors }, { data: config }] = await Promise.all([
    db.from('guardian').select('id, family_id, first_name, last_name, login_email, role').in('family_id', familyIds),
    db.from('student').select('id, family_id, first_name, last_name, grade, birthdate, school_id, cavitt_fee_override, communication_email, fusion_education_email, slack_email').in('family_id', familyIds),
    db.from('family').select('id, employer_match_company, employer_match_pct, employer_match_portal, employer_match_submitted_at').in('id', familyIds),
    db.from('family_sponsor_interest').select('family_id, student_id, business_name').in('family_id', familyIds).eq('season', season),
    db.from('season_config').select('zeffy_student_url, zeffy_cavitt_url').eq('season', season).maybeSingle(),
  ])

  const studentIds = ((students ?? []) as any[]).map((s) => s.id)
  const [{ data: enrs }, { data: apps }] = await Promise.all([
    studentIds.length
      ? db.from('enrollment').select('student_id, program, division, submitted_at, registration_fee_status, registration_fee_amount, payment_reference_code, fundraising_target, fundraising_received_at, fundraising_methods').eq('season', season).in('student_id', studentIds)
      : Promise.resolve({ data: [] as any[] }),
    studentIds.length
      ? db.from('student_application').select('student_id, program_interest').eq('season', season).in('student_id', studentIds)
      : Promise.resolve({ data: [] as any[] }),
  ])

  const schoolIds = [...new Set(((students ?? []) as any[]).map((s) => s.school_id).filter(Boolean))]
  const { data: schools } = schoolIds.length ? await db.from('school').select('id, fee_tier').in('id', schoolIds) : { data: [] as any[] }
  const feeTierBySchool: Record<string, string> = Object.fromEntries(((schools ?? []) as any[]).map((s) => [s.id, s.fee_tier]))

  const guardiansByFamily: Record<string, any[]> = {}
  for (const g of (guardians ?? []) as any[]) (guardiansByFamily[g.family_id] ??= []).push(g)
  const famById: Record<string, any> = Object.fromEntries(((fams ?? []) as any[]).map((f) => [f.id, f]))
  const sponsorByStudent: Record<string, any> = {}
  for (const sp of (sponsors ?? []) as any[]) if (sp.student_id) sponsorByStudent[sp.student_id] = sp
  const enrByStudent: Record<string, any[]> = {}
  for (const e of (enrs ?? []) as any[]) (enrByStudent[e.student_id] ??= []).push(e)
  const appByStudent: Record<string, any> = Object.fromEntries(((apps ?? []) as any[]).map((a) => [a.student_id, a]))

  const zeffyStudentUrl: string | null = config?.zeffy_student_url ?? null
  const zeffyCavittUrl: string | null = config?.zeffy_cavitt_url ?? null

  const families: FamilyReminder[] = []

  for (const familyId of familyIds) {
    const famStudents = ((students ?? []) as any[]).filter((s) => s.family_id === familyId)
    const reminderStudents: ReminderStudent[] = []
    const studentRecipients: StudentRecipient[] = []
    let needsSponsorCc = false

    for (const s of famStudents) {
      const myEnrs = enrByStudent[s.id] ?? []
      const app = appByStudent[s.id]
      // Program scoping: require POSITIVE evidence of V5/Combat (enrollment or
      // application program_interest) — an IQ-only or no-signal student is out
      // of scope, same fix as the Slack campaign (never trust "no proof of IQ").
      const enrPrograms = new Set(myEnrs.map((e: any) => e.program))
      const appPrograms = app?.program_interest === 'both' ? ['vex_v5', 'combat'] : app?.program_interest ? [app.program_interest] : []
      const knownPrograms = enrPrograms.size ? enrPrograms : new Set(appPrograms)
      if (![...knownPrograms].some((p) => MAIN_PROGRAMS.has(p))) continue

      const submitted = myEnrs.filter((e: any) => e.submitted_at)
      const name = `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim()

      if (!submitted.length) {
        summary.notRegistered++
        reminderStudents.push({ name, registerUrl: `${siteUrl}/register?student=${s.id}` })
        const age = ageFromDob(s.birthdate ?? '')
        const email = s.communication_email || s.fusion_education_email || s.slack_email
        if (email && !isUnder13(age)) studentRecipients.push({ email, name, notRegistered: true, feeDue: false, fundraisingDue: false })
        continue
      }

      const primary = submitted.find((e: any) => Number(e.registration_fee_amount) > 0) ?? submitted[0]
      const feeDue = primary.registration_fee_status === 'unpaid'
      const fundDue = !primary.fundraising_received_at && Number(primary.fundraising_target ?? 0) > 0
      if (!feeDue && !fundDue) { summary.fullyDone++; continue }
      if (feeDue) summary.unpaid++
      else summary.fundraisingOpen++

      const methods: string[] = primary.fundraising_methods ?? []
      if (methods.includes('sponsored')) needsSponsorCc = true

      // Cavitt fee tier only ever applies to a PURE vex_v5 registration (never
      // combat/'both'/IQ) — derive the student's overall program choice from
      // their application (authoritative for 'both'), not just this row's
      // program (a 'both' registration's primary row is itself 'vex_v5').
      const overallProgram = app?.program_interest ?? (enrPrograms.size > 1 ? 'both' : primary.program)
      const isCavittV5 = overallProgram === 'vex_v5' && (s.cavitt_fee_override || (s.school_id && feeTierBySchool[s.school_id] === 'cavitt'))
      const zeffyUrl = isCavittV5 ? (zeffyCavittUrl || zeffyStudentUrl) : zeffyStudentUrl
      const programLabel = overallProgram === 'vex_v5' ? 'VEX V5' : overallProgram === 'combat' ? 'Combat' : overallProgram === 'both' ? 'VEX V5 & Combat' : overallProgram === 'vex_iq' ? 'VEX IQ' : null

      const fam = famById[familyId]
      reminderStudents.push({
        name,
        program: programLabel,
        feeAmount: Number(primary.registration_fee_amount ?? 0),
        feeStatus: primary.registration_fee_status,
        paymentReferenceCode: primary.payment_reference_code ?? null,
        zeffyUrl,
        fundraisingTarget: Number(primary.fundraising_target ?? 0),
        fundraisingDone: !!primary.fundraising_received_at,
        fundraisingMethods: methods,
        employerPortal: fam?.employer_match_portal ?? null,
        employerCompany: fam?.employer_match_company ?? null,
        employerMatchSubmittedAt: fam?.employer_match_submitted_at ?? null,
        sponsorBusiness: sponsorByStudent[s.id]?.business_name ?? null,
      })

      const age = ageFromDob(s.birthdate ?? '')
      const email = s.communication_email || s.fusion_education_email || s.slack_email
      if (email && !isUnder13(age)) studentRecipients.push({ email, name, notRegistered: false, feeDue, fundraisingDue: fundDue })
    }

    if (!reminderStudents.length) continue

    const famGuardians = guardiansByFamily[familyId] ?? []
    const primaryGuardian = famGuardians.find((g) => g.role === 'primary' || g.role === 'single_guardian') ?? famGuardians[0]
    const guardianEmails = famGuardians.map((g) => g.login_email).filter(Boolean)
    if (!guardianEmails.length) continue

    families.push({
      familyId,
      guardianEmails,
      guardianFirstName: primaryGuardian?.first_name ?? '',
      students: reminderStudents,
      studentRecipients,
      needsSponsorCc,
    })
  }

  return { families, summary }
}
