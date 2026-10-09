import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowDown, ArrowUp, Plus, Save, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase/client'
import { useAuth } from '../features/auth/AuthProvider'
import { validateQuestions } from '../utils/assessment'
import type { AssessmentQuestion, QuestionKind } from '../types/assessment'
import type { Course } from '../types/classroom'

export function AssessmentBuilderPage() {
  const { session, role } = useAuth()
  const navigate = useNavigate()
  const { assessmentId } = useParams()
  const [courses, setCourses] = useState<Course[]>([])
  const [courseId, setCourseId] = useState('')
  const [title, setTitle] = useState('')
  const [instructions, setInstructions] = useState('Complete the quiz and Python exercises. Run your code before submitting.')
  const [dueAt, setDueAt] = useState('')
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([])
  const [keys, setKeys] = useState<Record<string, number>>({})
  const [savedId, setSavedId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { let query = supabase.from('cs_courses').select('*'); if (role !== 'admin') query = query.eq('teacher_id', session!.user.id); void query.then(({ data, error }) => {
    if (error) setError(error.message)
    else { setCourses(data as Course[]); if (!assessmentId) setCourseId(data?.[0]?.id ?? '') }
  }) }, [session, role, assessmentId])
  useEffect(() => {
    if (!assessmentId) return
    void (async () => {
      const [a, k] = await Promise.all([supabase.from('cs_assessments').select('*').eq('id', assessmentId).single(), supabase.from('cs_assessment_keys').select('answers').eq('assessment_id', assessmentId).maybeSingle()])
      if (a.error || k.error) { setError(a.error?.message ?? k.error?.message ?? 'Could not load the draft.'); return }
      if (a.data.status !== 'draft') { navigate(`/assessments/${assessmentId}/review`, { replace: true }); return }
      setSavedId(assessmentId); setTitle(a.data.title); setInstructions(a.data.instructions); setCourseId(a.data.course_id); setQuestions(a.data.questions); setKeys(k.data?.answers ?? {})
      if (a.data.due_at) { const date = new Date(a.data.due_at); setDueAt(new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)) }
    })()
  }, [assessmentId, navigate])
  const add = (kind: QuestionKind) => {
    const id = crypto.randomUUID()
    setQuestions(q => [...q, { id, kind, prompt: '', points: kind === 'python' ? 10 : 2, ...(kind === 'multiple_choice' ? { options: ['', '', '', ''] } : {}), ...(kind === 'python' ? { starter_code: '# Write your program here\n' } : {}) }])
    if (kind === 'multiple_choice') setKeys(k => ({ ...k, [id]: 0 }))
  }
  const update = (id: string, patch: Partial<AssessmentQuestion>) => setQuestions(q => q.map(item => item.id === id ? { ...item, ...patch } : item))
  const move = (index: number, offset: number) => setQuestions(items => {
    const next = [...items]; const other = index + offset
    if (other < 0 || other >= next.length) return items
    ;[next[index], next[other]] = [next[other]!, next[index]!]
    return next
  })
  const save = async (event: FormEvent) => {
    event.preventDefault(); setError('')
    const problem = validateQuestions(questions, keys)
    if (problem || !courseId || !title.trim()) { setError(problem ?? 'Enter an assessment title and select a class.'); return }
    setBusy(true)
    try {
      const payload = { course_id: courseId, title: title.trim(), instructions, due_at: dueAt ? new Date(dueAt).toISOString() : null, questions }
      const result = savedId
        ? await supabase.from('cs_assessments').update(payload).eq('id', savedId).select('id').single()
        : await supabase.from('cs_assessments').insert(payload).select('id').single()
      if (result.error) throw result.error
      const id = result.data.id as string
      setSavedId(id)
      const answerKeys = Object.fromEntries(questions.filter(q => q.kind === 'multiple_choice').map(q => [q.id, keys[q.id]]))
      const keyResult = await supabase.from('cs_assessment_keys').upsert({ assessment_id: id, answers: answerKeys })
      if (keyResult.error) throw keyResult.error
      navigate(`/assessments/${id}/review`)
    } catch (error) { setError(error instanceof Error ? error.message : (error as { message?: string }).message ?? 'Could not save the assessment. Retrying will save the same draft.') }
    finally { setBusy(false) }
  }
  return <main className="page assessment-page"><Link className="back" to="/assessments"><ArrowLeft size={16}/> Quiz & Code</Link><p className="eyebrow">ASSESSMENT BUILDER</p><h1>Create assessment</h1><p className="lede">Save a draft, review it, then assign it to your class. Only teachers can view the answer key.</p>
    <form onSubmit={event => void save(event)}><fieldset disabled={busy} className="assessment-fieldset"><section className="panel form-grid"><label className="field">Assessment title<input value={title} onChange={e => setTitle(e.target.value)} maxLength={160} required placeholder="Example: Python — Booleans & If/Else"/></label><div className="two-column"><label className="field">Class / course<select value={courseId} onChange={e => setCourseId(e.target.value)} required><option value="">Select a class</option>{courses.map(c => <option key={c.id} value={c.id}>{c.title}{c.status !== 'published' ? ' (not published)' : ''}</option>)}</select></label><label className="field">Due date (optional)<input type="datetime-local" value={dueAt} onChange={e => setDueAt(e.target.value)}/></label></div><label className="field">Instructions<textarea value={instructions} onChange={e => setInstructions(e.target.value)}/></label>{!courses.length && <p className="alert">You need to <Link to="/teacher/courses">create a class and add students</Link> before assigning an assessment.</p>}</section>
    {questions.map((q, i) => <section className="panel question-builder" key={q.id}><div className="question-header"><h2>Question {i + 1} · {q.kind === 'python' ? 'Python' : q.kind === 'multiple_choice' ? 'Multiple choice' : 'Short answer'}</h2><div className="heading-actions"><button type="button" className="icon-button" aria-label={`Move question ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={17}/></button><button type="button" className="icon-button" aria-label={`Move question ${i + 1} down`} disabled={i === questions.length - 1} onClick={() => move(i, 1)}><ArrowDown size={17}/></button><button type="button" className="icon-button" aria-label={`Delete question ${i + 1}`} onClick={() => setQuestions(items => items.filter(item => item.id !== q.id))}><Trash2 size={17}/></button></div></div><div className="form-grid"><label className="field">Question prompt<textarea value={q.prompt} onChange={e => update(q.id, { prompt: e.target.value })} required placeholder="Enter the problem, examples, and expected output…"/></label><label className="field points-field">Points<input type="number" min={1} max={100} step={1} value={q.points} onChange={e => update(q.id, { points: Number(e.target.value) })} required/></label>{q.kind === 'multiple_choice' && <fieldset className="quiz-options"><legend>Options — select the correct answer</legend>{q.options?.map((option, n) => <div className="builder-option" key={n}><label><input type="radio" name={`key-${q.id}`} checked={keys[q.id] === n} onChange={() => setKeys(k => ({ ...k, [q.id]: n }))} aria-label={`Correct answer for question ${i + 1}: ${String.fromCharCode(65 + n)}`}/>{String.fromCharCode(65 + n)}</label><input aria-label={`Question ${i + 1}, option ${String.fromCharCode(65 + n)}`} value={option} onChange={e => update(q.id, { options: q.options!.map((o, oi) => oi === n ? e.target.value : o) })} required/></div>)}</fieldset>}{q.kind === 'python' && <label className="field">Starter code (optional)<textarea className="code-textarea" value={q.starter_code} onChange={e => update(q.id, { starter_code: e.target.value })}/></label>}</div></section>)}
    <div className="assessment-add-buttons"><button type="button" className="button secondary" onClick={() => add('multiple_choice')}><Plus size={17}/> Multiple choice</button><button type="button" className="button secondary" onClick={() => add('short_answer')}><Plus size={17}/> Short answer</button><button type="button" className="button secondary" onClick={() => add('python')}><Plus size={17}/> Python exercise</button></div>{error && <p className="alert" role="alert">{error}</p>}<div className="assessment-footer"><span>{questions.length} questions · {questions.reduce((sum, q) => sum + q.points, 0)} points</span><button className="button" disabled={busy || !courses.length}><Save size={17}/> {busy ? 'Saving…' : 'Save draft & review'}</button></div></fieldset></form>
  </main>
}
