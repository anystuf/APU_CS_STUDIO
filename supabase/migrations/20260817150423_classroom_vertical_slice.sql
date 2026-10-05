-- Course hierarchy, Python challenges, test cases, and immutable attempt history.
create type public.cs_activity_type as enum ('coding','quiz','code_prediction','code_tracing','debugging','parsons','reflection');
create type public.cs_difficulty as enum ('core','challenge','stretch');
create type public.cs_test_visibility as enum ('public','hidden');
create type public.cs_attempt_status as enum ('draft','submitted','passed','failed');

create table public.cs_modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.cs_courses(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  description text not null default '', position integer not null default 0 check(position >= 0),
  status public.cs_publish_status not null default 'draft', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.cs_lessons (
  id uuid primary key default gen_random_uuid(), module_id uuid not null references public.cs_modules(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160), introduction text not null default '',
  learning_objectives text[] not null default '{}', vocabulary text[] not null default '{}',
  position integer not null default 0 check(position >= 0), status public.cs_publish_status not null default 'draft',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.cs_activities (
  id uuid primary key default gen_random_uuid(), lesson_id uuid not null references public.cs_lessons(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160), instructions text not null default '',
  activity_type public.cs_activity_type not null, difficulty public.cs_difficulty not null default 'core',
  position integer not null default 0 check(position >= 0), is_required boolean not null default true,
  max_score numeric(6,2) not null default 100 check(max_score >= 0), status public.cs_publish_status not null default 'draft',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.cs_coding_challenges (
  activity_id uuid primary key references public.cs_activities(id) on delete cascade,
  starter_code text not null default '', solution_notes text not null default '', allow_input boolean not null default true
);
create table public.cs_coding_test_cases (
  id uuid primary key default gen_random_uuid(), challenge_id uuid not null references public.cs_coding_challenges(activity_id) on delete cascade,
  input text not null default '', expected_output text not null, visibility public.cs_test_visibility not null default 'public',
  position integer not null default 0 check(position >= 0)
);
create table public.cs_activity_attempts (
  id uuid primary key default gen_random_uuid(), activity_id uuid not null references public.cs_activities(id) on delete cascade,
  student_id uuid not null references public.cs_profiles(id) on delete cascade, code text not null default '', stdout text not null default '',
  status public.cs_attempt_status not null default 'submitted', score numeric(6,2) not null default 0 check(score >= 0),
  test_results jsonb not null default '[]'::jsonb, attempt_number integer not null check(attempt_number > 0), submitted_at timestamptz not null default now(),
  unique(activity_id, student_id, attempt_number)
);
create index cs_modules_course_idx on public.cs_modules(course_id, position);
create index cs_lessons_module_idx on public.cs_lessons(module_id, position);
create index cs_activities_lesson_idx on public.cs_activities(lesson_id, position);
create index cs_test_cases_challenge_idx on public.cs_coding_test_cases(challenge_id, position);
create index cs_attempts_student_idx on public.cs_activity_attempts(student_id, submitted_at desc);
create index cs_attempts_activity_idx on public.cs_activity_attempts(activity_id, submitted_at desc);

alter table public.cs_modules enable row level security;
alter table public.cs_lessons enable row level security;
alter table public.cs_activities enable row level security;
alter table public.cs_coding_challenges enable row level security;
alter table public.cs_coding_test_cases enable row level security;
alter table public.cs_activity_attempts enable row level security;
grant select, insert, update, delete on public.cs_modules, public.cs_lessons, public.cs_activities, public.cs_coding_challenges, public.cs_coding_test_cases to authenticated;
grant select, insert on public.cs_activity_attempts to authenticated;

create function private.cs_owns_course(target uuid) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.cs_courses c where c.id=target and (c.teacher_id=(select auth.uid()) or exists(select 1 from public.cs_profiles p where p.id=(select auth.uid()) and p.role='admin')));
$$;
create function private.cs_can_view_course(target uuid) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.cs_courses c where c.id=target and (c.teacher_id=(select auth.uid()) or (c.status='published' and exists(select 1 from public.cs_enrollments e where e.course_id=c.id and e.student_id=(select auth.uid())))));
$$;
create function private.cs_activity_course(target uuid) returns uuid language sql stable security definer set search_path='' as $$
  select m.course_id from public.cs_activities a join public.cs_lessons l on l.id=a.lesson_id join public.cs_modules m on m.id=l.module_id where a.id=target;
$$;
revoke all on function private.cs_owns_course(uuid), private.cs_can_view_course(uuid), private.cs_activity_course(uuid) from public, anon;
grant execute on function private.cs_owns_course(uuid), private.cs_can_view_course(uuid), private.cs_activity_course(uuid) to authenticated;

create policy modules_read on public.cs_modules for select to authenticated using ((select private.cs_owns_course(course_id)) or (status='published' and (select private.cs_can_view_course(course_id))));
create policy modules_write on public.cs_modules for all to authenticated using ((select private.cs_owns_course(course_id))) with check ((select private.cs_owns_course(course_id)));
create policy lessons_read on public.cs_lessons for select to authenticated using (exists(select 1 from public.cs_modules m where m.id=module_id and ((select private.cs_owns_course(m.course_id)) or (cs_lessons.status='published' and m.status='published' and (select private.cs_can_view_course(m.course_id))))));
create policy lessons_write on public.cs_lessons for all to authenticated using (exists(select 1 from public.cs_modules m where m.id=module_id and (select private.cs_owns_course(m.course_id)))) with check (exists(select 1 from public.cs_modules m where m.id=module_id and (select private.cs_owns_course(m.course_id))));
create policy activities_read on public.cs_activities for select to authenticated using (exists(select 1 from public.cs_lessons l join public.cs_modules m on m.id=l.module_id where l.id=lesson_id and ((select private.cs_owns_course(m.course_id)) or (cs_activities.status='published' and l.status='published' and m.status='published' and (select private.cs_can_view_course(m.course_id))))));
create policy activities_write on public.cs_activities for all to authenticated using ((select private.cs_owns_course((select private.cs_activity_course(id))))) with check (exists(select 1 from public.cs_lessons l join public.cs_modules m on m.id=l.module_id where l.id=lesson_id and (select private.cs_owns_course(m.course_id))));
create policy challenges_read on public.cs_coding_challenges for select to authenticated using (exists(select 1 from public.cs_activities a where a.id=activity_id));
create policy challenges_write on public.cs_coding_challenges for all to authenticated using ((select private.cs_owns_course((select private.cs_activity_course(activity_id))))) with check ((select private.cs_owns_course((select private.cs_activity_course(activity_id)))));
create policy tests_read on public.cs_coding_test_cases for select to authenticated using (visibility='public' or (select private.cs_owns_course((select private.cs_activity_course(challenge_id)))));
create policy tests_write on public.cs_coding_test_cases for all to authenticated using ((select private.cs_owns_course((select private.cs_activity_course(challenge_id))))) with check ((select private.cs_owns_course((select private.cs_activity_course(challenge_id)))));
create policy attempts_read on public.cs_activity_attempts for select to authenticated using (student_id=(select auth.uid()) or (select private.cs_owns_course((select private.cs_activity_course(activity_id)))));
create policy attempts_insert on public.cs_activity_attempts for insert to authenticated with check (student_id=(select auth.uid()) and (select private.cs_can_view_course((select private.cs_activity_course(activity_id)))));
