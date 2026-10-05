drop policy modules_write on public.cs_modules;
create policy modules_insert on public.cs_modules for insert to authenticated with check ((select private.cs_owns_course(course_id)));
create policy modules_update on public.cs_modules for update to authenticated using ((select private.cs_owns_course(course_id))) with check ((select private.cs_owns_course(course_id)));
create policy modules_delete on public.cs_modules for delete to authenticated using ((select private.cs_owns_course(course_id)));

drop policy lessons_write on public.cs_lessons;
create policy lessons_insert on public.cs_lessons for insert to authenticated with check (exists(select 1 from public.cs_modules m where m.id=module_id and (select private.cs_owns_course(m.course_id))));
create policy lessons_update on public.cs_lessons for update to authenticated using (exists(select 1 from public.cs_modules m where m.id=module_id and (select private.cs_owns_course(m.course_id)))) with check (exists(select 1 from public.cs_modules m where m.id=module_id and (select private.cs_owns_course(m.course_id))));
create policy lessons_delete on public.cs_lessons for delete to authenticated using (exists(select 1 from public.cs_modules m where m.id=module_id and (select private.cs_owns_course(m.course_id))));

drop policy activities_write on public.cs_activities;
create policy activities_insert on public.cs_activities for insert to authenticated with check (exists(select 1 from public.cs_lessons l join public.cs_modules m on m.id=l.module_id where l.id=lesson_id and (select private.cs_owns_course(m.course_id))));
create policy activities_update on public.cs_activities for update to authenticated using ((select private.cs_owns_course((select private.cs_activity_course(id))))) with check (exists(select 1 from public.cs_lessons l join public.cs_modules m on m.id=l.module_id where l.id=lesson_id and (select private.cs_owns_course(m.course_id))));
create policy activities_delete on public.cs_activities for delete to authenticated using ((select private.cs_owns_course((select private.cs_activity_course(id)))));

drop policy challenges_write on public.cs_coding_challenges;
create policy challenges_insert on public.cs_coding_challenges for insert to authenticated with check ((select private.cs_owns_course((select private.cs_activity_course(activity_id)))));
create policy challenges_update on public.cs_coding_challenges for update to authenticated using ((select private.cs_owns_course((select private.cs_activity_course(activity_id))))) with check ((select private.cs_owns_course((select private.cs_activity_course(activity_id)))));
create policy challenges_delete on public.cs_coding_challenges for delete to authenticated using ((select private.cs_owns_course((select private.cs_activity_course(activity_id)))));

drop policy tests_write on public.cs_coding_test_cases;
create policy tests_insert on public.cs_coding_test_cases for insert to authenticated with check ((select private.cs_owns_course((select private.cs_activity_course(challenge_id)))));
create policy tests_update on public.cs_coding_test_cases for update to authenticated using ((select private.cs_owns_course((select private.cs_activity_course(challenge_id))))) with check ((select private.cs_owns_course((select private.cs_activity_course(challenge_id)))));
create policy tests_delete on public.cs_coding_test_cases for delete to authenticated using ((select private.cs_owns_course((select private.cs_activity_course(challenge_id)))));
