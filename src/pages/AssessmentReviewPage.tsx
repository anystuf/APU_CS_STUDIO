import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Download, Eye, Lock, Send } from 'lucide-react'
import { useAuth } from '../features/auth/AuthProvider'
import { supabase } from '../lib/supabase/client'
import { formatDate, normalizeSubmission } from '../utils/assessment'
import type { Assessment, AssessmentSubmission } from '../types/assessment'

function download(name: string, content: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a'); link.href = url; link.download = name; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function AssessmentReviewPage() {
  const { assessmentId } = useParams()
  const { session } = useAuth()
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [submissions, setSubmissions] = useState<AssessmentSubmission[]>([])
  const [keys, setKeys] = useState<Record<string, number>>({})
  const [roster, setRoster] = useState<{ id: string; full_name: string; email: string }[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [score, setScore] = useState('')
  const [feedback, setFeedback] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    setLoading(true)
    const [a, s, k] = await Promise.all([
      supabase.from('cs_assessments').select('*,cs_courses(title,status)').eq('id', assessmentId!).single(),
      supabase.from('cs_assessment_submissions').select('*,cs_profiles(full_name,email),cs_assessment_reviews(*)').eq('assessment_id', assessmentId!).order('updated_at', { ascending: false }),
      supabase.from('cs_assessment_keys').select('answers').eq('assessment_id', assessmentId!).maybeSingle(),
    ])
    if (a.error || s.error || k.error) { setMessage(a.error?.message ?? s.error?.message ?? k.error?.message ?? 'Không tải được bài làm.'); setLoading(false); return }
    setAssessment(a.data as Assessment); setSubmissions((s.data ?? []).map(normalizeSubmission)); setKeys(k.data?.answers ?? {})
    const enrollments = await supabase.from('cs_enrollments').select('student_id,cs_profiles(id,full_name,email)').eq('course_id', a.data.course_id)
    if (enrollments.error) setMessage(enrollments.error.message)
    else setRoster((enrollments.data ?? []).flatMap(row => row.cs_profiles as unknown as { id: string; full_name: string; email: string }))
    setLoading(false)
  }, [assessmentId])
  useEffect(() => { void load() }, [load])
  const open = (s: AssessmentSubmission) => {
    setSelected(s.id); setScore(s.cs_assessment_reviews?.[0] ? String(s.cs_assessment_reviews[0].manual_score) : '')
    setFeedback(s.cs_assessment_reviews?.[0]?.feedback ?? '')
  }
  const changeStatus = async (status: 'published' | 'closed') => {
    setBusy(true)
    const { error } = await supabase.from('cs_assessments').update({ status }).eq('id', assessmentId!)
    setMessage(error?.message ?? (status === 'published' ? 'Đã giao đề cho học sinh trong lớp.' : 'Đã đóng bài kiểm tra. Bài làm đã lưu vẫn được giữ.'))
    if (!error) await load()
    setBusy(false)
  }
  const current = submissions.find(s => s.id === selected)
  const saveReview = async (event: FormEvent) => {
    event.preventDefault()
    if (!current || !Number.isFinite(Number(score)) || Number(score) < 0 || Number(score) > Number(current.manual_max_score)) return
    setBusy(true)
    const { error } = await supabase.from('cs_assessment_reviews').upsert({ submission_id: current.id, teacher_id: session!.user.id, manual_score: Number(score), feedback })
    setMessage(error?.message ?? 'Đã lưu điểm và nhận xét; học sinh có thể xem trong bài đã nộp.')
    if (!error) await load()
    setBusy(false)
  }
  if (loading && !assessment) return <main className="page">Đang tải bài làm…</main>
  if (!assessment) return <main className="page"><Link to="/assessments">Quiz & Code</Link><p className="alert">{message || 'Không tìm thấy đề.'}</p></main>
  const submitted = submissions.filter(s => s.status === 'submitted')
  const graded = submitted.filter(s => s.cs_assessment_reviews?.length)
  const visible = submissions.filter(s => (filter === 'all' || (filter === 'draft' ? s.status === 'draft' : filter === 'pending' ? s.status === 'submitted' && !s.cs_assessment_reviews?.length : Boolean(s.cs_assessment_reviews?.length))) && `${s.cs_profiles?.full_name} ${s.cs_profiles?.email}`.toLowerCase().includes(query.toLowerCase()))
  const missing = roster.filter(p => !submitted.some(s => s.student_id === p.id))
  return <main className="page assessment-page"><Link className="back" to="/assessments"><ArrowLeft size={17}/> Quiz & Code</Link><div className="page-heading"><div><p className="eyebrow">GIÁO VIÊN · {assessment.cs_courses?.title}</p><h1>{assessment.title}</h1><p>Hạn nộp: {formatDate(assessment.due_at)}</p></div><div className="heading-actions"><Link className="button secondary" to={`/assessments/${assessment.id}`}><Eye size={17}/> Xem đề</Link>{assessment.status === 'draft' ? <button className="button" disabled={busy} onClick={() => void changeStatus('published')}><Send size={17}/> Giao cho lớp</button> : <button className="button secondary" disabled={busy} onClick={() => void changeStatus(assessment.status === 'published' ? 'closed' : 'published')}><Lock size={17}/>{assessment.status === 'published' ? 'Đóng bài' : 'Mở lại bài'}</button>}</div></div>
    {assessment.status === 'draft' && <p className="status">Đề đang ở bản nháp, học sinh chưa nhìn thấy. <Link to={`/assessments/${assessment.id}/edit`}>Sửa đề</Link> rồi xem lại trước khi giao.</p>}
    <div className="stat-grid"><article className="stat"><strong>{submitted.length}/{roster.length}</strong><span>Đã nộp / học sinh trong lớp</span></article><article className="stat"><strong>{submitted.length - graded.length}</strong><span>Bài chờ chấm</span></article><article className="stat"><strong>{graded.length}</strong><span>Đã trả điểm</span></article></div>
    {message && <p className="status" role="status">{message}</p>}
    <div className="review-toolbar"><label className="field">Tìm học sinh<input value={query} onChange={e => setQuery(e.target.value)} placeholder="Tên hoặc email"/></label><label className="field">Trạng thái<select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">Tất cả bài làm</option><option value="draft">Đang làm / nháp</option><option value="pending">Đã nộp, chờ chấm</option><option value="graded">Đã chấm</option></select></label><button className="button secondary" onClick={() => download('apu-assessment-submissions.json', JSON.stringify({ assessment, submissions }, null, 2))}><Download size={17}/> Tải bài làm</button><button className="button secondary" disabled={loading} onClick={() => void load()}>Làm mới</button></div>
    {missing.length > 0 && <details className="panel missing-students"><summary>{missing.length} học sinh chưa nộp</summary><p>{missing.map(p => p.full_name || p.email).join(', ')}</p></details>}
    <div className="assessment-review-grid"><section className="submission-list">{visible.map(s => <button className={`submission assessment-student ${selected === s.id ? 'selected' : ''}`} key={s.id} onClick={() => open(s)}><div><strong>{s.cs_profiles?.full_name || s.cs_profiles?.email}</strong><p>{s.cs_profiles?.email}</p><p>{s.status === 'draft' ? `Lưu nháp ${formatDate(s.updated_at)}` : `Nộp ${formatDate(s.submitted_at)}`}</p></div><span className="assessment-badge">{s.status === 'draft' ? 'Đang làm' : s.cs_assessment_reviews?.length ? 'Đã chấm' : 'Chờ chấm'}</span></button>)}{!visible.length && <div className="empty"><h2>Chưa có bài làm phù hợp</h2><p>Bài làm xuất hiện khi học sinh bắt đầu lưu nháp hoặc nộp bài.</p></div>}</section>
    <section>{current ? <article className="panel"><h2>{current.cs_profiles?.full_name || current.cs_profiles?.email}</h2><p>Trắc nghiệm: {current.quiz_score}/{current.quiz_max_score} · Tự luận & Python: tối đa {current.manual_max_score} điểm</p>{current.question_snapshot.map((q, i) => {
      const answer = current.answers[q.id]
      return <section key={q.id} className="review-answer"><h3>Câu {i + 1} · {q.points} điểm</h3><p className="question-prompt">{q.prompt}</p>{q.kind === 'multiple_choice' ? <><p><strong>Học sinh chọn:</strong> {answer?.choice === undefined ? 'Chưa trả lời' : q.options?.[answer.choice]}</p><p className="answer-key">Đáp án: {q.options?.[keys[q.id] ?? -1]}</p></> : q.kind === 'short_answer' ? <p className="question-prompt">{answer?.text || 'Chưa trả lời'}</p> : <><pre className="review-code">{answer?.code || '# Chưa có code'}</pre>{answer?.stdout && <pre className="review-output">{answer.stdout}</pre>}{answer?.stderr && <pre className="review-output">{answer.stderr}</pre>}<button className="button secondary compact" onClick={() => download(`cau-${i + 1}.py`, answer?.code ?? '', 'text/x-python')}><Download size={15}/> Tải code .py</button></>}</section>
    })}{current.status === 'submitted' ? <form className="form-grid" onSubmit={event => void saveReview(event)}><label className="field">Điểm tự luận & Python (tối đa {current.manual_max_score})<input type="number" min={0} max={current.manual_max_score} step="0.5" required value={score} onChange={e => setScore(e.target.value)}/></label><label className="field">Nhận xét cho học sinh<textarea value={feedback} maxLength={10000} onChange={e => setFeedback(e.target.value)} placeholder="Điểm tốt và phần cần sửa…"/></label><p>Tổng điểm: {Number(current.quiz_score) + Number(score)}/{Number(current.quiz_max_score) + Number(current.manual_max_score)}</p><button className="button" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu điểm & nhận xét'}</button></form> : <p className="status">Học sinh chưa nộp bài. Bản nháp này chỉ để theo dõi tiến độ.</p>}</article> : <div className="empty"><h2>Chọn một học sinh</h2><p>Xem quiz và code trong cùng một bài làm.</p></div>}</section></div>
  </main>
}
