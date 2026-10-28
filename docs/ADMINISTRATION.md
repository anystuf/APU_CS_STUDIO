# Course and activity administration

Open **Courses & students**, choose a course, then use **Course settings**,
**Module settings** and **Lesson settings** to edit titles, descriptions, order
and publication status. New content starts as a draft. Publish every parent
(course, module, lesson) before assigning an activity to students.

Use the activity search, then **Preview / Edit / Assign** to manage an exercise:

1. **Edit activity** changes instructions, starter Python, points and test cases.
2. **Save changes** saves those fields together in one database transaction.
3. Set a deadline and required/optional flag. **Assign / Publish** makes the task
   available when its parents are published and its prerequisite is satisfied.
4. **Review saved work and submissions** filters the teacher review to that task.
5. **Unpublish** or **Archive** hides work without deleting student submissions.
   Restore it by selecting Published again.

If another session edits an activity, a stale save is rejected. Copy any desired
unsaved changes before reloading and reconcile them with the latest version.
Deadlines communicate a target; they do not block late submissions.

## Permission repair (October 28, 2026)

The activity manager selected `expected_output` directly from
`cs_coding_test_cases`. That column is intentionally unavailable to authenticated
REST clients to prevent students reading hidden answers. The replacement
`cs_teacher_activity_tests` RPC checks course ownership/admin status before
returning tests. Student views and grading restrictions remain intact.

`cs_save_activity` applies metadata, starter code and tests atomically, under RLS,
with an activity timestamp check to prevent stale overwrites. Unavailable test
or starter data is left unchanged during a settings-only save. New course
creation also requires an INSERT RETURNING-compatible SELECT policy.

Activities with no automated tests are submitted for teacher review rather than
automatically receiving full marks. Student local drafts are not rewritten until
the requested activity has finished loading.

## Verification

- `npm run lint`, `npm test`, `npm run build`.
- `supabase/tests/activity_management.sql` tests teacher/admin access, student,
  unrelated-teacher and anonymous denial, safe student test views, atomic saves,
  stale changes, test ownership, course creation, and archiving without losing
  work. Run the complete script as one transaction; it rolls back its fictional
  fixtures and must never be split into separately committed statements.
- Apply the dated migrations before deploying the frontend. Do not grant public
  SELECT on expected outputs as a workaround for the original error.
