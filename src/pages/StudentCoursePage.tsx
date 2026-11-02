import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase/client'
import { useAuth } from '../features/auth/AuthProvider'
import type { Activity, Course, Lesson, Module } from '../types/classroom'
import { LearningInstructions } from '../components/LearningInstructions'
import { displayActivityTitle, displayTitle } from '../utils/learningContent'

export function StudentCoursePage() {
  const { courseId } = useParams()
  const { session } = useAuth()
  const [course, setCourse] = useState<Course | null>(null)
  const [modules, setModules] = useState<Module[]>([])
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [submitted, setSubmitted] = useState<string[]>([])
  const [assessmentDone, setAssessmentDone] = useState<string[]>([])
  const [drafts, setDrafts] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [c, m, l, a, attempts, work, assessments] = await Promise.all([
        supabase.from('cs_courses').select('*').eq('id', courseId!).single(),
        supabase.from('cs_modules').select('*').eq('course_id', courseId!).eq('status', 'published').order('position'),
        supabase.from('cs_lessons').select('*,cs_modules!inner(course_id),cs_assessments(id,title,status)').eq('cs_modules.course_id', courseId!).eq('status', 'published').order('position'),
        supabase.from('cs_activities').select('*,cs_lessons!inner(cs_modules!inner(course_id))').eq('cs_lessons.cs_modules.course_id', courseId!).eq('status', 'published').order('position'),
        supabase.from('cs_activity_attempts').select('activity_id').eq('student_id', session!.user.id),
        supabase.from('cs_code_workspaces').select('activity_id').eq('student_id', session!.user.id),
        supabase.from('cs_assessment_submissions').select('assessment_id').eq('student_id', session!.user.id).eq('status', 'submitted'),
      ])
      const failed = [c, m, l, a, attempts, work, assessments].find(result => result.error)
      if (failed?.error) throw failed.error
      setCourse(c.data); setModules(m.data ?? []); setLessons((l.data ?? []) as unknown as Lesson[])
      setActivities((a.data ?? []) as unknown as Activity[])
      setSubmitted((attempts.data ?? []).map(row => row.activity_id)); setDrafts((work.data ?? []).map(row => row.activity_id))
      setAssessmentDone((assessments.data ?? []).map(row => row.assessment_id))
    } catch { setError('We couldn’t load this course. Check your connection. If access is restricted, ask your teacher to check your enrollment.') }
    finally { setLoading(false) }
  }, [courseId, session])
  useEffect(() => { void load() }, [load])
  const query = search.trim().toLowerCase()
  const matches = (lesson: Lesson) => !query || `${lesson.title} ${activities.filter(a => a.lesson_id === lesson.id).map(a => a.title).join(' ')}`.toLowerCase().includes(query)
  const links = (items: Activity[]) => <ul className="student-task-list">{items.map(activity => {
    const status = submitted.includes(activity.id) ? 'Submitted' : drafts.includes(activity.id) ? 'Draft saved' : 'Not started'
    return <li key={activity.id}><div><Link to={`/student/activity/${activity.id}`}>{displayActivityTitle(activity.title)}</Link><p>{activity.max_score} points{activity.due_at ? ` · Due ${new Date(activity.due_at).toLocaleString()}` : ''}</p></div><span className={`assessment-badge ${status === 'Submitted' ? 'submitted' : ''}`}>{status}</span><Link className="button secondary compact" aria-label={`Open ${displayActivityTitle(activity.title)}`} to={`/student/activity/${activity.id}`}>{status === 'Not started' ? 'Start activity' : 'Open activity'}</Link></li>
  })}</ul>
  return <main className="page student-course"><Link className="back" to="/student">← Dashboard</Link><p className="eyebrow">YOUR COURSE</p><h1>{course ? displayTitle(course.title) : loading ? 'Loading course…' : 'Course unavailable'}</h1>{course && <p className="lede">{course.description}</p>}
    <label className="field course-search">Find a lesson or activity<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="For example: W10.5, functions, or clean"/></label>
    {loading && <p role="status">Loading your lessons and activity status…</p>}{error && <div className="alert" role="alert">{error}<button className="button secondary" onClick={() => void load()}>Retry loading</button></div>}
    {!loading && !error && <><p className="filter-summary" role="status">{lessons.filter(matches).length} lessons match. Open a required activity to start your work.</p><div className="learning-path">{modules.map(module => {
      const visibleLessons = lessons.filter(l => l.module_id === module.id && matches(l))
      if (!visibleLessons.length) return null
      return <section key={module.id}><h2>{displayTitle(module.title)}</h2>{visibleLessons.map(lesson => {
        const tasks = activities.filter(a => a.lesson_id === lesson.id)
        const required = tasks.filter(a => a.is_required !== false)
        const extension = tasks.filter(a => a.is_required === false)
        const assessment = lesson.cs_assessments
        return <article className="panel student-lesson" key={lesson.id}><h3>{displayTitle(lesson.title)}</h3>
          {!!lesson.learning_objectives?.length && <section className="lesson-goals"><h4>What you’ll learn</h4><ul>{lesson.learning_objectives.map((objective, i) => <li key={i}>{objective}</li>)}</ul></section>}
          {lesson.introduction && <details className="lesson-overview"><summary>Lesson overview and schedule</summary><LearningInstructions text={lesson.introduction}/></details>}
          {assessment && assessment.status !== 'draft' && <section className="lesson-required"><h4>Required assessment</h4><p>{displayTitle(assessment.title)}</p><Link className="button compact" to={`/assessments/${assessment.id}`}>{assessmentDone.includes(assessment.id) ? 'View submission' : assessment.status === 'closed' ? 'View closed assessment' : 'Open assessment'}</Link></section>}
          {required.length > 0 && <section><h4>Required activities</h4>{links(required)}</section>}
          {extension.length > 0 && <section><h4>Extension activities</h4><p>Additional practice after your required work.</p>{links(extension)}</section>}
          {!tasks.length && <p className="filter-summary">No coding activities are available in this lesson yet. Some activities may require a prerequisite submission.</p>}
        </article>
      })}</section>
    })}</div>{!lessons.filter(matches).length && <div className="empty"><h2>No matching lessons</h2><p>Try another lesson or activity title.</p><button className="button secondary" onClick={() => setSearch('')}>Clear search</button></div>}</>}
  </main>
}
