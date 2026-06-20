'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { TextInput, TextArea, PrimaryButton, SecondaryButton, ErrorAlert } from '@/components/ui'

export default function CreditForm({ commitmentId }: { commitmentId: string | null }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{ familySeasonId: string; label: string }[]>([])
  const [selected, setSelected] = useState<{ familySeasonId: string; label: string } | null>(null)
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  if (!commitmentId) {
    return <p className="text-help">Add a {`'`}2026-27{`'`} commitment above before crediting enrollments.</p>
  }

  async function search() {
    if (query.trim().length < 2) return
    setSearching(true)
    try {
      const res = await fetch(`/api/admin/family-seasons/search?q=${encodeURIComponent(query.trim())}`)
      const data = await res.json()
      setResults(data.familySeasons ?? [])
    } finally {
      setSearching(false)
    }
  }

  async function save() {
    if (!selected || !(Number(amount) > 0) || saving) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/admin/sponsors/credit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sponsorCommitmentId: commitmentId, familySeasonId: selected.familySeasonId, amount: Number(amount), notes }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Couldn’t credit.'); setSaving(false) }
      else { setOpen(false); setSelected(null); setQuery(''); setResults([]); setAmount(''); setNotes(''); router.refresh() }
    } catch {
      setError('Network error.'); setSaving(false)
    }
  }

  if (!open) {
    return <SecondaryButton type="button" onClick={() => setOpen(true)}>Credit Enrollment</SecondaryButton>
  }

  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: '10px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
      {error && <ErrorAlert>{error}</ErrorAlert>}
      {selected ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.9375rem' }}>{selected.label}</span>
          <button type="button" onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'var(--color-navy-deep)', cursor: 'pointer', fontWeight: 600, fontSize: '0.8125rem' }}>Change</button>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search family by student name" />
            <SecondaryButton type="button" onClick={search} loading={searching}>Search</SecondaryButton>
          </div>
          {results.map((r) => (
            <button key={r.familySeasonId} type="button" onClick={() => { setSelected(r); setResults([]) }} style={{ textAlign: 'left', padding: '0.5rem 0.75rem', border: '1px solid var(--color-border)', borderRadius: '6px', background: 'var(--color-surface)', cursor: 'pointer', fontSize: '0.875rem', fontFamily: 'inherit' }}>{r.label}</button>
          ))}
        </>
      )}
      <TextInput type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount to credit" />
      <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" />
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <PrimaryButton type="button" disabled={!selected || !(Number(amount) > 0)} loading={saving} onClick={save}>Save credit</PrimaryButton>
        <SecondaryButton type="button" onClick={() => setOpen(false)}>Cancel</SecondaryButton>
      </div>
    </div>
  )
}
