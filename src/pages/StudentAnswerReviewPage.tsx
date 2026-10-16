import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, LockKeyhole } from 'lucide-react'
import { supabase } from '../lib/supabase/client'

type AnswerItem = {
  number: number
  id: string
  kind: string
  points: number
  prompt: string
  options: string[]
  student_choice: number | null
  correct_choice: number | null
  student_code: string | null
  explanation: string
  reference_code: string | null
}
type Review = {
  available: boolean
  reason?: string
  title?: string
  quiz_score?: number
  quiz_max_score?: number
  manual_score?: number | null
  manual_max_score?: number
  teacher_feedback?: string
  questions?: AnswerItem[]
}
export function StudentAnswerReviewPage() {
  const { assessmentId } = useParams()
  const [review, setReview] = useState<Review | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data, error } = await supabase.rpc('cs_get_student_answer_review', {
        p_assessment_id: assessmentId,
      })
      if (!cancelled) {
        setError(error?.message ?? '')
        setReview((data as Review | null) ?? null)
        setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [assessmentId])
  const blocked: Record<string, string> = {
    not_submitted: 'Your submission has not been received yet.',
    not_released: 'Your teacher has not released the answer key yet.',
    awaiting_grading: 'The programming task is still being graded.',
    missing_key: 'The answer key is being prepared. Please check again later.',
  }
  if (loading) return <main className="page" role="status">Loading your answer review…</main>
  return <main className="page assessment-page">
    <Link className="back" to={`/assessments/${assessmentId}`}><ArrowLeft size={16}/> Back to submission</Link>
    <div className="page-heading"><div><p className="eyebrow">YOUR PRIVATE EXAM REVIEW</p><h1>{review?.title ?? 'Answer Key & Explanations'}</h1><p>Only your own submitted work is shown here.</p></div></div>
    {error && <p className="alert" role="alert">{error}</p>}
    {!error && !review?.available && <section className="panel"><LockKeyhole size={22}/><h2>Review not available yet</h2><p>{blocked[review?.reason ?? ''] ?? 'Please check again after your teacher releases the results.'}</p></section>}
    {review?.available && <>
      <section className="assessment-success"><CheckCircle2/><div><h2>Answer key released</h2>
        <p>Multiple choice: {review.quiz_score}/{review.quiz_max_score} points.</p>
        {review.manual_score !== null && <p>Programming: {review.manual_score}/{review.manual_max_score} points.</p>}
        {review.teacher_feedback && <p><strong>Teacher feedback:</strong> {review.teacher_feedback}</p>}
      </div></section>
      {review.questions?.map(q => <section className="panel assessment-question" key={q.id}>
        <div className="question-header"><h2>Question {q.number}</h2><strong>{q.points} points</strong></div>
        <p className="question-prompt" style={{ whiteSpace: 'pre-wrap' }}>{q.prompt}</p>
        {q.kind === 'multiple_choice' ? <>
          <p><strong>Your answer:</strong> {q.student_choice === null ? 'Not answered' : q.options[q.student_choice]}</p>
          <p><strong>Correct answer:</strong> {q.correct_choice === null ? 'Not available' : q.options[q.correct_choice]}</p>
        </> : q.kind === 'python' ? <>
          <h3>Your submitted code</h3><pre className="review-code">{q.student_code ?? 'No code submitted'}</pre>
          {q.reference_code && <><h3>Reference solution</h3><pre className="review-code">{q.reference_code}</pre></>}
        </> : null}
        {q.explanation && <p><strong>Explanation:</strong> {q.explanation}</p>}
      </section>)}
    </>}
  </main>
}
