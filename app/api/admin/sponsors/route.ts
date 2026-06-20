import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAdminProfile } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const admin = await getAdminProfile()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const form = await request.formData()
  const name = String(form.get('name') ?? '').trim()
  if (!name) return NextResponse.json({ error: 'Sponsor name is required.' }, { status: 400 })

  const db = createAdminClient()

  // Optional logo upload — non-fatal if it fails.
  let logoUrl: string | null = null
  const file = form.get('logo')
  if (file && typeof file !== 'string' && file.size > 0) {
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '')
      const path = `${crypto.randomUUID()}.${ext || 'png'}`
      const buffer = Buffer.from(await file.arrayBuffer())
      const { error: upErr } = await db.storage
        .from('sponsor-logos')
        .upload(path, buffer, { contentType: file.type || 'image/png', upsert: false })
      if (!upErr) {
        logoUrl = db.storage.from('sponsor-logos').getPublicUrl(path).data.publicUrl
      }
    } catch {
      // ignore — sponsor is still created without a logo
    }
  }

  const stype = String(form.get('sponsor_type') ?? 'company')
  const { data, error } = await db
    .from('sponsor')
    .insert({
      name,
      sponsor_type: ['company', 'family', 'individual'].includes(stype) ? stype : 'company',
      contact_first: String(form.get('contact_first') ?? '').trim() || null,
      contact_last: String(form.get('contact_last') ?? '').trim() || null,
      contact_email: String(form.get('contact_email') ?? '').trim() || null,
      contact_phone: String(form.get('contact_phone') ?? '').trim() || null,
      website_url: String(form.get('website_url') ?? '').trim() || null,
      part_contact: String(form.get('part_contact') ?? '').trim() || null,
      is_returning: form.get('is_returning') === 'on' || form.get('is_returning') === 'true',
      notes: String(form.get('notes') ?? '').trim() || null,
      logo_url: logoUrl,
    })
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, id: data.id })
}
