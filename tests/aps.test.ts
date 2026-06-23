import { describe, it, expect } from 'vitest'
import { expiryFromComplete, pickTraining, type ApsTraining } from '@/lib/aps'

describe('expiryFromComplete (2-year validity)', () => {
  it('adds two years to the completion date', () => {
    expect(expiryFromComplete('2025-09-01')).toBe('2027-09-01')
  })
})

describe('pickTraining', () => {
  const trainings: ApsTraining[] = [
    { winner: true, complete_date: '2024-01-01', survey_code: 'OLD' },
    { winner: true, complete_date: '2025-09-01', survey_code: 'MR' },
    { winner: false, complete_date: '2026-01-01', survey_code: 'MR' }, // not completed
  ]
  it('picks the most recently completed training', () => {
    expect(pickTraining(trainings)?.complete_date).toBe('2025-09-01')
  })
  it('filters to a specific survey code when given', () => {
    expect(pickTraining(trainings, 'OLD')?.complete_date).toBe('2024-01-01')
  })
  it('returns null when nothing is completed', () => {
    expect(pickTraining([{ winner: false, complete_date: '2025-01-01' }])).toBeNull()
  })
})
