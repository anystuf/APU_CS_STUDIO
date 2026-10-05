import { describe, expect, it } from 'vitest'
import { canAccessTeacherRoutes, masteryFromScore, scorePassedTests } from './learning'

describe('masteryFromScore', () => {
  it('keeps missing work distinct from low performance', () => expect(masteryFromScore(null)).toBe('not_started'))
  it('uses understandable mastery thresholds', () => {
    expect(masteryFromScore(69)).toBe('developing')
    expect(masteryFromScore(70)).toBe('proficient')
    expect(masteryFromScore(90)).toBe('advanced')
  })
})

describe('coding challenge scoring', () => {
  it('scores passed tests proportionally', () => {
    expect(scorePassedTests([true, false, true])).toBe(67)
    expect(scorePassedTests([true, true], 20)).toBe(20)
  })
  it('awards the configured score when no tests exist', () => expect(scorePassedTests([], 25)).toBe(25))
})

describe('teacher route permissions', () => {
  it('allows staff and rejects students', () => {
    expect(canAccessTeacherRoutes('teacher')).toBe(true)
    expect(canAccessTeacherRoutes('admin')).toBe(true)
    expect(canAccessTeacherRoutes('student')).toBe(false)
  })
})
