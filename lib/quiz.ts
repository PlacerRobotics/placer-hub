// Pure quiz grading — shared by the volunteer quiz route and unit tests.
// Single-answer scoring: a question is correct when the selected option index
// equals correct_answers[0]. (Seeded quizzes are all single_correct.)
export type GradeQuestion = { id: string; correct_answers: unknown }
export type GradeResult = {
  correct: number
  total: number
  fraction: number
  percent: number
  passed: boolean
  wrong: { id: string; correctIndex: number }[]
}

export function gradeQuiz(questions: GradeQuestion[], answers: Record<string, number>, passThreshold: number): GradeResult {
  let correct = 0
  const wrong: { id: string; correctIndex: number }[] = []
  for (const q of questions) {
    const ca = Array.isArray(q.correct_answers) ? q.correct_answers : []
    const correctIndex = Number(ca[0])
    if (answers[q.id] === correctIndex) correct++
    else wrong.push({ id: q.id, correctIndex })
  }
  const total = questions.length
  const fraction = total ? correct / total : 0
  return { correct, total, fraction, percent: Math.round(fraction * 100), passed: fraction >= passThreshold, wrong }
}
