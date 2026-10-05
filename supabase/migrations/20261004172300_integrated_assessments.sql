-- One classroom assessment contains both quiz questions and Python exercises.
create table public.cs_assessments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.cs_courses(id),
  title text not null check (char_length(trim(title)) between 1 and 160),
  instructions text not null default '',
  status text not null default 'draft' check (status in ('draft','published','closed')),
  due_at timestamptz,
  questions jsonb not null default '[]' check (jsonb_typeof(questions)='array' and jsonb_array_length(questions) <= 100),
  created_at timestamptz not null default now()
);
create table public.cs_assessment_keys (
  assessment_id uuid primary key references public.cs_assessments(id) on delete cascade,
  answers jsonb not null default '{}' check(jsonb_typeof(answers)='object')
);
create table public.cs_assessment_submissions (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.cs_assessments(id),
  student_id uuid not null references public.cs_profiles(id),
  status text not null default 'draft' check(status in ('draft','submitted')),
  answers jsonb not null default '{}' check(jsonb_typeof(answers)='object' and octet_length(answers::text) <= 1000000),
  question_snapshot jsonb not null default '[]',
  quiz_score numeric not null default 0,
  quiz_max_score numeric not null default 0,
  manual_max_score numeric not null default 0,
  submitted_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(assessment_id,student_id)
);
create table public.cs_assessment_reviews (
  submission_id uuid primary key references public.cs_assessment_submissions(id),
  teacher_id uuid not null references public.cs_profiles(id),
  manual_score numeric not null check(manual_score >= 0),
  feedback text not null default '' check(char_length(feedback) <= 10000),
  updated_at timestamptz not null default now()
);
create index cs_assessments_course_idx on public.cs_assessments(course_id,created_at desc);
create index cs_assessment_submissions_student_idx on public.cs_assessment_submissions(student_id);
create index cs_assessment_reviews_teacher_idx on public.cs_assessment_reviews(teacher_id);
alter table public.cs_assessments enable row level security;
alter table public.cs_assessment_keys enable row level security;
alter table public.cs_assessment_submissions enable row level security;
alter table public.cs_assessment_reviews enable row level security;
grant select,insert,update on public.cs_assessments,public.cs_assessment_keys,public.cs_assessment_submissions,public.cs_assessment_reviews to authenticated;

create policy assessments_read on public.cs_assessments for select to authenticated using (
  (select private.cs_owns_course(course_id)) or
  (status in ('published','closed') and (select private.cs_can_view_course(course_id)))
);
create policy assessments_insert on public.cs_assessments for insert to authenticated with check ((select private.cs_owns_course(course_id)));
create policy assessments_update on public.cs_assessments for update to authenticated using ((select private.cs_owns_course(course_id))) with check ((select private.cs_owns_course(course_id)));
create policy assessment_keys_read on public.cs_assessment_keys for select to authenticated using (exists(select 1 from public.cs_assessments a where a.id=assessment_id and (select private.cs_owns_course(a.course_id))));
create policy assessment_keys_insert on public.cs_assessment_keys for insert to authenticated with check (exists(select 1 from public.cs_assessments a where a.id=assessment_id and a.status='draft' and (select private.cs_owns_course(a.course_id))));
create policy assessment_keys_update on public.cs_assessment_keys for update to authenticated using (exists(select 1 from public.cs_assessments a where a.id=assessment_id and a.status='draft' and (select private.cs_owns_course(a.course_id)))) with check (exists(select 1 from public.cs_assessments a where a.id=assessment_id and a.status='draft' and (select private.cs_owns_course(a.course_id))));
create policy assessment_submissions_read on public.cs_assessment_submissions for select to authenticated using (
  student_id=(select auth.uid()) or exists(select 1 from public.cs_assessments a where a.id=assessment_id and (select private.cs_owns_course(a.course_id)))
);
create policy assessment_submissions_insert on public.cs_assessment_submissions for insert to authenticated with check (
  student_id=(select auth.uid()) and exists(select 1 from public.cs_assessments a where a.id=assessment_id and a.status='published' and (a.due_at is null or a.due_at>now()) and (select private.cs_can_view_course(a.course_id)))
);
create policy assessment_submissions_update on public.cs_assessment_submissions for update to authenticated using (
  student_id=(select auth.uid()) and status='draft'
) with check (
  student_id=(select auth.uid()) and exists(select 1 from public.cs_assessments a where a.id=assessment_id and a.status='published' and (a.due_at is null or a.due_at>now()) and (select private.cs_can_view_course(a.course_id)))
);
create policy assessment_reviews_read on public.cs_assessment_reviews for select to authenticated using (exists(select 1 from public.cs_assessment_submissions s where s.id=submission_id));
create policy assessment_reviews_insert on public.cs_assessment_reviews for insert to authenticated with check (
  teacher_id=(select auth.uid()) and exists(select 1 from public.cs_assessment_submissions s join public.cs_assessments a on a.id=s.assessment_id where s.id=submission_id and s.status='submitted' and (select private.cs_owns_course(a.course_id)))
);
create policy assessment_reviews_update on public.cs_assessment_reviews for update to authenticated using (
  exists(select 1 from public.cs_assessment_submissions s join public.cs_assessments a on a.id=s.assessment_id where s.id=submission_id and (select private.cs_owns_course(a.course_id)))
) with check (
  teacher_id=(select auth.uid()) and exists(select 1 from public.cs_assessment_submissions s join public.cs_assessments a on a.id=s.assessment_id where s.id=submission_id and s.status='submitted' and (select private.cs_owns_course(a.course_id)))
);

