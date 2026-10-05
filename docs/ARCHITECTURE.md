# CS Studio architecture

CS Studio is a static React application deployed to GitHub Pages. `HashRouter` makes deep links reliable under repository subpaths. Supabase provides authentication, PostgreSQL, and row-level authorization; Pyodide will be loaded only on Python activity pages.

The frontend is organized by feature. Authorization is enforced twice: route guards improve UX, while database RLS remains the security boundary. Only the publishable Supabase key is used in the browser.

## Entity relationship plan

`cs_profiles` represents Auth users. Teachers own `cs_courses`; students join through `cs_enrollments`. Courses contain ordered `cs_modules`, modules contain ordered `cs_lessons`, and lessons contain typed `cs_activities`. Attempts belong to a student and activity and are append-only for submission history. Later phases add normalized quiz, competency, grading, and project tables.

## Delivery phases

1. Foundation: shell, auth, roles, schema, RLS, design system.
2. Course system and teacher authoring.
3. Browser Python lab with CodeMirror and lazy Pyodide.
4. Tests, submissions, attempts, and teacher review.
5. Additional learning activities, progress, grading, capstone, deployment.
