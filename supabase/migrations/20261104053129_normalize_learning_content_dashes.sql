-- Atomic maintenance: concurrent writes wait until validation is restored before commit.
lock table public.cs_assessments in access exclusive mode;
alter table public.cs_assessments disable trigger cs_validate_assessment;

-- Normalize presentation punctuation without changing student work, code, test data or keys.
-- Keep the protected installer in sync with its title-based allow-list.
do $$
declare definition text;
begin
  select pg_get_functiondef('public.cs_install_monday_midterm_tests(uuid)'::regprocedure) into definition;
  execute replace(definition, chr(8212), '-');
end;
$$;

update public.cs_courses set title=replace(title,chr(8212),'-'), description=replace(description,chr(8212),'-')
where title like '%'||chr(8212)||'%' or description like '%'||chr(8212)||'%';
update public.cs_modules set title=replace(title,chr(8212),'-'), description=replace(description,chr(8212),'-')
where title like '%'||chr(8212)||'%' or description like '%'||chr(8212)||'%';
update public.cs_lessons set title=replace(title,chr(8212),'-'), introduction=replace(introduction,chr(8212),'-'),
learning_objectives=array(select replace(v,chr(8212),'-') from unnest(learning_objectives) v),
vocabulary=array(select replace(v,chr(8212),'-') from unnest(vocabulary) v)
where title like '%'||chr(8212)||'%' or introduction like '%'||chr(8212)||'%' or array_to_string(learning_objectives,' ') like '%'||chr(8212)||'%' or array_to_string(vocabulary,' ') like '%'||chr(8212)||'%';
update public.cs_activities set title=replace(title,chr(8212),'-'), instructions=replace(instructions,chr(8212),'-')
where title like '%'||chr(8212)||'%' or instructions like '%'||chr(8212)||'%';
update public.cs_assessments set title=replace(title,chr(8212),'-'), instructions=replace(instructions,chr(8212),'-')
where title like '%'||chr(8212)||'%' or instructions like '%'||chr(8212)||'%';

update public.cs_assessments a set questions=(
 select jsonb_agg(
 q || case when q ? 'prompt' then jsonb_build_object('prompt',replace(q->>'prompt',chr(8212),'-')) else '{}'::jsonb end
   || case when q ? 'hint' then jsonb_build_object('hint',replace(q->>'hint',chr(8212),'-')) else '{}'::jsonb end
   || case when jsonb_typeof(q->'options')='array' then jsonb_build_object('options',(select jsonb_agg(replace(o,chr(8212),'-') order by n) from jsonb_array_elements_text(q->'options') with ordinality x(o,n))) else '{}'::jsonb end
 order by position)
 from jsonb_array_elements(a.questions) with ordinality x(q,position)
) where questions::text like '%'||chr(8212)||'%';

alter table public.cs_assessments enable trigger cs_validate_assessment;

update public.cs_assessment_explanations set explanation=replace(explanation,chr(8212),'-') where explanation like '%'||chr(8212)||'%';
update public.cs_coding_challenges set solution_notes=replace(solution_notes,chr(8212),'-') where solution_notes like '%'||chr(8212)||'%';
update public.cs_teacher_feedback set comment=replace(comment,chr(8212),'-') where comment like '%'||chr(8212)||'%';
update public.cs_workspace_feedback set comment=replace(comment,chr(8212),'-') where comment like '%'||chr(8212)||'%';
update public.cs_assessment_reviews set feedback=replace(feedback,chr(8212),'-') where feedback like '%'||chr(8212)||'%';
