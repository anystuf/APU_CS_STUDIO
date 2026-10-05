-- Internal policy helper: narrowly scoped identity check avoids recursion through enrollment/profile RLS.
create function private.cs_can_review_ide(target_student uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists (
    select 1 from public.cs_profiles p where p.id=auth.uid() and (
      p.role='admin' or (p.role='teacher' and exists (
        select 1 from public.cs_enrollments e join public.cs_courses c on c.id=e.course_id
        where e.student_id=target_student and c.teacher_id=auth.uid()
      ))
    )
  );
$$;
revoke all on function private.cs_can_review_ide(uuid) from public,anon;
grant execute on function private.cs_can_review_ide(uuid) to authenticated;
create policy ide_staff_review on public.cs_ide_projects for select to authenticated
using (private.cs_can_review_ide(user_id));
-- This adds read access only. Existing insert/update policies still require ownership.
