import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ClipboardCheck, Code2, Plus } from 'lucide-react'
import { supabase } from '../lib/supabase/client'
import { useAuth } from '../features/auth/AuthProvider'
import { formatDate, normalizeSubmission } from '../utils/assessment'
import type { Assessment, AssessmentSubmission } from '../types/assessment'

export function AssessmentsPage() {
  const { role } = useAuth()
  const staff = role === 'teacher' || role === 'admin'
  const [items, setItems] = useState<Assessment[]>([])
  const [work, setWork] = useState<AssessmentSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    setLoading(true); setError('')
    const [a, s] = await Promise.all([
      supabase.from('cs_assessments').select('*,cs_courses(title)').order('created_at', { ascending: false }),
      supabase.from('cs_assessment_submissions').select('assessment_id,status,cs_assessment_reviews(submission_id)').eq('status', 'submitted'),
    ])
    if (a.error || s.error) setError(a.error?.message ?? s.error?.message ?? 'Could not load assessments.')
    else { setItems(a.data as Assessment[]); setWork((s.data ?? []).map(normalizeSubmission)) }
    setLoading(false)
  }, [])
  useEffect(() => { void load() }, [load])
  return <main className="page assessment-page">
    <div className="page-heading"><div><p className="eyebrow">APU CLASSROOM</p><h1>Quiz & Code</h1><p className="lede">Take quizzes, run Python, and submit your work in one place.</p></div>{staff && <Link to="/assessments/new" className="button"><Plus size={18}/> Create assessment</Link>}</div>
    <section className="assessment-banner"><ClipboardCheck size={32}/><div><h2>{staff ? 'One assessment. One submission. All your work.' : 'Your work is saved automatically.'}</h2><p>{staff ? 'Assign assessments to your class, review each student’s answers and code, and return grades and feedback.' : 'Complete the sections in any order. Check the save status before leaving, and submit when you are finished.'}</p></div></section>
    {loading && <p role="status">Loading assessments…</p>}
    {error && <div className="alert" role="alert">Could not load data: {error} <button className="button compact secondary" onClick={() => void load()}>Retry</button></div>}
    <div className="course-grid">{items.map(a => {
      const submissions = work.filter(s => s.assessment_id === a.id)
      const done = !staff && submissions.length > 0
      return <article className="course-card" key={a.id}><div className="assessment-card-top"><ClipboardCheck/><span className={`assessment-badge ${done ? 'submitted' : a.status}`}>{done ? 'Submitted' : a.status === 'draft' ? 'Draft' : a.status === 'closed' ? 'Closed' : 'Open'}</span></div><h2>{a.title}</h2><p>{a.cs_courses?.title}</p><p>{a.questions.filter(q => q.kind !== 'python').length} quiz questions · {a.questions.filter(q => q.kind === 'python').length} Python exercises · {a.questions.reduce((sum, q) => sum + q.points, 0)} points</p><p className="work-meta">Due: {formatDate(a.due_at)}</p>{staff && <p>{submissions.length} submissions · {submissions.filter(s => s.cs_assessment_reviews?.length).length} graded</p>}<Link className="text-link" to={staff ? `/assessments/${a.id}/review` : `/assessments/${a.id}`}>{staff ? 'Manage & grade' : done ? 'View submission' : 'Start assessment'} <ArrowRight size={16}/></Link>{staff && <Link to={`/assessments/${a.id}`} className="text-link"><Code2 size={16}/> Preview assessment</Link>}</article>
    })}</div>
    {!loading && !error && !items.length && <div className="empty"><ClipboardCheck/><h2>No assessments yet</h2><p>{staff ? 'Create an assessment with multiple-choice questions, short answers, and Python exercises, then assign it to your class.' : 'Assessments appear here when your teacher assigns them to your class.'}</p>{staff && <Link className="button" to="/assessments/new">Create your first assessment</Link>}</div>}
  </main>
}
