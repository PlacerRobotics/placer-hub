import { describe, it, expect } from 'vitest'
import { expiryFromComplete, pickTraining, needsApsRenewal, type ApsTraining } from '@/lib/aps'

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

describe('needsApsRenewal (bulk enrollment eligibility, task 1.10)', () => {
  const SEASON_END = '2027-05-31'
  it('cert expiring before season end → needs renewal (Terry: 2026-10-06)', () => {
    expect(needsApsRenewal({ status: 'cleared', latestExpiry: '2026-10-06' }, SEASON_END)).toBe(true)
  })
  it('cert valid through season end → no renewal', () => {
    expect(needsApsRenewal({ status: 'cleared', latestExpiry: '2027-05-31' }, SEASON_END)).toBe(false)
    expect(needsApsRenewal({ status: 'cleared', latestExpiry: '2027-09-01' }, SEASON_END)).toBe(false)
  })
  it('no cert at all → needs enrollment (covers never-enrolled volunteers)', () => {
    expect(needsApsRenewal({ status: 'in_progress', latestExpiry: null }, SEASON_END)).toBe(true)
    expect(needsApsRenewal({ status: 'pending', latestExpiry: null }, SEASON_END)).toBe(true)
  })
  it('admin-closed profiles are never bulk-enrolled', () => {
    for (const status of ['denied', 'deactivated', 'suspended', 'withdrawn']) {
      expect(needsApsRenewal({ status, latestExpiry: null }, SEASON_END)).toBe(false)
      expect(needsApsRenewal({ status, latestExpiry: '2026-10-06' }, SEASON_END)).toBe(false)
    }
  })
})
