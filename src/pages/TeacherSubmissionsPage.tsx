import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Clock, Code2, MessageSquare, Save, Search } from 'lucide-react'
import { supabase } from '../lib/supabase/client'
import { useAuth } from '../features/auth/AuthProvider'
import type { Attempt, CodeWorkspace } from '../types/classroom'

type ReviewTab = 'saved' | 'submitted'

export function TeacherSubmissionsPage() {
  const { session } = useAuth()
  const [tab, setTab] = useState<ReviewTab>('saved')
  const [workspaces, setWorkspaces] = useState<CodeWorkspace[]>([])
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    const [workspaceResult, attemptResult] = await Promise.all([
      supabase.from('cs_code_workspaces').select('*,cs_profiles(full_name,email),cs_activities(title),cs_workspace_feedback(*)').order('updated_at', { ascending: false }),
      supabase.from('cs_activity_attempts').select('*,cs_profiles(full_name,email),cs_activities(title),cs_teacher_feedback(*)').order('submitted_at', { ascending: false }),
    ])
    if (workspaceResult.error || attemptResult.error) {
      setMessage(workspaceResult.error?.message ?? attemptResult.error?.message ?? 'Could not load student work')
      return
    }
    const workspaceRows = (workspaceResult.data ?? []) as CodeWorkspace[]
    const attemptRows = (attemptResult.data ?? []) as Attempt[]
    setWorkspaces(workspaceRows)
    setAttempts(attemptRows)
    setDrafts(Object.fromEntries([
      ...workspaceRows.map((workspace) => [`workspace-${workspace.id}`, workspace.cs_workspace_feedback?.[0]?.comment ?? '']),
      ...attemptRows.map((attempt) => [`attempt-${attempt.id}`, attempt.cs_teacher_feedback?.[0]?.comment ?? '']),
    ]))
  }, [])

  useEffect(() => { void load() }, [load])

  const saveWorkspaceReview = async (workspace: CodeWorkspace) => {
    const comment = (drafts[`workspace-${workspace.id}`] ?? '').trim()
    if (!comment) return
    const existing = workspace.cs_workspace_feedback?.[0]
    const request = existing
      ? supabase.from('cs_workspace_feedback').update({ comment, updated_at: new Date().toISOString() }).eq('id', existing.id)
      : supabase.from('cs_workspace_feedback').insert({ workspace_id: workspace.id, student_id: workspace.student_id, teacher_id: session!.user.id, comment })
    const { error } = await request
    setMessage(error?.message ?? 'Review saved and visible to the student')
    void load()
  }

  const saveSubmissionFeedback = async (attempt: Attempt) => {
    const comment = (drafts[`attempt-${attempt.id}`] ?? '').trim()
    if (!comment) return
    const existing = attempt.cs_teacher_feedback?.[0]
    const request = existing
      ? supabase.from('cs_teacher_feedback').update({ comment, updated_at: new Date().toISOString() }).eq('id', existing.id)
      : supabase.from('cs_teacher_feedback').insert({ attempt_id: attempt.id, student_id: attempt.student_id, teacher_id: session!.user.id, comment })
    const { error } = await request
    setMessage(error?.message ?? 'Feedback saved and visible to the student')
    void load()
  }

  const normalizedQuery = query.trim().toLowerCase()
  const matches = (student = '', activity = '') => `${student} ${activity}`.toLowerCase().includes(normalizedQuery)
  const visibleWorkspaces = workspaces.filter((workspace) => matches(workspace.cs_profiles?.full_name || workspace.cs_profiles?.email, workspace.cs_activities?.title))
  const visibleAttempts = attempts.filter((attempt) => matches(attempt.cs_profiles?.full_name || attempt.cs_profiles?.email, attempt.cs_activities?.title))

  return <main className="page">
    <p className="eyebrow">CLASSWORK</p><h1>Student code</h1>
    <p className="lede">Open saved work, track submissions, and give feedback from one classroom inbox.</p>
    <div className="review-toolbar">
      <div className="tabs review-tabs">
        <button className={tab === 'saved' ? 'active' : ''} onClick={() => setTab('saved')}><Save size={17}/> Saved work <span>{workspaces.length}</span></button>
        <button className={tab === 'submitted' ? 'active' : ''} onClick={() => setTab('submitted')}><CheckCircle2 size={17}/> Submitted <span>{attempts.length}</span></button>
      </div>
      <label className="review-search"><Search size={17}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search student or exercise"/></label>
    </div>
    {message && <p className="status">{message}</p>}
    {tab === 'saved' ? <div className="submission-list">
      {visibleWorkspaces.map((workspace) => <article className="submission" key={workspace.id}>
        <div className="submission-head"><div className="avatar"><Code2/></div><div><h2>{workspace.cs_activities?.title}</h2><p>{workspace.cs_profiles?.full_name || workspace.cs_profiles?.email}</p></div><strong className="work-state">In progress</strong></div>
        <p className="work-meta">Last saved {new Date(workspace.updated_at).toLocaleString()}</p>
        <pre>{workspace.code || '# No code entered yet'}</pre>
        <div className="feedback-box"><label><MessageSquare size={17}/> Review this saved code</label><textarea value={drafts[`workspace-${workspace.id}`] ?? ''} onChange={(event) => setDrafts((current) => ({ ...current, [`workspace-${workspace.id}`]: event.target.value }))} placeholder="Name a strength and one useful next step…"/><button className="button compact" onClick={() => void saveWorkspaceReview(workspace)}>Save review</button></div>
      </article>)}
      {!visibleWorkspaces.length && <div className="empty"><Save/><h2>No saved work yet</h2><p>When students press Save code inside an exercise, their work appears here.</p></div>}
    </div> : <div className="submission-list">
      {visibleAttempts.map((attempt) => <article className="submission" key={attempt.id}>
        <div className="submission-head"><div className="avatar"><Code2/></div><div><h2>{attempt.cs_activities?.title}</h2><p>{attempt.cs_profiles?.full_name || attempt.cs_profiles?.email} · Attempt {attempt.attempt_number}</p></div><strong className={attempt.status === 'passed' ? 'score passed' : 'score'}>{Number(attempt.score)}%</strong></div>
        <pre>{attempt.code}</pre><footer>{attempt.status === 'passed' ? <CheckCircle2/> : <Clock/>}{attempt.status} · {new Date(attempt.submitted_at).toLocaleString()}</footer>
        <div className="feedback-box"><label><MessageSquare size={17}/> Submission feedback</label><textarea value={drafts[`attempt-${attempt.id}`] ?? ''} onChange={(event) => setDrafts((current) => ({ ...current, [`attempt-${attempt.id}`]: event.target.value }))} placeholder="Name a strength and one useful next step…"/><button className="button compact" onClick={() => void saveSubmissionFeedback(attempt)}>Save feedback</button></div>
      </article>)}
      {!visibleAttempts.length && <div className="empty"><Code2/><h2>No submissions yet</h2><p>Final attempts appear here after students press Submit.</p></div>}
    </div>}
  </main>
}
