import { supabase } from '../lib/supabase/client'
import type { AssessmentQuestion } from '../types/assessment'
import { validateQuestions } from './assessment'
import { MIDTERM_ASSESSMENT_TITLE, MIDTERM_LESSON_TITLE, MIDTERM_MODULE_TITLE } from './midtermPractice'

export const IMPORT_COURSE_ID = 'ac79bd77-11c1-4bb0-bcfc-21bef4484785'
export const IMPORT_COURSE_TITLE = 'Computer Science Foundations — High School (Grades 11–12)'
type Row = Record<string, unknown>
type Day = 'tuesday' | 'wednesday'
export type ImportDay = {
  day: Day; lessonTitle: string; assessmentTitle: string; instructions: string
  questions: AssessmentQuestion[]; keys: Record<string, number>; feedback: Row
}
export type ImportPackage = { days: ImportDay[]; mcqCount: number }
export type ImportPreview = { day: string; title: string; action: string; assessmentId?: string; status?: string }

function object(value: unknown, label: string): Row {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`)
  return value as Row
}
function text(value: unknown, label: string, limit = 20000): string {
  if (typeof value !== 'string' || !value.trim() || value.length > limit) throw new Error(`${label} is missing or too long.`)
  return value
}
function same(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((item, i) => same(item, b[i]))
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const left = Object.keys(a).sort(); const right = Object.keys(b).sort()
    return same(left, right) && left.every(key => same((a as Row)[key], (b as Row)[key]))
  }
  return a === b
}

/** Only explicit student-safe fields survive this conversion. Never spread uploaded questions. */
export function parseMidtermImport(value: unknown, courseId: string): ImportPackage {
  const root = object(value, 'File')
  if (courseId !== IMPORT_COURSE_ID || root.target_course_id !== courseId || root.target_course !== IMPORT_COURSE_TITLE) throw new Error('This file belongs to the existing High School (Grades 11–12) course.')
  if (root.status !== 'draft') throw new Error('The import file must specify draft status.')
  const sourceDays = object(root.days, 'Days'); const days: ImportDay[] = []
  let mcqCount = 0
  for (const [day, count] of [['monday', 10], ['tuesday', 14], ['wednesday', 6]] as const) {
    const source = object(sourceDays[day], day)
    if (!Array.isArray(source.quiz) || source.quiz.length !== count) throw new Error(`${day}: expected ${count} multiple-choice questions.`)
    const keys: Record<string, number> = {}; const ids = new Set<string>()
    const questions: AssessmentQuestion[] = source.quiz.map((raw, index) => {
      const q = object(raw, `${day} question ${index + 1}`)
      const id = text(q.id, 'Question ID', 100)
      if (ids.has(id) || q.kind !== 'multiple_choice' || q.points !== 5 || q.required !== true) throw new Error(`${day}: invalid or duplicate question ${id}.`)
      ids.add(id)
      if (!Array.isArray(q.options) || q.options.length !== 4) throw new Error(`${id}: four answer choices are required.`)
      const letter = text(q.answer_key_letter, `${id} answer key`, 1)
      if (!/^[A-D]$/.test(letter)) throw new Error(`${id}: answer key must be A, B, C, or D.`)
      keys[id] = letter.charCodeAt(0) - 65
      return { id, kind: 'multiple_choice', prompt: text(q.prompt, `${id} prompt`), options: q.options.map(v => text(v, `${id} option`, 2000)), points: 5, required: true }
    })
    mcqCount += count
    const feedback: Row = {}
    if (day !== 'monday') {
      const q = object(source.coding_question, `${day} coding question`)
      const id = text(q.id, 'Coding question ID', 100)
      const required = day === 'tuesday'; const points = required ? 30 : 0
      if (ids.has(id) || q.kind !== 'python' || q.points !== points || q.required !== required) throw new Error(`${day}: coding question must be ${required ? 'required and worth 30 points' : 'optional and worth zero points'}.`)
      const expected = object(q.teacher_expected, `${id} teacher expectations`)
      if (!Object.keys(expected).length || Object.values(expected).some(n => typeof n !== 'number' || !Number.isFinite(n))) throw new Error(`${id}: invalid teacher expectations.`)
      const privateNotes: Row = { teacher_expected: expected }
      if (required) {
        const rubric = object(q.manual_rubric, `${id} rubric`)
        const scores = Object.values(rubric)
        if (scores.some(n => typeof n !== 'number' || !Number.isInteger(n) || n < 0) || scores.reduce<number>((total, n) => total + Number(n), 0) !== 30) throw new Error('Tuesday coding rubric must total 30 points.')
        privateNotes.manual_rubric = rubric
      }
      feedback[id] = privateNotes
      questions.push({ id, kind: 'python', prompt: text(q.prompt, `${id} prompt`), starter_code: text(q.starter_code, `${id} starter code`), points, required })
      days.push({ day, lessonTitle: text(source.title, `${day} lesson title`, 160), assessmentTitle: day === 'tuesday' ? 'Tuesday Mock Midterm — October 13, 2026' : 'Wednesday Optional Warm-Up — October 14, 2026', instructions: day === 'tuesday' ? 'Formative practice only. Allow 40 minutes. Complete 14 multiple-choice questions (70 points) and the Python programming task (30 points). This is not the official midterm examination.' : 'OPTIONAL formative warm-up. This is not part of the official midterm examination. Complete the six quiz questions if you choose to participate. The Python task is optional and worth zero points.', questions, keys, feedback })
    }
    const problem = validateQuestions(questions, keys)
    if (problem) throw new Error(`${day}: ${problem}`)
  }
  if (days[0]?.lessonTitle !== 'Tuesday — 40-minute Mock Midterm' || days[1]?.lessonTitle !== 'Wednesday — Optional Warm-Up') throw new Error('Tuesday/Wednesday lesson titles do not match the practice package.')
  return { days, mcqCount }
}

function check(result: { error: { message: string } | null }, stage: string) {
  if (result.error) throw new Error(`${stage}: ${result.error.message}`)
}
async function lookup(table: 'cs_modules' | 'cs_lessons' | 'cs_assessments', column: string, id: string, title: string) {
  const result = await supabase.from(table).select('*').eq(column, id).eq('title', title).maybeSingle()
  check(result, `Find ${title}`)
  return result.data as Row | null
}
async function authorize(courseId: string) {
  const auth = await supabase.auth.getUser(); check(auth, 'Verify teacher session')
  if (!auth.data.user) throw new Error('Sign in as the course teacher before importing.')
  const [profile, course] = await Promise.all([supabase.from('cs_profiles').select('role').eq('id', auth.data.user.id).single(), supabase.from('cs_courses').select('id,title,teacher_id').eq('id', courseId).single()])
  check(profile, 'Verify teacher role'); check(course, 'Verify target course')
  if (!course.data || !profile.data || courseId !== IMPORT_COURSE_ID || course.data.title !== IMPORT_COURSE_TITLE || !['teacher', 'admin'].includes(profile.data.role) || (profile.data.role !== 'admin' && course.data.teacher_id !== auth.data.user.id)) throw new Error('Only the owner teacher or an administrator can import into this High School course.')
}
export function assertMatchingAssessment(existing: Row, day: ImportDay) {
  if (!same(existing.questions, day.questions)) throw new Error(`${day.assessmentTitle} already exists with different questions. Existing content was preserved.`)
}
async function inspect(courseId: string, pack: ImportPackage) {
  await authorize(courseId)
  const module = await lookup('cs_modules', 'course_id', courseId, MIDTERM_MODULE_TITLE)
  const monday = await lookup('cs_assessments', 'course_id', courseId, MIDTERM_ASSESSMENT_TITLE)
  const lesson = module ? await lookup('cs_lessons', 'module_id', String(module.id), MIDTERM_LESSON_TITLE) : null
  if (!monday || !lesson || lesson.assessment_id !== monday.id || !Array.isArray(monday.questions) || monday.questions.length !== 10) throw new Error('The existing Monday lesson and linked 10-question assessment could not be verified. Install/restore Monday first; this importer will not replace it.')
  const activities = await supabase.from('cs_activities').select('id', { count: 'exact', head: true }).eq('lesson_id', String(lesson.id))
  check(activities, 'Verify Monday activities')
  if (activities.count !== 6) throw new Error('Monday should have six existing coding activities. Import stopped without replacing Monday.')
  const rows = []
  for (const day of pack.days) {
    const assessment = await lookup('cs_assessments', 'course_id', courseId, day.assessmentTitle)
    const existingLesson = module ? await lookup('cs_lessons', 'module_id', String(module.id), day.lessonTitle) : null
    if (assessment) {
      assertMatchingAssessment(assessment, day)
      const saved = await supabase.from('cs_assessment_keys').select('answers,feedback').eq('assessment_id', String(assessment.id)).maybeSingle()
      check(saved, 'Check protected teacher notes')
      if (saved.data && (!same(saved.data.answers, day.keys) || !same(saved.data.feedback, day.feedback))) throw new Error(`${day.assessmentTitle} has different protected keys or rubric. Import stopped.`)
      if (!saved.data && assessment.status !== 'draft') throw new Error(`${day.assessmentTitle} is assigned but has no matching protected keys. Import stopped.`)
    }
    if (existingLesson && existingLesson.assessment_id !== assessment?.id) throw new Error(`${day.lessonTitle} already exists with a different assessment link. Import stopped.`)
    rows.push({ day, assessment, lesson: existingLesson })
  }
  return { module, monday, rows }
}
export async function previewMidtermImport(courseId: string, pack: ImportPackage): Promise<ImportPreview[]> {
  const current = await inspect(courseId, pack)
  return [{ day: 'monday', title: MIDTERM_LESSON_TITLE, action: 'Already installed — preserve assessment and six activities', assessmentId: String(current.monday.id), status: String(current.monday.status) }, ...current.rows.map(row => ({ day: row.day.day, title: row.day.lessonTitle, action: row.assessment && row.lesson ? 'Already installed — verify and reuse' : row.assessment ? 'Reuse matching assessment; complete lesson link' : 'Create lesson and draft assessment', assessmentId: row.assessment ? String(row.assessment.id) : undefined, status: row.assessment ? String(row.assessment.status) : 'draft' }))]
}
/** Uses only the caller's browser session. Partial imports resume without overwriting existing records. */
export async function importMidtermPractice(courseId: string, pack: ImportPackage): Promise<ImportPreview[]> {
  const current = await inspect(courseId, pack)
  const moduleId = String(current.module!.id)
  const positions = await supabase.from('cs_lessons').select('position').eq('module_id', moduleId)
  check(positions, 'Read lesson positions')
  let position = Math.max(-1, ...(positions.data ?? []).map(row => Number(row.position))) + 1
  const results: ImportPreview[] = [{ day: 'monday', title: MIDTERM_LESSON_TITLE, action: 'Already installed — preserved', assessmentId: String(current.monday.id), status: String(current.monday.status) }]
  for (const row of current.rows) {
    let assessment = row.assessment
    if (!assessment) {
      const created = await supabase.from('cs_assessments').insert({ course_id: courseId, title: row.day.assessmentTitle, instructions: row.day.instructions, questions: row.day.questions, status: 'draft', due_at: null }).select('*').single()
      check(created, `Create ${row.day.assessmentTitle}`); assessment = created.data as Row
    }
    const id = String(assessment.id)
    const saved = await supabase.from('cs_assessment_keys').select('answers,feedback').eq('assessment_id', id).maybeSingle()
    check(saved, 'Read protected keys')
    if (!saved.data) {
      if (assessment.status !== 'draft') throw new Error('Only a draft can receive protected keys.')
      const keys = await supabase.from('cs_assessment_keys').insert({ assessment_id: id, answers: row.day.keys, feedback: row.day.feedback })
      check(keys, 'Save protected keys and teacher rubric')
    } else if (!same(saved.data.answers, row.day.keys) || !same(saved.data.feedback, row.day.feedback)) throw new Error('Protected keys changed since preview. Import stopped.')
    if (!row.lesson) {
      const created = await supabase.from('cs_lessons').insert({ module_id: moduleId, title: row.day.lessonTitle, introduction: row.day.instructions, learning_objectives: ['Practise Python variables, conditions, loops, lists, and functions.'], vocabulary: [], position: position++, status: 'published', assessment_id: id }).select('id').single()
      check(created, `Link ${row.day.lessonTitle}`)
    }
    results.push({ day: row.day.day, title: row.day.assessmentTitle, action: row.assessment && row.lesson ? 'Already installed — preserved' : 'Imported — review before assigning', assessmentId: id, status: String(assessment.status) })
  }
  await previewMidtermImport(courseId, pack)
  return results
}
