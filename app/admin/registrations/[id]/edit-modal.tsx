'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', fontSize: '0.9375rem', border: '1.5px solid var(--color-border)', borderRadius: '6px', fontFamily: 'inherit', boxSizing: 'border-box', backgroundColor: 'var(--color-surface)' }
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.8125rem', fontWeight: 500, marginBottom: '0.25rem', color: 'var(--color-text-muted)' }
const btn: React.CSSProperties = { padding: '8px 16px', border: 'none', borderRadius: '6px', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit' }

export default function RegistrationEdit({
  familySeasonId,
  studentId,
  current,
}: {
  familySeasonId: string
  studentId: string
  current: {
    tshirt_size: string; program: string; division: string; emergency_name: string; emergency_phone: string
    fundraising_methods: string[]; employer_company: string; employer_pct: string; employer_portal: string
    sponsor_business: string; sponsor_contact: string; sponsor_amount: string
  }
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ ...current })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  function set<K extends keyof typeof f>(k: K, v: typeof f[K]) { setF((s) => ({ ...s, [k]: v })) }
  function toggleMethod(v: string) {
    setF((s) => ({ ...s, fundraising_methods: s.fundraising_methods.includes(v) ? s.fundraising_methods.filter((x) => x !== v) : [...s.fundraising_methods, v] }))
  }

  async function save() {
    setBusy(true); setErr('')
    try {
      const res = await fetch(`/api/admin/registrations/${familySeasonId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId, ...f }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setErr(d.error || 'Save failed.'); return }
      setOpen(false); router.refresh()
    } catch { setErr('Network error.') } finally { setBusy(false) }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} style={{ ...btn, backgroundColor: 'var(--color-navy-deep)', color: '#fff' }}>
        Edit registration
      </button>
    )
  }

  return (
    <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '1.25rem' }}>
      <h3 className="text-card-title" style={{ marginBottom: '1rem' }}>Edit registration</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.875rem' }}>
        <div>
          <label style={labelStyle}>T-shirt size</label>
          <select style={inputStyle} value={f.tshirt_size} onChange={(e) => set('tshirt_size', e.target.value)}>
            <option value="">—</option>
            {['xs', 's', 'm', 'l', 'xl', 'xxl'].map((s) => <option key={s} value={s}>{s.toUpperCase()}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Program</label>
          <select style={inputStyle} value={f.program} onChange={(e) => set('program', e.target.value)}>
            <option value="vex_v5">VEX V5</option>
            <option value="combat">Combat</option>
            <option value="vex_iq">VEX IQ</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Division</label>
          <select style={inputStyle} value={f.division} onChange={(e) => set('division', e.target.value)}>
            <option value="">—</option>
            <option value="ES">Elementary</option>
            <option value="MS">Middle</option>
            <option value="HS">High</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Emergency contact name</label>
          <input style={inputStyle} value={f.emergency_name} onChange={(e) => set('emergency_name', e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Emergency contact phone</label>
          <input style={inputStyle} value={f.emergency_phone} onChange={(e) => set('emergency_phone', e.target.value)} />
        </div>
      </div>

      <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)' }}>
        <div style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--color-text-primary)' }}>Fundraising</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.875rem' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Methods (select all that apply)</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem 1.25rem' }}>
              {([['direct_donation', 'Direct contribution'], ['corporate_match', 'Employer match'], ['sponsored', 'Business sponsorship'], ['paper_check', 'Paper check'], ['pending', 'Financial assistance']] as [string, string][]).map(([v, lbl]) => (
                <label key={v} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={f.fundraising_methods.includes(v)} onChange={() => toggleMethod(v)} />
                  {lbl}
                </label>
              ))}
            </div>
          </div>
          {f.fundraising_methods.includes('corporate_match') && (
            <>
              <div><label style={labelStyle}>Employer</label><input style={inputStyle} value={f.employer_company} onChange={(e) => set('employer_company', e.target.value)} /></div>
              <div><label style={labelStyle}>Match %</label><input style={inputStyle} type="number" min={1} max={100} value={f.employer_pct} onChange={(e) => set('employer_pct', e.target.value)} /></div>
              <div>
                <label style={labelStyle}>Submitted via</label>
                <select style={inputStyle} value={f.employer_portal} onChange={(e) => set('employer_portal', e.target.value)}>
                  <option value="">—</option><option value="benevity">Benevity</option><option value="yourcause">YourCause</option><option value="employer_portal">Employer portal</option><option value="other">Other</option>
                </select>
              </div>
            </>
          )}
          {f.fundraising_methods.includes('sponsored') && (
            <>
              <div><label style={labelStyle}>Business</label><input style={inputStyle} value={f.sponsor_business} onChange={(e) => set('sponsor_business', e.target.value)} /></div>
              <div><label style={labelStyle}>Contact</label><input style={inputStyle} value={f.sponsor_contact} onChange={(e) => set('sponsor_contact', e.target.value)} /></div>
              <div><label style={labelStyle}>Estimated amount</label><input style={inputStyle} type="number" min={0} value={f.sponsor_amount} onChange={(e) => set('sponsor_amount', e.target.value)} /></div>
            </>
          )}
        </div>
      </div>
      {err && <p style={{ color: 'var(--color-error)', fontSize: '0.8125rem', marginTop: '0.625rem' }}>{err}</p>}
      <div style={{ display: 'flex', gap: '0.625rem', marginTop: '1rem' }}>
        <button type="button" onClick={save} disabled={busy} style={{ ...btn, backgroundColor: 'var(--color-gold)', color: 'var(--color-navy-darker)' }}>{busy ? 'Saving…' : 'Save'}</button>
        <button type="button" onClick={() => { setOpen(false); setF({ ...current }); setErr('') }} disabled={busy} style={{ ...btn, backgroundColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>Cancel</button>
      </div>
    </div>
  )
}
