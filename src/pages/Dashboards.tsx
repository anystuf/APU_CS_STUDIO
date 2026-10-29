import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, BookOpen, ClipboardCheck, Code2, Users } from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthProvider'
import { supabase } from '../lib/supabase/client'
import type { Course, TeacherFeedback } from '../types/classroom'

export function HomePage() { const { role } = useAuth(); return <Navigate to={role === 'student' ? '/student' : '/teacher'} replace/> }

export function StudentDashboard() {
  const { session } = useAuth()
  const [courses, setCourses] = useState<Course[]>([])
  const [feedback, setFeedback] = useState<TeacherFeedback[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [c, f] = await Promise.all([
        supabase.from('cs_courses').select('*,cs_enrollments!inner(student_id)').eq('cs_enrollments.student_id', session!.user.id).eq('status', 'published'),
        supabase.from('cs_teacher_feedback').select('*,cs_activity_attempts(*,cs_activities(title))').eq('student_id', session!.user.id).order('created_at', { ascending: false }).limit(5),
      ])
      if (c.error || f.error) throw c.error ?? f.error
      setCourses((c.data ?? []) as Course[]); setFeedback((f.data ?? []) as TeacherFeedback[])
    } catch { setError('We couldn’t load your courses and feedback. Your saved work has not been changed. Check your connection and retry.') }
    finally { setLoading(false) }
  }, [session])
  useEffect(() => { void load() }, [load])
  return <main className="page">
    <p className="eyebrow">YOUR LEARNING</p><h1>Welcome back to Computer Science</h1><p className="lede">Open your course, finish assigned work, or practice Python.</p>
    {loading && <p role="status">Loading courses and feedback…</p>}
    {error && <div className="alert" role="alert">{error}<button className="button secondary" onClick={() => void load()}>Retry loading</button></div>}
    {!loading && !error && <>{courses[0] ? <section className="hero-card"><div><span className="pill">Your course</span><h2>{courses[0].title}</h2><p>{courses[0].description}</p><Link className="button link-button" to={`/student/course/${courses[0].id}`}>Open course <ArrowRight size={18}/></Link></div><BookOpen size={60} aria-hidden="true"/></section> : <div className="empty"><BookOpen aria-hidden="true"/><h2>You’re not enrolled in a course yet</h2><p>Ask your teacher to add you to the course. You can practice in the Python IDE while you wait.</p><Link className="button" to="/python-ide">Practice Python</Link></div>}
    {courses.length > 1 && <section><h2>Your courses</h2><div className="course-grid">{courses.map(c => <Link className="course-card" key={c.id} to={`/student/course/${c.id}`}><BookOpen aria-hidden="true"/><h3>{c.title}</h3><p>{c.description}</p><span className="text-link">Open course <ArrowRight size={16}/></span></Link>)}</div></section>}
    {feedback.length > 0 && <section className="feedback-section"><h2>Teacher feedback</h2>{feedback.map(f => <article className="feedback-card" key={f.id}><h3>{f.cs_activity_attempts?.cs_activities?.title ?? 'Recent activity'}</h3><p>{f.comment}</p><time dateTime={f.created_at}>{new Date(f.created_at).toLocaleDateString()}</time></article>)}</section>}</>}
    <div className="dashboard-actions"><Link className="action-card" to="/assessments"><ClipboardCheck aria-hidden="true"/><div><h2>Assigned assessments</h2><p>Answer questions, write code, and submit in Quiz & Code.</p></div><ArrowRight aria-hidden="true"/></Link><Link className="action-card" to="/python-ide"><Code2 aria-hidden="true"/><div><h2>Practice Python</h2><p>Run code and save files. This workspace does not submit assignments.</p></div><ArrowRight aria-hidden="true"/></Link></div>
    <p><Link className="help-link" to="/help">How to save and submit your work →</Link></p>
  </main>
}

export function TeacherDashboard() {
  const [counts, setCounts] = useState<{ students: number; courses: number; work: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [s, c, w] = await Promise.all([
        supabase.from('cs_profiles').select('id', { count: 'exact', head: true }).eq('role', 'student'),
        supabase.from('cs_courses').select('id', { count: 'exact', head: true }),
        supabase.from('cs_code_workspaces').select('id', { count: 'exact', head: true }),
      ])
      if (s.error || c.error || w.error) throw s.error ?? c.error ?? w.error
      setCounts({ students: s.count ?? 0, courses: c.count ?? 0, work: w.count ?? 0 })
    } catch { setError('We couldn’t load the classroom overview. Your courses and student work have not been changed. Check your connection and retry.') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])
  return <main className="page"><p className="eyebrow">CLASS OVERVIEW</p><h1>Your Classroom</h1><p className="lede">Plan lessons, assign work, and give students useful feedback.</p>
    {loading && <p role="status">Loading classroom overview…</p>}
    {error && <div className="alert" role="alert">{error}<button className="button secondary" onClick={() => void load()}>Retry loading</button></div>}
    {counts && !loading && !error && <><div className="stat-grid"><article className="stat"><Users aria-hidden="true"/><strong>{counts.students}</strong><span>Visible student accounts</span></article><article className="stat"><BookOpen aria-hidden="true"/><strong>{counts.courses}</strong><span>Courses you can manage</span></article><article className="stat"><Code2 aria-hidden="true"/><strong>{counts.work}</strong><span>Saved course workspaces</span></article></div><p className="filter-summary">Counts reflect your account permissions. Saved workspaces are drafts, not a count of submitted assignments.</p></>}
    <div className="dashboard-actions">
      <Link className="action-card" to="/teacher/courses"><BookOpen aria-hidden="true"/><div><h2>Manage courses</h2><p>Organize lessons, create activities, and manage your roster.</p></div><ArrowRight aria-hidden="true"/></Link>
      <Link className="action-card" to="/assessments"><ClipboardCheck aria-hidden="true"/><div><h2>Manage assessments</h2><p>Assign quizzes and coding assessments, then grade submissions.</p></div><ArrowRight aria-hidden="true"/></Link>
      <Link className="action-card" to="/teacher/submissions"><Code2 aria-hidden="true"/><div><h2>Review course activity code</h2><p>Review saved exercise code and submitted attempts.</p></div><ArrowRight aria-hidden="true"/></Link>
      <Link className="action-card" to="/teacher/workspaces"><Users aria-hidden="true"/><div><h2>Review IDE workspaces</h2><p>See Python files students saved from the standalone IDE.</p></div><ArrowRight aria-hidden="true"/></Link>
    </div><section className="panel dashboard-guide"><h2>Before assigning a new activity</h2><p>Publish its course, unit, and lesson; review the instructions and tests; then publish the activity. Archive content to hide it while keeping student work. <Link to="/help">Read the classroom guide →</Link></p></section>
  </main>
}

export function Placeholder({ title }: { title: string }) {
  return <main className="page"><p className="eyebrow">CS STUDIO</p><h1>{title === 'Page not found' ? 'We couldn’t find that page' : title}</h1>{title === 'Page not found' && <><p className="lede">The link may be outdated, or the page may have moved. Return to your dashboard to find your course or activity.</p><Link className="button link-button" to="/">Back to dashboard <ArrowRight size={18}/></Link></>}</main>
}
