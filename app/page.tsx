import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Root URL (hub.placerrobotics.org/) — send signed-in users to their dashboard,
// everyone else to sign-in (which links to /apply for new families).
export const dynamic = 'force-dynamic'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  redirect(user ? '/dashboard' : '/login')
}
