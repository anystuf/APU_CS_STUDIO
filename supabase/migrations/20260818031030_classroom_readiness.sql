create type public.cs_invite_status as enum ('pending','accepted','cancelled');

create table public.cs_course_invites (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.cs_courses(id) on delete cascade,
  email text not null check (email = lower(trim(email)) and position('@' in email) > 1),
  invited_by uuid not null references public.cs_profiles(id),
  status public.cs_invite_status not null default 'pending',
  created_at timestamptz not null default now(), accepted_at timestamptz,
  unique(course_id,email)
);
create index cs_course_invites_email_idx on public.cs_course_invites(email) where status='pending';

create table public.cs_teacher_feedback (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null unique references public.cs_activity_attempts(id) on delete cascade,
  student_id uuid not null references public.cs_profiles(id) on delete cascade,
  teacher_id uuid not null references public.cs_profiles(id),
  comment text not null check (char_length(comment) between 1 and 4000),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index cs_feedback_student_idx on public.cs_teacher_feedback(student_id,created_at desc);
create index cs_feedback_teacher_idx on public.cs_teacher_feedback(teacher_id,created_at desc);

alter table public.cs_course_invites enable row level security;
alter table public.cs_teacher_feedback enable row level security;
grant select,insert,update,delete on public.cs_course_invites to authenticated;
grant select,insert,update,delete on public.cs_teacher_feedback to authenticated;

create policy invites_read on public.cs_course_invites for select to authenticated using ((select private.cs_owns_course(course_id)));
create policy invites_insert on public.cs_course_invites for insert to authenticated with check ((select private.cs_owns_course(course_id)) and invited_by=(select auth.uid()));
create policy invites_update on public.cs_course_invites for update to authenticated using ((select private.cs_owns_course(course_id))) with check ((select private.cs_owns_course(course_id)));
create policy invites_delete on public.cs_course_invites for delete to authenticated using ((select private.cs_owns_course(course_id)));

create policy feedback_read on public.cs_teacher_feedback for select to authenticated using (student_id=(select auth.uid()) or teacher_id=(select auth.uid()) or (select private.cs_owns_course((select private.cs_activity_course((select a.activity_id from public.cs_activity_attempts a where a.id=attempt_id))))));
create policy feedback_insert on public.cs_teacher_feedback for insert to authenticated with check (teacher_id=(select auth.uid()) and (select private.cs_owns_course((select private.cs_activity_course((select a.activity_id from public.cs_activity_attempts a where a.id=attempt_id))))));
create policy feedback_update on public.cs_teacher_feedback for update to authenticated using (teacher_id=(select auth.uid())) with check (teacher_id=(select auth.uid()) and (select private.cs_owns_course((select private.cs_activity_course((select a.activity_id from public.cs_activity_attempts a where a.id=attempt_id))))));
create policy feedback_delete on public.cs_teacher_feedback for delete to authenticated using (teacher_id=(select auth.uid()));

create function private.cs_apply_pending_invites() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.cs_enrollments(course_id,student_id)
  select i.course_id,new.id from public.cs_course_invites i
  where i.email=lower(new.email) and i.status='pending'
  on conflict do nothing;
  update public.cs_course_invites set status='accepted',accepted_at=now()
  where email=lower(new.email) and status='pending';
  return new;
end; $$;
revoke all on function private.cs_apply_pending_invites() from public,anon,authenticated;
create trigger cs_profile_apply_invites after insert on public.cs_profiles for each row execute function private.cs_apply_pending_invites();

-- A useful starter course, created once for the first teacher in the project.
do $$
declare teacher uuid; course uuid; module uuid; lesson uuid; activity uuid;
begin
  select id into teacher from public.cs_profiles where role in ('teacher','admin') order by created_at limit 1;
  if teacher is not null and not exists(select 1 from public.cs_courses where teacher_id=teacher) then
    insert into public.cs_courses(teacher_id,title,description,status) values
      (teacher,'Computer Science Foundations — Middle School','Start with decisions, predictions, and a friendly Python challenge.','published') returning id into course;
    insert into public.cs_modules(course_id,title,description,position,status) values
      (course,'Programming Fundamentals','Build confidence with variables, input, output, and decisions.',0,'published') returning id into module;
    insert into public.cs_lessons(module_id,title,introduction,learning_objectives,vocabulary,position,status) values
      (module,'Making Decisions','Programs use conditions to choose what happens next.',array['Use if and else to make a decision','Test a program with different inputs'],array['condition','boolean','branch'],0,'published') returning id into lesson;
    insert into public.cs_activities(lesson_id,title,instructions,activity_type,difficulty,position,status) values
      (lesson,'Even or Odd','Read an integer and print Even when it is divisible by 2; otherwise print Odd.','coding','core',0,'published') returning id into activity;
    insert into public.cs_coding_challenges(activity_id,starter_code) values
      (activity,E'number = int(input("Number: "))\n\n# Write your condition here\n');
    insert into public.cs_coding_test_cases(challenge_id,input,expected_output,visibility,position) values
      (activity,'10','Even','public',0),(activity,'7','Odd','public',1);
  end if;
end $$;
