-- INSERT ... RETURNING checks SELECT policies before a helper can find the
-- newly inserted course through a separate table lookup. Use the row owner
-- directly; preserve the existing admin and enrolled-student access rules.
drop policy courses_read_enrolled_or_owner on public.cs_courses;
create policy courses_read_enrolled_or_owner on public.cs_courses
for select to authenticated using (
  teacher_id = (select auth.uid())
  or exists(select 1 from public.cs_profiles p where p.id=(select auth.uid()) and p.role='admin')
  or (select private.cs_can_view_course(id))
);
