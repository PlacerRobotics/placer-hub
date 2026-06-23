'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader, PrimaryButton, SecondaryButton, SuccessAlert, ErrorAlert } from '@/components/ui'

type Q = { id: string; question_text: string; options: string[] }
type Result = { score: number; passed: boolean; total: number; correct: number; wrong: { id: string; correctIndex: number }[] }

export default function QuizRunner({ type, title, passPercent, questions }: { type: string; title: string; passPercent: number; questions: Q[] }) {
  const router = useRouter()
  const [i, setI] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<Result | null>(null)

  if (!questions.length) return <PageHeader title={title} subtitle="This quiz has no questions yet — please check back." />

  const q = questions[i]
  const selected = answers[q?.id]
  const isLast = i === questions.length - 1

  async function submit() {
    if (busy) return
    setBusy(true); setError('')
    try {
      const res = await fetch(`/api/volunteer/quiz/${type}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers }) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setError(d.error || 'Could not submit.'); setBusy(false); return }
      setResult(d)
    } catch { setError('Network error — please try again.'); setBusy(false) }
  }

  function retake() { setResult(null); setAnswers({}); setI(0); setError('') }

  if (result) {
    const wrongById = new Map(result.wrong.map((w) => [w.id, w.correctIndex]))
    return (
      <>
        <PageHeader title={title} subtitle="Quiz results" />
        {result.passed ? (
          <SuccessAlert title={`You passed with ${result.score}%!`}>{result.correct} correct out of {result.total}. You can return to your portal — this step is now complete for the season.</SuccessAlert>
        ) : (
          <ErrorAlert title={`You scored ${result.score}%`}>You need {passPercent}% to pass. Review the questions you missed below, then retake the quiz.</ErrorAlert>
        )}
        {!result.passed && (
          <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {questions.filter((qq) => wrongById.has(qq.id)).map((qq) => {
              const ci = wrongById.get(qq.id)!
              return (
                <div key={qq.id} style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: '0.875rem' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{qq.question_text}</div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: 4 }}>Your answer: {answers[qq.id] != null ? qq.options[answers[qq.id]] : '—'}</div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--color-success)', marginTop: 2 }}>Correct: {qq.options[ci]}</div>
                </div>
              )
            })}
          </div>
        )}
        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem' }}>
          {result.passed ? <PrimaryButton onClick={() => router.push('/volunteer')}>Back to portal</PrimaryButton> : <PrimaryButton onClick={retake}>Retake quiz</PrimaryButton>}
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader title={title} subtitle={`Question ${i + 1} of ${questions.length} · ${passPercent}% to pass · You can’t go back, so choose carefully.`} />
      {error && <div style={{ marginBottom: '1rem' }}><ErrorAlert title="Error">{error}</ErrorAlert></div>}
      <div style={{ border: '1px solid var(--color-border)', borderRadius: 10, padding: '1.25rem 1.5rem' }}>
        <div style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '1rem' }}>{q.question_text}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {q.options.map((opt, idx) => (
            <label key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.625rem 0.875rem', border: `1.5px solid ${selected === idx ? 'var(--color-navy-deep)' : 'var(--color-border)'}`, borderRadius: 8, cursor: 'pointer', background: selected === idx ? 'var(--color-surface-alt, #f4f6fb)' : 'transparent' }}>
              <input type="radio" name={q.id} checked={selected === idx} onChange={() => setAnswers((a) => ({ ...a, [q.id]: idx }))} />
              <span style={{ fontSize: '0.9375rem' }}>{opt}</span>
            </label>
          ))}
        </div>
      </div>
      <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
        {isLast ? (
          <PrimaryButton onClick={submit} loading={busy} disabled={selected == null}>Submit quiz</PrimaryButton>
        ) : (
          <SecondaryButton onClick={() => setI((n) => n + 1)} disabled={selected == null}>Next →</SecondaryButton>
        )}
      </div>
    </>
  )
}
