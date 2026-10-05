export type QuestionKind = 'multiple_choice' | 'short_answer' | 'python'
export type AssessmentQuestion = {
  id: string
  kind: QuestionKind
  prompt: string
  points: number
  options?: string[]
  starter_code?: string
}
export type Assessment = {
  id: string
  course_id: string
  title: string
  instructions: string
  status: 'draft' | 'published' | 'closed'
  due_at: string | null
  questions: AssessmentQuestion[]
  created_at: string
  cs_courses?: { title: string }
}
export type QuestionAnswer = { choice?: number; text?: string; code?: string; input?: string; stdout?: string; stderr?: string }
export type AssessmentAnswers = Record<string, QuestionAnswer>
export type AssessmentReview = { submission_id: string; teacher_id: string; manual_score: number; feedback: string; updated_at: string }
export type AssessmentSubmission = {
  id: string
  assessment_id: string
  student_id: string
  status: 'draft' | 'submitted'
  answers: AssessmentAnswers
  quiz_score: number
  quiz_max_score: number
  manual_max_score: number
  question_snapshot: AssessmentQuestion[]
  submitted_at: string | null
  updated_at: string
  cs_profiles?: { full_name: string; email: string }
  cs_assessment_reviews?: AssessmentReview[]
}
