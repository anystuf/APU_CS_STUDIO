import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Cloud, Save, Send } from 'lucide-react'
import { supabase } from '../lib/supabase/client'
import { useAuth } from '../features/auth/AuthProvider'
import { AssessmentQuestion } from '../components/AssessmentQuestion'
import { formatDate, initialAnswers, isAnswered, normalizeSubmission } from '../utils/assessment'
import type { Assessment, AssessmentAnswers, AssessmentSubmission, QuestionAnswer } from '../types/assessment'

type CachedWork = { answers: AssessmentAnswers; updated_at: string }
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
  const [saveState, setSaveState] = useState('Chưa có thay đổi')
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [now, setNow] = useState(Date.now())
  const latest = useRef<AssessmentAnswers>({})
  const dirty = useRef(false)
  const finalizing = useRef(false)
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const done = submission?.status === 'submitted'
  const closed = assessment?.status !== 'published' || Boolean(assessment.due_at && new Date(assessment.due_at).getTime() <= now)
  const locked = done || busy || (!staff && closed)
  const canEdit = useRef(!locked)
  canEdit.current = !locked
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 10000); return () => clearInterval(timer) }, [])
  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true); setError(''); dirty.current = false
      const [a, s] = await Promise.all([
        supabase.from('cs_assessments').select('*,cs_courses(title)').eq('id', assessmentId!).single(),
        staff ? Promise.resolve({ data: null, error: null }) : supabase.from('cs_assessment_submissions').select('*,cs_assessment_reviews(*)').eq('assessment_id', assessmentId!).eq('student_id', userId).maybeSingle(),
      ])
      if (cancelled) return
      if (a.error || s.error) { setError(a.error?.message ?? s.error?.message ?? 'Không tải được đề.'); setLoading(false); return }
      const item = a.data as Assessment; const saved = s.data ? normalizeSubmission(s.data) : null
      let restored = saved?.answers ?? initialAnswers(item.questions)
      if (!staff && saved?.status !== 'submitted') {
        try {
          const local = JSON.parse(localStorage.getItem(storageKey) ?? 'null') as CachedWork | null
          if (local?.answers && (!saved || new Date(local.updated_at) > new Date(saved.updated_at))) { restored = local.answers; dirty.current = true; setSaveState('Đã khôi phục bản nháp trên máy này; đang đồng bộ…') }
        } catch { /* Local storage does not block cloud work. */ }
      }
      setAssessment(item); setSubmission(saved); latest.current = restored; setAnswers(restored)
      if (saved && !dirty.current) setSaveState(saved.status === 'submitted' ? 'Bài đã nộp và lưu trên hệ thống' : `Đã lưu trên hệ thống lúc ${formatDate(saved.updated_at)}`)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [assessmentId, userId, staff, storageKey])

  const persist = useCallback(async (snapshot: AssessmentAnswers, status: 'draft' | 'submitted') => {
    const { data, error } = await supabase.from('cs_assessment_submissions').upsert({ assessment_id: assessmentId, student_id: userId, answers: snapshot, status }, { onConflict: 'assessment_id,student_id' }).select('*,cs_assessment_reviews(*)').single()
    if (error) throw new Error(error.message)
    const saved = normalizeSubmission(data)
    setSubmission(saved)
    if (JSON.stringify(latest.current) === JSON.stringify(snapshot)) {
      dirty.current = false
      try { localStorage.removeItem(storageKey) } catch { /* Cloud save is confirmed. */ }
      setSaveState(status === 'submitted' ? 'Bài đã nộp và lưu trên hệ thống' : `Đã lưu trên hệ thống lúc ${formatDate(saved.updated_at)}`)
    }
    return saved
  }, [assessmentId, userId, storageKey])

  const saveDraft = useCallback(() => {
    if (staff || finalizing.current || !dirty.current || closed || done) return
    const snapshot = structuredClone(latest.current)
    setSaveState('Đang lưu trên hệ thống…')
    queue.current = queue.current.catch(() => undefined).then(() => persist(snapshot, 'draft')).catch(error => {
      setSaveState(`Chưa đồng bộ: ${error.message}. Bản nháp vẫn giữ trên máy này; hãy thử lưu lại.`)
    })
  }, [staff, closed, done, persist])
  useEffect(() => {
    if (loading) return
    const timer = setTimeout(saveDraft, 1800)
    return () => clearTimeout(timer)
  }, [answers, loading, saveDraft])
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
      try { localStorage.setItem(storageKey, JSON.stringify({ answers: next, updated_at: new Date().toISOString() })); setSaveState('Đã giữ nháp trên máy; đang chờ đồng bộ…') }
      catch { setSaveState('Đang chờ lưu trên hệ thống…') }
    }
  }
  const submit = async () => {
    if (!assessment || finalizing.current) return
    finalizing.current = true; setBusy(true); setError('')
    try {
      await queue.current
      const saved = await persist(structuredClone(latest.current), 'submitted')
      latest.current = saved.answers; setAnswers(saved.answers); setConfirming(false)
    } catch (error) {
      // Recover an acknowledged server submission whose response was lost.
      const check = await supabase.from('cs_assessment_submissions').select('*,cs_assessment_reviews(*)').eq('assessment_id', assessmentId!).eq('student_id', userId).maybeSingle()
      if (check.data?.status === 'submitted') {
        const saved = normalizeSubmission(check.data)
        setSubmission(saved); latest.current = saved.answers; setAnswers(saved.answers); dirty.current = false; setConfirming(false)
        try { localStorage.removeItem(storageKey) } catch { /* Submission is confirmed. */ }
      } else setError(error instanceof Error ? error.message : 'Nộp bài chưa thành công. Bài làm vẫn được giữ để thử lại.')
    }
    finally { finalizing.current = false; setBusy(false) }
  }
  if (loading) return <main className="page" role="status">Đang tải đề và bài làm…</main>
  if (!assessment) return <main className="page"><Link className="back" to="/assessments">Quay lại Quiz & Code</Link><p className="alert" role="alert">{error || 'Không tìm thấy bài kiểm tra.'}</p></main>
  const questions = done ? submission.question_snapshot : assessment.questions
  const completed = questions.filter(q => isAnswered(q, answers)).length
  const review = submission?.cs_assessment_reviews?.[0]
  return <main className="lab-page assessment-page"><Link className="back" to="/assessments"><ArrowLeft size={16}/> Quiz & Code</Link><div className="lab-heading"><div><p className="eyebrow">{assessment.cs_courses?.title}</p><h1>{assessment.title}</h1><p className="question-prompt">{assessment.instructions}</p><p className="work-meta">Hạn nộp: {formatDate(assessment.due_at)}</p></div><span className="assessment-badge">{completed}/{questions.length} câu đã làm</span></div>
    {staff && <p className="status">Chế độ xem trước: có thể thử quiz và Python, bài thử không được lưu hay nộp.</p>}
    {!staff && closed && !done && <p className="alert">Bài kiểm tra đã đóng hoặc hết hạn. Em vẫn có thể xem bản nháp đã lưu.</p>}
    {done && <section className="assessment-success" role="status"><CheckCircle2/><div><h2>Đã nộp bài thành công</h2><p>Hệ thống lưu cả câu trả lời và code lúc {formatDate(submission.submitted_at)}. Bài đã nộp được khóa để giáo viên chấm.</p><p>Trắc nghiệm: {submission.quiz_score}/{submission.quiz_max_score} điểm. {review ? `Tự luận & Python: ${review.manual_score}/${submission.manual_max_score} điểm. Tổng: ${Number(submission.quiz_score) + Number(review.manual_score)}/${Number(submission.quiz_max_score) + Number(submission.manual_max_score)}.` : submission.manual_max_score > 0 ? 'Phần tự luận & Python đang chờ giáo viên chấm.' : ''}</p>{review?.feedback && <p className="question-prompt"><strong>Nhận xét:</strong> {review.feedback}</p>}</div></section>}
    <div className="assessment-progress" aria-label="Tiến độ bài làm">{questions.map((q, i) => <button key={q.id} onClick={() => document.getElementById(`question-${q.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className={isAnswered(q, answers) ? 'complete' : ''}>Câu {i + 1}{isAnswered(q, answers) && <CheckCircle2 size={14}/>}</button>)}</div>
    {questions.map((q, i) => <AssessmentQuestion key={q.id} question={q} number={i + 1} answer={answers[q.id] ?? {}} locked={locked} onChange={answer => change(q.id, answer)}/>)}
    {error && <p className="alert" role="alert">{error}</p>}
    {!staff && !done && <div className="assessment-footer"><span className="assessment-save" role="status"><Cloud size={18}/>{saveState}</span><div className="heading-actions"><button className="button secondary" disabled={busy || closed} onClick={saveDraft}><Save size={17}/> Lưu nháp</button><button className="button" disabled={busy || closed || completed !== questions.length} onClick={() => setConfirming(true)}><Send size={17}/> Nộp bài</button></div>{completed !== questions.length && <small>Hoàn thành tất cả câu hỏi để nộp bài.</small>}</div>}
    {confirming && <dialog className="assessment-confirm" style={{ margin: 0 }} ref={dialog => { if (dialog && !dialog.open) dialog.showModal() }} aria-labelledby="confirm-title" onCancel={event => { event.preventDefault(); if (!busy) setConfirming(false) }}><h2 id="confirm-title">Nộp bài kiểm tra?</h2><p>Em đã làm {completed}/{questions.length} câu. Sau khi nộp, câu trả lời và code sẽ được khóa.</p><div className="heading-actions"><button className="button secondary" disabled={busy} onClick={() => setConfirming(false)}>Tiếp tục kiểm tra</button><button className="button" disabled={busy} onClick={() => void submit()}>{busy ? 'Đang nộp…' : 'Xác nhận nộp bài'}</button></div></dialog>}
  </main>
}
