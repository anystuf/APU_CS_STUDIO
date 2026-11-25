import { displayTitle } from '../utils/learningContent'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Cloud, Save, Send, Flag, Clock, ChevronLeft, ChevronRight, StickyNote } from 'lucide-react'
import { supabase } from '../lib/supabase/client'
import { useAuth } from '../features/auth/AuthProvider'
import { AssessmentQuestion } from '../components/AssessmentQuestion'
import { formatDate, initialAnswers, isAnswered, normalizeSubmission } from '../utils/assessment'
import type { Assessment, AssessmentAnswers, AssessmentSubmission, QuestionAnswer } from '../types/assessment'

type CachedWork = { answers: AssessmentAnswers; updated_at: string }
type ReviewMarks = Record<string, { flagged?: boolean; note?: string }>
function readMarks(key: string): ReviewMarks {
  try { const value = JSON.parse(localStorage.getItem(key) ?? '{}'); return value && typeof value === 'object' && !Array.isArray(value) ? value : {} } catch { return {} }
}
function timeLabel(seconds: number) {
  const whole = Math.max(0, Math.ceil(seconds))
  return String(Math.floor(whole / 60)).padStart(2, '0') + ':' + String(whole % 60).padStart(2, '0')
}
// Keep assigned assessment data immutable; improve only the presentation of the
// published directions for the standard timed classroom quiz.
const standardQuizDirections = '20 minutes + 2 minutes extra time. 14 multiple-choice questions (5 points each) and 1 coding task (30 points). Total: 100 points. Work independently. Python IDE allowed; no AI or outside help. Submit before time expires.'
function usesStandardQuizDirections(assessment: Assessment) {
  return assessment.instructions.trim() === standardQuizDirections &&
    assessment.duration_seconds === 1200 && assessment.grace_seconds === 120 &&
    assessment.questions.length === 15 &&
    assessment.questions.slice(0, 14).every(q => q.kind === 'multiple_choice' && q.points === 5) &&
    assessment.questions[14]?.kind === 'python' && assessment.questions[14]?.points === 30
}
function AssessmentDirections({ assessment }: { assessment: Assessment }) {
  if (!usesStandardQuizDirections(assessment)) return <p className="question-prompt">{assessment.instructions}</p>
  return <section aria-label="Assessment directions" className="exam-directions">
    <style>{`
      .exam-directions{max-width:780px;margin:16px 0 20px;font-size:.96rem;line-height:1.55}
      .exam-directions p{margin:6px 0;line-height:1.55}
      .exam-directions-meta{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;border-bottom:1px solid var(--line,#dce5df);padding:0 0 12px;margin-bottom:4px}
      .exam-directions-meta div{padding:8px 12px;border:1px solid var(--line,#dce5df);border-radius:8px;background:rgba(23,107,77,.035)}
      .exam-directions-meta span,.exam-directions-section small{display:block;font-size:.8rem;color:var(--muted,#526359)}
      .exam-directions-section{padding:10px 0;border-bottom:1px solid var(--line,#dce5df)}
      .exam-directions-section h2,.exam-directions-rules h2{font-weight:700;line-height:1.4;font-size:1rem;margin:0;color:inherit;letter-spacing:normal}
      .exam-directions-section header{display:flex;align-items:baseline;justify-content:space-between;gap:8px;flex-wrap:wrap}
      .exam-directions-section header strong{white-space:nowrap}
      .exam-directions-rules{padding-top:12px}
      @media(max-width:420px){.exam-directions-meta div{padding:7px 9px}.exam-directions{font-size:.9rem}}
    `}</style>
    <div className="exam-directions-meta">
      <div><span>Time limit</span><strong>20 minutes</strong><span>2-minute grace period</span></div>
      <div><span>Total points</span><strong>100 points</strong><span>15 questions</span></div>
    </div>
    <div className="exam-directions-section">
      <header><h2>Section I: Multiple Choice</h2><strong>70 points</strong></header>
      <small>Questions 1–14 · 5 points each</small>
      <p>Select the best answer for each question.</p>
    </div>
    <div className="exam-directions-section">
      <header><h2>Section II: Programming</h2><strong>30 points</strong></header>
      <small>Question 15</small>
      <p>Write and test a Python program that meets the given requirements. Partial credit is available.</p>
    </div>
    <div className="exam-directions-rules">
      <h2>General Directions</h2>
      <p>Work independently. You may use the Python IDE to write and test your code. AI tools and assistance from others are not permitted.</p>
      <p>Review your answers and submit your work before time expires.</p>
    </div>
  </section>
}
export function AssessmentWorkspacePage() {
  const { assessmentId } = useParams()
  const { session } = useAuth()
  return <AssessmentWorkspace key={`${session?.user.id}:${assessmentId}`} assessmentId={assessmentId!}/>
}

