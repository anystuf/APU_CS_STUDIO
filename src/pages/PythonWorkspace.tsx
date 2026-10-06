import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { python } from '@codemirror/lang-python'
import { Download, FileCode2, PanelLeft, Play, Plus, Save, Square, Terminal, Upload } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthProvider'
import { supabase } from '../lib/supabase/client'
import { runPython, stopPython } from '../lib/pyodide/runner'
import { initialFiles, readDraft, validateFiles, type IdeDraft } from '../utils/ide'
import '../python-ide.css'
import '../python-projector.css'

export function PythonWorkspacePage() {
  const { session } = useAuth()
  return <Workspace key={session!.user.id} userId={session!.user.id}/>
}

function Workspace({ userId }: { userId: string }) {
  const key = `apu-python-workspace-${userId}`
  const [draft, setDraft] = useState<IdeDraft>(() => {
    try { return readDraft(localStorage.getItem(key)) ?? { files: initialFiles, activeFile: 'main.py', input: 'Student', revision: 0, dirty: false } }
    catch { return { files: initialFiles, activeFile: 'main.py', input: 'Student', revision: 0, dirty: false } }
  })
  const draftRef = useRef(draft)
  draftRef.current = draft
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState('')
  const [cloudTime, setCloudTime] = useState('')
  const [newName, setNewName] = useState('helpers.py')
  const [stdout, setStdout] = useState('')
  const [stderr, setStderr] = useState('')
  const [runState, setRunState] = useState('Ready to run')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [panel, setPanel] = useState<'code' | 'output'>('code')
  const [fontSize, setFontSize] = useState(18)
  const uploadRef = useRef<HTMLInputElement>(null)
  const active = draft.files.find(file => file.name === draft.activeFile) ?? draft.files[0]!

  useEffect(() => {
    let live = true
    void supabase.from('cs_ide_projects').select('*').eq('user_id', userId).maybeSingle().then(({ data, error }) => {
      if (!live) return
      if (error) setMessage(`Cloud could not load: ${error.message}. Your local draft is preserved.`)
      else if (data) {
        const remote = readDraft(JSON.stringify({ files: data.files, activeFile: data.active_file, input: data.stdin, revision: data.revision, dirty: false }))
        if (!remote) setMessage('Cloud workspace format is invalid. Your local draft is preserved.')
        else {
          setCloudTime(data.updated_at)
          if (draftRef.current.dirty) setMessage('Restored your unsaved local draft. Save to cloud when ready. If another device changed the workspace, load cloud before saving.')
          else setDraft(remote)
        }
      }
      setLoading(false)
    })
    return () => { live = false; if (runningRef.current) stopPython() }
  }, [userId])
  const runningRef = useRef(false)

  useEffect(() => {
    if (loading) return
    try { localStorage.setItem(key, JSON.stringify(draft)) }
    catch { setMessage('Browser storage is full or unavailable. Save to cloud or download your code now.') }
  }, [draft, key, loading])

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (draftRef.current.dirty) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [])

  const edit = (change: Partial<IdeDraft>) => setDraft(current => ({ ...current, ...change, dirty: true }))
  const save = async () => {
    const snapshot = draftRef.current
    const invalid = validateFiles(snapshot.files)
    if (invalid) { setMessage(invalid); return }
    setSaving(true)
    try {
      const { data, error } = await supabase.rpc('cs_save_ide_project', { project_files: snapshot.files, selected_file: snapshot.activeFile, program_input: snapshot.input, expected_revision: snapshot.revision })
      if (error) throw error
      const saved = data?.[0]
      if (!saved) throw new Error('Cloud did not confirm this save.')
      setCloudTime(saved.updated_at)
      setDraft(current => ({ ...current, revision: saved.revision, dirty: current !== snapshot }))
      setMessage('Workspace saved to your account. All Python files and program input are saved.')
    } catch (error) { setMessage(error instanceof Error ? error.message : (error as { message?: string }).message ?? 'Cloud save failed. Your local draft is preserved.') }
    finally { setSaving(false) }
  }
  const reloadCloud = async () => {
    if (draftRef.current.dirty && !window.confirm('Replace your unsaved local draft with the cloud version? Download a backup first if you need it.')) return
    setLoading(true)
    const { data, error } = await supabase.from('cs_ide_projects').select('*').eq('user_id', userId).maybeSingle()
    if (error) setMessage(`Cloud load failed: ${error.message}`)
    else if (!data) setMessage('No cloud workspace yet. Save your current files first.')
    else {
      const remote = readDraft(JSON.stringify({ files: data.files, activeFile: data.active_file, input: data.stdin, revision: data.revision, dirty: false }))
      if (remote) { setDraft(remote); setCloudTime(data.updated_at); setMessage('Loaded your cloud workspace.') }
      else setMessage('Cloud workspace format is invalid. Local draft kept.')
    }
    setLoading(false)
  }
  const run = async () => {
    const snapshot = draftRef.current
    setRunning(true); runningRef.current = true
    setStdout(''); setStderr(''); setRunState(`Running ${snapshot.activeFile}…`)
    const start = performance.now()
    try {
      const result = await runPython(active.code, snapshot.input, snapshot.files, snapshot.activeFile)
      setStdout(result.stdout); setStderr(result.stderr)
      setRunState(`${result.stderr ? 'Finished with errors or stopped' : 'Finished'} · ${((performance.now() - start) / 1000).toFixed(2)}s`)
    } finally { setRunning(false); runningRef.current = false }
  }
  const addFile = () => {
    const name = newName.trim()
    const next = [...draft.files, { name, code: '# Write Python here\n' }]
    const invalid = validateFiles(next)
    if (invalid) { setMessage(invalid); return }
    edit({ files: next, activeFile: name }); setMessage(`Created ${name}.`)
  }
  const renameFile = () => {
    const name = window.prompt('New Python filename', active.name)?.trim()
    if (!name || name === active.name) return
    const files = draft.files.map(file => file.name === active.name ? { ...file, name } : file)
    const invalid = validateFiles(files)
    if (invalid) { setMessage(invalid); return }
    edit({ files, activeFile: name })
  }
  const deleteFile = () => {
    if (draft.files.length === 1) { setMessage('Keep at least one Python file.'); return }
    if (!window.confirm(`Delete ${active.name} from this workspace? Download it first if needed.`)) return
    const files = draft.files.filter(file => file.name !== active.name)
    edit({ files, activeFile: files[0]!.name })
  }
  const importFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const incoming = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (incoming.some(file => file.size > 900000)) { setMessage('File is too large (maximum 900 KB).'); return }
    try {
      const files = await Promise.all(incoming.map(async file => ({ name: file.name, code: await file.text() })))
      if (!files.length) return
      if (files.length === 1 && files[0]!.name.endsWith('.json')) {
        const backup = readDraft(files[0]!.code)
        if (!backup) { setMessage('Invalid workspace backup.'); return }
        if (!window.confirm('Replace current files with this backup? Download your current workspace first if needed.')) return
        edit({ files: backup.files, activeFile: backup.activeFile, input: backup.input })
        setMessage('Workspace backup restored as a local draft. Save to cloud when ready.')
        return
      }
      // Do not silently overwrite a file with the same name.
      const next = [...draftRef.current.files, ...files]
      const invalid = validateFiles(next)
      if (invalid) { setMessage(`${invalid} Rename an existing file before importing a duplicate.`); return }
      edit({ files: next, activeFile: files[0]!.name }); setMessage(`Imported ${files.length} file(s). Save to cloud to keep them across devices.`)
    } catch { setMessage('Could not read the selected files.') }
  }
  const download = (name: string, content: string, type = 'text/plain') => {
    const url = URL.createObjectURL(new Blob([content], { type }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return <main className={`lab-page workspace-page ${sidebarOpen ? 'sidebar-open' : ''}`} style={{ '--code-font-size': `${fontSize}px` } as CSSProperties}>
    <div className="lab-heading"><div><h1>Python IDE</h1></div>
      <div className="heading-actions"><button className="button secondary" disabled={loading || saving} onClick={() => void save()}><Save size={17}/>{saving ? 'Saving…' : 'Save to cloud'}</button>
      </div>
    </div>
    <div className="workspace-status"><span>{loading ? 'Loading cloud workspace…' : draft.dirty ? 'Local draft · not yet saved to cloud' : cloudTime ? `Cloud saved · ${new Date(cloudTime).toLocaleString()}` : 'New workspace · save to cloud to sync'}</span><button disabled={loading || saving || running} onClick={() => void reloadCloud()}>Load cloud version</button></div>
    {message && <p className="status" role="status">{message}</p>}
    <div className="workspace-grid"><aside id="python-files" className="workspace-files" aria-label="Python files" hidden={!sidebarOpen}>
      <h2><FileCode2 size={18}/> Files <small>{draft.files.length}/20</small></h2>
      {draft.files.map(file => <button key={file.name} className={file.name === active.name ? 'selected' : ''} aria-pressed={file.name === active.name} disabled={loading || running} onClick={() => edit({ activeFile: file.name })}><FileCode2 size={15}/>{file.name}</button>)}
      <label className="field"><span>New filename</span><input value={newName} disabled={loading || running} onChange={event => setNewName(event.target.value)} placeholder="helpers.py"/></label>
      <button disabled={loading || running} onClick={addFile}><Plus size={16}/>Add file</button>
      <button disabled={loading || running} onClick={renameFile}>Rename selected</button>
      <button disabled={loading || running || draft.files.length === 1} onClick={deleteFile}>Delete selected</button>
      <hr/>
      <input ref={uploadRef} type="file" accept=".py,.json" multiple hidden onChange={event => void importFiles(event)}/>
      <button disabled={loading || running} onClick={() => uploadRef.current?.click()}><Upload size={16}/>Import .py / backup</button>
      <button onClick={() => download(active.name, active.code)}><Download size={16}/>Download selected .py</button>
      <button onClick={() => download('apu-python-backup.json', JSON.stringify(draft, null, 2), 'application/json')}>Download workspace backup</button>
      <button disabled={loading || running} onClick={() => {
        const code = localStorage.getItem('cs-python-ide-code')
        if (code === null) { setMessage('No draft from the old IDE was found on this browser.'); return }
        const files = [...draft.files, { name: 'legacy_draft.py', code }]
        const invalid = validateFiles(files)
        if (invalid) { setMessage(invalid); return }
        edit({ files, activeFile: 'legacy_draft.py' }); setMessage('Imported the old browser draft. Save to cloud when ready.')
      }}>Import old browser draft</button>
      <p>Run the selected file. For example: <code>from helpers import greet</code>.</p>
    </aside><div className={`ide workspace-ide show-${panel}`}>
      <div className="code-dock">
        <button aria-label="Toggle files sidebar" aria-expanded={sidebarOpen} aria-controls="python-files" onClick={() => setSidebarOpen(open => !open)}><PanelLeft size={18}/></button>
        <div className="dock-tabs" aria-label="Workspace panels">
          <button aria-pressed={panel === 'code'} onClick={() => setPanel('code')}><FileCode2 size={16}/><span>{active.name}</span></button>
          <button aria-pressed={panel === 'output'} onClick={() => setPanel('output')}><Terminal size={16}/>Output</button>
        </div>
        <div className="font-controls"><button aria-label="Decrease code font size" disabled={fontSize <= 12} onClick={() => setFontSize(size => size - 2)}>A−</button><span>{fontSize}</span><button aria-label="Increase code font size" disabled={fontSize >= 36} onClick={() => setFontSize(size => size + 2)}>A+</button></div>
        {running ? <button className="dock-run danger" onClick={stopPython}><Square size={17}/>Stop</button> : <button className="dock-run" disabled={loading} aria-label={`Run ${active.name}`} onClick={() => void run()}><Play size={17}/>Run</button>}
      </div>
      <section className="editor-pane" aria-label="Python code editor">
      <CodeMirror key={active.name} value={active.code} height="100%" extensions={[python()]} theme="dark" editable={!loading} basicSetup={{ lineNumbers: true, foldGutter: true }} onChange={code => edit({ files: draft.files.map(file => file.name === active.name ? { ...file, code } : file) })}/>
    </section><section className="console-pane" aria-label="Python output"><header><Terminal size={17}/>Output<button disabled={running} onClick={() => { setStdout(''); setStderr(''); setRunState('Ready to run') }}>Clear</button></header>
      <p className="run-state" role="status">{runState}</p>
      <pre className="stdout">{stdout || (running ? 'Loading Python or executing code…' : 'No output yet. Use print() to display a result.')}</pre>
      {stderr && <div className="stderr"><strong>Errors / execution status</strong><pre>{stderr}</pre></div>}
      <label className="console-input"><span>Program input · one value per input() call</span><textarea maxLength={50000} value={draft.input} onChange={event => edit({ input: event.target.value })} placeholder="Enter one value per line"/></label>
    </section></div></div>
    <div className="workspace-help"><p>First run downloads Python. Runs stop after 30 seconds; packages requiring native system access are not supported. Your course teachers and platform administrators can review cloud-saved files. Saving here is not submitting an assignment.</p><Link className="text-link" to="/assessments">Open Quiz & Code to submit assigned work →</Link></div>
  </main>
}
