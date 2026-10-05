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
    if (a.error || s.error) setError(a.error?.message ?? s.error?.message ?? 'Không tải được bài kiểm tra.')
    else { setItems(a.data as Assessment[]); setWork((s.data ?? []).map(normalizeSubmission)) }
    setLoading(false)
  }, [])
  useEffect(() => { void load() }, [load])
  return <main className="page assessment-page">
    <div className="page-heading"><div><p className="eyebrow">APU CLASSROOM</p><h1>Quiz & Code</h1><p className="lede">Làm quiz, chạy Python và nộp bài trong cùng một nơi.</p></div>{staff && <Link to="/assessments/new" className="button"><Plus size={18}/> Tạo bài kiểm tra</Link>}</div>
    <section className="assessment-banner"><ClipboardCheck size={32}/><div><h2>{staff ? 'Một đề. Một lần nộp. Đầy đủ bài làm.' : 'Bài làm của em được lưu tự động.'}</h2><p>{staff ? 'Giao đề theo lớp, xem câu trả lời và code của từng học sinh, rồi trả điểm và nhận xét.' : 'Làm từng phần theo thứ tự em muốn. Kiểm tra trạng thái lưu trước khi rời trang và nộp khi đã hoàn thành.'}</p></div></section>
    {loading && <p role="status">Đang tải bài kiểm tra…</p>}
    {error && <div className="alert" role="alert">Không tải được dữ liệu: {error} <button className="button compact secondary" onClick={() => void load()}>Thử lại</button></div>}
    <div className="course-grid">{items.map(a => {
      const submissions = work.filter(s => s.assessment_id === a.id)
      const done = !staff && submissions.length > 0
      return <article className="course-card" key={a.id}><div className="assessment-card-top"><ClipboardCheck/><span className={`assessment-badge ${done ? 'submitted' : a.status}`}>{done ? 'Đã nộp' : a.status === 'draft' ? 'Nháp' : a.status === 'closed' ? 'Đã đóng' : 'Đang mở'}</span></div><h2>{a.title}</h2><p>{a.cs_courses?.title}</p><p>{a.questions.filter(q => q.kind !== 'python').length} câu quiz · {a.questions.filter(q => q.kind === 'python').length} bài Python · {a.questions.reduce((sum, q) => sum + q.points, 0)} điểm</p><p className="work-meta">Hạn nộp: {formatDate(a.due_at)}</p>{staff && <p>{submissions.length} bài đã nộp · {submissions.filter(s => s.cs_assessment_reviews?.length).length} đã chấm</p>}<Link className="text-link" to={staff ? `/assessments/${a.id}/review` : `/assessments/${a.id}`}>{staff ? 'Quản lý & chấm bài' : done ? 'Xem bài đã nộp' : 'Làm bài'} <ArrowRight size={16}/></Link>{staff && <Link to={`/assessments/${a.id}`} className="text-link"><Code2 size={16}/> Xem trước đề</Link>}</article>
    })}</div>
    {!loading && !error && !items.length && <div className="empty"><ClipboardCheck/><h2>Chưa có bài kiểm tra</h2><p>{staff ? 'Tạo đề gồm câu trắc nghiệm, tự luận và bài Python, rồi giao cho lớp.' : 'Bài kiểm tra xuất hiện ở đây khi giáo viên giao cho lớp của em.'}</p>{staff && <Link className="button" to="/assessments/new">Tạo đề đầu tiên</Link>}</div>}
  </main>
}
