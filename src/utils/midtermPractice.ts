import { supabase } from '../lib/supabase/client'
import type { AssessmentQuestion } from '../types/assessment'

export const MIDTERM_MODULE_TITLE = 'Midterm Review'
export const MIDTERM_LESSON_TITLE = 'Monday — Python Exam Readiness'
export const MIDTERM_ASSESSMENT_TITLE = 'Monday Midterm Practice — October 12, 2026'
export const MIDTERM_LESSON_INTRODUCTION = 'Monday, October 12, 2026 · 50 minutes total, including teacher guidance · 30–35 minutes of independent work. Work through Quick Check, Trace, Debug, Build, and Reflection. Finish the required practice before the optional challenge activities.'
export const MIDTERM_OBJECTIVES = [
  'By the end of this lesson, you should be able to predict Python output, trace changes in variables, correct a loop, and write a simple program using lists, conditions, and loops.',
]

export const MIDTERM_QUESTIONS: AssessmentQuestion[] = [
  {
    id: 'quick-variables', kind: 'multiple_choice', points: 2, required: true,
    prompt: 'QUICK CHECK 1 — Variables\n\n```python\nx = 4\nx = x + 3\nprint(x)\n```\n\nWhat is printed?',
    options: ['4', '7', '3', '43'],
  },
  {
    id: 'quick-input-conversion', kind: 'multiple_choice', points: 2, required: true,
    prompt: 'QUICK CHECK 2 — Input and conversion\n\n```python\nage = int(input("Age: "))\nprint(age + 1)\n```\n\nIf the user enters 12, what is printed?',
    options: ['12', '121', '13', 'An input error'],
  },
  {
    id: 'quick-conditions', kind: 'multiple_choice', points: 2, required: true,
    prompt: 'QUICK CHECK 3 — Conditions\n\n```python\nhours = 4\n\nif hours >= 6:\n    print("Full")\nelif hours >= 3:\n    print("Partial")\nelse:\n    print("None")\n```\n\nWhat is printed?',
    options: ['Full', 'Partial', 'None', 'Full and Partial'],
  },
  {
    id: 'quick-range', kind: 'multiple_choice', points: 2, required: true,
    prompt: 'QUICK CHECK 4 — range()\n\n```python\nfor n in range(3, 10, 3):\n    print(n)\n```\n\nWhat is the complete output? Choose the option with each value on its own line.',
    options: ['3\n6\n9', '3\n6\n9\n10', '3\n6', '3\n4\n5\n6\n7\n8\n9'],
  },
  {
    id: 'quick-functions', kind: 'multiple_choice', points: 2, required: true,
    prompt: 'QUICK CHECK 5 — Functions\n\n```python\ndef triple(number):\n    return number * 3\n\nprint(triple(4))\n```\n\nWhat is printed?',
    options: ['7', '12', '64', '4'],
  },
  {
    id: 'trace-list', kind: 'short_answer', points: 6, required: true,
    prompt: 'TRACE — Complete the table after each loop pass, then explain what count represents.\n\n```python\nnumbers = [5, 2, 8]\n\ntotal = 0\ncount = 0\n\nfor number in numbers:\n    total += number\n\n    if number > 4:\n        count += 1\n\nprint(total)\nprint(count)\n```\n\n| Current number | total | count |\n| --- | ---: | ---: |\n| Start | 0 | 0 |\n| 5 | ? | ? |\n| 2 | ? | ? |\n| 8 | ? | ? |\n\nWrite the values for each row and answer: What does count represent?',
  },
  {
    id: 'debug-predict', kind: 'short_answer', points: 3, required: true,
    prompt: 'DEBUG — Predict before running\n\n```python\nnumber = 6\n\nwhile number > 0:\n    print(number)\n    number = number + 2\n```\n\nBefore testing your correction, explain whether the original loop stops and list the first three values it prints.',
  },
  {
    id: 'debug-fix', kind: 'python', points: 5, required: true,
    prompt: 'Correct the loop so it prints 6, 4, and 2, then stops. Run the corrected program to check it. The original loop is provided as the starter code.',
    starter_code: 'number = 6\n\nwhile number > 0:\n    print(number)\n    number = number + 2\n',
  },
  {
    id: 'canteen-sales', kind: 'python', points: 12, required: true,
    prompt: 'BUILD — School Canteen Sales\n\nA school canteen recorded these orders. Write a Python program that calculates the total sales, counts orders strictly greater than 20, and finds the largest order without using max(). Display all results with clear labels.\n\nRequired output structure:\n```text\nCANTEEN SALES REPORT\nTotal: ...\nOrders above 20: ...\nLargest order: ...\n```',
    starter_code: 'orders = [18, 42, 12, 35, 7]\n\ntotal = 0\ncount = 0\nlargest = orders[0]\n\nfor order in orders:\n    # Complete the calculations\n    pass\n\nprint("CANTEEN SALES REPORT")\n# Display the three results with clear labels\n',
    hint: 'Start with total = 0, count = 0, and largest = orders[0]. For each order, add it to total. If it is greater than 20, increase count. If it is greater than largest, update largest. Then print the report labels and values.',
  },
  {
    id: 'midterm-reflection', kind: 'short_answer', points: 0, required: false,
    prompt: 'REFLECTION — Which Python topic do you need to review most before the midterm, and why? This response is optional and does not affect your score.',
  },
]