function AssessmentWorkspace({ assessmentId }: { assessmentId: string }) {
  const { session, role } = useAuth()
  const staff = role === 'teacher' || role === 'admin'
  const userId = session!.user.id
  const storageKey = `apu-assessment-v1:${userId}:${assessmentId}`
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [submission, setSubmission] = useState<AssessmentSubmission | null>(null)
  const [answers, setAnswers] = useState<AssessmentAnswers>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saveState, setSaveState] = useState('No changes yet')
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [now, setNow] = useState(Date.now())
  const marksKey = storageKey + ':review'
  const [marks, setMarks] = useState<ReviewMarks>(() => readMarks(marksKey))
  const [marksWarning, setMarksWarning] = useState('')
  const [active, setActive] = useState(0)
  const [starting, setStarting] = useState(false)
  const automatic = useRef(false)
  const timed = Boolean(assessment?.duration_seconds) && !staff
  const started = Boolean(submission?.started_at)
  const startTime = submission?.started_at ? new Date(submission.started_at).getTime() : null
  const normalEnd = startTime === null ? null : startTime + (assessment?.duration_seconds ?? 0) * 1000
  const end = normalEnd === null ? null : normalEnd + (assessment?.grace_seconds ?? 0) * 1000
  const expired = timed && end !== null && now >= end
  const grace = timed && normalEnd !== null && now >= normalEnd && !expired
  const remaining = normalEnd === null ? (assessment?.duration_seconds ?? 0) : Math.max(0, ((grace ? end! : normalEnd) - now) / 1000)
  const updateMark = (id: string, value: { flagged?: boolean; note?: string }) => setMarks(old => ({ ...old, [id]: { ...old[id], ...value } }))
  useEffect(() => {
    if (staff) return
    try { localStorage.setItem(marksKey, JSON.stringify(marks)); setMarksWarning('') } catch { setMarksWarning('Review flags and notes cannot be saved on this device.') }
  }, [marks, marksKey, staff])
  const latest = useRef<AssessmentAnswers>({})
  const dirty = useRef(false)
  const finalizing = useRef(false)
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const done = submission?.status === 'submitted'
  const closed = assessment?.status !== 'published' || Boolean(assessment.due_at && new Date(assessment.due_at).getTime() <= now)
  const locked = done || busy || (!staff && closed) || (timed && (!started || expired))
  const canEdit = useRef(!locked)
  canEdit.current = !locked
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(timer) }, [])
  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true); setError(''); dirty.current = false
      const [a, s] = await Promise.all([
        supabase.from('cs_assessments').select('*,cs_courses(title)').eq('id', assessmentId!).single(),
        staff ? Promise.resolve({ data: null, error: null }) : supabase.from('cs_assessment_submissions').select('*,cs_assessment_reviews(*)').eq('assessment_id', assessmentId!).eq('student_id', userId).maybeSingle(),
      ])
      if (cancelled) return
      if (a.error || s.error) { setError(a.error?.message ?? s.error?.message ?? 'Could not load the assessment.'); setLoading(false); return }
      const item = a.data as Assessment; const saved = s.data ? normalizeSubmission(s.data) : null
      let restored = saved?.answers ?? initialAnswers(item.questions)
      if (!staff && saved?.status !== 'submitted' && (!item.duration_seconds || saved?.started_at)) {
        try {
          const local = JSON.parse(localStorage.getItem(storageKey) ?? 'null') as CachedWork | null
          if (local?.answers && (!saved || new Date(local.updated_at) > new Date(saved.updated_at))) { restored = local.answers; dirty.current = true; setSaveState('Local draft restored; syncing…') }
        } catch { /* Local storage does not block cloud work. */ }
      }
      setAssessment(item); setSubmission(saved); latest.current = restored; setAnswers(restored)
      if (saved && !dirty.current) setSaveState(saved.status === 'submitted' ? 'Submission saved to the cloud' : `Saved to the cloud at ${formatDate(saved.updated_at)}`)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [assessmentId, userId, staff, storageKey])

  const beginAttempt = async () => {
    if (!assessment || starting || staff || closed || started) return
    setStarting(true); setError('')
    try {
      const initial = initialAnswers(assessment.questions)
      const result = await supabase.from('cs_assessment_submissions').insert({ assessment_id: assessmentId, student_id: userId, answers: initial, status: 'draft' }).select('*,cs_assessment_reviews(*)').single()
      let data = result.data
      if (result.error) {
        const existing = await supabase.from('cs_assessment_submissions').select('*,cs_assessment_reviews(*)').eq('assessment_id', assessmentId).eq('student_id', userId).maybeSingle()
        if (!existing.data) throw new Error(result.error.message)
        data = existing.data
      }
      const saved = normalizeSubmission(data)
      latest.current = saved.answers; setAnswers(saved.answers); setSubmission(saved); setNow(Date.now())
      setSaveState('Attempt started and saved to the cloud')
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not start the assessment. Please try again.') }
    finally { setStarting(false) }
  }
  const persist = useCallback(async (snapshot: AssessmentAnswers, status: 'draft' | 'submitted') => {
    const request = timed
      ? supabase.from('cs_assessment_submissions').update({ answers: snapshot, status }).eq('assessment_id', assessmentId).eq('student_id', userId)
      : supabase.from('cs_assessment_submissions').upsert({ assessment_id: assessmentId, student_id: userId, answers: snapshot, status }, { onConflict: 'assessment_id,student_id' })
    const { data, error } = await request.select('*,cs_assessment_reviews(*)').single()
    if (error) throw new Error(error.message)
    const saved = normalizeSubmission(data)
    setSubmission(saved)
    if (JSON.stringify(latest.current) === JSON.stringify(snapshot)) {
      dirty.current = false
      try { localStorage.removeItem(storageKey) } catch { /* Cloud save is confirmed. */ }
      setSaveState(status === 'submitted' ? 'Submission saved to the cloud' : `Saved to the cloud at ${formatDate(saved.updated_at)}`)
    }
    return saved
  }, [assessmentId, userId, storageKey, timed])

  const saveDraft = useCallback(() => {
    if (staff || finalizing.current || !dirty.current || closed || done || (timed && (!started || expired))) return
    const snapshot = structuredClone(latest.current)
    setSaveState('Saving to the cloud…')
    queue.current = queue.current.catch(() => undefined).then(() => persist(snapshot, 'draft')).catch(error => {
      setSaveState(`Not synced: ${error.message}. Your draft is still saved on this device. Please try saving again.`)
    })
  }, [staff, closed, done, persist, timed, started, expired])
  useEffect(() => {
    if (loading) return
    const timer = setTimeout(saveDraft, timed ? 500 : 1800)
    return () => clearTimeout(timer)
  }, [answers, loading, saveDraft, timed])
  useEffect(() => {
    window.addEventListener('online', saveDraft)
    return () => window.removeEventListener('online', saveDraft)
  }, [saveDraft])
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => { if (dirty.current) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [])
  const change = (id: string, answer: QuestionAnswer) => {
    if (!canEdit.current || finalizing.current) return
    const next = { ...latest.current, [id]: answer }
    latest.current = next; setAnswers(next)
    if (!staff) {
      dirty.current = true
      try { localStorage.setItem(storageKey, JSON.stringify({ answers: next, updated_at: new Date().toISOString() })); setSaveState('Draft saved on this device; waiting to sync…') }
      catch { setSaveState('Waiting to save to the cloud…') }
    }
  }
  const submit = useCallback(async () => {
    if (!assessment || finalizing.current || staff || done || (timed && !started)) return
    finalizing.current = true; setBusy(true); setError('')
    try {
      await queue.current
      const saved = await persist(structuredClone(latest.current), 'submitted')
      const lastLocal = JSON.stringify(latest.current)
      latest.current = saved.answers; setAnswers(saved.answers); setConfirming(false)
      dirty.current = false
      setSaveState('Submission saved to the cloud')
      if (lastLocal !== JSON.stringify(saved.answers)) setError('Time expired before every local change synced. Your last cloud-saved work was submitted; a local recovery copy remains on this device.')
      else { try { localStorage.removeItem(storageKey) } catch { /* Submitted. */ } }
    } catch (error) {
      // Recover an acknowledged server submission whose response was lost.
      const check = await supabase.from('cs_assessment_submissions').select('*,cs_assessment_reviews(*)').eq('assessment_id', assessmentId!).eq('student_id', userId).maybeSingle()
      if (check.data?.status === 'submitted') {
        const saved = normalizeSubmission(check.data)
        setSubmission(saved); latest.current = saved.answers; setAnswers(saved.answers); dirty.current = false; setConfirming(false)
        try { localStorage.removeItem(storageKey) } catch { /* Submission is confirmed. */ }
      } else setError(error instanceof Error ? error.message : 'Submission failed. Your work is preserved so you can retry.')
    }
    finally { finalizing.current = false; setBusy(false) }
  }, [assessment, staff, done, timed, started, persist, assessmentId, userId, storageKey])
  useEffect(() => {
    if (!loading && timed && started && expired && !done && !closed && !automatic.current) {
      automatic.current = true
      setConfirming(false)
      void submit()
    }
  }, [loading, timed, started, expired, done, closed, submit])
  useEffect(() => {
    if (!timed || !started || !expired || done || closed) return
    const retry = () => void submit()
    window.addEventListener('online', retry)
    return () => window.removeEventListener('online', retry)
  }, [timed, started, expired, done, closed, submit])
  if (loading) return <main className="page" role="status">Loading assessment and saved work…</main>
  if (!assessment) return <main className="page"><Link className="back" to="/assessments">Back to Quiz & Code</Link><p className="alert" role="alert">{error || 'Assessment not found.'}</p></main>
  const questions = done ? submission.question_snapshot : assessment.questions
  const requiredQuestions = questions.filter(q => q.required !== false)
  const completed = requiredQuestions.filter(q => isAnswered(q, answers)).length
  const activeIndex = Math.min(active, Math.max(0, questions.length - 1))
  const current = questions[activeIndex]
  const flagged = questions.filter(q => marks[q.id]?.flagged).length
  const nextUnanswered = questions.findIndex(q => !isAnswered(q, answers))
  const go = (i: number) => {
    setActive(i)
    document.getElementById('assessment-current')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  if (timed && !started && !done) return <main className="lab-page assessment-page"><Link className="back" to="/assessments"><ArrowLeft size={16}/> Quiz & Code</Link><section className="panel"><p className="eyebrow">{assessment.cs_courses?.title}</p><h1>{displayTitle(assessment.title)}</h1><AssessmentDirections assessment={assessment}/><p>{!usesStandardQuizDirections(assessment) && <><strong>{timeLabel(assessment.duration_seconds ?? 0)}</strong> working time + <strong>{timeLabel(assessment.grace_seconds ?? 0)}</strong> extra time. </>}The timer starts when you select Start assessment and keeps running if you refresh or leave this page. At the end, your latest cloud-saved work is submitted, including unfinished answers, when connected.</p><button className="button" disabled={starting || closed} onClick={() => void beginAttempt()}><Clock size={18}/> {starting ? 'Starting…' : 'Start assessment'}</button>{error && <p className="alert" role="alert">{error}</p>}{closed && <p className="alert">This assessment is closed.</p>}</section></main>
  return <main className="lab-page assessment-page"><Link className="back" to="/assessments"><ArrowLeft size={16}/> Quiz & Code</Link><div className="lab-heading"><div><p className="eyebrow">{assessment.cs_courses?.title}</p><h1>{displayTitle(assessment.title)}</h1><AssessmentDirections assessment={assessment}/>{(!usesStandardQuizDirections(assessment) || assessment.due_at) && <p className="work-meta">Due: {formatDate(assessment.due_at)}</p>}</div><span className="assessment-badge">{completed}/{requiredQuestions.length} required questions completed</span></div>
    {staff && <p className="status">Preview mode: try the quiz and Python exercises. Preview answers are not saved or submitted.</p>}
    {!staff && closed && !done && <p className="alert">This assessment is closed or past its due date. You can still view your saved draft.</p>}
    {done && <section className="assessment-success" role="status"><CheckCircle2/><div><h2>Submitted successfully</h2><p>Your answers and code were saved at {formatDate(submission.submitted_at)}. Submitted work is locked for teacher review.</p><p>Your teacher will announce official scores separately. You can use the answer key, when released, to review and correct your own mistakes.</p></div></section>}
    {done && !staff && <section className="panel"><h2>Review your answers</h2><p>Once your teacher finishes grading and releases the answer key, you can see explanations and a reference solution from your own account.</p><Link className="button secondary" to={`/assessments/${assessmentId}/answers`}>Answer key & explanations</Link></section>}
    <style>{`
      .exam-layout{display:grid;grid-template-columns:minmax(200px,240px) minmax(0,1fr);gap:20px;align-items:start}
      .exam-nav{position:sticky;top:12px;min-width:0;padding:16px}
      .exam-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px;margin:12px 0}
      .exam-cell{position:relative;display:flex;align-items:center;justify-content:center;gap:3px;min-height:42px;border:1px solid #778294;border-radius:9px;color:inherit;background:transparent;cursor:pointer;font-weight:600;padding:3px}
      .exam-cell[data-complete=true]{border-color:#15803d;background:rgba(34,197,94,.13)}
      .exam-cell[aria-current=step]{outline:2px solid #60a5fa;outline-offset:2px}
      .exam-flag{color:#d97706;position:absolute;right:2px;top:2px}
      .exam-legend{display:flex;gap:8px;flex-wrap:wrap;font-size:.78rem;align-items:center}
      .exam-timer{border:1px solid #64748b;border-radius:12px;padding:12px;margin:8px 0;font-variant-numeric:tabular-nums}
      .exam-timer[data-grace=true]{border:2px solid #d97706}
      .exam-time{font-size:1.8rem;font-weight:700;letter-spacing:.03em}
      .exam-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:space-between;align-items:center;margin:12px 0}
      .exam-note-card{margin:12px 0 16px;padding:14px;border-radius:12px;border:1px solid #e0c56a;background:#fff6c4;color:#493b13;box-shadow:0 2px 5px rgba(72,57,12,.06)}
      .exam-note-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px}
      .exam-note-head strong{font-size:.98rem;color:#493b13}
      .exam-note-head span,.exam-note-card small{font-size:.8rem;color:#66531d}
      .exam-note-head span{margin-left:auto}
      .exam-note-card .field{margin:0;display:block}
      .exam-note-card textarea{display:block;width:100%;min-height:96px;box-sizing:border-box;resize:vertical;font:inherit;line-height:1.45;padding:10px 12px;border:1px solid #c8a94c;border-radius:8px;background:#fffdef;color:#382e10}
      .exam-note-card textarea::placeholder{color:#77632c}
      .exam-note-card textarea:focus-visible{outline:2px solid #926b13;outline-offset:2px}
      .exam-note-card small{display:block;margin-top:7px}
      @media(max-width:480px){.exam-note-card{padding:12px}.exam-note-head span{margin-left:0;width:100%}.exam-note-card textarea{min-height:84px}}
      .exam-content{min-width:0}
      .exam-content [hidden]{display:none!important}
      @media(max-width:780px){.exam-layout{grid-template-columns:minmax(0,1fr);gap:10px}.exam-nav{position:static}.exam-grid{grid-template-columns:repeat(8,minmax(0,1fr))}.exam-time{font-size:1.4rem}}
      @media(max-width:380px){.exam-grid{grid-template-columns:repeat(5,minmax(0,1fr))}.exam-actions .button{font-size:.82rem}}
    `}</style>
    <div className="exam-layout">
      <aside className="panel exam-nav" aria-label="Question navigator">
        {timed && !done && <div className="exam-timer" data-grace={grace || expired}><div><Clock size={16}/> {expired ? 'Time expired' : grace ? 'Extra time' : 'Time remaining'}</div><div className="exam-time" role="timer" aria-label="Time remaining">{expired ? '00:00' : timeLabel(remaining)}</div><small>{expired ? 'Answers locked. Submitting saved work.' : grace ? 'Use this time to review and submit.' : `+ ${timeLabel(assessment.grace_seconds ?? 0)} extra time`}</small></div>}
        <strong>Questions</strong><p className="work-meta">{completed}/{requiredQuestions.length} answered · {flagged} flagged</p>
        <div className="exam-grid">{questions.map((q,i) => <button type="button" key={q.id} className="exam-cell" data-complete={isAnswered(q,answers)} aria-current={i===activeIndex?'step':undefined} aria-label={`Question ${i+1}, ${isAnswered(q,answers)?'answered':'unanswered'}${marks[q.id]?.flagged?', flagged':''}${marks[q.id]?.note?', has note':''}`} onClick={() => go(i)}>{i+1}{isAnswered(q,answers)&&<CheckCircle2 size={12}/>}{marks[q.id]?.flagged&&<Flag className="exam-flag" size={12} fill="currentColor"/>}</button>)}</div>
        <div className="exam-legend"><span>○ Unanswered</span><span>✓ Answered</span><span><Flag size={12}/> Flagged</span></div>
        {nextUnanswered >= 0 && <button className="button secondary" style={{marginTop:12,width:'100%'}} onClick={() => go(nextUnanswered)}>Go to unanswered</button>}
        {flagged > 0 && <button className="button secondary" style={{marginTop:8,width:'100%'}} onClick={() => {const next=questions.findIndex((q,i)=>i>activeIndex&&marks[q.id]?.flagged);go(next>=0?next:questions.findIndex(q=>marks[q.id]?.flagged))}}>Review flagged</button>}
        {marksWarning && <p role="alert">{marksWarning}</p>}
      </aside>
      <div className="exam-content" id="assessment-current">
        <div className="exam-actions"><button className="button secondary" disabled={activeIndex===0} onClick={() => go(activeIndex-1)}><ChevronLeft size={16}/> Previous</button><span className="work-meta">Question {activeIndex+1} of {questions.length}</span><button className="button secondary" disabled={activeIndex===questions.length-1} onClick={() => go(activeIndex+1)}>Next <ChevronRight size={16}/></button></div>
        {current && !done && <div className="exam-actions"><button type="button" className="button secondary" disabled={locked} aria-pressed={Boolean(marks[current.id]?.flagged)} onClick={() => updateMark(current.id,{flagged:!marks[current.id]?.flagged})}><Flag size={16} fill={marks[current.id]?.flagged?'currentColor':'none'}/>{marks[current.id]?.flagged?'Flagged for review':'Flag for review'}</button>{!isAnswered(current,answers)&&<span className="work-meta">Unanswered</span>}</div>}
        {questions.map((q,i)=><div key={q.id} hidden={i!==activeIndex}><AssessmentQuestion question={q} number={i+1} answer={answers[q.id]??{}} locked={locked} result={undefined} onChange={answer=>change(q.id,answer)}/></div>)}
        {current && !done && <section className="exam-note-card" key={current.id} aria-label="Scratch notes"><div className="exam-note-head"><StickyNote size={17} aria-hidden="true"/><strong>Scratch notes</strong><span>Question {activeIndex+1} · Private</span></div><label className="field"><span className="sr-only">Scratch notes for question {activeIndex+1}</span><textarea value={marks[current.id]?.note??''} disabled={locked} maxLength={2000} placeholder="Jot down an idea or something to revisit..." onChange={e=>updateMark(current.id,{note:e.target.value})}/></label><small>Saved on this device. Not included in your submission or score.</small></section>}
        <div className="exam-actions"><button className="button secondary" disabled={activeIndex===0} onClick={()=>go(activeIndex-1)}><ChevronLeft size={16}/> Previous</button><button className="button secondary" disabled={activeIndex===questions.length-1} onClick={()=>go(activeIndex+1)}>Next <ChevronRight size={16}/></button></div>
      </div>
    </div>
    {error && <p className="alert" role="alert">{error}</p>}
    {!staff && !done && <div className="assessment-footer"><span className="assessment-save" role="status"><Cloud size={18}/>{saveState}</span><div className="heading-actions"><button className="button secondary" disabled={busy || closed || expired} onClick={saveDraft}><Save size={17}/> Save draft</button><button className="button" disabled={busy || closed || (!timed && completed !== requiredQuestions.length)} onClick={() => expired ? void submit() : setConfirming(true)}><Send size={17}/> Submit</button></div>{completed !== requiredQuestions.length && <small>{timed ? 'You may submit incomplete work. Unanswered questions receive no credit.' : 'Complete the required questions before submitting.'}</small>}</div>}
    {confirming && <dialog className="assessment-confirm" style={{ margin: 0 }} ref={dialog => { if (dialog && !dialog.open) dialog.showModal() }} aria-labelledby="confirm-title" onCancel={event => { event.preventDefault(); if (!busy) setConfirming(false) }}><h2 id="confirm-title">Submit this assessment?</h2><p>You have completed {completed}/{requiredQuestions.length} required questions. {timed && completed !== requiredQuestions.length ? 'Unanswered questions receive no credit. ' : ''}After submission, your answers and code will be locked.</p><div className="heading-actions"><button className="button secondary" disabled={busy} onClick={() => setConfirming(false)}>Continue reviewing</button><button className="button" disabled={busy} onClick={() => void submit()}>{busy ? 'Submitting…' : 'Confirm submission'}</button></div></dialog>}
  </main>
}
