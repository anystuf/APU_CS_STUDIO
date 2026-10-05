export type PythonFile = { name: string; code: string }
export type IdeDraft = { files: PythonFile[]; activeFile: string; input: string; revision: number; dirty: boolean }
export const initialFiles: PythonFile[] = [{ name: 'main.py', code: '# Write Python here\nname = input("What is your name? ")\nprint(f"Hello, {name}!")\n' }]
export function validateFiles(files: PythonFile[]): string | null {
  if (!Array.isArray(files) || files.length < 1 || files.length > 20) return 'Keep between 1 and 20 Python files.'
  const names = new Set<string>()
  for (const file of files) {
    if (!file || typeof file.name !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*\.py$/.test(file.name)) return 'Use a Python filename such as helpers.py (letters, numbers, underscores).'
    if (typeof file.code !== 'string') return 'Invalid Python file content.'
    if (names.has(file.name)) return 'A file with that name already exists.'
    names.add(file.name)
  }
  if (new TextEncoder().encode(JSON.stringify(files)).length > 900000) return 'Workspace is too large. Keep the total below 900 KB.'
  return null
}
export function readDraft(raw: string | null): IdeDraft | null {
  try {
    const draft = JSON.parse(raw ?? 'null') as IdeDraft
    if (!draft || validateFiles(draft.files) || !draft.files.some(file => file.name === draft.activeFile) || typeof draft.input !== 'string' || draft.input.length > 50000 || !Number.isInteger(draft.revision) || draft.revision < 0 || typeof draft.dirty !== 'boolean') return null
    return draft
  } catch { return null }
}
