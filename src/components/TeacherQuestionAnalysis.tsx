import { useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import type { Assessment, AssessmentSubmission, AssessmentQuestion } from '../types/assessment'
import './question-analysis.css'

type Missed = {
  student: string
  email: string
  studentId: string
  submissionId: string
  number: number
  question: AssessmentQuestion
  choice: number | null
  correct: number
  explanation: string
}
type Props = {
  assessment: Assessment
  submissions: AssessmentSubmission[]
  keys: Record<string, number>
  explanations: Record<string, string>
}
const answerLabel = (options: string[] | undefined, choice: number | null) => {
  if (choice === null) return 'Not answered'
  const value = options?.[choice]
  return choice >= 0 && value !== undefined
    ? '(' + String.fromCharCode(65 + choice) + ') ' + value : 'Unknown choice'
}
const summary = (s: string) => (s.split('\n')[0] ?? '').slice(0, 125)
const safeCell = (v: unknown) => {
  let s = String(v ?? '')
  if (/^\s*[=+@-]/.test(s)) s = "'" + s
  return '"' + s.replace(/"/g, '""') + '"'
}
function exportCsv(filename: string, rows: string[][]) {
  const text = '\uFEFF' + rows.map(row => row.map(safeCell).join(',')).join('\r\n') + '\r\n'
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export function TeacherQuestionAnalysis({ assessment, submissions, keys, explanations }: Props) {
  const [studentId, setStudentId] = useState('all')
  const [questionId, setQuestionId] = useState('all')
  const [mistakesOnly, setMistakesOnly] = useState(true)
  const submitted = useMemo(() => submissions.filter(s => s.status === 'submitted'), [submissions])
  const mcqs = assessment.questions.filter(q => q.kind === 'multiple_choice')
  const keyReady = mcqs.length > 0 && mcqs.every(q => {
    const correct = keys[q.id]
    return correct !== undefined && Number.isInteger(correct) && correct >= 0 && correct < (q.options?.length ?? 0)
  })
  const studentRows = useMemo(() => submitted.map(s => {
    const questions = (s.question_snapshot?.length ? s.question_snapshot : assessment.questions)
    const wrong: Missed[] = questions.flatMap((q,index) => {
      const correct = keys[q.id]
      if (q.kind !== 'multiple_choice' || correct === undefined || !Number.isInteger(correct)) return []
      const choice = s.answers?.[q.id]?.choice
      if (choice === correct) return []
      return [{
        student: s.cs_profiles?.full_name || s.cs_profiles?.email || 'Unknown student',
        email: s.cs_profiles?.email || '',
        studentId: s.student_id,
        submissionId: s.id,
        number: index+1,
        question: q,
        choice: Number.isInteger(choice) ? choice! : null,
        correct,
        explanation: explanations[q.id] || 'Explanation is not available yet.',
      }]
    })
    return { s, name: s.cs_profiles?.full_name || s.cs_profiles?.email || 'Unknown student',
      email: s.cs_profiles?.email || '', wrong,
      questionCount: questions.filter(q=>q.kind==='multiple_choice').length,
      graded: Number(s.manual_max_score)===0 || Boolean(s.cs_assessment_reviews?.length),
      total: Number(s.quiz_score) + Number(s.cs_assessment_reviews?.[0]?.manual_score ?? 0),
    }
  }).sort((a,b)=>a.name.localeCompare(b.name)), [submitted, assessment.questions, keys, explanations])
  const mistakes = studentRows.flatMap(row=>row.wrong)
  const shownStudents = studentRows.filter(r=>studentId==='all'||r.s.student_id===studentId)
  const shownMistakes = mistakes.filter(r=>(studentId==='all'||r.studentId===studentId)&&(questionId==='all'||r.question.id===questionId))
  const stats = mcqs.map((q,i)=>{
    const taking = submitted.filter(s => (s.question_snapshot ?? []).some(x=>x.id===q.id))
    const correct = taking.filter(s=>s.answers?.[q.id]?.choice===keys[q.id]).length
    return {q,index:i+1,correct,wrong:taking.length-correct,attempted:taking.length}
  })
  const allAnswers = shownStudents.flatMap(row => (row.s.question_snapshot || []).flatMap((q,i)=>{
    if(q.kind!=='multiple_choice'||(questionId!=='all'&&questionId!==q.id))return []
    const choice=row.s.answers?.[q.id]?.choice
    return [{student:row.name,email:row.email,studentId:row.s.student_id,
      submissionId:row.s.id,number:i+1,question:q,
      choice:Number.isInteger(choice)?choice!:null, correct:keys[q.id]!,
      explanation:explanations[q.id]||'Explanation is not available yet.'} satisfies Missed]
  }))
  const details=mistakesOnly?shownMistakes:allAnswers
  const saveCsv=()=>{
    const h=['Student','Email','Question','Question prompt','Student answer','Correct answer','Explanation','Question points']
    const rows=shownMistakes.map(m=>[m.student,m.email,'Q'+m.number,m.question.prompt,answerLabel(m.question.options,m.choice),answerLabel(m.question.options,m.correct),m.explanation,String(m.question.points)])
    exportCsv('apu-'+assessment.id+'-mcq-mistakes.csv',[h,...rows])
  }
  return <section className="panel question-analysis" aria-labelledby="qa-heading">
    <div className="qa-heading">
      <div><p className="eyebrow">TEACHER ONLY · ASSESSMENT INSIGHTS</p><h2 id="qa-heading">Question Analysis</h2>
      <p>See exactly which questions students missed, compare their answers with the answer key, and export an Excel-compatible report.</p></div>
      <button className="button secondary" type="button" disabled={!keyReady||!submitted.length} onClick={saveCsv}>
        <Download size={17}/> Export mistakes (CSV)
      </button>
    </div>
    {!keyReady ? <p className="alert" role="alert">The multiple-choice answer key is missing or incomplete.</p> : <>
      <div className="qa-metrics">
        <div><strong>{submitted.length}</strong><span>Submissions</span></div>
        <div><strong>{mcqs.length}</strong><span>MCQs</span></div>
        <div><strong>{mistakes.length}</strong><span>Incorrect responses</span></div>
      </div>
      <div className="qa-controls">
        <label className="field">Student<select value={studentId} onChange={e=>setStudentId(e.target.value)}>
          <option value="all">All students</option>
          {studentRows.map(r=><option key={r.s.id} value={r.s.student_id}>{r.name}</option>)}
        </select></label>
        <label className="field">Question<select value={questionId} onChange={e=>setQuestionId(e.target.value)}>
          <option value="all">All questions</option>
          {mcqs.map((q,i)=><option key={q.id} value={q.id}>Q{i+1}</option>)}
        </select></label>
        <label className="qa-checkbox"><input type="checkbox" checked={mistakesOnly} onChange={e=>setMistakesOnly(e.target.checked)}/> Show mistakes only</label>
      </div>
      <h3>Student overview</h3>
      <div className="qa-scroll"><table className="qa-table"><thead><tr>
        <th>Student</th><th>Correct MCQs</th><th>Wrong questions</th><th>MCQ score</th><th>Total</th><th>Review</th>
      </tr></thead><tbody>{shownStudents.map(r=><tr key={r.s.id}>
        <td><strong>{r.name}</strong></td><td>{r.questionCount-r.wrong.length}/{r.questionCount}</td>
        <td>{r.wrong.length?r.wrong.map(m=>'Q'+m.number).join(', '):'None'}</td>
        <td>{r.s.quiz_score}/{r.s.quiz_max_score}</td>
        <td>{r.graded?r.total+'/'+(Number(r.s.quiz_max_score)+Number(r.s.manual_max_score)):'Awaiting grading'}</td>
        <td><button className="button secondary compact" type="button" onClick={()=>{setStudentId(r.s.student_id);setQuestionId('all');setMistakesOnly(true)}}>Details</button></td>
      </tr>)}</tbody></table></div>
      <h3>Question performance</h3>
      <div className="qa-scroll"><table className="qa-table"><thead><tr>
        <th>Question</th><th>Topic / prompt</th><th>Correct</th><th>Wrong</th><th>Accuracy</th>
      </tr></thead><tbody>{stats.map(x=><tr key={x.q.id}>
        <td>Q{x.index}</td><td>{summary(x.q.prompt)}</td><td>{x.correct}/{x.attempted}</td><td>{x.wrong}</td>
        <td>{x.attempted?Math.round(x.correct/x.attempted*100)+'%':'—'}</td>
      </tr>)}</tbody></table></div>
      <h3>{mistakesOnly?'Incorrect answers':'All multiple-choice answers'}</h3>
      {details.length?<div className="qa-details">{details.map(x=><article className="qa-item" key={x.submissionId+':'+x.question.id}>
        <h4>{x.student} · Q{x.number} <span className={x.choice===x.correct?'qa-ok':'qa-incorrect'}>{x.choice===x.correct?'Correct':'Incorrect'}</span></h4>
        <p>{summary(x.question.prompt)}</p>
        <p><strong>Student selected: </strong>{answerLabel(x.question.options,x.choice)}</p>
        <p><strong>Correct answer: </strong>{answerLabel(x.question.options,x.correct)}</p>
        <p><strong>Explanation: </strong>{x.explanation}</p>
      </article>)}</div>:<p className="status">No matching incorrect answers. Select another student or question to continue.</p>}
    </>}
  </section>
}
