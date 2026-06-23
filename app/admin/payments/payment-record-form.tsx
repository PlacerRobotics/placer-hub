'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FormField, TextInput, TextArea, PrimaryButton, SecondaryButton, SuccessAlert, ErrorAlert } from '@/components/ui'

const TYPES = [
  ['registration_fee', 'Registration fee'],
  ['fundraising', 'Fundraising'],
  ['iq_team_fee', 'IQ team fee'],
  ['sponsorship', 'Sponsorship credit'],
]
const SOURCES = [
  ['check', 'Check'],
  ['cash', 'Cash'],
  ['benevity', 'Benevity'],
  ['corporate_platform', 'Corporate match'],
  ['other', 'Other'],
]

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.9375rem', fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: '0.375rem',
}
const selectStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', fontSize: '0.9375rem', color: 'var(--color-text-primary)',
  backgroundColor: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '6px',
  fontFamily: 'inherit', boxSizing: 'border-box',
}

export default function PaymentRecordForm() {
  const router = useRouter()
  const [familyQuery, setFamilyQuery] = useState('')
  const [familyResults, setFamilyResults] = useState<{ familyId: string; label: string }[]>([])
  const [familyId, setFamilyId] = useState<string | null>(null)
  const [familyLabel, setFamilyLabel] = useState('')
  const [searching, setSearching] = useState(false)

  const [amount, setAmount] = useState('')
  const [paymentType, setPaymentType] = useState('registration_fee')
  const [source, setSource] = useState('check')
  const [checkNumber, setCheckNumber] = useState('')
  const [paymentDate, setPaymentDate] = useState('')
  const [depositDate, setDepositDate] = useState('')
  const [notes, setNotes] = useState('')
  const [referenceCode, setReferenceCode] = useState('')

  const [status, setStatus] = useState<'idle' | 'saving'>('idle')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function searchFamily() {
    if (familyQuery.trim().length < 2) return
    setSearching(true)
    try {
      const res = await fetch(`/api/admin/families/search?q=${encodeURIComponent(familyQuery.trim())}`)
      const data = await res.json()
      setFamilyResults(data.families ?? [])
    } finally {
      setSearching(false)
    }
  }

  const valid = Number(amount) > 0 && !!paymentDate

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!valid || status === 'saving') return
    setStatus('saving')
    setError('')
    setMessage('')
    try {
      const res = await fetch('/api/admin/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          familyId,
          amount: Number(amount),
          paymentType,
          source,
          checkNumber,
          paymentDate,
          depositDate: depositDate || null,
          notes,
          referenceCode,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Couldn’t record the payment.')
      } else {
        setMessage(data.matched ? 'Payment recorded and matched to an enrollment.' : 'Payment recorded (unmatched).')
        setAmount(''); setCheckNumber(''); setNotes(''); setReferenceCode(''); setDepositDate('')
        setFamilyId(null); setFamilyLabel(''); setFamilyQuery(''); setFamilyResults([])
        router.refresh()
      }
    } catch {
      setError('Network error — please try again.')
    } finally {
      setStatus('idle')
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: '10px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem',
        maxWidth: '640px',
      }}
    >
      {message && <SuccessAlert>{message}</SuccessAlert>}
      {error && <ErrorAlert title="Couldn’t record payment">{error}</ErrorAlert>}

      <div>
        <label style={labelStyle}>Family (search by name or guardian email)</label>
        {familyId ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', padding: '9px 12px', border: '1.5px solid var(--color-border)', borderRadius: '6px' }}>
            <span style={{ fontSize: '0.9375rem' }}>{familyLabel}</span>
            <button type="button" onClick={() => { setFamilyId(null); setFamilyLabel('') }} style={{ background: 'none', border: 'none', color: 'var(--color-navy-deep)', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600 }}>Change</button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <TextInput value={familyQuery} onChange={(e) => setFamilyQuery(e.target.value)} placeholder="e.g. Miller or parent@email.com" />
              <SecondaryButton type="button" onClick={searchFamily} loading={searching}>Search</SecondaryButton>
            </div>
            {familyResults.length > 0 && (
              <div style={{ marginTop: '0.5rem', border: '1px solid var(--color-border)', borderRadius: '6px', overflow: 'hidden' }}>
                {familyResults.map((f) => (
                  <button key={f.familyId} type="button" onClick={() => { setFamilyId(f.familyId); setFamilyLabel(f.label); setFamilyResults([]) }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.625rem 0.875rem', background: 'none', border: 'none', borderBottom: '1px solid var(--color-border)', cursor: 'pointer', fontSize: '0.875rem', fontFamily: 'inherit' }}>
                    {f.label}
                  </button>
                ))}
              </div>
            )}
            <p className="text-help" style={{ marginTop: '0.375rem' }}>Optional — leave blank for payments not yet tied to a family.</p>
          </>
        )}
      </div>

      <FormField label="Payment amount" htmlFor="amount" required>
        <TextInput id="amount" type="number" inputMode="decimal" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </FormField>

      <div>
        <label htmlFor="ptype" style={labelStyle}>Payment type</label>
        <select id="ptype" value={paymentType} onChange={(e) => setPaymentType(e.target.value)} style={selectStyle}>
          {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      <div>
        <label htmlFor="psource" style={labelStyle}>Payment source</label>
        <select id="psource" value={source} onChange={(e) => setSource(e.target.value)} style={selectStyle}>
          {SOURCES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {source === 'check' && (
        <FormField label="Check number" htmlFor="checkno">
          <TextInput id="checkno" value={checkNumber} onChange={(e) => setCheckNumber(e.target.value)} />
        </FormField>
      )}

      <FormField label="Payment date" htmlFor="pdate" required>
        <TextInput id="pdate" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
      </FormField>
      <FormField label="Deposit date" htmlFor="ddate">
        <TextInput id="ddate" type="date" value={depositDate} onChange={(e) => setDepositDate(e.target.value)} />
      </FormField>

      <FormField label="Payment reference code" htmlFor="ref" helpText="If it matches an enrollment, the payment is auto-matched.">
        <TextInput id="ref" value={referenceCode} onChange={(e) => setReferenceCode(e.target.value)} placeholder="PART-2627-AB-1234" />
      </FormField>

      <FormField label="Notes" htmlFor="notes">
        <TextArea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </FormField>

      <PrimaryButton type="submit" disabled={!valid} loading={status === 'saving'}>Record payment</PrimaryButton>
    </form>
  )
}
