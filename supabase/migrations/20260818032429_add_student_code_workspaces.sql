-- Persistent student workspaces let teachers review code before final submission.
create table public.cs_code_workspaces (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.cs_activities(id) on delete cascade,
  student_id uuid not null references public.cs_profiles(id) on delete cascade,
  code text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (activity_id, student_id)
);

create index cs_code_workspaces_student_idx
  on public.cs_code_workspaces(student_id, updated_at desc);
create index cs_code_workspaces_activity_idx
  on public.cs_code_workspaces(activity_id, updated_at desc);

create table public.cs_workspace_feedback (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.cs_code_workspaces(id) on delete cascade,
  student_id uuid not null references public.cs_profiles(id) on delete cascade,
  teacher_id uuid not null references public.cs_profiles(id),
  comment text not null check (char_length(comment) between 1 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cs_workspace_feedback_student_idx
  on public.cs_workspace_feedback(student_id, updated_at desc);

alter table public.cs_code_workspaces enable row level security;
alter table public.cs_workspace_feedback enable row level security;

grant select, insert, update on public.cs_code_workspaces to authenticated;
grant select, insert, update, delete on public.cs_workspace_feedback to authenticated;

create policy code_workspaces_read on public.cs_code_workspaces
  for select to authenticated
  using (
    student_id = (select auth.uid())
    or (select private.cs_owns_course(private.cs_activity_course(activity_id)))
  );

create policy code_workspaces_insert on public.cs_code_workspaces
  for insert to authenticated
  with check (
    student_id = (select auth.uid())
    and (select private.cs_can_view_course(private.cs_activity_course(activity_id)))
  );

create policy code_workspaces_update on public.cs_code_workspaces
  for update to authenticated
  using (student_id = (select auth.uid()))
  with check (
    student_id = (select auth.uid())
    and (select private.cs_can_view_course(private.cs_activity_course(activity_id)))
  );

create policy workspace_feedback_read on public.cs_workspace_feedback
  for select to authenticated
  using (
    student_id = (select auth.uid())
    or teacher_id = (select auth.uid())
    or (select private.cs_owns_course(private.cs_activity_course(
      (select w.activity_id from public.cs_code_workspaces w where w.id = workspace_id)
    )))
  );

create policy workspace_feedback_insert on public.cs_workspace_feedback
  for insert to authenticated
  with check (
    teacher_id = (select auth.uid())
    and student_id = (select w.student_id from public.cs_code_workspaces w where w.id = workspace_id)
    and (select private.cs_owns_course(private.cs_activity_course(
      (select w.activity_id from public.cs_code_workspaces w where w.id = workspace_id)
    )))
  );

create policy workspace_feedback_update on public.cs_workspace_feedback
  for update to authenticated
  using (teacher_id = (select auth.uid()))
  with check (
    teacher_id = (select auth.uid())
    and student_id = (select w.student_id from public.cs_code_workspaces w where w.id = workspace_id)
    and (select private.cs_owns_course(private.cs_activity_course(
      (select w.activity_id from public.cs_code_workspaces w where w.id = workspace_id)
    )))
  );

create policy workspace_feedback_delete on public.cs_workspace_feedback
  for delete to authenticated
  using (teacher_id = (select auth.uid()));
