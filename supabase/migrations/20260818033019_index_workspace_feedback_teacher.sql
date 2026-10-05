create index cs_workspace_feedback_teacher_idx
  on public.cs_workspace_feedback(teacher_id, updated_at desc);
