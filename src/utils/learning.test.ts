import { describe, expect, it } from 'vitest'
import { activityTestSummary, canAccessTeacherRoutes, masteryFromScore, scorePassedTests } from './learning'

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
  it('keeps activities without tests awaiting teacher review instead of awarding full marks', () => {
    expect(scorePassedTests([], 25)).toBe(0)
    expect(activityTestSummary([], 25)).toMatchObject({ status: 'submitted', score: 0 })
    expect(activityTestSummary([false, true], 20)).toMatchObject({ status: 'failed', score: 10 })
  })
})

describe('teacher route permissions', () => {
  it('allows staff and rejects students', () => {
    expect(canAccessTeacherRoutes('teacher')).toBe(true)
    expect(canAccessTeacherRoutes('admin')).toBe(true)
    expect(canAccessTeacherRoutes('student')).toBe(false)
  })
})
