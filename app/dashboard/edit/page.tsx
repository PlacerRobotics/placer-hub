import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { FamilyShell, PageHeader } from '@/components/ui'
import AccountForm, { type AccountData } from './account-form'

const SEASON = '2026-27'

export default async function AccountPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: guardian } = await supabase
    .from('guardian')
    .select('id, family_id, first_name, last_name, login_email, communication_email, slack_email, street_address, city, state, zip_code, phone')
    .ilike('login_email', user.email ?? '')
    .maybeSingle()
  if (!guardian) redirect('/dashboard')
  const familyId = guardian.family_id

  const { data: studs } = await supabase
    .from('student')
    .select('id, first_name, last_name, tshirt_size, communication_email, fusion_education_email, slack_email')
    .eq('family_id', familyId)
    .order('created_at', { ascending: true })
  const students = studs ?? []
  const studentIds = students.map((s: any) => s.id)

  const { data: ecs } = studentIds.length
    ? await supabase.from('emergency_contact').select('student_id, first_name, last_name, phone, relationship').eq('priority', 1).in('student_id', studentIds)
    : { data: [] as any[] }
  const ecByStudent: Record<string, any> = Object.fromEntries((ecs ?? []).map((e: any) => [e.student_id, e]))

  const { data: gAll } = await supabase
    .from('guardian')
    .select('id, first_name, last_name, login_email, communication_email, slack_email, street_address, city, state, zip_code, phone')
    .eq('family_id', familyId)
    .order('created_at', { ascending: true })
  const g2 = (gAll ?? []).find((g: any) => g.id !== guardian.id)

  // Per-student fundraising — editable until that student's registration fee is paid.
  const { data: enrs } = studentIds.length
    ? await supabase.from('enrollment').select('student_id, program, fundraising_methods, fundraising_target, registration_fee_status').eq('season', SEASON).in('student_id', studentIds)
    : { data: [] as any[] }
  const enrByStudent: Record<string, any[]> = {}
  for (const e of enrs ?? []) (enrByStudent[e.student_id] ??= []).push(e)
  const { data: cfg } = await supabase.from('season_config').select('one_program_fundraising_target').eq('season', SEASON).maybeSingle()
  const defaultTarget = Number(cfg?.one_program_fundraising_target ?? 550)
  // employer-match (family, shared) + per-student sponsor interest (admin-RLS) via service role.
  const adb = createAdminClient()
  const [{ data: fam }, { data: sponsors }] = await Promise.all([
    adb.from('family').select('employer_match_company, employer_match_pct, employer_match_portal').eq('id', familyId).maybeSingle(),
    adb.from('family_sponsor_interest').select('student_id, business_name, contact_name, estimated_amount').eq('family_id', familyId).eq('season', SEASON).eq('source', 'registration_wizard'),
  ])
  const sponsorByStudent: Record<string, any> = {}
  for (const sp of sponsors ?? []) if (sp.student_id && !sponsorByStudent[sp.student_id]) sponsorByStudent[sp.student_id] = sp

  const data: AccountData = {
    guardian1: {
      name: `${guardian.first_name} ${guardian.last_name}`.trim(),
      email: guardian.login_email,
      communication_email: guardian.communication_email ?? '',
      slack_email: guardian.slack_email ?? '',
      street_address: guardian.street_address ?? '',
      city: guardian.city ?? '',
      state: guardian.state ?? '',
      zip_code: guardian.zip_code ?? '',
      phone: guardian.phone ?? '',
    },
    students: students.map((s: any) => {
      const ec = ecByStudent[s.id]
      const enrsS = enrByStudent[s.id] ?? []
      const isIq = enrsS.some((e: any) => e.program === 'vex_iq')
      const sp = sponsorByStudent[s.id]
      return {
        id: s.id,
        name: `${s.first_name} ${s.last_name}`.trim(),
        tshirt_size: s.tshirt_size ?? '',
        communication_email: s.communication_email ?? '',
        fusion_education_email: s.fusion_education_email ?? '',
        slack_email: s.slack_email ?? '',
        ec_first: ec?.first_name ?? '',
        ec_last: ec?.last_name ?? '',
        ec_phone: ec?.phone ?? '',
        ec_relationship: ec?.relationship ?? '',
        fund: {
          show: enrsS.length > 0 && !isIq, // registered, non-IQ
          locked: enrsS.some((e: any) => e.registration_fee_status === 'paid'),
          methods: [...new Set(enrsS.flatMap((e: any) => (e.fundraising_methods ?? []) as string[]))],
          target: Math.max(0, ...enrsS.map((e: any) => Number(e.fundraising_target) || 0)) || defaultTarget,
          employer_company: fam?.employer_match_company ?? '',
          employer_pct: fam?.employer_match_pct != null ? String(fam.employer_match_pct) : '',
          employer_portal: fam?.employer_match_portal ?? '',
          sponsor_business: sp?.business_name ?? '',
          sponsor_contact: sp?.contact_name ?? '',
          sponsor_amount: sp?.estimated_amount != null ? String(sp.estimated_amount) : '',
        },
      }
    }),
    guardian2: g2
      ? {
          first_name: g2.first_name ?? '',
          last_name: g2.last_name ?? '',
          email: g2.login_email ?? '',
          communication_email: g2.communication_email ?? '',
          slack_email: g2.slack_email ?? '',
          street_address: g2.street_address ?? '',
          city: g2.city ?? '',
          state: g2.state ?? '',
          zip_code: g2.zip_code ?? '',
          phone: g2.phone ?? '',
        }
      : null,
  }

  return (
    <FamilyShell familyName={`${guardian.last_name} Family`} maxWidth="lg">
      <PageHeader title="My Account" subtitle="Update your students, contact info, and second guardian." breadcrumb={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'My Account' }]} />
      <AccountForm data={data} />
    </FamilyShell>
  )
}
