// Horizontal / vertical privilege-escalation integration tests (task 1.5).
//
// These drive the REAL route handlers with an in-memory, RLS-free Supabase stand-in
// (see helpers/supabase-mock). Because the mock does not enforce RLS — matching the
// service-role client the routes actually use — any 403 here is produced by the
// route's own ownership check, which is exactly what we're verifying.
//
// Scenarios:
//   - guardian A cannot read/write family B's student, fundraising, or registration
//   - a guardian only ever signs waivers for their own family's enrollments
//   - a volunteer only ever acts on their own volunteer_profile
//   - (characterization) a read_only_admin can still hit admin mutation routes — the
//     API layer does not enforce the read-only role. See Finding H1.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeAdminClient, makeSessionClient, jsonRequest, ctx, type Tables } from './helpers/supabase-mock'
import { VOLUNTEER_WAIVER_TYPES, VOLUNTEER_SEASON } from '@/lib/volunteer'

const SEASON = '2026-27'

// Shared, per-test mutable clients — set at the top of each test before invoking a route.
const H = vi.hoisted(() => ({ state: { session: null as any, admin: null as any } }))

vi.mock('@/lib/supabase/server', () => ({ createClient: async () => H.state.session }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => H.state.admin }))
vi.mock('@/lib/email', () => ({
  sendEmail: async () => ({ ok: true }),
  registrationConfirmationHtml: () => '',
  studentApplicationReceivedHtml: () => '',
  volunteerApplicationReceivedHtml: () => '',
  volunteerAdminNotifyHtml: () => '',
  iqTeamSubmittedHtml: () => '',
  iqTeamPaidNotifyHtml: () => '',
  sendMagicLinkEmail: async () => ({ ok: true }),
}))
vi.mock('@/lib/admin/reg-audit', () => ({ logRegAudit: async () => {} }))

// Route handlers under test (imported after the mocks above are registered).
import { POST as studentPost } from '@/app/api/family/students/[id]/route'
import { PATCH as fundraisingPatch } from '@/app/api/family/fundraising/route'
import { POST as registerPost } from '@/app/api/register/route'
import { POST as waiversSignPost } from '@/app/api/waivers/sign/route'
import { POST as volunteerWaiverPost } from '@/app/api/volunteer/waiver/route'
import { POST as setStatusPost } from '@/app/api/admin/registrations/[id]/set-status/route'

function useClients(tables: Tables, user: { id?: string; email?: string } | null) {
  H.state.admin = makeAdminClient(tables)
  H.state.session = makeSessionClient(user, tables)
}

beforeEach(() => {
  H.state.session = null
  H.state.admin = null
})

// Two families, each with a guardian and one student.
function twoFamilies(): Tables {
  return {
    guardian: [
      { id: 'gA', family_id: 'famA', login_email: 'a@ex.com', first_name: 'Ann', last_name: 'Alpha', phone: '111' },
      { id: 'gB', family_id: 'famB', login_email: 'b@ex.com', first_name: 'Bob', last_name: 'Beta', phone: '222' },
    ],
    student: [
      { id: 'sA', family_id: 'famA', first_name: 'Amy', last_name: 'Alpha', tshirt_size: 'm', birthdate: '2010-01-01', slack_email: null },
      { id: 'sB', family_id: 'famB', first_name: 'Ben', last_name: 'Beta', tshirt_size: 's', birthdate: '2010-01-01', slack_email: null },
    ],
    enrollment: [
      { id: 'eA', family_id: 'famA', student_id: 'sA', season: SEASON, program: 'vex_v5', registration_fee_status: 'unpaid', fundraising_received_at: null, fundraising_methods: [], created_at: '2026-07-01' },
      { id: 'eB', family_id: 'famB', student_id: 'sB', season: SEASON, program: 'vex_v5', registration_fee_status: 'unpaid', fundraising_received_at: null, fundraising_methods: [], created_at: '2026-07-01' },
    ],
    family_season: [
      { id: 'fsA', family_id: 'famA', season: SEASON, status: 'cleared_to_register' },
      { id: 'fsB', family_id: 'famB', season: SEASON, status: 'cleared_to_register' },
    ],
    family: [
      { id: 'famA', employer_match_company: null },
      { id: 'famB', employer_match_company: null },
    ],
    emergency_contact: [],
    family_sponsor_interest: [],
  }
}

