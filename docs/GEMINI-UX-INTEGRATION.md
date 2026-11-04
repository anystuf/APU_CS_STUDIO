# Gemini UX handoff integration - November 4, 2026

The four-file source archive was reviewed as a design proposal rather than copied over the current app. Its student/course page predates the structured Markdown renderer and its layout omits Help, offline status, route focus management, and sign-out errors. Its grading flow also replaces the existing no-tests teacher-review behavior. Those regressions were not imported.

Implemented adaptations:
- Optional projector mode with a stored browser preference, larger learning text and editor text.
- Activity instructions beside code and output on desktop; explicit Instructions / Code & output controls on smaller screens.
- In-editor Run / Stop and font-size controls; interactive terminal input submitted with Enter.
- Readable Python exception summary with the full original error expandable.
- Expected/actual test output comparison only for values already returned by the existing grading RPC.
- Teacher review status filters and editable feedback suggestions, plus explicit loading/error/retry states.
- Starter reset confirmation; activity state remounts when the activity ID changes.

The current student course page, Markdown formatting, required/extension semantics, activity-specific teacher links, grading RPC, and database permissions remain in place. No new database privileges or schema changes are needed. The proposed classroom matrix and cloud autosave were not imported: the matrix inferred student participation from existing work and omitted students with no work; autosave needs conflict handling before it can safely replace explicit saving.

Validation: ESLint, TypeScript/Vite build, Vitest, and browser inspection. Browser evidence and remaining verification limits are reported with the release.
