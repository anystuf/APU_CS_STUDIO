# Decisions and assumptions

- The supplied Supabase organization contains one active project with an existing, unrelated schema. CS Studio uses a `cs_` prefix and makes no destructive changes.
- The initial role for a new account is `student`. Teacher/admin promotion must be performed by an existing administrator, never from editable user metadata.
- GitHub Pages uses hash routing for dependable refresh behavior.
- The modern Supabase publishable key is used instead of a legacy anon key. No service-role key is present in the frontend.
- New Supabase projects no longer automatically expose public tables to the Data API, so migrations include explicit grants alongside RLS.
- Python execution remains local in Pyodide and is deferred until the coding-lab phase.
- Student invitation is implemented as a pending email-to-course reservation, not privileged Auth user creation. This keeps service credentials out of the frontend while allowing enrollment before first sign-in.
- Teacher feedback belongs to a specific immutable attempt so students and teachers retain the assessment context.
