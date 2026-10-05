import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Plus, BookOpen, ArrowRight } from 'lucide-react'
import { useAuth } from '../features/auth/AuthProvider'
import { supabase } from '../lib/supabase/client'
import type { Course } from '../types/classroom'
import { Field, TextArea } from '../components/FormFields'

export function TeacherCoursesPage() {
  const { session, role } = useAuth(); const [courses,setCourses]=useState<Course[]>([]); const [open,setOpen]=useState(false); const [message,setMessage]=useState('')
  const load=useCallback(async()=>{ let query=supabase.from('cs_courses').select('*').order('created_at'); if(role!=='admin')query=query.eq('teacher_id',session!.user.id); const {data,error}=await query; if(error)setMessage(error.message); else setCourses(data??[]) },[session,role])
  useEffect(()=>{void load()},[load])
  const create=async(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const fd=new FormData(e.currentTarget);const {error}=await supabase.from('cs_courses').insert({teacher_id:session!.user.id,title:String(fd.get('title')),description:String(fd.get('description')),status:'published'});if(error)setMessage(error.message);else{setOpen(false);e.currentTarget.reset();void load()}}
  return <main className="page"><div className="page-heading"><div><p className="eyebrow">CURRICULUM</p><h1>Your courses</h1><p>Create the path from lesson to working Python.</p></div><button className="button" onClick={()=>setOpen(!open)}><Plus size={18}/> New course</button></div>{open&&<form className="panel form-grid" onSubmit={create}><Field name="title" label="Course title" required/><TextArea name="description" label="Short description"/><button className="button">Create published course</button></form>}{message&&<p className="alert">{message}</p>}<div className="course-grid">{courses.map(c=><Link className="course-card" key={c.id} to={`/teacher/course/${c.id}`}><BookOpen/><span className="pill light">{c.status}</span><h2>{c.title}</h2><p>{c.description||'Add modules, lessons, and coding challenges.'}</p><span className="text-link">Manage course <ArrowRight size={16}/></span></Link>)}{!courses.length&&<div className="empty"><BookOpen/><h2>No courses yet</h2><p>Create your first course to begin.</p></div>}</div></main>
}
