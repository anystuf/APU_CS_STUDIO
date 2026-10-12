-- Let a lesson point to its assessment without changing the existing course model.
alter table public.cs_lessons
  add column assessment_id uuid references public.cs_assessments(id) on delete set null;

create function private.cs_validate_lesson_assessment_link()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare lesson_course uuid; assessment_course uuid;
begin
  if new.assessment_id is null then return new; end if;
  select course_id into lesson_course from public.cs_modules where id = new.module_id;
  select course_id into assessment_course from public.cs_assessments where id = new.assessment_id;
  if lesson_course is null or assessment_course is null or lesson_course <> assessment_course then
    raise exception 'Lesson and assessment must belong to the same course.';
  end if;
  return new;
end;
$$;
create trigger cs_validate_lesson_assessment_link
before insert or update of module_id, assessment_id on public.cs_lessons
for each row execute function private.cs_validate_lesson_assessment_link();

-- Optional activities are hidden by RLS until the linked core practice is submitted.
alter table public.cs_activities
  add column unlock_assessment_id uuid references public.cs_assessments(id) on delete set null;
create index cs_activities_unlock_assessment_idx on public.cs_activities(unlock_assessment_id)
  where unlock_assessment_id is not null;

create function private.cs_validate_activity_unlock()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare activity_course uuid; assessment_course uuid;
begin
  if new.unlock_assessment_id is null then return new; end if;
  select m.course_id into activity_course
  from public.cs_lessons l join public.cs_modules m on m.id = l.module_id
  where l.id = new.lesson_id;
  select course_id into assessment_course from public.cs_assessments where id = new.unlock_assessment_id;
  if activity_course is null or assessment_course is null or activity_course <> assessment_course then
    raise exception 'Activity and unlock assessment must belong to the same course.';
  end if;
  return new;
end;
$$;
create trigger cs_validate_activity_unlock
before insert or update of lesson_id, unlock_assessment_id on public.cs_activities
for each row execute function private.cs_validate_activity_unlock();

drop policy activities_read on public.cs_activities;
create policy activities_read on public.cs_activities for select to authenticated using (
  exists (
    select 1
    from public.cs_lessons l
    join public.cs_modules m on m.id = l.module_id
    where l.id = lesson_id
      and (
        (select private.cs_owns_course(m.course_id))
        or (
          public.cs_activities.status = 'published'
          and l.status = 'published'
          and m.status = 'published'
          and (select private.cs_can_view_course(m.course_id))
          and (
            public.cs_activities.unlock_assessment_id is null
            or exists (
              select 1 from public.cs_assessment_submissions s
              where s.assessment_id = public.cs_activities.unlock_assessment_id
                and s.student_id = (select auth.uid())
                and s.status = 'submitted'
            )
          )
        )
      )
  )
);

-- Optional questions may be left blank. Zero-point questions are only valid when optional.
alter table public.cs_assessment_submissions
  add column quiz_results jsonb not null default '{}'::jsonb
  check (jsonb_typeof(quiz_results) = 'object');

alter table public.cs_assessment_keys
  add column feedback jsonb not null default '{}'::jsonb
  check (jsonb_typeof(feedback) = 'object');