type PracticeActivity = {
  title: string
  instructions: string
  starter_code: string
  input?: string
  difficulty: 'challenge' | 'stretch'
}

export const OPTIONAL_MIDTERM_PRACTICE: PracticeActivity[] = [
  {
    title: 'Practice 1 — Study Hours', difficulty: 'challenge',
    instructions: 'Ask for two whole-number inputs: Monday study hours and Tuesday study hours. Convert both inputs to integers, calculate their sum, and display it as Study hours: <result>. Enter each sample value on its own line in Program input. Example inputs: 2 and 3.',
    starter_code: 'monday = int(input())\ntuesday = int(input())\n\n# Calculate and print the total\n',
    input: '2\n3\n',
  },
  {
    title: 'Practice 2 — range()', difficulty: 'challenge',
    instructions: 'First predict the output of range(3, 13, 3). Then edit the loop so it prints 4, 8, 12, and 16, each on a new line.',
    starter_code: 'for number in range(3, 13, 3):\n    print(number)\n',
  },
  {
    title: 'Practice 3 — Countdown', difficulty: 'challenge',
    instructions: 'The goal is to print 5, 4, 3, 2, 1. Correct the while loop. The starter increases number, so inspect both the condition and update before you run it. If you run the unchanged code, the 30-second safety stop will end it.',
    starter_code: 'number = 5\n\nwhile number > 0:\n    print(number)\n    number = number + 1\n',
  },
  {
    title: 'Practice 4 — Counter and Accumulator', difficulty: 'challenge',
    instructions: 'Given prices = [6, 24, 11, 35, 9], calculate the total and count values strictly greater than 20. Print the total and count with clear labels.',
    starter_code: 'prices = [6, 24, 11, 35, 9]\n\ntotal = 0\ncount = 0\n\nfor price in prices:\n    # Complete the calculations\n    pass\n\nprint("Total:", total)\nprint("Count above 20:", count)\n',
  },
  {
    title: 'Practice 5 — Running Largest', difficulty: 'challenge',
    instructions: 'Given values = [13, 29, 4, 22, 17], find and print the largest value manually. Do not use max(). Start with the first list value, then compare each value in a loop.',
    starter_code: 'values = [13, 29, 4, 22, 17]\nlargest = values[0]\n\nfor value in values:\n    # Update largest when needed\n    pass\n\nprint("Largest:", largest)\n',
  },
  {
    title: 'Optional Function Challenge — Analyze Orders', difficulty: 'stretch',
    instructions: 'Create analyze_orders(orders), returning the total, count of orders greater than 20, and largest order. Call it with [18, 42, 12, 35, 7] and print the returned values. Stretch: explain how an empty list should be handled; the current list is not empty.',
    starter_code: 'def analyze_orders(orders):\n    total = 0\n    count = 0\n    largest = orders[0]\n\n    for order in orders:\n        # Calculate total, count, and largest\n        pass\n\n    return total, count, largest\n\norders = [18, 42, 12, 35, 7]\nprint(analyze_orders(orders))\n',
  },
]

type Row = Record<string, unknown>
type Lookup<T extends Row> = { data: T | null; error: { message: string } | null }

async function findByTitle(table: 'cs_modules' | 'cs_lessons' | 'cs_assessments' | 'cs_activities', column: string, parentId: string, title: string): Promise<Lookup<Row>> {
  const { data, error } = await supabase.from(table).select('*').eq(column, parentId).eq('title', title).limit(1).maybeSingle()
  return { data: data as Row | null, error }
}

function ensure(result: { error: { message: string } | null }, stage: string): void {
  if (result.error) throw new Error(`${stage}: ${result.error.message}`)
}

async function ensureActivity(lessonId: string, assessmentId: string, activity: PracticeActivity, position: number) {
  const { data: found, error } = await findByTitle('cs_activities', 'lesson_id', lessonId, activity.title)
  ensure({ error }, `Find ${activity.title}`)
  let data = found
  if (!data) {
    const created = await supabase.from('cs_activities').insert({
      lesson_id: lessonId, title: activity.title, instructions: activity.instructions,
      activity_type: 'coding', difficulty: activity.difficulty, position,
      is_required: false, max_score: 100, status: 'published', unlock_assessment_id: assessmentId,
    }).select('*').single()
    ensure(created, `Create ${activity.title}`)
    data = created.data as Row
  } else if (data.unlock_assessment_id !== assessmentId) {
    throw new Error(`An activity named “${activity.title}” already exists but is not gated by this practice. No existing content was changed.`)
  }
  const activityId = String(data.id)
  const { data: challenge, error: challengeError } = await supabase.from('cs_coding_challenges').select('activity_id').eq('activity_id', activityId).maybeSingle()
  ensure({ error: challengeError }, `Find starter for ${activity.title}`)
  if (!challenge) {
    const created = await supabase.from('cs_coding_challenges').insert({ activity_id: activityId, starter_code: activity.starter_code, solution_notes: '', allow_input: true })
    ensure(created, `Add starter for ${activity.title}`)
  }
  const tests = await supabase.rpc('cs_install_monday_midterm_tests', { target_activity: activityId })
  ensure(tests, `Install protected test for ${activity.title}`)
}

