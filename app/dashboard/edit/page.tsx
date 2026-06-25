import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FamilyShell, PageHeader } from '@/components/ui'
import AccountForm, { type AccountData } from './account-form'

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
