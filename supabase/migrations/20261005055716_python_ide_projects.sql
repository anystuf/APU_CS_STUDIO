create table public.cs_ide_projects (
  user_id uuid primary key references public.cs_profiles(id) on delete cascade,
  files jsonb not null check (jsonb_typeof(files) = 'array' and jsonb_array_length(files) between 1 and 20 and octet_length(files::text) <= 1048576),
  active_file text not null,
  stdin text not null default '' check (octet_length(stdin) <= 50000),
  revision integer not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.cs_ide_projects enable row level security;
grant select, insert, update on public.cs_ide_projects to authenticated;
create policy ide_read_own on public.cs_ide_projects for select to authenticated using (user_id=(select auth.uid()));
create policy ide_insert_own on public.cs_ide_projects for insert to authenticated with check (user_id=(select auth.uid()));
create policy ide_update_own on public.cs_ide_projects for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));

create function public.cs_save_ide_project(project_files jsonb, selected_file text, program_input text, expected_revision integer)
returns setof public.cs_ide_projects language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if expected_revision=0 then
    return query insert into public.cs_ide_projects(user_id,files,active_file,stdin)
    values(auth.uid(),project_files,selected_file,program_input) on conflict do nothing returning *;
  else
    return query update public.cs_ide_projects set files=project_files,active_file=selected_file,stdin=program_input,
      revision=revision+1,updated_at=now() where user_id=auth.uid() and revision=expected_revision returning *;
  end if;
  if not found then raise exception 'Workspace changed on another device. Load cloud version before saving.'; end if;
end $$;
revoke all on function public.cs_save_ide_project(jsonb,text,text,integer) from public,anon;
grant execute on function public.cs_save_ide_project(jsonb,text,text,integer) to authenticated;
