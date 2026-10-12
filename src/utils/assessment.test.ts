import { describe, expect, it } from 'vitest'
import { formatDate, initialAnswers, isAnswered, normalizeSubmission, validateQuestions } from './assessment'
import type { AssessmentQuestion } from '../types/assessment'

const quiz: AssessmentQuestion = { id: 'quiz', kind: 'multiple_choice', prompt: 'What is True?', points: 2, options: ['Boolean', 'String'] }
const code: AssessmentQuestion = { id: 'code', kind: 'python', prompt: 'Print a name', points: 8, starter_code: '' }
describe('combined assessment answers', () => {
  it('uses English validation and due-date labels', () => {
    expect(validateQuestions([], {})).toBe('Add at least one question.')
    expect(validateQuestions([quiz], {})).toBe('Question 1: fill in the options and select the correct answer.')
    expect(formatDate(null)).toBe('No due date')
  })
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
  it('does not count untouched starter code as a completed programming answer', () => {
    const starter = { ...code, starter_code: 'print("edit me")\n' }
    expect(isAnswered(starter, initialAnswers([starter]))).toBe(false)
    expect(isAnswered(starter, { code: { code: 'print("my answer")' } })).toBe(true)
  })
  it('allows an unanswered zero-point optional reflection without changing the required-answer check', () => {
    const reflection: AssessmentQuestion = { id: 'reflection', kind: 'short_answer', prompt: 'Reflect', points: 0, required: false }
    expect(isAnswered(reflection, {})).toBe(false)
    expect(validateQuestions([quiz, reflection], { quiz: 0 })).toBeNull()
    expect(validateQuestions([{ ...reflection, required: true }], {})).toContain('points')
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
