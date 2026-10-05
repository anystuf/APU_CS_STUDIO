import { describe, expect, it } from 'vitest'
import { initialFiles, readDraft, validateFiles } from './ide'
describe('Python IDE workspace validation', () => {
  it('accepts importable Python modules', () => expect(validateFiles([...initialFiles, { name: 'helpers.py', code: 'def greet(): return "hello"' }])).toBeNull())
  it('rejects traversal and invalid module names', () => {
    for (const name of ['../main.py', 'folder/main.py', 'a-b.py', '1.py', 'main.js']) expect(validateFiles([{ name, code: '' }])).not.toBeNull()
  })
  it('rejects duplicate files', () => expect(validateFiles([...initialFiles, ...initialFiles])).not.toBeNull())
  it('requires at least one file and enforces total size', () => {
    expect(validateFiles([])).not.toBeNull()
    expect(validateFiles([{ name: 'main.py', code: 'x'.repeat(900001) }])).not.toBeNull()
  })
  it('recovers a valid draft with its saved revision', () => expect(readDraft(JSON.stringify({ files: initialFiles, activeFile: 'main.py', input: '', revision: 3, dirty: true }))?.revision).toBe(3))
  it('ignores malformed or inconsistent drafts', () => {
    expect(readDraft('{')).toBeNull()
    expect(readDraft(JSON.stringify({ files: initialFiles, activeFile: 'missing.py', input: '', revision: 0, dirty: false }))).toBeNull()
  })
})
