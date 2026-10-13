import { describe, expect, it, vi } from 'vitest'
vi.mock('../lib/supabase/client', () => ({ supabase: {} }))
import { assertMatchingAssessment, IMPORT_COURSE_ID, IMPORT_COURSE_TITLE, parseMidtermImport } from './midtermImport'

function fixture() {
  const quiz = (prefix: string, count: number) => Array.from({ length: count }, (_, i) => ({ id: `${prefix}-${i}`, kind: 'multiple_choice', prompt: 'Synthetic test question', options: ['One', 'Two', 'Three', 'Four'], points: 5, required: true, answer_key_letter: String.fromCharCode(65 + i % 4), teacher_expected: 'PRIVATE TEST NOTE' }))
  return { target_course_id: IMPORT_COURSE_ID, target_course: IMPORT_COURSE_TITLE, status: 'draft', days: {
    monday: { title: 'Monday', quiz: quiz('m', 10) },
    tuesday: { title: 'Tuesday — 40-minute Mock Midterm', quiz: quiz('t', 14), coding_question: { id: 't-code', kind: 'python', prompt: 'Synthetic coding task', starter_code: '# Start', points: 30, required: true, teacher_expected: { synthetic_total: 123456789 }, manual_rubric: { algorithm: 30 } } },
    wednesday: { title: 'Wednesday — Optional Warm-Up', quiz: quiz('w', 6), coding_question: { id: 'w-code', kind: 'python', prompt: 'Optional test task', starter_code: '# Start', points: 0, required: false, teacher_expected: { synthetic_total: 987654321 } } },
  } }
}
describe('teacher midterm JSON import validation', () => {
  it('validates all 30 keys, converts A-D, and creates only Tuesday/Wednesday with correct totals', () => {
    const pack = parseMidtermImport(fixture(), IMPORT_COURSE_ID)
    expect(pack.mcqCount).toBe(30)
    expect(pack.days.map(d => d.day)).toEqual(['tuesday', 'wednesday'])
    expect(pack.days[0]!.questions.reduce((sum, q) => sum + q.points, 0)).toBe(100)
    expect(pack.days[0]!.keys['t-3']).toBe(3)
    expect(pack.days[1]!.questions.at(-1)).toMatchObject({ kind: 'python', required: false, points: 0 })
  })
  it('strips private and unexpected fields from student-readable questions, preserving protected notes separately', () => {
    const pack = parseMidtermImport(fixture(), IMPORT_COURSE_ID)
    const publicContent = JSON.stringify(pack.days.map(d => d.questions))
    for (const secret of ['answer_key_letter', 'teacher_expected', 'manual_rubric', '123456789', 'PRIVATE TEST NOTE']) expect(publicContent).not.toContain(secret)
    expect(pack.days[0]!.feedback['t-code']).toEqual({ teacher_expected: { synthetic_total: 123456789 }, manual_rubric: { algorithm: 30 } })
  })
  it('rejects wrong course, malformed keys, duplicate IDs, missing questions, and incorrect rubric totals before writes', () => {
    expect(() => parseMidtermImport(fixture(), 'other-course')).toThrow('existing High School')
    const badKey = fixture(); badKey.days.monday.quiz[0]!.answer_key_letter = 'E'
    expect(() => parseMidtermImport(badKey, IMPORT_COURSE_ID)).toThrow('A, B, C, or D')
    const duplicate = fixture(); duplicate.days.tuesday.quiz[1]!.id = duplicate.days.tuesday.quiz[0]!.id
    expect(() => parseMidtermImport(duplicate, IMPORT_COURSE_ID)).toThrow('duplicate')
    const missing = fixture(); missing.days.wednesday.quiz.pop()
    expect(() => parseMidtermImport(missing, IMPORT_COURSE_ID)).toThrow('expected 6')
    const rubric = fixture(); rubric.days.tuesday.coding_question.manual_rubric.algorithm = 29
    expect(() => parseMidtermImport(rubric, IMPORT_COURSE_ID)).toThrow('total 30')
  })
  it('accepts identical existing questions but rejects altered IDs/content for idempotent imports', () => {
    const day = parseMidtermImport(fixture(), IMPORT_COURSE_ID).days[0]!
    expect(() => assertMatchingAssessment({ questions: structuredClone(day.questions) }, day)).not.toThrow()
    const changed = structuredClone(day.questions); changed[0]!.id = 'different-id'
    expect(() => assertMatchingAssessment({ questions: changed }, day)).toThrow('different questions')
  })
})
