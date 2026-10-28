import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase/client'

type Activity = { id:string; title:string; instructions:string; status:string; is_required:boolean; max_score:number; due_at:string|null; lesson_id:string }
type TestCase = { id:string; input:string; expected_output:string; visibility:string; position:number }
type Challenge = { activity_id:string; starter_code:string; allow_input:boolean }
function localDate(value:string|null){if(!value)return '';const date=new Date(value);const local=new Date(date.getTime()-date.getTimezoneOffset()*60000);return local.toISOString().slice(0,16)}
export function TeacherActivityManagerPage(){
 const {activityId}=useParams()
 const [activity,setActivity]=useState<Activity|null>(null)
 const [starter,setStarter]=useState('')
 const [tests,setTests]=useState<TestCase[]>([])
 const [inputEnabled,setInputEnabled]=useState(false)
 const [due,setDue]=useState('')
 const [message,setMessage]=useState('')
 const [busy,setBusy]=useState(false)
 const [editing,setEditing]=useState(false)
 const [loading,setLoading]=useState(true)
 useEffect(()=>{let active=true;void(async()=>{
  const [a,c,t]=await Promise.all([
   supabase.from('cs_activities').select('id,title,instructions,status,is_required,max_score,due_at,lesson_id').eq('id',activityId!).single(),
   supabase.from('cs_coding_challenges').select('activity_id,starter_code,allow_input').eq('activity_id',activityId!).maybeSingle(),
   supabase.from('cs_coding_test_cases').select('id,input,expected_output,visibility,position').eq('challenge_id',activityId!).order('position')
  ])
  if(!active)return
  if(a.error||c.error||t.error){setMessage(a.error?.message??c.error?.message??t.error?.message??'Unable to open activity')}
  else{const row=a.data as Activity;setActivity(row);setDue(localDate(row.due_at));setStarter((c.data as Challenge|null)?.starter_code??'');setInputEnabled((c.data as Challenge|null)?.allow_input??false);setTests((t.data??[]) as TestCase[])}
  setLoading(false)
 })();return()=>{active=false}},[activityId])
 async function save(event:FormEvent){event.preventDefault();if(!activity)return;setBusy(true);setMessage('')
  const [a,c]=await Promise.all([
   supabase.from('cs_activities').update({title:activity.title,instructions:activity.instructions,is_required:activity.is_required,max_score:activity.max_score,due_at:due?new Date(due).toISOString():null}).eq('id',activity.id),
   supabase.from('cs_coding_challenges').update({starter_code:starter,allow_input:inputEnabled}).eq('activity_id',activity.id)
  ])
  setBusy(false);setMessage(a.error?.message??c.error?.message??'Changes saved');if(!a.error&&!c.error)setEditing(false)
 }
 async function assign(published:boolean){if(!activity)return;setBusy(true);setMessage('')
  const {error}=await supabase.from('cs_activities').update({status:published?'published':'draft',due_at:due?new Date(due).toISOString():null,is_required:activity.is_required}).eq('id',activity.id)
  setBusy(false)
  if(error)setMessage(error.message)
  else {setActivity({...activity,status:published?'published':'draft',due_at:due?new Date(due).toISOString():null});setMessage(published?'Assigned: visible to students in this course. Share the course link with the class.':'Activity unpublished: hidden from the student course.')}
 }
 if(loading)return <main className="page"><p>Loading activity…</p></main>
 if(!activity)return <main className="page"><h1>Could not load activity</h1><p role="alert">{message}</p></main>
 return <main className="page">
  <Link className="back" to="/teacher/courses">← Courses</Link>
  <p className="eyebrow">TEACHER / ADMIN · ACTIVITY MANAGEMENT</p>
  <h1>{activity.title}</h1>
  <p className="lede">Preview the student instructions, edit the task, publish or unpublish, set a due date, and review submitted work. This preview cannot submit student answers.</p>
  {message&&<p role="status" className="status">{message}</p>}
  <div className="panel" style={{marginBottom:20}}>
   <h2>Assignment settings</h2>
   <p><strong>Status:</strong> {activity.status==='published'?'Published · visible to enrolled students':'Draft · not shown to students'}</p>
   <label className="field"><span>Due date and time (your local timezone)</span><input type="datetime-local" value={due} onChange={e=>setDue(e.target.value)}/></label>
   <label style={{display:'flex',gap:8,alignItems:'center',marginTop:10}}><input type="checkbox" checked={activity.is_required} onChange={e=>setActivity({...activity,is_required:e.target.checked})}/> Required activity</label>
   <p className="work-meta">Setting a due date displays the target deadline; it does not automatically lock late submissions.</p>
   <div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:14}}>
    <button className="button" disabled={busy} onClick={()=>void assign(true)}>Assign / Publish</button>
    <button className="button secondary" disabled={busy} onClick={()=>void assign(false)}>Unpublish</button>
    <button className="button secondary" onClick={()=>setEditing(!editing)}>{editing?'Close editor':'Edit activity'}</button>
    <Link className="button secondary" to="/teacher/submissions">Review submissions</Link>
   </div>
  </div>
  {editing&&<form className="panel" onSubmit={save} style={{marginBottom:20}}>
   <h2>Edit activity</h2>
   <label className="field"><span>Title</span><input required value={activity.title} onChange={e=>setActivity({...activity,title:e.target.value})}/></label>
   <label className="field"><span>Instructions</span><textarea rows={8} value={activity.instructions} onChange={e=>setActivity({...activity,instructions:e.target.value})}/></label>
   <label className="field"><span>Starter Python</span><textarea rows={15} style={{fontFamily:'monospace'}} value={starter} onChange={e=>setStarter(e.target.value)}/></label>
   <label style={{display:'flex',gap:8}}><input type="checkbox" checked={inputEnabled} onChange={e=>setInputEnabled(e.target.checked)}/> Allow program input</label>
   <label className="field"><span>Maximum score</span><input type="number" min="1" max="1000" value={activity.max_score} onChange={e=>setActivity({...activity,max_score:Number(e.target.value)})}/></label>
   <button className="button" disabled={busy} type="submit">Save changes</button>
  </form>}
  <section className="panel" style={{marginBottom:20}}>
   <p className="eyebrow">READ-ONLY STUDENT PREVIEW</p>
   <h2>{activity.title}</h2><p style={{whiteSpace:'pre-wrap'}}>{activity.instructions}</p>
   <p><strong>Difficulty / required:</strong> {activity.is_required?'Required':'Optional'}</p>
   {due&&<p><strong>Due:</strong> {new Date(due).toLocaleString()}</p>}
   <h3>Starter code</h3><pre style={{whiteSpace:'pre-wrap',overflowX:'auto'}}>{starter||'# No starter code'}</pre>
   <h3>Tests ({tests.length})</h3>
   {tests.map(t=><details key={t.id} style={{marginBottom:8}}><summary>Test {t.position+1} · {t.visibility}</summary><strong>Input</strong><pre>{t.input||'(empty)'}</pre><strong>Expected output</strong><pre>{t.expected_output}</pre></details>)}
  </section>
  <p><Link to="/teacher/submissions">Review student submissions and leave feedback →</Link></p>
 </main>
}
