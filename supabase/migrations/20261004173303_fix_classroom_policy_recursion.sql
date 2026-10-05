-- Course and enrollment policies previously called each other recursively.
-- Existing private helpers perform the same ownership checks without that cycle.
drop policy courses_read_enrolled_or_owner on public.cs_courses;
create policy courses_read_enrolled_or_owner on public.cs_courses for select to authenticated
using ((select private.cs_owns_course(id)) or (select private.cs_can_view_course(id)));
drop policy enrollments_read_own_or_teacher on public.cs_enrollments;
create policy enrollments_read_own_or_teacher on public.cs_enrollments for select to authenticated
using (student_id=(select auth.uid()) or (select private.cs_owns_course(course_id)));
drop policy enrollments_teacher_insert on public.cs_enrollments;
create policy enrollments_teacher_insert on public.cs_enrollments for insert to authenticated
with check ((select private.cs_owns_course(course_id)));
drop policy enrollments_teacher_delete on public.cs_enrollments;
create policy enrollments_teacher_delete on public.cs_enrollments for delete to authenticated
using ((select private.cs_owns_course(course_id)));
