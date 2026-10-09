import type { AssessmentAnswers, AssessmentQuestion, AssessmentReview, AssessmentSubmission } from '../types/assessment'

// PostgREST embeds a unique one-to-one relation as an object rather than an array.
export function normalizeSubmission(value: unknown): AssessmentSubmission {
  const row = value as Omit<AssessmentSubmission, 'cs_assessment_reviews'> & { cs_assessment_reviews?: AssessmentReview | AssessmentReview[] | null }
  return { ...row, cs_assessment_reviews: Array.isArray(row.cs_assessment_reviews) ? row.cs_assessment_reviews : row.cs_assessment_reviews ? [row.cs_assessment_reviews] : [] }
}

export function isAnswered(question: AssessmentQuestion, answers: AssessmentAnswers) {
  const answer = answers[question.id]
  if (question.kind === 'multiple_choice') return Number.isInteger(answer?.choice) && answer!.choice! >= 0 && answer!.choice! < (question.options?.length ?? 0)
  return Boolean((question.kind === 'python' ? answer?.code : answer?.text)?.trim())
}

export function initialAnswers(questions: AssessmentQuestion[]): AssessmentAnswers {
  return Object.fromEntries(questions.map(q => [q.id, q.kind === 'python' ? { code: q.starter_code ?? '', input: '' } : {}]))
}

export function validateQuestions(questions: AssessmentQuestion[], keys: Record<string, number>) {
  if (!questions.length) return 'Add at least one question.'
  for (const [index, q] of questions.entries()) {
    if (!q.prompt.trim()) return `Question ${index + 1}: enter a question prompt.`
    if (!Number.isInteger(q.points) || q.points < 1 || q.points > 100) return `Question ${index + 1}: points must be an integer from 1 to 100.`
    if (q.kind === 'multiple_choice' && (!q.options || q.options.length < 2 || q.options.some(o => !o.trim()) || !Number.isInteger(keys[q.id]) || keys[q.id]! < 0 || keys[q.id]! >= q.options.length)) return `Question ${index + 1}: fill in the options and select the correct answer.`
  }
  return null
}

export function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString('en-GB') : 'No due date'
}
