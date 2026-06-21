import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAdminProfile } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Admin guardian typeahead. GET ?q= searches guardians by first/last name or
 * login email. Returns up to 10 { id, first_name, last_name, login_email }.
 */
export async function GET(request: NextRequest) {
  const admin = await getAdminProfile()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const raw = (request.nextUrl.searchParams.get('q') ?? '').trim()
  // Strip characters that would break the PostgREST .or() filter grammar.
  const q = raw.replace(/[,()*%]/g, ' ').trim()
  if (q.length < 2) return NextResponse.json({ guardians: [] })

  const db = createAdminClient()
  const like = `%${q}%`
  const { data, error } = await db
    .from('guardian')
    .select('id, first_name, last_name, login_email')
    .or(`first_name.ilike.${like},last_name.ilike.${like},login_email.ilike.${like}`)
    .order('last_name', { ascending: true })
    .limit(10)

  if (error) return NextResponse.json({ guardians: [] })
  return NextResponse.json({ guardians: data ?? [] })
}
