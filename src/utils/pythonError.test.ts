import { describe, expect, it } from 'vitest'
import { describePythonError } from './pythonError'
describe('student Python errors', () => {
  it('keeps the final exception after internal Pyodide frames', () => {
    const result = describePythonError('Traceback (most recent call last):\n  File "/lib/python312.zip/_pyodide/_base.py", line 597\n  File "main.py", line 2\nValueError: invalid literal for int() with base 10: \'Student\'')
    expect(result.summary).toContain('main.py')
    expect(result.summary).toContain('ValueError:')
    expect(result.summary).not.toContain('_pyodide')
    expect(result.hint).toContain('conversions')
  })
  it('preserves unfamiliar runtime errors instead of hiding them', () => {
    const error = 'RuntimeError: WebAssembly stack switching not supported'
    expect(describePythonError(error).summary).toBe(error)
  })
  it('preserves a message without a Python exception', () => {
    expect(describePythonError('Stopped by you.').summary).toBe('Stopped by you.')
  })
})
