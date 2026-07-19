// gatherRegistrationReminders — recipient computation for the "finish your
// registration" campaign. Covers the same class of scoping bug already fixed
// in Slack (lib/slack-recon.ts): requiring POSITIVE V5/Combat evidence rather
// than absence-of-IQ-proof, plus the Cavitt-fee-tier / 'both'-program nuance
// (a 'both' registration's primary enrollment row is itself 'vex_v5', but must
// NOT get Cavitt pricing — only a genuinely V5-only registration does).

import { describe, it, expect } from 'vitest'
import { makeAdminClient, type Tables } from './helpers/supabase-mock'
import { gatherRegistrationReminders } from '@/lib/registration-reminders'

const SEASON = '2026-27'
const SITE = 'https://hub.placerrobotics.org'

function baseFixture(): Tables {
  return {
    family_season: [],
    guardian: [],
    student: [],
    family: [],
    family_sponsor_interest: [],
    season_config: [],
    enrollment: [],
    student_application: [],
    school: [],
  }
}

function baseGuardian(overrides: Partial<Record<string, any>> = {}) {
  return { id: 'g1', family_id: 'fam1', first_name: 'Pat', last_name: 'Doe', login_email: 'pat@ex.com', role: 'primary', ...overrides }
}

describe('gatherRegistrationReminders', () => {
  it('excludes a fully-complete student (fee paid + fundraising received)', async () => {
    const t = baseFixture()
    t.family_season = [{ family_id: 'fam1', season: SEASON, status: 'registered' }]
    t.guardian = [baseGuardian()]
    t.student = [{ id: 's1', family_id: 'fam1', first_name: 'Kid', last_name: 'Doe', grade: 8 }]
    t.enrollment = [{ student_id: 's1', season: SEASON, program: 'vex_v5', division: 'MS', submitted_at: '2026-07-01', registration_fee_status: 'paid', registration_fee_amount: 40, fundraising_target: 550, fundraising_received_at: '2026-07-05', fundraising_methods: ['direct_donation'] }]

    const { families, summary } = await gatherRegistrationReminders(makeAdminClient(t), SEASON, SITE)
    expect(families).toEqual([])
    expect(summary).toEqual({ notRegistered: 0, unpaid: 0, fundraisingOpen: 0, fullyDone: 1 })
  })

  it('includes a not-yet-registered student with a register link', async () => {
    const t = baseFixture()
    t.family_season = [{ family_id: 'fam1', season: SEASON, status: 'cleared_to_register' }]
    t.guardian = [baseGuardian()]
    t.student = [{ id: 's1', family_id: 'fam1', first_name: 'Kid', last_name: 'Doe', grade: 8 }]
    t.student_application = [{ student_id: 's1', season: SEASON, program_interest: 'vex_v5' }]

    const { families, summary } = await gatherRegistrationReminders(makeAdminClient(t), SEASON, SITE)
    expect(summary.notRegistered).toBe(1)
    expect(families).toHaveLength(1)
    expect(families[0].students).toEqual([{ name: 'Kid Doe', registerUrl: `${SITE}/register?student=s1` }])
  })

  it('includes a registered-but-unpaid student with fee/zeffy details', async () => {
    const t = baseFixture()
    t.family_season = [{ family_id: 'fam1', season: SEASON, status: 'registered' }]
    t.guardian = [baseGuardian()]
    t.student = [{ id: 's1', family_id: 'fam1', first_name: 'Kid', last_name: 'Doe', grade: 8 }]
    t.season_config = [{ season: SEASON, zeffy_student_url: 'https://zeffy/standard', zeffy_cavitt_url: 'https://zeffy/cavitt' }]
    t.enrollment = [{ student_id: 's1', season: SEASON, program: 'vex_v5', division: 'MS', submitted_at: '2026-07-01', registration_fee_status: 'unpaid', registration_fee_amount: 40, payment_reference_code: 'PART-CODE', fundraising_target: 550, fundraising_received_at: null, fundraising_methods: ['direct_donation'] }]

    const { families, summary } = await gatherRegistrationReminders(makeAdminClient(t), SEASON, SITE)
    expect(summary.unpaid).toBe(1)
    expect(families[0].students[0]).toMatchObject({
      name: 'Kid Doe', feeAmount: 40, feeStatus: 'unpaid', paymentReferenceCode: 'PART-CODE', zeffyUrl: 'https://zeffy/standard',
      fundraisingTarget: 550, fundraisingDone: false, fundraisingMethods: ['direct_donation'],
    })
  })

  it('excludes a student whose only signal is VEX IQ (application, no enrollment)', async () => {
    const t = baseFixture()
    t.family_season = [{ family_id: 'fam1', season: SEASON, status: 'cleared_to_register' }]
    t.guardian = [baseGuardian()]
    t.student = [{ id: 's1', family_id: 'fam1', first_name: 'Kid', last_name: 'Doe', grade: 4 }]
    t.student_application = [{ student_id: 's1', season: SEASON, program_interest: 'vex_iq' }]

    const { families, summary } = await gatherRegistrationReminders(makeAdminClient(t), SEASON, SITE)
    expect(families).toEqual([])
    expect(summary).toEqual({ notRegistered: 0, unpaid: 0, fundraisingOpen: 0, fullyDone: 0 })
  })

  it('excludes a student whose only signal is VEX IQ (enrollment)', async () => {
    const t = baseFixture()
    t.family_season = [{ family_id: 'fam1', season: SEASON, status: 'registered' }]
    t.guardian = [baseGuardian()]
    t.student = [{ id: 's1', family_id: 'fam1', first_name: 'Kid', last_name: 'Doe', grade: 4 }]
    t.enrollment = [{ student_id: 's1', season: SEASON, program: 'vex_iq', division: 'ES', submitted_at: '2026-07-01', registration_fee_status: 'unpaid', registration_fee_amount: 0, fundraising_target: 0, fundraising_received_at: null, fundraising_methods: [] }]

    const { families } = await gatherRegistrationReminders(makeAdminClient(t), SEASON, SITE)
    expect(families).toEqual([])
  })

  it('flags needsSponsorCc when a student selected sponsored', async () => {
    const t = baseFixture()
    t.family_season = [{ family_id: 'fam1', season: SEASON, status: 'registered' }]
    t.guardian = [baseGuardian()]
    t.student = [{ id: 's1', family_id: 'fam1', first_name: 'Kid', last_name: 'Doe', grade: 8 }]
    t.family_sponsor_interest = [{ family_id: 'fam1', student_id: 's1', business_name: 'Acme Co', season: SEASON }]
    t.enrollment = [{ student_id: 's1', season: SEASON, program: 'vex_v5', division: 'MS', submitted_at: '2026-07-01', registration_fee_status: 'paid', registration_fee_amount: 40, fundraising_target: 550, fundraising_received_at: null, fundraising_methods: ['sponsored'] }]

    const { families } = await gatherRegistrationReminders(makeAdminClient(t), SEASON, SITE)
    expect(families[0].needsSponsorCc).toBe(true)
    expect(families[0].students[0].sponsorBusiness).toBe('Acme Co')
  })

  it('applies the Cavitt Zeffy URL only for a genuinely V5-only registration at a Cavitt school', async () => {
    const t = baseFixture()
    t.family_season = [{ family_id: 'fam1', season: SEASON, status: 'registered' }]
    t.guardian = [baseGuardian()]
    t.school = [{ id: 'sch1', fee_tier: 'cavitt' }]
    t.student = [{ id: 's1', family_id: 'fam1', first_name: 'Kid', last_name: 'Doe', grade: 8, school_id: 'sch1' }]
    t.student_application = [{ student_id: 's1', season: SEASON, program_interest: 'vex_v5' }]
    t.season_config = [{ season: SEASON, zeffy_student_url: 'https://zeffy/standard', zeffy_cavitt_url: 'https://zeffy/cavitt' }]
    t.enrollment = [{ student_id: 's1', season: SEASON, program: 'vex_v5', division: 'MS', submitted_at: '2026-07-01', registration_fee_status: 'unpaid', registration_fee_amount: 40, fundraising_target: 550, fundraising_received_at: null, fundraising_methods: [] }]

    const { families } = await gatherRegistrationReminders(makeAdminClient(t), SEASON, SITE)
    expect(families[0].students[0].zeffyUrl).toBe('https://zeffy/cavitt')
  })

  it('does NOT apply the Cavitt URL to a \'both\' registration even though the primary enrollment row is vex_v5', async () => {
    const t = baseFixture()
    t.family_season = [{ family_id: 'fam1', season: SEASON, status: 'registered' }]
    t.guardian = [baseGuardian()]
    t.school = [{ id: 'sch1', fee_tier: 'cavitt' }]
    t.student = [{ id: 's1', family_id: 'fam1', first_name: 'Kid', last_name: 'Doe', grade: 8, school_id: 'sch1' }]
    t.student_application = [{ student_id: 's1', season: SEASON, program_interest: 'both' }]
    t.season_config = [{ season: SEASON, zeffy_student_url: 'https://zeffy/standard', zeffy_cavitt_url: 'https://zeffy/cavitt' }]
    // 'both' registrations enroll in vex_v5 (primary, carries the fee) + combat (secondary, $0).
    t.enrollment = [
      { student_id: 's1', season: SEASON, program: 'vex_v5', division: 'MS', submitted_at: '2026-07-01', registration_fee_status: 'unpaid', registration_fee_amount: 40, fundraising_target: 550, fundraising_received_at: null, fundraising_methods: [] },
      { student_id: 's1', season: SEASON, program: 'combat', division: 'MS', submitted_at: '2026-07-01', registration_fee_status: 'unpaid', registration_fee_amount: 0, fundraising_target: 0, fundraising_received_at: null, fundraising_methods: [] },
    ]

    const { families } = await gatherRegistrationReminders(makeAdminClient(t), SEASON, SITE)
    expect(families[0].students[0].zeffyUrl).toBe('https://zeffy/standard')
    expect(families[0].students[0].program).toBe('VEX V5 & Combat')
  })

  it('includes a 13+ student with an email as a student recipient, excludes an under-13 student even with an email', async () => {
    const t = baseFixture()
    t.family_season = [{ family_id: 'fam1', season: SEASON, status: 'cleared_to_register' }]
    t.guardian = [baseGuardian()]
    const teenDob = new Date(); teenDob.setFullYear(teenDob.getFullYear() - 15)
    const kidDob = new Date(); kidDob.setFullYear(kidDob.getFullYear() - 10)
    t.student = [
      { id: 's1', family_id: 'fam1', first_name: 'Teen', last_name: 'Doe', grade: 9, birthdate: teenDob.toISOString().slice(0, 10), communication_email: 'teen@ex.com' },
      { id: 's2', family_id: 'fam1', first_name: 'Young', last_name: 'Doe', grade: 6, birthdate: kidDob.toISOString().slice(0, 10), communication_email: 'young@ex.com' },
    ]
    t.student_application = [
      { student_id: 's1', season: SEASON, program_interest: 'vex_v5' },
      { student_id: 's2', season: SEASON, program_interest: 'combat' },
    ]

    const { families } = await gatherRegistrationReminders(makeAdminClient(t), SEASON, SITE)
    const recipientEmails = families[0].studentRecipients.map((r) => r.email)
    expect(recipientEmails).toEqual(['teen@ex.com'])
  })

  it('excludes a family entirely when no guardian has a login_email on file', async () => {
    const t = baseFixture()
    t.family_season = [{ family_id: 'fam1', season: SEASON, status: 'cleared_to_register' }]
    t.guardian = [baseGuardian({ login_email: null })]
    t.student = [{ id: 's1', family_id: 'fam1', first_name: 'Kid', last_name: 'Doe', grade: 8 }]
    t.student_application = [{ student_id: 's1', season: SEASON, program_interest: 'vex_v5' }]

    const { families } = await gatherRegistrationReminders(makeAdminClient(t), SEASON, SITE)
    expect(families).toEqual([])
  })
})
