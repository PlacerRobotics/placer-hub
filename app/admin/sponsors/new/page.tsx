'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AdminShell, PageHeader, ErrorAlert } from '@/components/ui'

const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', fontSize: '0.9375rem', border: '1.5px solid var(--color-border)', borderRadius: '6px', fontFamily: 'inherit', boxSizing: 'border-box', backgroundColor: 'var(--color-surface)' }

export default function NewSponsorPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    setError('')
    try {
      const fd = new FormData(e.currentTarget)
      const res = await fetch('/api/admin/sponsors', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Couldn’t create the sponsor.')
        setSaving(false)
      } else {
        router.push(`/admin/sponsors/${data.id}`)
      }
    } catch {
      setError('Network error — please try again.')
      setSaving(false)
    }
  }

  return (
    <AdminShell activePath="/admin/sponsors">
      <PageHeader title="Add Sponsor" breadcrumb={[{ label: 'Sponsors', href: '/admin/sponsors' }, { label: 'New' }]} />
      <form onSubmit={handleSubmit} style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '1.5rem', maxWidth: '640px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {error && <ErrorAlert title="Couldn’t save">{error}</ErrorAlert>}
        <div><label style={labelStyle}>Sponsor name *</label><input name="name" required style={inputStyle} /></div>
        <div><label style={labelStyle}>Type</label><select name="sponsor_type" style={inputStyle}><option value="company">Company</option><option value="family">Family</option><option value="individual">Individual</option></select></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
          <div><label style={labelStyle}>Contact first name</label><input name="contact_first" style={inputStyle} /></div>
          <div><label style={labelStyle}>Contact last name</label><input name="contact_last" style={inputStyle} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
          <div><label style={labelStyle}>Contact email</label><input name="contact_email" type="email" style={inputStyle} /></div>
          <div><label style={labelStyle}>Contact phone</label><input name="contact_phone" type="tel" style={inputStyle} /></div>
        </div>
        <div><label style={labelStyle}>Website URL</label><input name="website_url" type="url" placeholder="https://" style={inputStyle} /></div>
        <div><label style={labelStyle}>PART contact</label><input name="part_contact" placeholder="Internal PART person managing this relationship" style={inputStyle} /></div>
        <div><label style={labelStyle}>Logo</label><input name="logo" type="file" accept="image/*" style={{ ...inputStyle, padding: '6px' }} /></div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9375rem' }}><input type="checkbox" name="is_returning" /> Returning sponsor</label>
        <div><label style={labelStyle}>Notes</label><textarea name="notes" style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} /></div>
        <button type="submit" disabled={saving} style={{ padding: '11px 22px', backgroundColor: 'var(--color-gold)', color: 'var(--color-navy-darker)', border: 'none', borderRadius: '6px', fontWeight: 600, fontSize: '0.9375rem', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', alignSelf: 'flex-start' }}>{saving ? 'Saving…' : 'Save sponsor'}</button>
      </form>
    </AdminShell>
  )
}
