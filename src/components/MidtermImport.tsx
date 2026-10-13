import { useRef, useState, type ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthProvider'
import { importMidtermPractice, parseMidtermImport, previewMidtermImport, type ImportPackage, type ImportPreview } from '../utils/midtermImport'

export function MidtermImport({ courseId, courseTitle, onImported }: { courseId: string; courseTitle: string; onImported: () => Promise<void> }) {
  const { role } = useAuth()
  const [pack, setPack] = useState<ImportPackage | null>(null)
  const [preview, setPreview] = useState<ImportPreview[]>([])
  const [results, setResults] = useState<ImportPreview[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const generation = useRef(0)
  if (role !== 'teacher' && role !== 'admin') return null

  const selectFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; const current = ++generation.current
    setPack(null); setPreview([]); setResults([]); setError('')
    if (!file) return
    setBusy(true)
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error('Choose a JSON file smaller than 2 MB.')
      const parsed = parseMidtermImport(JSON.parse(await file.text()), courseId)
      const plan = await previewMidtermImport(courseId, parsed)
      if (current !== generation.current) return
      setPack(parsed); setPreview(plan)
    } catch (cause) { if (current === generation.current) setError(cause instanceof Error ? cause.message : 'Could not validate this file.') }
    finally { if (current === generation.current) setBusy(false) }
  }
  const importFile = async () => {
    if (!pack || busy) return
    setBusy(true); setError('')
    try {
      const imported = await importMidtermPractice(courseId, pack)
      setResults(imported); await onImported()
    } catch (cause) { setError(`${cause instanceof Error ? cause.message : 'Import failed.'} Re-select the same file to inspect and resume any completed steps.`) }
    finally { setBusy(false) }
  }
  return <details className="panel midterm-import"><summary>Import Midterm Practice</summary>
    <p>Choose the validated Grades 11–12 practice JSON from your computer. Monday is reused. Tuesday and Wednesday are imported as drafts for teacher review.</p>
    <label className="field"><span>Practice JSON file</span><input type="file" accept=".json,application/json" disabled={busy} onChange={event => void selectFile(event)}/></label>
    <p>Target course: <strong>{courseTitle}</strong></p>
    {busy && <p role="status">Checking or importing practice…</p>}
    {error && <p className="alert" role="alert">{error}</p>}
    {pack && <section aria-label="Import confirmation summary"><p>Validated all {pack.mcqCount} multiple-choice questions and keys in the file. Monday’s uploaded questions are not imported.</p>
      <ul>{preview.map(item => <li key={item.day}><strong>{item.title}</strong> — {item.action}{item.status ? ` (${item.status})` : ''}</li>)}</ul>
      <p>Tuesday: 14 multiple-choice questions + 1 required Python task = 100 points (70 + 30). Wednesday: 6 multiple-choice questions = 30 points + 1 optional Python task worth zero points. Wednesday is optional practice, separate from the official midterm.</p>
      {!results.length && <button className="button" type="button" disabled={busy} onClick={() => void importFile()}>Confirm import Tuesday &amp; Wednesday as drafts</button>}
    </section>}
    {!!results.length && <section aria-label="Import results" role="status"><h2>Import complete</h2><ul>{results.map(item => <li key={item.day}>{item.title}: {item.action} ({item.status}). {item.assessmentId && <Link to={`/assessments/${item.assessmentId}/review`}>Review {item.day} assessment</Link>}</li>)}</ul><p>Open each draft, review it, then select “Assign to class” when ready. Student enrollment is managed in the Students tab.</p></section>}
  </details>
}
