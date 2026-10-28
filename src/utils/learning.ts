import type { AppRole } from '../features/auth/AuthProvider'

export type MasteryLevel = 'not_started' | 'developing' | 'proficient' | 'advanced'

export function masteryFromScore(score: number | null): MasteryLevel {
  if (score === null) return 'not_started'
  if (score >= 90) return 'advanced'
  if (score >= 70) return 'proficient'
  return 'developing'
}

export function canAccessTeacherRoutes(role: AppRole | null): boolean {
  return role === 'teacher' || role === 'admin'
}

export function scorePassedTests(passed: boolean[], maxScore = 100): number {
  if (passed.length === 0) return 0
  return Math.round((passed.filter(Boolean).length / passed.length) * maxScore)
}

export function activityTestSummary(passed: boolean[], maxScore = 100) {
  if (!passed.length) return { status: 'submitted' as const, score: 0, message: 'No automated tests are configured. Submitted work needs teacher review.' }
  const allPassed = passed.every(Boolean)
  return { status: allPassed ? 'passed' as const : 'failed' as const, score: scorePassedTests(passed, maxScore), message: allPassed ? 'All tests passed. Great work!' : 'Some tests need another look.' }
}
