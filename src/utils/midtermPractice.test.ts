import { describe, expect, it } from 'vitest'
import { MIDTERM_LESSON_TITLE, MIDTERM_QUESTIONS, OPTIONAL_MIDTERM_PRACTICE } from './midtermPractice'

describe('Monday midterm practice package', () => {
  it('keeps quiz feedback public but does not put answer-key fields in question data', () => {
    const quiz = MIDTERM_QUESTIONS.filter(question => question.kind === 'multiple_choice')
    expect(quiz).toHaveLength(5)
    expect(quiz.every(question => question.options?.length === 4)).toBe(true)
    expect(quiz.every(question => !('correct_choice' in question) && !('answer' in question) && !('feedback' in question))).toBe(true)
  })

  it('has required Quick Check, Trace, Debug, and Build plus a zero-point optional reflection', () => {
    expect(MIDTERM_LESSON_TITLE).toBe('Monday — Python Exam Readiness')
    expect(MIDTERM_QUESTIONS.filter(question => question.required !== false)).toHaveLength(9)
    const reflection = MIDTERM_QUESTIONS.find(question => question.id === 'midterm-reflection')!
    expect(reflection.required).toBe(false)
    expect(reflection.points).toBe(0)
  })

  it('provides the five optional coding activities and one function challenge', () => {
    expect(OPTIONAL_MIDTERM_PRACTICE).toHaveLength(6)
    expect(OPTIONAL_MIDTERM_PRACTICE.slice(0, 5).map(activity => activity.title)).toEqual([
      'Practice 1 — Study Hours',
      'Practice 2 — range()',
      'Practice 3 — Countdown',
      'Practice 4 — Counter and Accumulator',
      'Practice 5 — Running Largest',
    ])
    expect(OPTIONAL_MIDTERM_PRACTICE.every(activity => !('expected_output' in activity))).toBe(true)
  })
})