create or replace function private.cs_validate_assessment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare q jsonb; keys jsonb; seen text[] := '{}';
begin
  if auth.uid() is null or not private.cs_owns_course(new.course_id) then raise exception 'Not authorized to edit this assessment.'; end if;
  if TG_OP='UPDATE' then
    if new.course_id<>old.course_id or new.id<>old.id then raise exception 'Assessment cannot be moved to another course.'; end if;
    if old.status<>'draft' and (new.questions<>old.questions or new.title<>old.title or new.instructions<>old.instructions or new.due_at is distinct from old.due_at or new.status='draft') then
      raise exception 'An assigned assessment cannot be edited. Create a new assessment.';
    end if;
  end if;
  for q in select value from jsonb_array_elements(new.questions) loop
    if coalesce(q->>'id','')='' or q->>'id'=any(seen) or coalesce(trim(q->>'prompt'),'')='' or coalesce(q->>'kind','') not in ('multiple_choice','short_answer','python') or coalesce(q->>'points','') !~ '^[0-9]+$' then raise exception 'Invalid assessment question.'; end if;
    if (q->>'points')::integer not between 0 and 100 then raise exception 'Question points must be between 0 and 100.'; end if;
    if (q->>'points')::integer = 0 and coalesce((q->>'required')::boolean, true) then raise exception 'Only optional questions may have zero points.'; end if;
    if q ? 'required' and jsonb_typeof(q->'required') <> 'boolean' then raise exception 'Question required flag must be true or false.'; end if;
    if length(coalesce(q->>'feedback','')) > 2000 or length(coalesce(q->>'hint','')) > 5000 then raise exception 'Question feedback or hint is too long.'; end if;
    seen:=array_append(seen,q->>'id');
    if q->>'kind'='multiple_choice' then
      if jsonb_typeof(q->'options') is distinct from 'array' then raise exception 'Missing answer choices.'; end if;
      if jsonb_array_length(q->'options') not between 2 and 8 or exists(select 1 from jsonb_array_elements(q->'options') opt where jsonb_typeof(opt)<>'string' or trim(opt #>> '{}')='') then raise exception 'Invalid answer choices.'; end if;
    end if;
  end loop;
  if new.status='published' then
    if jsonb_array_length(new.questions)=0 then raise exception 'Assessment has no questions.'; end if;
    select answers into keys from public.cs_assessment_keys where assessment_id=new.id;
    for q in select value from jsonb_array_elements(new.questions) where value->>'kind'='multiple_choice' loop
      if coalesce(keys->>(q->>'id'),'') !~ '^[0-9]+$' then raise exception 'A multiple-choice answer is missing.'; end if;
      if (keys->>(q->>'id'))::integer >= jsonb_array_length(q->'options') then raise exception 'Invalid answer key.'; end if;
    end loop;
  end if;
  return new;
end
$$;

create or replace function private.cs_prepare_assessment_submission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare a public.cs_assessments; q jsonb; answer jsonb; keys jsonb; explanations jsonb; correct_choice integer;
begin
  if auth.uid() is null or new.student_id<>auth.uid() then raise exception 'Students can only save their own work.'; end if;
  select * into a from public.cs_assessments where id=new.assessment_id for share;
  if a.status<>'published' or (a.due_at is not null and a.due_at<=now()) or not private.cs_can_view_course(a.course_id) then raise exception 'This assessment is closed or not assigned to you.'; end if;
  if TG_OP='UPDATE' then
    if old.status='submitted' or new.id<>old.id or new.student_id<>old.student_id or new.assessment_id<>old.assessment_id then raise exception 'Submitted work cannot be changed.'; end if;
  end if;
  new.quiz_score:=0; new.quiz_max_score:=0; new.manual_max_score:=0; new.quiz_results:='{}'::jsonb;
  new.question_snapshot:=a.questions; new.updated_at:=now(); new.submitted_at:=null;
  if new.status='submitted' then
    select answers, feedback into keys, explanations from public.cs_assessment_keys where assessment_id=a.id;
    for q in select value from jsonb_array_elements(a.questions) loop
      answer:=new.answers->(q->>'id');
      if answer is null and not coalesce((q->>'required')::boolean, true) then continue; end if;
      if q->>'kind'='multiple_choice' then
        if coalesce(answer->>'choice','') !~ '^[0-9]+$' then raise exception 'Please answer each required question.'; end if;
        if (answer->>'choice')::integer >= jsonb_array_length(q->'options') then raise exception 'Invalid answer choice.'; end if;
        correct_choice := (keys->>(q->>'id'))::integer;
        new.quiz_max_score:=new.quiz_max_score+(q->>'points')::numeric;
        if (answer->>'choice')::integer=correct_choice then new.quiz_score:=new.quiz_score+(q->>'points')::numeric; end if;
        new.quiz_results:=new.quiz_results || jsonb_build_object(q->>'id',jsonb_build_object(
          'correct',(answer->>'choice')::integer=correct_choice,
          'correct_choice',correct_choice,
          'feedback',coalesce(explanations->>(q->>'id'),'')
        ));
      else
        if coalesce(trim(answer->>(case when q->>'kind'='python' then 'code' else 'text' end)),'')='' then
          if coalesce((q->>'required')::boolean, true) then raise exception 'Please answer each required question.'; end if;
          continue;
        end if;
        new.manual_max_score:=new.manual_max_score+(q->>'points')::numeric;
      end if;
    end loop;
    new.submitted_at:=now();
  end if;
  return new;
end
$$;

revoke all on function private.cs_validate_lesson_assessment_link(), private.cs_validate_activity_unlock() from public, anon, authenticated;

-- Keep the Monday quiz key out of the static GitHub Pages bundle.
-- Only an owner of the assessment's course can call this, and the RPC never returns keys.
create function public.cs_install_monday_midterm_keys(target_assessment uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare a public.cs_assessments; q jsonb; expected_keys jsonb := '{}'::jsonb; expected_feedback jsonb := '{}'::jsonb; saved_keys jsonb; saved_feedback jsonb; answer_count integer := 0;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  select * into a from public.cs_assessments where id = target_assessment for update;
  if a.id is null or not private.cs_owns_course(a.course_id) then raise exception 'Not authorized to manage this assessment.'; end if;
  if a.status <> 'draft' then raise exception 'Only a draft assessment can receive its protected key.'; end if;
  for q in select value from jsonb_array_elements(a.questions) where value->>'kind' = 'multiple_choice' loop
    case q->>'id'
      when 'quick-variables' then
        if q->'options' <> jsonb_build_array('4','7','3','43') then raise exception 'Monday practice options do not match the protected key.'; end if;
        expected_keys := expected_keys || jsonb_build_object('quick-variables', 1);
        expected_feedback := expected_feedback || jsonb_build_object('quick-variables', 'The second assignment uses the current value of x (4), adds 3, and stores 7 back in x.');
      when 'quick-input-conversion' then
        if q->'options' <> jsonb_build_array('12','121','13','An input error') then raise exception 'Monday practice options do not match the protected key.'; end if;
        expected_keys := expected_keys || jsonb_build_object('quick-input-conversion', 2);
        expected_feedback := expected_feedback || jsonb_build_object('quick-input-conversion', 'int() converts the entered text "12" to the integer 12. Adding 1 prints 13.');
      when 'quick-conditions' then
        if q->'options' <> jsonb_build_array('Full','Partial','None','Full and Partial') then raise exception 'Monday practice options do not match the protected key.'; end if;
        expected_keys := expected_keys || jsonb_build_object('quick-conditions', 1);
        expected_feedback := expected_feedback || jsonb_build_object('quick-conditions', 'Four is not at least 6, so Python checks the elif. Four is at least 3, so it prints Partial.');
      when 'quick-range' then
        if q->'options' <> jsonb_build_array(E'3\n6\n9',E'3\n6\n9\n10',E'3\n6',E'3\n4\n5\n6\n7\n8\n9') then raise exception 'Monday practice options do not match the protected key.'; end if;
        expected_keys := expected_keys || jsonb_build_object('quick-range', 0);
        expected_feedback := expected_feedback || jsonb_build_object('quick-range', 'range(3, 10, 3) starts at 3, adds 3 each time, and stops before 10. It prints 3, 6, and 9.');
      when 'quick-functions' then
        if q->'options' <> jsonb_build_array('7','12','64','4') then raise exception 'Monday practice options do not match the protected key.'; end if;
        expected_keys := expected_keys || jsonb_build_object('quick-functions', 1);
        expected_feedback := expected_feedback || jsonb_build_object('quick-functions', 'The function returns 4 multiplied by 3, which is 12.');
      else
        raise exception 'Unexpected multiple-choice question in Monday practice.';
    end case;
    answer_count := answer_count + 1;
  end loop;
  if answer_count <> 5 then raise exception 'Monday practice must contain all five protected quiz questions.'; end if;
  select answers, feedback into saved_keys, saved_feedback from public.cs_assessment_keys where assessment_id = target_assessment for update;
  if saved_keys is not null then
    if saved_keys <> expected_keys or saved_feedback <> expected_feedback then raise exception 'This assessment already has a different protected key.'; end if;
  else
    insert into public.cs_assessment_keys(assessment_id, answers, feedback) values (target_assessment, expected_keys, expected_feedback);
  end if;
end;
$$;
revoke all on function public.cs_install_monday_midterm_keys(uuid) from public, anon;
grant execute on function public.cs_install_monday_midterm_keys(uuid) to authenticated;

-- Add hidden, server-side test expectations for the optional activity bank.
create function public.cs_install_monday_midterm_tests(target_activity uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare activity public.cs_activities; expected text; sample_input text := '';
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  select * into activity from public.cs_activities where id = target_activity;
  if activity.id is null or activity.unlock_assessment_id is null
     or not private.cs_owns_course(private.cs_activity_course(target_activity)) then
    raise exception 'Not authorized to install tests for this activity.';
  end if;
  if not exists (
    select 1 from public.cs_assessments a
    where a.id = activity.unlock_assessment_id
      and a.course_id = private.cs_activity_course(target_activity)
      and a.title = 'Monday Midterm Practice — October 12, 2026'
  ) then raise exception 'This is not a Monday midterm practice activity.'; end if;
  case activity.title
    when 'Practice 1 — Study Hours' then expected := 'Study hours: 5'; sample_input := E'2\n3\n';
    when 'Practice 2 — range()' then expected := E'4\n8\n12\n16';
    when 'Practice 3 — Countdown' then expected := E'5\n4\n3\n2\n1';
    when 'Practice 4 — Counter and Accumulator' then expected := E'Total: 85\nCount above 20: 2';
    when 'Practice 5 — Running Largest' then expected := 'Largest: 29';
    when 'Optional Function Challenge — Analyze Orders' then expected := '(114, 2, 42)';
    else raise exception 'No protected test is defined for this activity.';
  end case;
  if not exists(select 1 from public.cs_coding_test_cases where challenge_id = target_activity and visibility = 'hidden') then
    insert into public.cs_coding_test_cases(challenge_id,input,expected_output,visibility,position)
    values(target_activity,sample_input,expected,'hidden',0);
  end if;
end;
$$;
revoke all on function public.cs_install_monday_midterm_tests(uuid) from public, anon;
grant execute on function public.cs_install_monday_midterm_tests(uuid) to authenticated;
