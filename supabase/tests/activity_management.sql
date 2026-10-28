-- All fixtures are temporary and rolled back, including auth/profile records.
begin;
create temp table management_fixture(label text primary key,id uuid not null) on commit drop;
grant select,insert,update on management_fixture to authenticated;
insert into management_fixture values ('teacher',gen_random_uuid()),('other_teacher',gen_random_uuid()),('student',gen_random_uuid()),('admin',gen_random_uuid());
insert into auth.users(id,email,raw_user_meta_data) select id,'activity-test-'||id||'@example.com','{}'::jsonb from management_fixture;
update public.cs_profiles p set role=case when f.label='admin' then 'admin'::public.cs_user_role else 'teacher'::public.cs_user_role end
  from management_fixture f where p.id=f.id and f.label<>'student';
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from management_fixture where label='teacher'),'role','authenticated')::text,true);
with c as (insert into public.cs_courses(teacher_id,title,status) select id,'Temporary management test','published' from management_fixture where label='teacher' returning id)
insert into management_fixture select 'course',id from c;
with m as (insert into public.cs_modules(course_id,title,status) select id,'Temporary module','published' from management_fixture where label='course' returning id)
insert into management_fixture select 'module',id from m;
with l as (insert into public.cs_lessons(module_id,title,status) select id,'Temporary lesson','published' from management_fixture where label='module' returning id)
insert into management_fixture select 'lesson',id from l;
insert into public.cs_enrollments(course_id,student_id) select c.id,s.id from management_fixture c,management_fixture s where c.label='course' and s.label='student';
insert into management_fixture values ('test',gen_random_uuid());
with a as (select result.id from public.cs_save_activity(null,
  jsonb_build_object('lesson_id',(select id from management_fixture where label='lesson'),'title','Temporary activity','instructions','Original instructions','is_required',true,'max_score',100,'status','published','difficulty','core'),
  '{"starter_code":"print(1)","allow_input":true}'::jsonb,
  jsonb_build_array(jsonb_build_object('id',(select id from management_fixture where label='test'),'input','','expected_output','private expectation','visibility','hidden')),
  null) result) insert into management_fixture select 'activity',id from a;
with a as (insert into public.cs_activities(lesson_id,title,activity_type,status) select id,'Other temporary activity','coding','published' from management_fixture where label='lesson' returning id)
insert into management_fixture select 'other_activity',id from a;
insert into public.cs_coding_challenges(activity_id) select id from management_fixture where label='other_activity';
with t as (insert into public.cs_coding_test_cases(challenge_id,expected_output,visibility) select id,'other protected output','hidden' from management_fixture where label='other_activity' returning id)
insert into management_fixture select 'foreign_test',id from t;
do $$ declare a public.cs_activities; answer text; begin
  select * into a from public.cs_activities where id=(select id from management_fixture where label='activity');
  select expected_output into answer from public.cs_teacher_activity_tests(a.id);
  if answer is distinct from 'private expectation' then raise exception 'Owner cannot read protected expectations'; end if;
  begin
    perform expected_output from public.cs_coding_test_cases where challenge_id=a.id;
    raise exception 'Direct expected_output column unexpectedly readable';
  exception when insufficient_privilege then null; end;
  perform public.cs_save_activity(a.id,to_jsonb(a)||'{"title":"Updated activity"}'::jsonb,
    '{"starter_code":"print(2)","allow_input":false}'::jsonb,
    jsonb_build_array(jsonb_build_object('id',(select id from management_fixture where label='test'),'input','2','expected_output','updated expectation','visibility','hidden')),a.updated_at);
  if (select count(*) from public.cs_teacher_activity_tests(a.id))<>1 then raise exception 'Test IDs duplicated'; end if;
  if (select expected_output from public.cs_teacher_activity_tests(a.id))<>'updated expectation' then raise exception 'Test update failed'; end if;
  if not exists(select 1 from public.cs_coding_challenges where activity_id=a.id and starter_code='print(2)' and allow_input=false) then raise exception 'Starter update failed'; end if;
  begin
    perform public.cs_save_activity(a.id,to_jsonb(a),null,null,a.updated_at);
    raise exception 'Stale update was accepted';
  exception when serialization_failure then null; end;
  select * into a from public.cs_activities where id=a.id;
  begin
    perform public.cs_save_activity(a.id,to_jsonb(a)||'{"title":"Must roll back"}'::jsonb,
      '{"starter_code":"must roll back","allow_input":true}'::jsonb,
      jsonb_build_array(jsonb_build_object('id',(select id from management_fixture where label='foreign_test'),'input','','expected_output','foreign id','visibility','hidden')),
      a.updated_at);
    raise exception 'Foreign test update was accepted';
  exception when raise_exception then if sqlerrm='Foreign test update was accepted' then raise; end if; end;
  if (select title from public.cs_activities where id=a.id)='Must roll back' or exists(select 1 from public.cs_coding_challenges where activity_id=a.id and starter_code='must roll back') then raise exception 'Child save error did not roll back parent/starter'; end if;
  select * into a from public.cs_activities where id=a.id;
  begin
    perform public.cs_save_activity(a.id,to_jsonb(a)||'{"title":"Never persisted"}'::jsonb,null,
      jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'input','','expected_output','x','visibility','invalid')),a.updated_at);
    raise exception 'Invalid tests were accepted';
  exception when raise_exception then if sqlerrm='Invalid tests were accepted' then raise; end if; end;
  if (select title from public.cs_activities where id=a.id)='Never persisted' then raise exception 'Partial save was committed'; end if;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from management_fixture where label='student'),'role','authenticated')::text,true);
