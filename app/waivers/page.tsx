import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FamilyShell, PageHeader, SuccessAlert, WarningAlert } from '@/components/ui'
import WaiverSignForm, { type SignWaiver } from './sign-form'

const SEASON = '2026-27'

// Per-guardian agreement signing. Lets a second parent/legal guardian sign the
// active waivers from their own authenticated session — a real independent
// signature recorded under their guardian_id. Reached via the dashboard prompt.
export default async function WaiversPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { notice } = await searchParams

  const { data: guardian } = await supabase
    .from('guardian')
    .select('id, family_id, first_name, last_name')
    .ilike('login_email', user.email ?? '')
    .maybeSingle()
  if (!guardian) redirect('/dashboard')

  const { data: waivers } = await supabase
    .from('waiver_template')
    .select('id, title, body_markdown')
    .eq('active', true)
    .order('waiver_type', { ascending: true })
  const activeWaivers = (waivers ?? []) as SignWaiver[]

  const { data: enrollments } = await supabase
    .from('enrollment')
    .select('student_id, student:student_id ( first_name, last_name )')
    .eq('family_id', guardian.family_id)
    .eq('season', SEASON)
  const registered = (enrollments ?? []) as any[]
  const studentNames = [
    ...new Set(registered.map((e) => `${e.student?.first_name ?? ''} ${e.student?.last_name ?? ''}`.trim()).filter(Boolean)),
  ]

  const { data: mySigs } = await supabase
    .from('waiver_signature')
    .select('waiver_template_id')
    .eq('guardian_id', guardian.id)
    .eq('season', SEASON)
  const signedIds = new Set((mySigs ?? []).map((s: any) => s.waiver_template_id))
  const allSigned = activeWaivers.length > 0 && activeWaivers.every((w) => signedIds.has(w.id))

  const guardianName = `${guardian.first_name} ${guardian.last_name}`.trim()

  return (
    <FamilyShell familyName={guardianName} maxWidth="lg">
      <PageHeader
        title="Sign agreements"
        subtitle={`Review and sign the ${SEASON} agreements${studentNames.length ? ` for ${studentNames.join(', ')}` : ''}.`}
      />
      {notice === 'signed' && (
        <div style={{ marginBottom: '1.25rem' }}>
          <SuccessAlert title="Thank you">Your signatures were recorded.</SuccessAlert>
        </div>
      )}

      {activeWaivers.length === 0 ? (
        <WarningAlert>There are no agreements to sign right now.</WarningAlert>
      ) : registered.length === 0 ? (
        <WarningAlert title="Nothing to sign yet">
          No student on your account is registered for {SEASON} yet. Once a student is registered, the agreements
          will appear here.
        </WarningAlert>
      ) : allSigned ? (
        <SuccessAlert title="All signed">
          You&apos;ve already signed all current agreements. Thank you!
        </SuccessAlert>
      ) : (
        <WaiverSignForm waivers={activeWaivers} alreadySigned={[...signedIds] as string[]} guardianName={guardianName} />
      )}
    </FamilyShell>
  )
}