describe('POST /api/family/students/[id] — guardian cannot edit another family\'s student', () => {
  it('rejects guardian A editing family B\'s student and leaves it unchanged', async () => {
    const tables = twoFamilies()
    useClients(tables, { id: 'auth-a', email: 'a@ex.com' })

    const res = await studentPost(jsonRequest({ tshirt_size: 'xl' }), ctx({ id: 'sB' }))
    expect(res.status).toBe(403)

    const sB = tables.student.find((s) => s.id === 'sB')!
    expect(sB.tshirt_size).toBe('s') // untouched
  })

  it('positive control: guardian A can edit their OWN student', async () => {
    const tables = twoFamilies()
    useClients(tables, { id: 'auth-a', email: 'a@ex.com' })

    const res = await studentPost(jsonRequest({ tshirt_size: 'xl' }), ctx({ id: 'sA' }))
    expect(res.status).toBe(200)

    const sA = tables.student.find((s) => s.id === 'sA')!
    expect(sA.tshirt_size).toBe('xl')
  })
})

describe('PATCH /api/family/fundraising — guardian cannot edit another family\'s fundraising', () => {
  it('rejects guardian A targeting family B\'s student via body.student_id', async () => {
    const tables = twoFamilies()
    useClients(tables, { id: 'auth-a', email: 'a@ex.com' })

    const res = await fundraisingPatch(jsonRequest({ student_id: 'sB', methods: ['direct_donation'] }))
    expect(res.status).toBe(403)

    const eB = tables.enrollment.find((e) => e.id === 'eB')!
    expect(eB.fundraising_methods).toEqual([]) // untouched
  })

  it('positive control: guardian A can set fundraising on their OWN student', async () => {
    const tables = twoFamilies()
    useClients(tables, { id: 'auth-a', email: 'a@ex.com' })

    const res = await fundraisingPatch(jsonRequest({ student_id: 'sA', methods: ['direct_donation'] }))
    expect(res.status).toBe(200)

    const eA = tables.enrollment.find((e) => e.id === 'eA')!
    expect(eA.fundraising_methods).toEqual(['direct_donation'])
  })
})

describe('POST /api/register — guardian cannot register another family\'s student', () => {
  it('rejects guardian A submitting registration for family B\'s student', async () => {
    const tables = twoFamilies()
    useClients(tables, { id: 'auth-a', email: 'a@ex.com' })

    const res = await registerPost(
      jsonRequest({ studentId: 'sB', program: 'vex_v5', student: { grade: 9, first_name: 'Ben', last_name: 'Beta', birthdate: '2010-01-01' }, paymentReferenceCode: 'PART-X' }),
    )
    expect(res.status).toBe(403)

    // Family B's enrollment must not have been marked submitted by A.
    const eB = tables.enrollment.find((e) => e.id === 'eB')!
    expect(eB.submitted_at).toBeUndefined()
  })
})

describe('POST /api/waivers/sign — a guardian only signs for their own family', () => {
  it('creates signatures scoped to the caller\'s family only, never family B', async () => {
    const tables = twoFamilies()
    tables.waiver_template = [{ id: 'w1', waiver_type: 'student_participation', version: 1, body_hash: 'h1', active: true }]
    tables.waiver_signature = []
    useClients(tables, { id: 'auth-a', email: 'a@ex.com' })

    const res = await waiversSignPost(jsonRequest({ signatureName: 'Ann Alpha' }))
    expect(res.status).toBe(200)

    const sigs = tables.waiver_signature
    expect(sigs.length).toBeGreaterThan(0)
    // Every signature belongs to family A / student A — none reference family B.
    expect(sigs.every((s) => s.family_id === 'famA')).toBe(true)
    expect(sigs.every((s) => s.guardian_id === 'gA')).toBe(true)
    expect(sigs.some((s) => s.student_id === 'sB' || s.family_id === 'famB')).toBe(false)
  })
})

