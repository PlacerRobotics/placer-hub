import { describe, it, expect } from 'vitest'
import { gradeQuiz, type GradeQuestion } from '@/lib/quiz'

function makeQuestions(n: number): GradeQuestion[] {
  return Array.from({ length: n }, (_, i) => ({ id: `q${i}`, correct_answers: [0] }))
}
// First `nCorrect` answered correctly (index 0), the rest wrong (index 1).
function answer(qs: GradeQuestion[], nCorrect: number): Record<string, number> {
  const a: Record<string, number> = {}
  qs.forEach((q, i) => { a[q.id] = i < nCorrect ? 0 : 1 })
  return a
}

describe('gradeQuiz — RC (42 questions, 90% to pass)', () => {
  it('42/42 = 100% = pass', () => {
    const qs = makeQuestions(42)
    const r = gradeQuiz(qs, answer(qs, 42), 0.9)
    expect(r.correct).toBe(42)
    expect(r.percent).toBe(100)
    expect(r.passed).toBe(true)
  })
  it('38/42 (90.5%) = pass', () => {
    const qs = makeQuestions(42)
    const r = gradeQuiz(qs, answer(qs, 38), 0.9)
    expect(r.correct).toBe(38)
    expect(r.passed).toBe(true)
  })
  it('37/42 (88.1%) = fail', () => {
    const qs = makeQuestions(42)
    const r = gradeQuiz(qs, answer(qs, 37), 0.9)
    expect(r.correct).toBe(37)
    expect(r.passed).toBe(false)
  })
  it('records each wrong answer with its correct index', () => {
    const qs = makeQuestions(42)
    const r = gradeQuiz(qs, answer(qs, 40), 0.9)
    expect(r.wrong).toHaveLength(2)
    expect(r.wrong[0].correctIndex).toBe(0)
  })
})

describe('gradeQuiz — YP (16 questions, 90% to pass)', () => {
  it('16/16 = pass', () => {
    const qs = makeQuestions(16)
    expect(gradeQuiz(qs, answer(qs, 16), 0.9).passed).toBe(true)
  })
  it('15/16 (93.75%) = pass', () => {
    const qs = makeQuestions(16)
    expect(gradeQuiz(qs, answer(qs, 15), 0.9).passed).toBe(true)
  })
  it('14/16 (87.5%) = fail', () => {
    const qs = makeQuestions(16)
    expect(gradeQuiz(qs, answer(qs, 14), 0.9).passed).toBe(false)
  })
})
