// Fuzzy name matching for "unexpected" Slack members (task: alt-email mapping).

import { describe, it, expect } from 'vitest'
import { nameSimilarity, fuzzyMatchUnexpected, type FuzzyMatchCandidate } from '@/lib/slack'

describe('nameSimilarity', () => {
  it('scores an exact match as 1', () => {
    expect(nameSimilarity('Jane Doe', 'jane doe')).toBe(1)
  })

  it('scores a close typo highly', () => {
    expect(nameSimilarity('Jonathan Smith', 'Jonathon Smith')).toBeGreaterThan(0.65)
  })

  it('does not score a shared surname alone as a match — different real people', () => {
    // The exact failure mode this design avoids: siblings, spouses, or a
    // parent/child sharing a last name are NOT the same person.
    expect(nameSimilarity('Arjun Dhillon', 'Robin Dhillon')).toBeLessThan(0.3)
    expect(nameSimilarity('Juan Chavez', 'Amity Chavez')).toBeLessThan(0.3)
  })

  it('scores reordered names highly (token overlap)', () => {
    expect(nameSimilarity('Smith, John', 'John Smith')).toBeGreaterThan(0.7)
  })

  it('scores unrelated names low', () => {
    expect(nameSimilarity('Jane Doe', 'Robert Chen')).toBeLessThan(0.3)
  })

  it('handles empty input without throwing', () => {
    expect(nameSimilarity('', 'Jane Doe')).toBe(0)
    expect(nameSimilarity('Jane Doe', '')).toBe(0)
  })
})

describe('fuzzyMatchUnexpected', () => {
  const candidates: FuzzyMatchCandidate[] = [
    { id: 'g1', name: 'Jane Doe', kind: 'guardian' },
    { id: 's1', name: 'Mia Doe', kind: 'student' },
  ]

  it('matches an unexpected Slack member to the closest-named candidate', () => {
    const matches = fuzzyMatchUnexpected(
      [{ email: 'jane.personal@gmail.com', slackUserId: 'U1', slackName: 'Jane Doe' }],
      candidates
    )
    expect(matches).toHaveLength(1)
    expect(matches[0].candidateId).toBe('g1')
    expect(matches[0].score).toBe(1)
  })

  it('does not propose a match below the threshold', () => {
    const matches = fuzzyMatchUnexpected(
      [{ email: 'stranger@ex.com', slackUserId: 'U2', slackName: 'Totally Unrelated Person' }],
      candidates
    )
    expect(matches).toEqual([])
  })

  it('picks the single best candidate when two are similar', () => {
    const matches = fuzzyMatchUnexpected(
      [{ email: 'j.doe@gmail.com', slackUserId: 'U3', slackName: 'J Doe' }],
      candidates
    )
    expect(matches).toHaveLength(1)
    expect(['g1', 's1']).toContain(matches[0].candidateId)
  })

  it('sorts multiple results by descending score', () => {
    const matches = fuzzyMatchUnexpected(
      [
        { email: 'a@ex.com', slackUserId: 'U4', slackName: 'Mia Doe' },
        { email: 'b@ex.com', slackUserId: 'U5', slackName: 'Jane Doe' },
      ],
      candidates
    )
    expect(matches.map((m) => m.slackUserId)).toEqual(['U4', 'U5'])
  })
})