/** Creates or reuses this lesson only inside the teacher-selected, RLS-authorized course. */
export async function installMondayMidtermPractice(courseId: string) {
  const moduleResult = await findByTitle('cs_modules', 'course_id', courseId, MIDTERM_MODULE_TITLE)
  ensure({ error: moduleResult.error }, 'Find Midterm Review module')
  let moduleRow = moduleResult.data
  if (!moduleRow) {
    const created = await supabase.from('cs_modules').insert({ course_id: courseId, title: MIDTERM_MODULE_TITLE, description: 'Monday, October 12, 2026 · Python practice for the Wednesday midterm.', position: 0, status: 'published' }).select('*').single()
    ensure(created, 'Create Midterm Review module')
    moduleRow = created.data as Row
  }
  const moduleId = String(moduleRow.id)

  const assessmentResult = await findByTitle('cs_assessments', 'course_id', courseId, MIDTERM_ASSESSMENT_TITLE)
  ensure({ error: assessmentResult.error }, 'Find Monday practice assessment')
  let assessmentRow = assessmentResult.data
  if (!assessmentRow) {
    const created = await supabase.from('cs_assessments').insert({
      course_id: courseId, title: MIDTERM_ASSESSMENT_TITLE,
      instructions: 'Complete Quick Check, Trace, Debug, and Build. Reflection is optional. Submit your answers and code here; your teacher can review the submitted work.',
      status: 'draft', due_at: null, questions: MIDTERM_QUESTIONS,
    }).select('*').single()
    ensure(created, 'Create Monday practice assessment')
    assessmentRow = created.data as Row
  } else {
    const savedQuestions = assessmentRow.questions as AssessmentQuestion[]
    const sameQuestions = savedQuestions?.length === MIDTERM_QUESTIONS.length && MIDTERM_QUESTIONS.every((question, index) => {
      const saved = savedQuestions[index]
      return saved?.id === question.id && saved?.prompt === question.prompt && saved?.kind === question.kind && saved?.points === question.points && JSON.stringify(saved?.options ?? []) === JSON.stringify(question.options ?? [])
    })
    if (!sameQuestions) throw new Error('An assessment with the Monday practice title already exists but has different questions. No existing content was changed.')
  }
  const assessmentId = String(assessmentRow.id)
  if (assessmentRow.status === 'draft') {
    const keyInstall = await supabase.rpc('cs_install_monday_midterm_keys', { target_assessment: assessmentId })
    ensure(keyInstall, 'Install protected answer key')
  }

  const lessonResult = await findByTitle('cs_lessons', 'module_id', moduleId, MIDTERM_LESSON_TITLE)
  ensure({ error: lessonResult.error }, 'Find Monday lesson')
  let lessonRow = lessonResult.data
  if (!lessonRow) {
    const created = await supabase.from('cs_lessons').insert({
      module_id: moduleId, title: MIDTERM_LESSON_TITLE, introduction: MIDTERM_LESSON_INTRODUCTION,
      learning_objectives: MIDTERM_OBJECTIVES, vocabulary: [], position: 0, status: 'published', assessment_id: assessmentId,
    }).select('*').single()
    ensure(created, 'Create Monday lesson')
    lessonRow = created.data as Row
  } else if (lessonRow.assessment_id == null) {
    const linked = await supabase.from('cs_lessons').update({ assessment_id: assessmentId }).eq('id', String(lessonRow.id))
    ensure(linked, 'Link lesson to its assessment')
  } else if (lessonRow.assessment_id !== assessmentId) {
    throw new Error('A lesson with this title is already linked to a different assessment. No existing content was changed.')
  }

  const lessonId = String(lessonRow.id)
  const existingActivities = await supabase.from('cs_activities').select('id').eq('lesson_id', lessonId)
  ensure(existingActivities, 'Read existing lesson activities')
  const nextPosition = (existingActivities.data ?? []).length
  for (const [index, activity] of OPTIONAL_MIDTERM_PRACTICE.entries()) {
    await ensureActivity(lessonId, assessmentId, activity, nextPosition + index)
  }
  return { assessmentId, lessonId, moduleId, assessmentStatus: String(assessmentRow.status), activityCount: OPTIONAL_MIDTERM_PRACTICE.length }
}
