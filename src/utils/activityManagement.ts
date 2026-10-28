export type ManagedTest = { id: string; input: string; expected_output: string; visibility: 'public' | 'hidden'; position: number }
export type ManagedActivity = { id: string; lesson_id: string; title: string; instructions: string; status: string; activity_type: string; difficulty: string; is_required: boolean; max_score: number; due_at: string | null; updated_at: string; unlock_assessment_id?: string | null }
export function validateActivity(activity: Pick<ManagedActivity, 'title' | 'instructions' | 'max_score'>, starter: string, tests: ManagedTest[] | null): string | null {
  if (!activity.title.trim() || activity.title.trim().length > 160) return 'Enter a title between 1 and 160 characters.'
  if (activity.instructions.length > 50000) return 'Keep instructions below 50,000 characters.'
  if (!Number.isFinite(activity.max_score) || activity.max_score < 0 || activity.max_score > 1000) return 'Maximum score must be between 0 and 1000.'
  if (starter.length > 200000) return 'Starter code is too long.'
  if (tests && (tests.length > 100 || new Set(tests.map(t => t.id)).size !== tests.length)) return 'Keep no more than 100 uniquely identified tests.'
  if (tests?.some(t => t.input.length > 20000 || t.expected_output.length > 20000 || !['public', 'hidden'].includes(t.visibility))) return 'Check test visibility and keep each input/output below 20,000 characters.'
  return null
}
export function managementError(error: unknown): string {
  const value = error as { message?: string; code?: string }
  if (value?.code === '40001') return 'Another session changed this activity. Reload it before saving; your editor has been kept open.'
  if (value?.code === '42501') return `Your account could not access this item: ${value.message ?? 'permission denied'}. Check the course owner and sign in again if your permissions recently changed.`
  return value?.message ?? 'The operation failed. Your changes have been kept in the editor.'
}
export function localDate(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