describe('POST /api/volunteer/waiver — a volunteer only ever acts on their own profile', () => {
  function volunteerTables(): Tables {
    return {
      guardian: [
        { id: 'gVA', family_id: 'famVA', login_email: 'vola@ex.com', first_name: 'Val', last_name: 'A' },
        { id: 'gVB', family_id: 'famVB', login_email: 'volb@ex.com', first_name: 'Val', last_name: 'B' },
      ],
      volunteer_profile: [
        { id: 'vpA', guardian_id: 'gVA', status: 'pending' },
        { id: 'vpB', guardian_id: 'gVB', status: 'pending' },
      ],
      waiver_template: VOLUNTEER_WAIVER_TYPES.map((t, i) => ({ id: `wt${i}`, waiver_type: t, version: 1, body_hash: `h${i}`, active: true })),
      waiver_signature: [],
      volunteer_clearance: [],
    }
  }

  it('records signatures under the caller\'s volunteer_profile, never another volunteer', async () => {
    const tables = volunteerTables()
    useClients(tables, { id: 'auth-vola', email: 'vola@ex.com' })

    const res = await volunteerWaiverPost(jsonRequest({ first_name: 'Val', last_name: 'A', acknowledged: true }))
    expect(res.status).toBe(200)

    const sigs = tables.waiver_signature
    expect(sigs.length).toBe(VOLUNTEER_WAIVER_TYPES.length)
    expect(sigs.every((s) => s.volunteer_id === 'vpA')).toBe(true)
    expect(sigs.some((s) => s.volunteer_id === 'vpB')).toBe(false)

    // Clearance side effects landed on volunteer A only.
    expect(tables.volunteer_clearance.every((c) => c.volunteer_id === 'vpA')).toBe(true)
    expect(VOLUNTEER_SEASON).toBe(SEASON)
  })
})

describe('Vertical escalation: read_only_admin vs. admin mutation routes', () => {
  function adminTables(roleValue: string): Tables {
    return {
      admin_profile: [{ id: 'apX', auth_user_id: 'auth-x' }],
      admin_role_assignment: [{ id: 'ra1', admin_profile_id: 'apX', role: roleValue, revoked_at: null }],
      family_season: [{ id: 'fs1', status: 'applied' }],
    }
  }

  // Finding H1 fix: admin mutation routes now authorize with requireWriteAdmin(), which
  // rejects a profile whose only non-revoked role is read_only_admin. The read-only admin
  // must be blocked at the API layer (page guards never covered direct API calls), and the
  // family_season row must be left unchanged.
  it('read_only_admin is rejected (403) from a mutation route and changes nothing', async () => {
    const tables = adminTables('read_only_admin')
    useClients(tables, { id: 'auth-x', email: 'ro@ex.com' })

    const res = await setStatusPost(jsonRequest({ status: 'registered' }), ctx({ id: 'fs1' }))
    expect(res.status).toBe(403)
    expect(tables.family_season.find((f) => f.id === 'fs1')!.status).toBe('applied') // untouched
  })

  it('read_only_admin combined with a write role is allowed (write role wins)', async () => {
    const tables: Tables = {
      admin_profile: [{ id: 'apX', auth_user_id: 'auth-x' }],
      admin_role_assignment: [
        { id: 'ra1', admin_profile_id: 'apX', role: 'read_only_admin', revoked_at: null },
        { id: 'ra2', admin_profile_id: 'apX', role: 'registration_admin', revoked_at: null },
      ],
      family_season: [{ id: 'fs1', status: 'applied' }],
    }
    useClients(tables, { id: 'auth-x', email: 'mix@ex.com' })

    const res = await setStatusPost(jsonRequest({ status: 'registered' }), ctx({ id: 'fs1' }))
    expect(res.status).toBe(200)
    expect(tables.family_season.find((f) => f.id === 'fs1')!.status).toBe('registered')
  })

  it('positive control: a write-capable role (registration_admin) may set status', async () => {
    const tables = adminTables('registration_admin')
    useClients(tables, { id: 'auth-x', email: 'reg@ex.com' })

    const res = await setStatusPost(jsonRequest({ status: 'registered' }), ctx({ id: 'fs1' }))
    expect(res.status).toBe(200)
    expect(tables.family_season.find((f) => f.id === 'fs1')!.status).toBe('registered')
  })
})
