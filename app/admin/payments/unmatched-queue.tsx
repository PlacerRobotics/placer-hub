'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AdminQueueTable, EmptyState, SecondaryButton, PrimaryButton, TextInput, ErrorAlert } from '@/components/ui'

export type UnmatchedPayment = {
  id: string
  family: string
  amount: number
  source: string
  date: string | null
  checkNumber: string | null
}

function money(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export default function UnmatchedQueue({ items }: { items: UnmatchedPayment[] }) {
  const router = useRouter()
  const [selected, setSelected] = useState<UnmatchedPayment | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{ enrollmentId: string; label: string }[]>([])
  const [searching, setSearching] = useState(false)
  const [matching, setMatching] = useState(false)
  const [error, setError] = useState('')

  async function searchEnrollments() {
    if (query.trim().length < 2) return
    setSearching(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/enrollments/search?q=${encodeURIComponent(query.trim())}`)
      const data = await res.json()
      setResults(data.enrollments ?? [])
    } finally {
      setSearching(false)
    }
  }

  async function match(enrollmentId: string) {
    if (!selected || matching) return
    setMatching(true)
    setError('')
    try {
      const res = await fetch('/api/admin/payments/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId: selected.id, enrollmentId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Couldn’t match the payment.')
      } else {
        setSelected(null); setQuery(''); setResults([])
        router.refresh()
      }
    } catch {
      setError('Network error — please try again.')
    } finally {
      setMatching(false)
    }
  }

  if (items.length === 0) {
    return <EmptyState title="No unmatched payments" description="Recorded and webhook payments that need a family/enrollment appear here." />
  }

  return (
    <>
      <AdminQueueTable
        title="Needs matching"
        count={items.length}
        items={items.map((p) => ({
          id: p.id,
          primary: `${p.family} · ${money(p.amount)}`,
          secondary: `${p.source}${p.checkNumber ? ` · check ${p.checkNumber}` : ''}`,
          status: 'Unmatched',
          statusVariant: 'warning' as const,
          waitingTime: p.date ? new Date(p.date).toLocaleDateString() : undefined,
          onClick: () => { setSelected(p); setQuery(''); setResults([]); setError('') },
        }))}
      />

      {selected && (
        <div style={{ marginTop: '1rem', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
            <h3 className="text-card-title">Match {money(selected.amount)} from {selected.family}</h3>
            <SecondaryButton type="button" size="sm" onClick={() => setSelected(null)}>Close</SecondaryButton>
          </div>
          {error && <div style={{ marginBottom: '0.875rem' }}><ErrorAlert>{error}</ErrorAlert></div>}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by student name or reference code" />
            <SecondaryButton type="button" onClick={searchEnrollments} loading={searching}>Search</SecondaryButton>
          </div>
          {results.length > 0 && (
            <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {results.map((r) => (
                <div key={r.enrollmentId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', padding: '0.625rem 0.875rem', border: '1px solid var(--color-border)', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.875rem' }}>{r.label}</span>
                  <PrimaryButton type="button" size="sm" loading={matching} onClick={() => match(r.enrollmentId)}>Match</PrimaryButton>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}
