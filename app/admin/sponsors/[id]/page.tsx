import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminShell, PageHeader, StatusBadge, EmptyState } from '@/components/ui'
import CreditForm from './credit-form'

const SEASON = '2026-27'
const TYPE_LABELS: Record<string, string> = { company: 'Company', family: 'Family', individual: 'Individual' }
const TIERS = ['diamond', 'platinum', 'gold', 'silver', 'bronze', 'irl_season', 'in_kind']

function money(n: number | null | undefined) {
  if (n == null) return '—'
  return Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.8125rem', fontWeight: 500, marginBottom: '0.2rem' }
const inputStyle: React.CSSProperties = { width: '100%', padding: '7px 9px', fontSize: '0.875rem', border: '1.5px solid var(--color-border)', borderRadius: '6px', fontFamily: 'inherit', boxSizing: 'border-box', backgroundColor: 'var(--color-surface)' }
const navyBtn: React.CSSProperties = { padding: '9px 18px', backgroundColor: 'var(--color-navy-deep)', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit' }

export default async function SponsorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: sponsor } = await supabase.from('sponsor').select('*').eq('id', id).maybeSingle()
  if (!sponsor) {
    return (
      <AdminShell activePath="/admin/sponsors">
        <PageHeader title="Sponsor not found" breadcrumb={[{ label: 'Sponsors', href: '/admin/sponsors' }, { label: 'Not found' }]} />
      </AdminShell>
    )
  }

  const { data: commitments } = await supabase
    .from('sponsor_commitment')
    .select('*')
    .eq('sponsor_id', id)
    .order('season', { ascending: false })
  const commitmentList = (commitments ?? []) as any[]
  const currentCommitment = commitmentList.find((c) => c.season === SEASON) ?? null

  const commitmentIds = commitmentList.map((c) => c.id)
  let credits: any[] = []
  if (commitmentIds.length) {
    const { data } = await supabase
      .from('enrollment_sponsor_credit')
      .select('id, amount_credited, credited_at, notes, family_season:family_season_id ( family:family_id ( display_name, primary_email ) ), admin:credited_by ( email )')
      .in('sponsor_commitment_id', commitmentIds)
      .order('credited_at', { ascending: false })
    credits = (data ?? []) as any[]
  }

  async function addCommitment(formData: FormData) {
    'use server'
    const db = await createClient()
    const num = (k: string) => { const v = String(formData.get(k) ?? '').trim(); return v ? Number(v) : null }
    const txt = (k: string) => String(formData.get(k) ?? '').trim() || null
    await db.from('sponsor_commitment').insert({
      sponsor_id: id,
      season: SEASON,
      tier: txt('tier'),
      amount_committed: num('amount_committed'),
      amount_type: txt('amount_type'),
      amount_received: num('amount_received') ?? 0,
      payment_date: txt('payment_date'),
      payment_method: txt('payment_method'),
      donor_letter_sent_date: txt('donor_letter_sent_date'),
      logo_on_tshirt: formData.get('logo_on_tshirt') === 'on',
      tshirt_sizes: txt('tshirt_sizes'),
      social_media_recognition: formData.get('social_media_recognition') === 'on',
      notes: txt('notes'),
    })
    redirect(`/admin/sponsors/${id}`)
  }

  async function updateSponsor(formData: FormData) {
    'use server'
    const db = await createClient()
    const txt = (k: string) => String(formData.get(k) ?? '').trim() || null
    await db.from('sponsor').update({
      name: String(formData.get('name') ?? '').trim() || sponsor.name,
      contact_email: txt('contact_email'),
      contact_phone: txt('contact_phone'),
      website_url: txt('website_url'),
      part_contact: txt('part_contact'),
      notes: txt('notes'),
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    redirect(`/admin/sponsors/${id}`)
  }

  return (
    <AdminShell activePath="/admin/sponsors">
      <PageHeader title={sponsor.name} subtitle={`${TYPE_LABELS[sponsor.sponsor_type] ?? sponsor.sponsor_type}${sponsor.is_returning ? ' · returning sponsor' : ''}`} breadcrumb={[{ label: 'Sponsors', href: '/admin/sponsors' }, { label: 'Detail' }]} />

      {/* Header card with logo + contact */}
      <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '1.5rem', marginBottom: '1.5rem' }}>
        {sponsor.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={sponsor.logo_url} alt="" width={72} height={72} style={{ width: 72, height: 72, objectFit: 'contain', borderRadius: 8, background: '#fff', border: '1px solid var(--color-border)' }} />
        ) : (
          <span style={{ display: 'inline-flex', width: 72, height: 72, borderRadius: 8, backgroundColor: 'var(--color-bg-light)', border: '1px solid var(--color-border)', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', color: 'var(--color-text-muted)' }}>{(sponsor.name?.[0] ?? '?').toUpperCase()}</span>
        )}
        <div style={{ fontSize: '0.9375rem', lineHeight: 1.6 }}>
          {(sponsor.contact_first || sponsor.contact_last) && <div>{sponsor.contact_first} {sponsor.contact_last}</div>}
          {sponsor.contact_email && <div className="text-help">{sponsor.contact_email}</div>}
          {sponsor.contact_phone && <div className="text-help">{sponsor.contact_phone}</div>}
          {sponsor.website_url && <div><a href={sponsor.website_url} target="_blank" rel="noopener noreferrer">{sponsor.website_url}</a></div>}
          {sponsor.part_contact && <div className="text-help">PART contact: {sponsor.part_contact}</div>}
        </div>
      </div>

      {/* Edit details */}
      <details style={{ marginBottom: '2rem' }}>
        <summary style={{ cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-navy-deep)' }}>Edit details</summary>
        <form action={updateSponsor} style={{ marginTop: '1rem', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '1.25rem', maxWidth: '560px', display: 'grid', gap: '0.75rem' }}>
          <div><label style={labelStyle}>Name</label><input name="name" defaultValue={sponsor.name} style={inputStyle} /></div>
          <div><label style={labelStyle}>Contact email</label><input name="contact_email" defaultValue={sponsor.contact_email ?? ''} style={inputStyle} /></div>
          <div><label style={labelStyle}>Contact phone</label><input name="contact_phone" defaultValue={sponsor.contact_phone ?? ''} style={inputStyle} /></div>
          <div><label style={labelStyle}>Website</label><input name="website_url" defaultValue={sponsor.website_url ?? ''} style={inputStyle} /></div>
          <div><label style={labelStyle}>PART contact</label><input name="part_contact" defaultValue={sponsor.part_contact ?? ''} style={inputStyle} /></div>
          <div><label style={labelStyle}>Notes</label><textarea name="notes" defaultValue={sponsor.notes ?? ''} style={{ ...inputStyle, minHeight: '70px', resize: 'vertical' }} /></div>
          <button type="submit" style={{ ...navyBtn, justifySelf: 'start' }}>Save changes</button>
        </form>
      </details>

      {/* Commitments */}
      <h2 className="text-section-title" style={{ margin: '0 0 1rem' }}>Commitments</h2>
      {commitmentList.length === 0 ? (
        <p className="text-help" style={{ marginBottom: '1rem' }}>No commitments yet.</p>
      ) : (
        <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', overflow: 'hidden', marginBottom: '1.5rem' }}>
          {commitmentList.map((c, i) => (
            <div key={c.id} style={{ padding: '0.875rem 1.25rem', borderBottom: i < commitmentList.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
                <div style={{ fontSize: '0.9375rem', fontWeight: 500, textTransform: 'capitalize' }}>{c.season} · {c.tier ? String(c.tier).replace('_', ' ') : 'no tier'}</div>
                <div style={{ fontSize: '0.875rem' }}>{money(c.amount_received)} / {money(c.amount_committed)}</div>
              </div>
              <div className="text-help" style={{ marginTop: '0.25rem' }}>
                {[c.amount_type, c.payment_method, c.donor_letter_sent_date ? `letter sent ${c.donor_letter_sent_date}` : null, c.logo_on_tshirt ? `t-shirt logo${c.tshirt_sizes ? ` (${c.tshirt_sizes})` : ''}` : null, c.social_media_recognition ? 'social recognition' : null].filter(Boolean).join(' · ') || '—'}
                {c.notes ? ` · ${c.notes}` : ''}
              </div>
            </div>
          ))}
        </div>
      )}

      <details style={{ marginBottom: '2.5rem' }}>
        <summary style={{ cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-navy-deep)' }}>Add commitment ({SEASON})</summary>
        <form action={addCommitment} style={{ marginTop: '1rem', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '1.25rem', maxWidth: '640px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div><label style={labelStyle}>Tier</label><select name="tier" style={inputStyle}><option value="">—</option>{TIERS.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}</select></div>
          <div><label style={labelStyle}>Amount type</label><select name="amount_type" style={inputStyle}><option value="cash">Cash</option><option value="in_kind">In-kind</option><option value="matching">Matching</option><option value="combination">Combination</option></select></div>
          <div><label style={labelStyle}>Amount committed</label><input name="amount_committed" type="number" step="0.01" style={inputStyle} /></div>
          <div><label style={labelStyle}>Amount received</label><input name="amount_received" type="number" step="0.01" style={inputStyle} /></div>
          <div><label style={labelStyle}>Payment date</label><input name="payment_date" type="date" style={inputStyle} /></div>
          <div><label style={labelStyle}>Payment method</label><select name="payment_method" style={inputStyle}><option value="">—</option><option value="check">Check</option><option value="online">Online</option><option value="benevity">Benevity</option><option value="wire">Wire</option><option value="in_kind">In-kind</option></select></div>
          <div><label style={labelStyle}>Donor letter sent</label><input name="donor_letter_sent_date" type="date" style={inputStyle} /></div>
          <div><label style={labelStyle}>T-shirt sizes</label><input name="tshirt_sizes" placeholder="1L, 2M, 1S" style={inputStyle} /></div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}><input type="checkbox" name="logo_on_tshirt" /> Logo on t-shirt</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}><input type="checkbox" name="social_media_recognition" /> Social media recognition</label>
          <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Notes</label><textarea name="notes" style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }} /></div>
          <button type="submit" style={{ ...navyBtn, gridColumn: '1 / -1', justifySelf: 'start' }}>Add commitment</button>
        </form>
      </details>

      {/* Enrollment credits */}
      <h2 className="text-section-title" style={{ margin: '0 0 1rem' }}>Enrollment Credits</h2>
      {credits.length === 0 ? (
        <p className="text-help" style={{ marginBottom: '1rem' }}>No enrollments credited to this sponsor yet.</p>
      ) : (
        <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', overflow: 'hidden', marginBottom: '1.5rem' }}>
          {credits.map((cr, i) => {
            const fam = cr.family_season?.family
            return (
              <div key={cr.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', padding: '0.875rem 1.25rem', borderBottom: i < credits.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                <div>
                  <div style={{ fontSize: '0.9375rem', fontWeight: 500 }}>{fam?.display_name ?? fam?.primary_email ?? 'Family'}</div>
                  <div className="text-help">credited by {cr.admin?.email ?? '—'} · {cr.credited_at ? new Date(cr.credited_at).toLocaleDateString() : ''}{cr.notes ? ` · ${cr.notes}` : ''}</div>
                </div>
                <div style={{ fontSize: '0.9375rem', fontWeight: 600 }}>{money(cr.amount_credited)}</div>
              </div>
            )
          })}
        </div>
      )}

      <CreditForm commitmentId={currentCommitment?.id ?? null} />
    </AdminShell>
  )
}
