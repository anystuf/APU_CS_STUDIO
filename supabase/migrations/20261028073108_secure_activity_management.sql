-- Expected outputs stay unreadable through the student REST tables/views.
-- Only this owner-checked private function can return them to staff.
create function private.cs_teacher_activity_tests(target_activity uuid)
returns setof public.cs_coding_test_cases
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not coalesce(private.cs_owns_course(private.cs_activity_course(target_activity)), false) then
    raise exception 'Only the course teacher or an administrator can manage activity tests.' using errcode = '42501';
  end if;
  return query select t.* from public.cs_coding_test_cases t
    where t.challenge_id = target_activity order by t.position, t.id;
end;
$$;
revoke all on function private.cs_teacher_activity_tests(uuid) from public, anon;
grant execute on function private.cs_teacher_activity_tests(uuid) to authenticated;
create function public.cs_teacher_activity_tests(target_activity uuid)
returns setof public.cs_coding_test_cases
language sql stable security invoker set search_path = '' as $$
  select * from private.cs_teacher_activity_tests(target_activity);
$$;
revoke all on function public.cs_teacher_activity_tests(uuid) from public, anon;
grant execute on function public.cs_teacher_activity_tests(uuid) to authenticated;

-- One transaction for metadata, starter code and tests. RLS remains in force.
create function public.cs_save_activity(
  target_activity uuid, activity_data jsonb, challenge_data jsonb default null,
  test_data jsonb default null, expected_updated_at timestamptz default null
)
returns public.cs_activities
language plpgsql security invoker set search_path = '' as $$
declare
  current_row public.cs_activities; result public.cs_activities;
  course uuid; test jsonb; test_id uuid; changed integer;
begin
  if auth.uid() is null then raise exception 'Sign in before managing activities.' using errcode='42501'; end if;
  if jsonb_typeof(activity_data) is distinct from 'object' then raise exception 'Invalid activity data.'; end if;
  if target_activity is not null then
    select * into current_row from public.cs_activities where id=target_activity for update;
    if not found then raise exception 'Activity not found or access denied.' using errcode='42501'; end if;
    course := private.cs_activity_course(target_activity);
    if expected_updated_at is null or current_row.updated_at is distinct from expected_updated_at then
      raise exception 'This activity changed in another session. Reload before saving.' using errcode='40001';
    end if;
  else
    select m.course_id into course from public.cs_lessons l join public.cs_modules m on m.id=l.module_id
      where l.id=(activity_data->>'lesson_id')::uuid;
  end if;
  if course is null or not coalesce(private.cs_owns_course(course),false) then
    raise exception 'Only the course teacher or an administrator can save activities.' using errcode='42501';
  end if;
  if char_length(trim(coalesce(activity_data->>'title',''))) not between 1 and 160
    or char_length(coalesce(activity_data->>'instructions','')) > 50000
    or (activity_data->>'max_score')::numeric not between 0 and 1000 then raise exception 'Check title, instructions and maximum score.'; end if;
  if challenge_data is not null and (jsonb_typeof(challenge_data)<>'object'
    or char_length(coalesce(challenge_data->>'starter_code',''))>200000) then raise exception 'Invalid starter code.'; end if;
  if test_data is not null then
    if jsonb_typeof(test_data) is distinct from 'array' then raise exception 'Tests must be an array.'; end if;
    if jsonb_array_length(test_data)>100 then raise exception 'Keep no more than 100 tests.'; end if;
    if (select count(distinct (q->>'id')::uuid) from jsonb_array_elements(test_data) q) <> jsonb_array_length(test_data) then
      raise exception 'Each test needs a unique ID.';
    end if;
    for test in select value from jsonb_array_elements(test_data) loop
      if jsonb_typeof(test->'input') is distinct from 'string' or jsonb_typeof(test->'expected_output') is distinct from 'string'
        or length(test->>'input')>20000 or length(test->>'expected_output')>20000
        or coalesce(test->>'visibility','') not in ('public','hidden') then raise exception 'Invalid test case.'; end if;
    end loop;
  end if;
  if target_activity is null then
    insert into public.cs_activities(lesson_id,title,instructions,activity_type,difficulty,is_required,max_score,status,position,due_at)
      values((activity_data->>'lesson_id')::uuid,trim(activity_data->>'title'),coalesce(activity_data->>'instructions',''),
        'coding',coalesce(activity_data->>'difficulty','core')::public.cs_difficulty,coalesce((activity_data->>'is_required')::boolean,true),
        (activity_data->>'max_score')::numeric,coalesce(activity_data->>'status','draft')::public.cs_publish_status,
        coalesce((select max(position)+1 from public.cs_activities where lesson_id=(activity_data->>'lesson_id')::uuid),0),
        nullif(activity_data->>'due_at','')::timestamptz) returning * into result;
  else
    update public.cs_activities set title=trim(activity_data->>'title'),instructions=coalesce(activity_data->>'instructions',''),
      difficulty=coalesce(activity_data->>'difficulty',current_row.difficulty::text)::public.cs_difficulty,
      is_required=(activity_data->>'is_required')::boolean,max_score=(activity_data->>'max_score')::numeric,
      status=(activity_data->>'status')::public.cs_publish_status,due_at=nullif(activity_data->>'due_at','')::timestamptz,
      updated_at=clock_timestamp() where id=target_activity returning * into result;
  end if;
  if challenge_data is not null then
    insert into public.cs_coding_challenges(activity_id,starter_code,allow_input)
      values(result.id,coalesce(challenge_data->>'starter_code',''),coalesce((challenge_data->>'allow_input')::boolean,true))
      on conflict(activity_id) do update set starter_code=excluded.starter_code,allow_input=excluded.allow_input;
  end if;
  if test_data is not null then
    -- Keep unchanged IDs so existing attempt histories still refer to the same tests.
    for test in select value from jsonb_array_elements(test_data) loop
      test_id := (test->>'id')::uuid;
      if exists(select 1 from public.cs_coding_test_cases where id=test_id and challenge_id<>result.id) then
        raise exception 'A test cannot be moved between activities.';
      end if;
      update public.cs_coding_test_cases set input=test->>'input',expected_output=test->>'expected_output',
        visibility=(test->>'visibility')::public.cs_test_visibility,
        position=(select ordinality-1 from jsonb_array_elements(test_data) with ordinality x where x.value=test)
        where id=test_id and challenge_id=result.id;
      get diagnostics changed = row_count;
      if changed=0 then
        insert into public.cs_coding_test_cases(id,challenge_id,input,expected_output,visibility,position)
          values(test_id,result.id,test->>'input',test->>'expected_output',(test->>'visibility')::public.cs_test_visibility,
            (select ordinality-1 from jsonb_array_elements(test_data) with ordinality x where x.value=test));
      end if;
    end loop;
    delete from public.cs_coding_test_cases t where challenge_id=result.id
      and not exists(select 1 from jsonb_array_elements(test_data) q where (q->>'id')::uuid=t.id);
  end if;
  return result;
end;
$$;
revoke all on function public.cs_save_activity(uuid,jsonb,jsonb,jsonb,timestamptz) from public, anon;
grant execute on function public.cs_save_activity(uuid,jsonb,jsonb,jsonb,timestamptz) to authenticated;
