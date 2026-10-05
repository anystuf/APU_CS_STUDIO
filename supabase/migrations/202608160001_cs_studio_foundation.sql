-- CS Studio additive foundation. Deliberately does not alter pre-existing tables.
create extension if not exists pgcrypto;
create schema if not exists private;
create type public.cs_user_role as enum ('student','teacher','admin');
create type public.cs_publish_status as enum ('draft','published','archived');

create table public.cs_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  role public.cs_user_role not null default 'student',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.cs_courses (
  id uuid primary key default gen_random_uuid(), teacher_id uuid not null references public.cs_profiles(id),
  title text not null check (char_length(title) between 1 and 160), description text not null default '',
  status public.cs_publish_status not null default 'draft', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.cs_enrollments (
  course_id uuid not null references public.cs_courses(id) on delete cascade,
  student_id uuid not null references public.cs_profiles(id) on delete cascade,
  enrolled_at timestamptz not null default now(), primary key(course_id,student_id)
);
create index cs_courses_teacher_idx on public.cs_courses(teacher_id);
create index cs_enrollments_student_idx on public.cs_enrollments(student_id);

alter table public.cs_profiles enable row level security;
alter table public.cs_courses enable row level security;
alter table public.cs_enrollments enable row level security;
grant select on public.cs_profiles to authenticated;
grant update(full_name) on public.cs_profiles to authenticated;
grant select, insert, update, delete on public.cs_courses to authenticated;
grant select, insert, delete on public.cs_enrollments to authenticated;

create function private.cs_is_staff() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.cs_profiles p where p.id = (select auth.uid()) and p.role in ('teacher','admin'));
$$;
revoke all on function private.cs_is_staff() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.cs_is_staff() to authenticated;
create policy "profiles_read_self_or_staff" on public.cs_profiles for select to authenticated using ((select auth.uid()) = id or private.cs_is_staff());
create policy "profiles_update_self" on public.cs_profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "courses_read_enrolled_or_owner" on public.cs_courses for select to authenticated using (teacher_id=(select auth.uid()) or status='published' and exists(select 1 from public.cs_enrollments e where e.course_id=id and e.student_id=(select auth.uid())));
create policy "courses_staff_insert" on public.cs_courses for insert to authenticated with check (private.cs_is_staff() and teacher_id=(select auth.uid()));
create policy "courses_owner_update" on public.cs_courses for update to authenticated using (teacher_id=(select auth.uid()) or exists(select 1 from public.cs_profiles p where p.id=(select auth.uid()) and p.role='admin')) with check (teacher_id=(select auth.uid()) or exists(select 1 from public.cs_profiles p where p.id=(select auth.uid()) and p.role='admin'));
create policy "courses_owner_delete" on public.cs_courses for delete to authenticated using (teacher_id=(select auth.uid()) or exists(select 1 from public.cs_profiles p where p.id=(select auth.uid()) and p.role='admin'));
create policy "enrollments_read_own_or_teacher" on public.cs_enrollments for select to authenticated using (student_id=(select auth.uid()) or exists(select 1 from public.cs_courses c where c.id=course_id and c.teacher_id=(select auth.uid())));
create policy "enrollments_teacher_insert" on public.cs_enrollments for insert to authenticated with check (exists(select 1 from public.cs_courses c where c.id=course_id and c.teacher_id=(select auth.uid())));
create policy "enrollments_teacher_delete" on public.cs_enrollments for delete to authenticated using (exists(select 1 from public.cs_courses c where c.id=course_id and c.teacher_id=(select auth.uid())));

create function private.cs_handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.cs_profiles(id,full_name,email) values(new.id,coalesce(new.raw_user_meta_data->>'full_name',''),coalesce(new.email,''));
  return new;
end; $$;
revoke all on function private.cs_handle_new_user() from public, anon, authenticated;
create trigger cs_on_auth_user_created after insert on auth.users for each row execute function private.cs_handle_new_user();
