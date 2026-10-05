import { describe, expect, it } from 'vitest'
import { initialAnswers, isAnswered, normalizeSubmission, validateQuestions } from './assessment'
import type { AssessmentQuestion } from '../types/assessment'

const quiz: AssessmentQuestion = { id: 'quiz', kind: 'multiple_choice', prompt: 'What is True?', points: 2, options: ['Boolean', 'String'] }
const code: AssessmentQuestion = { id: 'code', kind: 'python', prompt: 'Print a name', points: 8, starter_code: '' }
describe('combined assessment answers', () => {
  it('accepts the first choice and rejects out-of-range choices', () => {
    expect(isAnswered(quiz, { quiz: { choice: 0 } })).toBe(true)
    expect(isAnswered(quiz, { quiz: { choice: 2 } })).toBe(false)
    expect(isAnswered(quiz, {})).toBe(false)
  })
  it('requires actual code or text', () => {
    expect(isAnswered(code, { code: { code: '  \n' } })).toBe(false)
    expect(isAnswered(code, { code: { code: 'print("Bao")' } })).toBe(true)
    expect(initialAnswers([code])).toEqual({ code: { code: '', input: '' } })
  })
  it('requires a valid quiz answer key before a teacher can save', () => {
    expect(validateQuestions([quiz], {})).not.toBeNull()
    expect(validateQuestions([quiz, code], { quiz: 0 })).toBeNull()
    expect(validateQuestions([{ ...quiz, points: -1 }], { quiz: 0 })).not.toBeNull()
  })
  it('reads a PostgREST one-to-one review as one graded submission', () => {
    const review = { manual_score: 8, feedback: 'Good work' }
    expect(normalizeSubmission({ cs_assessment_reviews: review }).cs_assessment_reviews).toEqual([review])
    expect(normalizeSubmission({ cs_assessment_reviews: null }).cs_assessment_reviews).toEqual([])
    expect(normalizeSubmission({ cs_assessment_reviews: [review] }).cs_assessment_reviews).toEqual([review])
  })
})