do $$ declare activity uuid := (select id from management_fixture where label='activity'); begin
  if not exists(select 1 from public.cs_student_test_cases where challenge_id=activity) then raise exception 'Student safe test view broken'; end if;
  begin perform * from public.cs_teacher_activity_tests(activity); raise exception 'Student read teacher test expectations'; exception when insufficient_privilege then null; end;
  begin perform public.cs_save_activity(activity,'{}'::jsonb,null,null,now()); raise exception 'Student saved an activity'; exception when insufficient_privilege then null; end;
end $$;
insert into public.cs_code_workspaces(activity_id,student_id,code) select a.id,s.id,'original student work' from management_fixture a,management_fixture s where a.label='activity' and s.label='student';
insert into public.cs_activity_attempts(activity_id,student_id,code,status,attempt_number) select a.id,s.id,'submitted work','submitted',1 from management_fixture a,management_fixture s where a.label='activity' and s.label='student';
select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from management_fixture where label='other_teacher'),'role','authenticated')::text,true);
do $$ begin
  begin perform * from public.cs_teacher_activity_tests((select id from management_fixture where label='activity')); raise exception 'Unrelated teacher read test expectations'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from management_fixture where label='admin'),'role','authenticated')::text,true);
do $$ declare a public.cs_activities; begin
  select * into a from public.cs_activities where id=(select id from management_fixture where label='activity');
  perform * from public.cs_teacher_activity_tests(a.id);
  perform public.cs_save_activity(a.id,to_jsonb(a)||'{"status":"archived"}'::jsonb,null,null,a.updated_at);
  if not exists(select 1 from public.cs_code_workspaces where activity_id=a.id and code='original student work') or not exists(select 1 from public.cs_activity_attempts where activity_id=a.id) then raise exception 'Archiving lost student work'; end if;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from management_fixture where label='student'),'role','authenticated')::text,true);
do $$ begin
  if exists(select 1 from public.cs_activities where id=(select id from management_fixture where label='activity')) then raise exception 'Archived activity visible to student'; end if;
  if has_function_privilege('anon','public.cs_teacher_activity_tests(uuid)','execute') or has_function_privilege('anon','public.cs_save_activity(uuid,jsonb,jsonb,jsonb,timestamp with time zone)','execute') then raise exception 'Anonymous access to management RPCs'; end if;
end $$;
reset role;
rollback;
select 'PASS: teacher/admin access, student/unrelated/anonymous denial, safe view, atomic saves, stale edit rejection, archive preserves work; fixtures rolled back' as result;
