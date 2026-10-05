# CS Studio

A browser-first computer science learning platform for middle- and high-school students. Teachers can build published courses, modules, lessons, and Python challenges; enroll signed-in students; and review attempt history. Students can run Python locally through Pyodide, test code, autosave drafts, and submit results.

## Local development

1. Copy `.env.example` to `.env.local` and add the Supabase project URL and publishable key.
2. Install dependencies with `npm install`.
3. Start with `npm run dev`.

## Supabase setup

Apply the migrations in `supabase/migrations` in timestamp order. Enable Google in Authentication → Providers, then add local and GitHub Pages URLs to Authentication → URL Configuration. New users default to students; promote the teacher account by updating `cs_profiles.role` through a trusted admin workflow. Students become available for enrollment after their first sign-in.

## Browser Python lab

Pyodide is fetched only when a coding activity is opened, and the editor route is code-split from the main dashboard bundle. Code runs locally in the browser; the backend stores submissions and test outcomes, not execution processes. The lab supports stdout, readable errors, sequential `input()` values, reset, local draft autosave, public and hidden tests, and submission history. Hidden expected answers remain server-side: students receive the input, submit the observed output to an authenticated grader, and receive only pass/fail for hidden cases.

## Classroom workflow

Teachers can reserve course enrollment for a student email before the student has an account. The database automatically converts matching pending invitations into enrollments when that student first signs in. Teachers can also enroll existing students, rename or delete curriculum items, review attempt history, and leave feedback that appears on the student dashboard. The readiness migration creates one starter course and Python challenge for the first teacher when the workspace has no CS Studio course yet.

## Integrated Quiz & Code

The **Quiz & Code** tab combines multiple-choice questions, written answers, and Python exercises in one course-assigned assessment. Students save cloud drafts and submit once; teachers review the complete work and return scores and feedback. Answer keys and automatic quiz scoring stay on the server. Python runs in a worker with a timeout. See [the classroom guide](docs/QUIZ_AND_CODE.md).

## Security

The browser receives only a publishable key. RLS is enabled on every exposed CS Studio table, roles are stored in protected profile data rather than user metadata, and the schema explicitly grants only the operations needed by authenticated users.

See `docs/ARCHITECTURE.md` and `docs/DECISIONS.md` for the implementation plan and assumptions.
