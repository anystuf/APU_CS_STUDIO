import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase/client'
import { useAuth } from '../features/auth/AuthProvider'
import { readDraft, type IdeDraft } from '../utils/ide'

type Workspace = { user_id: string; files: IdeDraft['files']; active_file: string; stdin: string; revision: number; updated_at: string; cs_profiles: { full_name: string; email: string } | null }

export function StudentWorkspacesPage() {
  const { role } = useAuth()
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [selected, setSelected] = useState('')
  const [fileName, setFileName] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    setLoading(true); setError('')
    const { data, error } = await supabase.from('cs_ide_projects').select('*,cs_profiles(full_name,email)').order('updated_at', { ascending: false })
    if (error) setError(error.message)
    else setWorkspaces((data ?? []) as Workspace[])
    setLoading(false)
  }, [])
  useEffect(() => { void load() }, [load])
  const visible = workspaces.filter(workspace => `${workspace.cs_profiles?.full_name ?? ''} ${workspace.cs_profiles?.email ?? ''}`.toLowerCase().includes(search.toLowerCase()))
  const current = visible.find(workspace => workspace.user_id === selected) ?? visible[0]
  const draft = current ? readDraft(JSON.stringify({ files: current.files, activeFile: current.active_file, input: current.stdin, revision: current.revision, dirty: false })) : null
  const file = draft?.files.find(file => file.name === fileName) ?? draft?.files.find(file => file.name === draft.activeFile) ?? draft?.files[0]
  return <main className="page">
    <p className="eyebrow">CLOUD-SAVED PYTHON CODE</p><h1>Student workspaces</h1>
    <p className="lede">{role === 'admin' ? 'Administrator view of saved IDE workspaces.' : 'Saved IDE workspaces from students enrolled in your courses.'} These are live drafts, not final submissions. Review is read-only.</p>
    <p><Link to="/teacher/submissions">Review assigned activity submissions</Link></p>
    <div className="review-toolbar"><label className="field"><span>Search student</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Student name or email"/></label><button className="button secondary" disabled={loading} onClick={() => void load()}>Refresh saved work</button></div>
    {error && <p className="alert" role="alert">{error}</p>}
    {loading ? <p role="status">Loading saved workspaces…</p> : !visible.length ? <div className="empty"><h2>No saved workspaces found</h2><p>Students must press Save to cloud in Python IDE. Teachers need their students enrolled through Courses & students. Local-only drafts do not appear here.</p></div> : <>
      <label className="field"><span>Student · {visible.length} workspace(s)</span><select value={current!.user_id} onChange={event => { setSelected(event.target.value); setFileName('') }}>{visible.map(workspace => <option key={workspace.user_id} value={workspace.user_id}>{workspace.cs_profiles?.full_name || workspace.cs_profiles?.email || workspace.user_id}</option>)}</select></label>
      <article className="submission" style={{ marginTop: 20 }}>
        <h2>{current!.cs_profiles?.full_name || 'Student workspace'}</h2><p>{current!.cs_profiles?.email}</p><p>Last cloud save: {new Date(current!.updated_at).toLocaleString()} · Revision {current!.revision}</p>
        {!draft ? <p className="alert">Workspace format is invalid.</p> : <>
          <div className="tabs" aria-label="Saved Python files">{draft.files.map(item => <button key={item.name} className={file?.name === item.name ? 'active' : ''} aria-pressed={file?.name === item.name} onClick={() => setFileName(item.name)}>{item.name}</button>)}</div>
          <pre aria-label={`Saved code in ${file?.name}`}>{file?.code || '# Empty file'}</pre>
          <details><summary>Saved program input</summary><pre>{draft.input || '(No input)'}</pre></details>
        </>}
      </article>
    </>}
  </main>
}
