drop policy tests_read on public.cs_coding_test_cases;
create policy tests_read on public.cs_coding_test_cases for select to authenticated using (
  (select private.cs_can_view_course((select private.cs_activity_course(challenge_id))))
  or (select private.cs_owns_course((select private.cs_activity_course(challenge_id))))
);

revoke select on public.cs_coding_test_cases from authenticated;
grant select(id,challenge_id,input,visibility,position) on public.cs_coding_test_cases to authenticated;

create view public.cs_student_test_cases with (security_invoker=true) as
select id,challenge_id,input,visibility,position from public.cs_coding_test_cases;
grant select on public.cs_student_test_cases to authenticated;

create function private.cs_grade_test_outputs(target_activity uuid,outputs jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(outputs) <> 'array' or jsonb_array_length(outputs) > 100 then raise exception 'Invalid test output payload'; end if;
  if not (select private.cs_can_view_course((select private.cs_activity_course(target_activity))))
     and not (select private.cs_owns_course((select private.cs_activity_course(target_activity)))) then
    raise exception 'Activity is not accessible';
  end if;
  with supplied as (
    select (value->>'id')::uuid id,coalesce(value->>'output','') output from jsonb_array_elements(outputs)
  ),graded as (
    select t.id,t.position,t.visibility,
      trim(coalesce(s.output,''))=trim(t.expected_output) passed,
      case when t.visibility='public' then t.expected_output end expected,
      case when t.visibility='public' then coalesce(s.output,'') end actual
    from public.cs_coding_test_cases t left join supplied s on s.id=t.id
    where t.challenge_id=target_activity order by t.position
  )
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'name','Test '||(position+1),'passed',passed,'expected',expected,'actual',actual,'visibility',visibility) order by position),'[]'::jsonb)
  into result from graded;
  return result;
end; $$;
revoke all on function private.cs_grade_test_outputs(uuid,jsonb) from public,anon;
grant execute on function private.cs_grade_test_outputs(uuid,jsonb) to authenticated;

create function public.cs_grade_test_outputs(target_activity uuid,outputs jsonb)
returns jsonb language sql stable security invoker set search_path='' as $$
  select private.cs_grade_test_outputs(target_activity,outputs);
$$;
revoke all on function public.cs_grade_test_outputs(uuid,jsonb) from public,anon;
grant execute on function public.cs_grade_test_outputs(uuid,jsonb) to authenticated;
