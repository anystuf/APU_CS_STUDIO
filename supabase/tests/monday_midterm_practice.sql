begin;
create temp table apu_midterm_fixture(label text primary key,id uuid) on commit drop;
insert into apu_midterm_fixture values
  ('teacher',gen_random_uuid()),('student',gen_random_uuid());
grant select on apu_midterm_fixture to authenticated;
insert into auth.users(id,email,raw_user_meta_data)
select id,'midterm-test-'||id||'@example.com','{}'::jsonb from apu_midterm_fixture;
update public.cs_profiles p set role='teacher'::public.cs_user_role
from apu_midterm_fixture f where f.label='teacher' and p.id=f.id;

set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',(select id from apu_midterm_fixture where label='teacher'),'role','authenticated')::text,true);
insert into public.cs_courses(id,teacher_id,title,status)
select gen_random_uuid(),id,'Temporary Monday practice test','published'
from apu_midterm_fixture where label='teacher';
insert into public.cs_enrollments(course_id,student_id)
select c.id,s.id from public.cs_courses c,apu_midterm_fixture s
where c.title='Temporary Monday practice test' and s.label='student';
insert into public.cs_modules(id,course_id,title,status)
select gen_random_uuid(),c.id,'Temporary Midterm Review','published'
from public.cs_courses c where c.title='Temporary Monday practice test';
insert into public.cs_assessments(id,course_id,title,status,questions)
select gen_random_uuid(),c.id,'Temporary optional reflection test','draft',
  '[{"id":"quick","kind":"multiple_choice","prompt":"Pick one","points":2,"required":true,"options":["A","B"]},{"id":"reflection","kind":"short_answer","prompt":"Optional","points":0,"required":false}]'::jsonb
from public.cs_courses c where c.title='Temporary Monday practice test';
insert into public.cs_assessment_keys(assessment_id,answers,feedback)
select a.id,'{"quick":1}'::jsonb,'{"quick":"That answer is correct."}'::jsonb
from public.cs_assessments a where a.title='Temporary optional reflection test';
insert into public.cs_lessons(id,module_id,title,status,assessment_id)
select gen_random_uuid(),m.id,'Temporary readiness lesson','published',a.id
from public.cs_modules m cross join public.cs_assessments a
where m.title='Temporary Midterm Review' and a.title='Temporary optional reflection test';
insert into public.cs_activities(id,lesson_id,title,activity_type,difficulty,status,is_required,unlock_assessment_id)
select gen_random_uuid(),l.id,'Temporary optional challenge','coding','challenge','published',false,a.id
from public.cs_lessons l cross join public.cs_assessments a
where l.title='Temporary readiness lesson' and a.title='Temporary optional reflection test';
update public.cs_assessments set status='published' where title='Temporary optional reflection test';

select set_config('request.jwt.claims',json_build_object('sub',(select id from apu_midterm_fixture where label='student'),'role','authenticated')::text,true);
do $$ begin
  if (select count(*) from public.cs_assessment_keys) <> 0 then raise exception 'Student can read the answer key before submitting.'; end if;
  if (select count(*) from public.cs_activities where title='Temporary optional challenge') <> 0 then raise exception 'Optional activity unlocked before required work was submitted.'; end if;
end $$;
insert into public.cs_assessment_submissions(assessment_id,student_id,answers,status)
select a.id,s.id,'{"quick":{"choice":1}}'::jsonb,'submitted'
from public.cs_assessments a,apu_midterm_fixture s
where a.title='Temporary optional reflection test' and s.label='student';
do $$ begin
  if (select count(*) from public.cs_activities where title='Temporary optional challenge') <> 1 then raise exception 'Submission did not unlock optional practice.'; end if;
  if not exists(select 1 from public.cs_assessment_submissions where status='submitted' and quiz_score=2 and quiz_max_score=2 and manual_max_score=0 and quiz_results->'quick'->>'correct'='true' and quiz_results->'quick'->>'feedback'='That answer is correct.') then raise exception 'Protected grading or optional reflection handling failed.'; end if;
end $$;
reset role;
rollback;
select 'hidden keys, required answer grading, optional zero-point reflection, and post-submit activity unlock: passed; fixtures rolled back' as result;
