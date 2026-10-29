# APU CS Studio — HCI and accessibility review

Review date: October 29, 2026. Audience: U.S.-style high school computer science,
grades 11–12. Baseline: `eeefe6e`. This is an expert heuristic review, not a SUS
survey, student usability study, legal opinion, or accessibility certification.

## Baseline rating: 5.8 / 10

Eight equally weighted dimensions, scored from 1 (blocked) to 10 (consistently
clear and verified across contexts). Mean = 46 / 8 = 5.75, rounded to 5.8.
Scores reflect the inspected workflows and source, not all possible users.

| Dimension | Before | Evidence and practical consequence |
|---|---:|---|
| Navigation / recognition | 6 | Main links are horizontally scrolled on narrow classroom pages; the IDE uses a different menu breakpoint. Two separate student-code destinations have little explanation. |
| System status / feedback | 6 | Save states exist, but dashboard failures are ignored and initially display zero counts or no enrollment. No shared offline notice. |
| Error prevention / recovery | 7 | Atomic activity saves, concurrency checks and archive preservation are strong. Course creation lacks a pending guard and dedicated retry. |
| Consistency / mental model | 6 | Three distinct practice/submission flows need clearer explanation. Sign-in mentions Gmail and Firebase rather than account tasks. |
| Accessibility foundations | 5 | Most controls use native HTML and a submission modal is native dialog. Missing skip navigation, route focus/title updates, and programmatic labels on teacher feedback fields. |
| Reflow / projection / targets | 5 | Small course-row icons, large headings, dense activity rows, and nav overflow compete for space. IDE supports font sizing, but the shared header is inconsistent. |
| Help / learnability | 4 | No persistent classroom guide explaining exactly where to save, submit, or review. |
| Visual hierarchy / scanning | 7 | Existing restrained green palette, card grouping and status badges are useful. Long titles and authoring controls overwhelm the outline. |

## Evaluation targets and scope

- **Nielsen's 10 usability heuristics:** visibility, familiar language, control,
  consistency, prevention, recognition, efficiency, minimalism, recovery, help.
  [Primary source](https://www.nngroup.com/articles/ten-usability-heuristics/).
- **WCAG 2.2 AA engineering target:** keyboard access, focus, labels, contrast,
  reflow, status feedback, and target size. AA's minimum target-size requirement
  is 24 CSS px subject to exceptions; this pass chooses a 44 px minimum for
  buttons/summary controls as an enhanced usability target, not a claim that
  every inline link or radio control must be 44 px.
  [Normative standard](https://www.w3.org/TR/WCAG22/).
- **U.S. public-school context:** DOJ guidance describes WCAG 2.1 AA for public
  school LMS content. Applicability, exceptions, deadlines and responsibilities
  must be evaluated for the adopting institution. This report makes no legal
  compliance claim. [DOJ LMS guidance](https://www.ada.gov/resources/web-rule-first-steps/).
- **Section 508:** federal ICT requirements incorporate WCAG 2.0 AA; Section 508
  is not interchangeable with “all American websites.”
  [Official applicability](https://www.section508.gov/develop/applicability-conformance/).

## Improvements implemented

1. One shared navigation: full desktop links, wrapping two-column mobile Menu,
   visible active location, Escape close, and focus return. Small-screen header
   uses normal flow so an expanded menu does not cover the page.
2. Skip-to-content link, route heading focus, descriptive document titles,
   consistent focus outlines, reduced-motion and forced-colors support.
3. Smaller responsive heading scale, larger row-action hit targets, wrapping
   activity rows, readable line spacing, narrow-screen cards and filters.
4. Teacher dashboard exposes four real destinations: courses, assessments,
   course activity code, and IDE workspaces. Student dashboard distinguishes
   assessments from standalone practice; a first course is not falsely called
   the user's last/most recently viewed course.
5. Dashboard and course-list loading/error/retry states; no fabricated zero or
   empty-enrollment state while a request is pending or has failed. Pending
   course creation disables duplicate submission and preserves form entries.
6. Search and status filters for courses and assessments; explicit no-match
   recovery and count feedback.
7. Teacher feedback textareas have associated labels; review search has an
   accessible name. Sign-in copy accepts email without exposing service names.
8. Persistent Help & accessibility guide: save versus submit, teacher review
   routes, keyboard/editor escape, projector text sizing, recovery and support.
9. Offline notice describes the limits of cloud saving without claiming that
   navigator.onLine proves the server is reachable. Save confirmations still
   come from each existing request's result.

## Verification and release gates

Automated checks: lint, existing 32 regression tests, TypeScript and production
build. The existing large-bundle warning remains; no new conformance assertion
is inferred from a passing build or tests.

Calculated shared palette contrast on solid colors: body text 15.19:1,
secondary text on white 6.39:1, white on green primary action 6.47:1,
blue focus on white 6.24:1, status text 9.70:1. These do not audit syntax
highlighting, transparency, every badge, or teacher-authored content.

Browser acceptance checklist (record actual results before claiming coverage):

- Desktop header shows every navigation destination; active page is identified.
- Narrow viewport has a reachable Menu, no page-level horizontal overflow, and
  every destination remains operable. Test actual CSS viewport width, not only
  screenshot dimensions.
- Keyboard: skip link moves focus to content; Escape closes Menu and returns
  focus; route changes focus a meaningful heading; code-editor escape is tested.
- Course and assessment searches return matching content and can clear no-match
  states. Filters never mutate course or assessment data.
- Help, course builder, activity manager and IDE remain reachable.
- At increased browser zoom / narrow equivalent width, controls reflow without
  losing labels. A narrow-width check is not a complete zoom conformance test.
- No student submissions, grades or publication settings are changed for a
  visual test. Network failure/reconnect, assistive technology and Safari are
  separately tracked when not exercised.

## What is still needed for U.S. institutional readiness

This release cannot honestly certify WCAG, ADA, Section 508 or FERPA conformance.
Complete keyboard and screen-reader evaluation with NVDA/Chrome and VoiceOver/
Safari; manually test all assessment question types, dynamic editors, native
dialogs, input prompts, 200%/400% zoom and text-spacing overrides. Run a full
automated accessibility scan as supporting evidence, not as a substitute for
manual testing. Audit course content, color-coded test results and code themes.

Measure **effectiveness, efficiency and satisfaction** with real students and
teachers: find an assignment, recover a draft, submit it, locate it for review,
and publish an edited activity. Record completion rate, time, assistance,
critical errors and a validated SUS questionnaire. Suggested release goals:
at least 90% unaided completion of each critical task, zero lost-work incidents,
and SUS >= 80; these are project goals, not measured results or U.S. legal rules.

Institutional review must cover student-data use, school/vendor agreements,
retention/deletion, approved support contacts, incident response and access
auditing. FERPA responsibilities depend on the school and arrangement; a UI
redesign alone does not establish compliance.
[U.S. Department of Education resources](https://studentprivacy.ed.gov/).

Track performance with field data (including slower school devices/networks),
cross-browser compatibility, and teacher usability sessions before describing
this as a production-ready institutional LMS. No field performance or SUS
measurements were collected in this review.
