import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Plus, BookOpen, ArrowRight } from 'lucide-react'
import { useAuth } from '../features/auth/AuthProvider'
import { supabase } from '../lib/supabase/client'
import type { Course } from '../types/classroom'
import { Field, TextArea } from '../components/FormFields'

export function TeacherCoursesPage() {
  const { session, role } = useAuth()
  const [courses, setCourses] = useState<Course[]>([])
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      let query = supabase.from('cs_courses').select('*').order('created_at')
      if (role !== 'admin') query = query.eq('teacher_id', session!.user.id)
      const { data, error } = await query
      if (error) throw error
      setCourses(data ?? [])
    } catch { setError('We couldn’t load your courses. Check your connection and try again.') }
    finally { setLoading(false) }
  }, [session, role])
  useEffect(() => { void load() }, [load])
  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (creating) return
    const form = event.currentTarget; const values = new FormData(form)
    const title = String(values.get('title')).trim()
    if (!title) { setMessage('Enter a course title.'); return }
    setCreating(true); setMessage('')
    try {
      const { error } = await supabase.from('cs_courses').insert({ teacher_id: session!.user.id, title, description: String(values.get('description')), status: 'draft' }).select('id').single()
      if (error) throw error
      form.reset(); setOpen(false); setMessage('Draft course created. Open it to add lessons and enroll students.'); await load()
    } catch { setMessage('Could not create the course. Your entries are still in the form. Check your connection and try again.') }
    finally { setCreating(false) }
  }
  const visible = courses.filter(c => (status === 'all' || c.status === status) && `${c.title} ${c.description}`.toLowerCase().includes(search.trim().toLowerCase()))
  return <main className="page"><div className="page-heading"><div><p className="eyebrow">CURRICULUM</p><h1>Your courses</h1><p className="lede">Organize units, lessons, activities, and your class roster.</p></div><button className="button" aria-expanded={open} aria-controls="new-course-form" disabled={creating} onClick={() => setOpen(!open)}><Plus size={18}/>{open ? 'Close form' : 'New course'}</button></div>
    <form id="new-course-form" hidden={!open} className="panel" onSubmit={event => void create(event)}><fieldset disabled={creating} className="assessment-fieldset form-grid"><legend>New course</legend><Field name="title" label="Course title" maxLength={160} required/><TextArea name="description" label="Short description"/><p>New courses start as drafts. Publish the course and its lessons when you’re ready for students to see them.</p><button className="button">{creating ? 'Creating…' : 'Create draft course'}</button></fieldset></form>
    {message && <p className="status" role="status">{message}</p>}
    <div className="filter-toolbar"><label className="field">Search courses<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Title or description"/></label><label className="field">Course status<select value={status} onChange={e => setStatus(e.target.value)}><option value="all">All statuses</option><option value="published">Published</option><option value="draft">Draft</option><option value="archived">Archived</option></select></label></div>
    {loading && <p role="status">Loading courses…</p>}{error && <div className="alert" role="alert">{error}<button className="button secondary" onClick={() => void load()}>Retry loading</button></div>}
    {!loading && !error && <><p className="filter-summary" role="status">Showing {visible.length} of {courses.length} courses</p><div className="course-grid">{visible.map(c => <Link className="course-card" key={c.id} to={`/teacher/course/${c.id}`}><BookOpen aria-hidden="true"/><span className="pill light">{c.status}</span><h2>{c.title}</h2><p>{c.description || 'Add units, lessons, and coding activities.'}</p><span className="text-link">Manage course <ArrowRight size={16}/></span></Link>)}</div>
    {!visible.length && <div className="empty"><BookOpen aria-hidden="true"/><h2>{courses.length ? 'No matching courses' : 'No courses yet'}</h2><p>{courses.length ? 'Try another search or show all statuses.' : 'Use New course to create a draft and begin organizing your class.'}</p>{courses.length > 0 && <button className="button secondary" onClick={() => { setSearch(''); setStatus('all') }}>Clear filters</button>}</div>}</>}
  </main>
}