-- Internal trigger needs privileged access solely to the hidden answer key.
create function private.cs_validate_assessment() returns trigger language plpgsql security definer set search_path='' as $$
declare q jsonb; keys jsonb; seen text[] := '{}';
begin
  if auth.uid() is null or not private.cs_owns_course(new.course_id) then raise exception 'Không có quyền sửa đề.'; end if;
  if TG_OP='UPDATE' then
    if new.course_id<>old.course_id or new.id<>old.id then raise exception 'Không thể chuyển đề sang lớp khác.'; end if;
    if old.status<>'draft' and (new.questions<>old.questions or new.title<>old.title or new.instructions<>old.instructions or new.due_at is distinct from old.due_at or new.status='draft') then
      raise exception 'Đề đã giao không thể thay đổi nội dung. Hãy tạo đề mới.';
    end if;
  end if;
  for q in select value from jsonb_array_elements(new.questions) loop
    if coalesce(q->>'id','')='' or q->>'id'=any(seen) or coalesce(trim(q->>'prompt'),'')='' or coalesce(q->>'kind','') not in ('multiple_choice','short_answer','python') or coalesce(q->>'points','') !~ '^[0-9]+$' then raise exception 'Câu hỏi không hợp lệ.'; end if;
    if (q->>'points')::integer not between 1 and 100 then raise exception 'Điểm câu hỏi phải từ 1 đến 100.'; end if;
    seen:=array_append(seen,q->>'id');
    if q->>'kind'='multiple_choice' then
      if jsonb_typeof(q->'options') is distinct from 'array' then raise exception 'Thiếu lựa chọn.'; end if;
      if jsonb_array_length(q->'options') not between 2 and 8 or exists(select 1 from jsonb_array_elements(q->'options') opt where jsonb_typeof(opt)<>'string' or trim(opt #>> '{}')='') then raise exception 'Lựa chọn không hợp lệ.'; end if;
    end if;
  end loop;
  if new.status='published' then
    if jsonb_array_length(new.questions)=0 then raise exception 'Đề chưa có câu hỏi.'; end if;
    select answers into keys from public.cs_assessment_keys where assessment_id=new.id;
    for q in select value from jsonb_array_elements(new.questions) where value->>'kind'='multiple_choice' loop
      if coalesce(keys->>(q->>'id'),'') !~ '^[0-9]+$' then raise exception 'Thiếu đáp án trắc nghiệm.'; end if;
      if (keys->>(q->>'id'))::integer >= jsonb_array_length(q->'options') then raise exception 'Đáp án không hợp lệ.'; end if;
    end loop;
  end if;
  return new;
end $$;
create trigger cs_validate_assessment before insert or update on public.cs_assessments for each row execute function private.cs_validate_assessment();

create function private.cs_prepare_assessment_submission() returns trigger language plpgsql security definer set search_path='' as $$
declare a public.cs_assessments; q jsonb; answer jsonb; keys jsonb;
begin
  if auth.uid() is null or new.student_id<>auth.uid() then raise exception 'Chỉ học sinh được lưu bài của mình.'; end if;
  select * into a from public.cs_assessments where id=new.assessment_id for share;
  if a.status<>'published' or (a.due_at is not null and a.due_at<=now()) or not private.cs_can_view_course(a.course_id) then raise exception 'Bài kiểm tra đã đóng hoặc bạn chưa được giao bài.'; end if;
  if TG_OP='UPDATE' then
    if old.status='submitted' or new.id<>old.id or new.student_id<>old.student_id or new.assessment_id<>old.assessment_id then raise exception 'Bài đã nộp không thể sửa.'; end if;
  end if;
  new.quiz_score:=0; new.quiz_max_score:=0; new.manual_max_score:=0;
  new.question_snapshot:=a.questions; new.updated_at:=now(); new.submitted_at:=null;
  if new.status='submitted' then
    select answers into keys from public.cs_assessment_keys where assessment_id=a.id;
    for q in select value from jsonb_array_elements(a.questions) loop
      answer:=new.answers->(q->>'id');
      if q->>'kind'='multiple_choice' then
        if coalesce(answer->>'choice','') !~ '^[0-9]+$' then raise exception 'Chưa trả lời hết câu hỏi.'; end if;
        if (answer->>'choice')::integer >= jsonb_array_length(q->'options') then raise exception 'Lựa chọn không hợp lệ.'; end if;
        new.quiz_max_score:=new.quiz_max_score+(q->>'points')::numeric;
        if answer->>'choice'=keys->>(q->>'id') then new.quiz_score:=new.quiz_score+(q->>'points')::numeric; end if;
      else
        if coalesce(trim(answer->>(case when q->>'kind'='python' then 'code' else 'text' end)),'')='' then raise exception 'Chưa trả lời hết câu hỏi.'; end if;
        new.manual_max_score:=new.manual_max_score+(q->>'points')::numeric;
      end if;
    end loop;
    new.submitted_at:=now();
  end if;
  return new;
end $$;
create trigger cs_prepare_assessment_submission before insert or update on public.cs_assessment_submissions for each row execute function private.cs_prepare_assessment_submission();

create function private.cs_validate_assessment_review() returns trigger language plpgsql security invoker set search_path='' as $$
declare max_points numeric; course uuid;
begin
  if auth.uid() is null or new.teacher_id<>auth.uid() then raise exception 'Không có quyền chấm bài.'; end if;
  if TG_OP='UPDATE' and new.submission_id<>old.submission_id then raise exception 'Không thể chuyển nhận xét sang bài khác.'; end if;
  select s.manual_max_score,a.course_id into max_points,course from public.cs_assessment_submissions s join public.cs_assessments a on a.id=s.assessment_id where s.id=new.submission_id and s.status='submitted';
  if max_points is null or not private.cs_owns_course(course) or new.manual_score>max_points then raise exception 'Điểm hoặc quyền chấm không hợp lệ.'; end if;
  new.updated_at:=now(); return new;
end $$;
create trigger cs_validate_assessment_review before insert or update on public.cs_assessment_reviews for each row execute function private.cs_validate_assessment_review();
revoke all on function private.cs_validate_assessment(),private.cs_prepare_assessment_submission(),private.cs_validate_assessment_review() from public,anon,authenticated;
