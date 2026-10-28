import { describe, expect, it } from 'vitest'
import { managementError, validateActivity, type ManagedTest } from './activityManagement'
const activity = { title: 'A coding activity', instructions: 'Write a loop.', max_score: 100 }
describe('activity management validation', () => {
  it('allows zero-point manual activities and metadata-only saves when test loading fails', () => {
    expect(validateActivity({ ...activity, max_score: 0 }, '', [])).toBeNull()
    expect(validateActivity(activity, '', null)).toBeNull()
  })
  it('rejects invalid scores, oversized tests and duplicate test identities', () => {
    const test: ManagedTest = { id: 'one', input: '', expected_output: '', visibility: 'hidden', position: 0 }
    expect(validateActivity({ ...activity, max_score: NaN }, '', [])).toContain('Maximum score')
    expect(validateActivity(activity, '', [test, test])).toContain('uniquely')
    expect(validateActivity(activity, '', [{ ...test, expected_output: 'x'.repeat(20001) }])).toContain('20,000')
  })
  it('distinguishes permission failure from concurrent edits with actionable feedback', () => {
    expect(managementError({ code: '42501', message: 'permission denied' })).toContain('course owner')
    expect(managementError({ code: '40001' })).toContain('Another session')
  })
})
