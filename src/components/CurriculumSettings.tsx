import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase/client'
import { managementError } from '../utils/activityManagement'

type Item = { id: string; title: string; status: string; description?: string; introduction?: string; learning_objectives?: string[]; position?: number }
export function CurriculumSettings({ table, item, label, onSaved }: { table: 'cs_courses' | 'cs_modules' | 'cs_lessons'; item: Item; label: string; onSaved: () => Promise<void> }) {
  const [title, setTitle] = useState(item.title)
  const [description, setDescription] = useState(item.introduction ?? item.description ?? '')
  const [objectives, setObjectives] = useState((item.learning_objectives ?? []).join('\n'))
  const [status, setStatus] = useState(item.status)
  const [position, setPosition] = useState(item.position ?? 0)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const save = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage('')
    try {
      const payload = { title: title.trim(), status, updated_at: new Date().toISOString(), ...(table === 'cs_lessons' ? { introduction: description, learning_objectives: objectives.split('\n').map(v => v.trim()).filter(Boolean) } : { description }), ...(table !== 'cs_courses' ? { position } : {}) }
      const result = await supabase.from(table).update(payload).eq('id', item.id).select('id').single()
      if (result.error) throw result.error
      setMessage('Saved.'); await onSaved()
    } catch (error) { setMessage(managementError(error)) }
    finally { setBusy(false) }
  }
  return <details className="panel"><summary>{label} settings · {item.status}</summary><form onSubmit={event => void save(event)}><fieldset disabled={busy} className="assessment-fieldset form-grid">
    <label className="field">{label} title<input required maxLength={160} value={title} onChange={e => setTitle(e.target.value)}/></label>
    <label className="field">{label} {table === 'cs_lessons' ? 'introduction' : 'description'}<textarea rows={4} value={description} onChange={e => setDescription(e.target.value)}/></label>
    {table === 'cs_lessons' && <label className="field">Learning objectives (one per line)<textarea rows={4} value={objectives} onChange={e => setObjectives(e.target.value)}/></label>}
    <label className="field">{label} status<select value={status} onChange={e => setStatus(e.target.value)}><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></label>
    {table !== 'cs_courses' && <label className="field">{label} order<input type="number" min={0} step={1} required value={position} onChange={e => setPosition(Number(e.target.value))}/></label>}
    <p>Draft/archived items and their nested activities are hidden from students. Student submissions are retained. Publish the course, module and lesson for students to access assigned work.</p>
    {message && <p role="status">{message}</p>}<button className="button" type="submit">{busy ? 'Saving…' : `Save ${label.toLowerCase()} settings`}</button>
  </fieldset></form></details>
}
