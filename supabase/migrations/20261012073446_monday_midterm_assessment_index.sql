create index cs_lessons_assessment_id_idx
  on public.cs_lessons(assessment_id)
  where assessment_id is not null;
