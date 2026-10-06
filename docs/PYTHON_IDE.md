# Python workspace

The compact teaching layout keeps Run/Stop in the code dock. Toggle the files sidebar with the left dock button; use A−/A+ to enlarge code and output (12–36 px) without zooming the whole page. At narrower widths, including a 200%-zoom equivalent viewport, main.py and Output buttons switch panels. Classroom opens platform navigation; Save to cloud remains above the dock.

The Python IDE uses CodeMirror and Pyodide in a dedicated Web Worker, not a third-party iframe. Each account has one personal workspace with up to 20 flat Python modules. Select a file and Run it; sibling imports work. Each run rebuilds the virtual workspace and removes cached workspace modules. This is not a server sandbox or a Colab notebook.

- **Save to cloud** stores all files, selected file and stdin in `cs_ide_projects`. RLS allows only the owner to write. Course teachers can read enrolled students’ workspaces, and platform administrators can read all workspaces, through **Student workspaces** at `/teacher/workspaces`. Review is read-only; other students and unrelated teachers have no access. Revision-checked saves reject stale edits from another device.
- Local drafts are stored under the Supabase user UUID, including their original cloud revision. Unsaved drafts are restored rather than overwritten by cloud loading. A browser-close warning protects edits; save to cloud for cross-device access.
- **Load cloud version** explicitly replaces an unsaved draft only after confirmation. Download a backup first to resolve cross-device conflicts.
- **Import .py / backup** imports Python files without silently overwriting duplicate names, or restores one exported JSON backup. Backup restore is a local edit, not an immediate cloud write.
- **Download selected .py** exports the active Python file. **Download workspace backup** exports all files and input. **Import old browser draft** copies the previous IDE's local draft into `legacy_draft.py` only on explicit request.
- **Stop** terminates the Worker and permits another run. A 30-second timeout also terminates runaway code. Displayed output and error text are capped to avoid flooding the UI. Python needs network access to download its runtime on first use.
- stdout and errors are shown separately. Input is supplied in advance, one value per `input()` call; this is not an interactive terminal.
- Personal cloud saves are not assignment submissions. Use Quiz & Code or an assigned coding activity for teacher review and grading. The existing submission workflows remain unchanged.

Apply `python_ide_projects` migration before deploying the frontend. GitHub Pages workflow builds the correct repository base path.
