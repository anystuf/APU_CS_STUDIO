import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase/client'
import { localDate, managementError, validateActivity, type ManagedActivity, type ManagedTest } from '../utils/activityManagement'

type Hierarchy = { courseId: string; path: string; blockers: string[] }
export function TeacherActivityManagerPage() {
  const { activityId } = useParams()
  const [saved, setSaved] = useState<ManagedActivity | null>(null)
  const [activity, setActivity] = useState<ManagedActivity | null>(null)
  const [starter, setStarter] = useState('')
  const [tests, setTests] = useState<ManagedTest[]>([])
  const [inputEnabled, setInputEnabled] = useState(false)
  const [due, setDue] = useState('')
  const [hierarchy, setHierarchy] = useState<Hierarchy | null>(null)
  const [message, setMessage] = useState('')
  const [testError, setTestError] = useState('')
  const [challengeError, setChallengeError] = useState('')
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const generation = useRef(0)
  const load = useCallback(async () => {
    const current = ++generation.current
    setLoading(true); setMessage(''); setTestError(''); setChallengeError('')
    try {
      const [a, c, t] = await Promise.all([
        supabase.from('cs_activities').select('*').eq('id', activityId!).single(),
        supabase.from('cs_coding_challenges').select('activity_id,starter_code,allow_input').eq('activity_id', activityId!).maybeSingle(),
        supabase.rpc('cs_teacher_activity_tests', { target_activity: activityId! }),
      ])
      if (current !== generation.current) return
      if (a.error) throw a.error
      const row = a.data as ManagedActivity
      setSaved(row); setActivity(row); setDue(localDate(row.due_at)); setHierarchy(null)
      if (c.error) setChallengeError(managementError(c.error))
      else { setStarter(c.data?.starter_code ?? ''); setInputEnabled(c.data?.allow_input ?? true) }
      if (t.error) setTestError(managementError(t.error))
      else setTests((t.data ?? []) as ManagedTest[])
      const lesson = await supabase.from('cs_lessons').select('id,title,status,module_id').eq('id', row.lesson_id).single()
      if (lesson.error) throw lesson.error
      const module = await supabase.from('cs_modules').select('id,title,status,course_id').eq('id', lesson.data.module_id).single()
      if (module.error) throw module.error
      const course = await supabase.from('cs_courses').select('id,title,status').eq('id', module.data.course_id).single()
      if (course.error) throw course.error
      if (current !== generation.current) return
      setHierarchy({ courseId: course.data.id, path: `${course.data.title} / ${module.data.title} / ${lesson.data.title}`, blockers: [course.data, module.data, lesson.data].filter(item => item.status !== 'published').map(item => `${item.title} (${item.status})`) })
    } catch (cause) { if (current === generation.current) setMessage(managementError(cause)) }
    finally { if (current === generation.current) setLoading(false) }
  }, [activityId])
  useEffect(() => {
    const requestState = generation
    setSaved(null); setActivity(null); setEditing(false); void load()
    return () => { requestState.current++ }
  }, [load])
  const persist = async (status: string, includeEditor: boolean) => {
    if (!activity || !saved || busy) return
    const payload = { ...(includeEditor ? activity : saved), status, due_at: due ? new Date(due).toISOString() : null, is_required: activity.is_required }
    const submittedTests = includeEditor && !testError && saved.activity_type === 'coding' ? tests : null
    const problem = validateActivity(payload, starter, submittedTests)
    if (problem) { setMessage(problem); return }
    setBusy(true); setMessage('')
    try {
      const result = await supabase.rpc('cs_save_activity', { target_activity: saved.id, activity_data: payload, challenge_data: includeEditor && !challengeError && saved.activity_type === 'coding' ? { starter_code: starter, allow_input: inputEnabled } : null, test_data: submittedTests, expected_updated_at: saved.updated_at })
      if (result.error) throw result.error
      const updated = (Array.isArray(result.data) ? result.data[0] : result.data) as ManagedActivity | null
      if (!updated?.id) throw new Error('The server did not confirm this save.')
      setSaved(updated); setActivity(updated); setEditing(false)
      setMessage(includeEditor ? 'Activity, starter code and available tests saved together.' : status === 'published' ? 'Assignment settings saved. Check the course visibility and prerequisite below.' : 'Assignment settings saved. Student work has been preserved.')
    } catch (cause) { setMessage(managementError(cause)) }
    finally { setBusy(false) }
  }
  const save = (event: FormEvent) => { event.preventDefault(); void persist(activity!.status, true) }
  const retry = () => { if (editing && !window.confirm('Reload this activity and discard unsaved editor changes?')) return; setEditing(false); void load() }
  const changeTest = (id: string, patch: Partial<ManagedTest>) => setTests(items => items.map(item => item.id === id ? { ...item, ...patch } : item))
  const toggleEditor = () => {
    if (!editing) { setEditing(true); return }
    if (!window.confirm('Discard unsaved editor changes?')) return
    setEditing(false); void load()
  }
  if (loading) return <main className="page"><p role="status">Loading activity…</p></main>
  if (!activity) return <main className="page"><Link to="/teacher/courses">← Courses</Link><h1>Could not load activity</h1><p role="alert">{message}</p><button className="button" onClick={retry}>Retry</button></main>
  return <main className="page">
    <Link className="back" to={hierarchy ? `/teacher/course/${hierarchy.courseId}` : '/teacher/courses'}>← Manage course</Link>
    <p className="eyebrow">TEACHER / ADMIN · ACTIVITY MANAGEMENT</p><h1>{saved?.title}</h1>
    {hierarchy && <p>{hierarchy.path}</p>}
    {message && <p role="status" className="status">{message}</p>}
    {(testError || challengeError) && <div className="alert" role="alert"><p>{testError || challengeError}</p><p>You can still manage assignment settings. Unavailable starter code or tests will not be overwritten.</p><button className="button secondary" disabled={busy} onClick={retry}>Retry loading details</button></div>}
    {!!hierarchy?.blockers.length && <p className="alert">Students cannot open this activity until these items are published: {hierarchy.blockers.join(', ')}. <Link to={`/teacher/course/${hierarchy.courseId}`}>Manage course visibility</Link></p>}
    {activity.unlock_assessment_id && <p className="status">Students must submit the prerequisite assessment first. <Link to={`/assessments/${activity.unlock_assessment_id}/review`}>Review prerequisite</Link></p>}
    <section className="panel"><h2>Assignment settings</h2><p><strong>Status:</strong> {saved?.status}</p>
      <fieldset disabled={busy} className="assessment-fieldset form-grid">
        <label className="field">Due date and time (your local timezone)<input type="datetime-local" value={due} onChange={e => setDue(e.target.value)}/></label>
        <label><input type="checkbox" checked={activity.is_required} onChange={e => setActivity({ ...activity, is_required: e.target.checked })}/> Required activity</label>
        <p>A due date displays the target deadline; it does not lock late submissions.</p>
        <div className="heading-actions"><button className="button" disabled={editing || !hierarchy} onClick={() => void persist('published', false)}>Assign / Publish</button><button className="button secondary" disabled={editing} onClick={() => void persist('draft', false)}>Unpublish</button><button className="button secondary" disabled={editing} onClick={() => void persist('archived', false)}>Archive</button><button className="button secondary" onClick={toggleEditor}>{editing ? 'Cancel editing' : 'Edit activity'}</button><button className="button secondary" onClick={() => void persist(saved!.status, false)} disabled={editing}>Save settings</button><button className="button secondary" onClick={retry}>Reload</button></div>
        {editing && <p>Save the editor before changing assignment settings.</p>}
      </fieldset>
    </section>
    {editing && <form className="panel" onSubmit={save}><h2>Edit activity</h2><fieldset disabled={busy} className="assessment-fieldset form-grid">
      <label className="field">Title<input required maxLength={160} value={activity.title} onChange={e => setActivity({ ...activity, title: e.target.value })}/></label>
      <label className="field">Instructions<textarea rows={8} maxLength={50000} value={activity.instructions} onChange={e => setActivity({ ...activity, instructions: e.target.value })}/></label>
      <label className="field">Difficulty<select value={activity.difficulty} onChange={e => setActivity({ ...activity, difficulty: e.target.value })}>{['core', 'challenge', 'stretch'].map(value => <option key={value}>{value}</option>)}</select></label>
      <label className="field">Maximum score<input type="number" min={0} max={1000} step="0.01" value={activity.max_score} onChange={e => setActivity({ ...activity, max_score: Number(e.target.value) })}/></label>
      <label className="field">Status<select value={activity.status} onChange={e => setActivity({ ...activity, status: e.target.value })}>{['draft', 'published', 'archived'].map(value => <option key={value}>{value}</option>)}</select></label>
      {activity.activity_type === 'coding' && !challengeError && <><label className="field">Starter Python<textarea rows={12} className="code-textarea" value={starter} onChange={e => setStarter(e.target.value)}/></label><label><input type="checkbox" checked={inputEnabled} onChange={e => setInputEnabled(e.target.checked)}/> Allow program input</label></>}
      {!testError && activity.activity_type === 'coding' && <section><h3>Teacher-only test cases ({tests.length})</h3><p>Expected outputs are visible here only to the course teacher/admin. Hidden expectations are not returned to students.</p>{tests.map((test, i) => <fieldset key={test.id} className="panel form-grid"><legend>Test {i + 1}</legend><label className="field">Test {i + 1} input<textarea value={test.input} maxLength={20000} onChange={e => changeTest(test.id, { input: e.target.value })}/></label><label className="field">Test {i + 1} expected output<textarea value={test.expected_output} maxLength={20000} onChange={e => changeTest(test.id, { expected_output: e.target.value })}/></label><label className="field">Test {i + 1} visibility<select value={test.visibility} onChange={e => changeTest(test.id, { visibility: e.target.value as ManagedTest['visibility'] })}><option value="public">Public result</option><option value="hidden">Hidden result</option></select></label><button className="button secondary" type="button" onClick={() => setTests(items => items.filter(t => t.id !== test.id))}>Remove test {i + 1} from draft</button></fieldset>)}<button className="button secondary" disabled={tests.length >= 100} type="button" onClick={() => setTests(items => [...items, { id: crypto.randomUUID(), input: '', expected_output: '', visibility: 'hidden', position: items.length }])}>Add test case</button></section>}
      <button className="button" type="submit">{busy ? 'Saving…' : 'Save changes'}</button>
    </fieldset></form>}
    <section className="panel"><p className="eyebrow">{editing ? 'UNSAVED EDITOR PREVIEW' : 'STUDENT INSTRUCTIONS PREVIEW'}</p><h2>{activity.title}</h2><p className="question-prompt">{activity.instructions}</p><p>{saved?.is_required ? 'Required' : 'Optional'} · {saved?.difficulty} · {saved?.max_score} points</p>{saved?.due_at && <p>Due: {new Date(saved.due_at).toLocaleString()}</p>}<pre className="review-code">{starter || '# No starter code'}</pre>
      {!testError && <details><summary>Teacher-only test expectations ({tests.length})</summary>{tests.map((test, i) => <section key={test.id}><h3>Test {i + 1} · {test.visibility}</h3><pre className="review-code">Input: {test.input || '(empty)'}{'\n'}Expected: {test.expected_output}</pre></section>)}</details>}
    </section><p><Link to={`/teacher/submissions?activity=${activity.id}`}>Review saved work and submissions for this activity →</Link></p>
  </main>
}
