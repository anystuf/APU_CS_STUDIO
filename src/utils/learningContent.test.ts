import { describe, expect, it } from 'vitest'
import { activityRequirement, displayTitle, instructionBody, instructionSections, instructionTime } from './learningContent'

describe('student content presentation', () => {
  it('separates legacy steps without breaking decimal numbers or Python calls', () => {
    const result = instructionSections('Keep 2.5 unchanged. Use .strip(). 1. Finish clean_name(name). 2. Print normalized.')
    expect(result[0]?.paragraphs).toEqual(['Keep 2.5 unchanged. Use .strip().'])
    expect(result[1]?.steps).toEqual(['Finish clean_name(name).', 'Print normalized.'])
  })
  it('keeps explicit learning goals, criteria and literal HTML as text', () => {
    const result = instructionSections('## Learning goal\nUse functions.\n## Success criteria\n<script>alert(1)</script>')
    expect(result.map(s => s.title)).toEqual(['Learning goal', 'Success criteria'])
    expect(result[1]?.paragraphs).toEqual(['<script>alert(1)</script>'])
  })
  it('separates submission and reminder guidance without discarding text', () => {
    const result = instructionSections('1. Explain your result. Submit your attempt. Remember: Keep duplicates.')
    expect(result.map(s => s.title)).toEqual(['Steps', 'Before you submit', 'Keep in mind'])
    expect(result[2]?.paragraphs).toEqual(['Keep duplicates.'])
  })
  it('does not call required work optional and normalizes title punctuation', () => {
    expect(activityRequirement(true)).toBe('Required')
    expect(activityRequirement(false)).toBe('Extension')
    expect(activityRequirement(undefined)).toBe('Activity')
    expect(displayTitle('CORE \u2014 Clean names')).toBe('CORE - Clean names')
  })
  it('retains authored numbered success criteria and separates time metadata', () => {
    expect(instructionSections('## Success criteria\n1. Keep duplicates.\n2. Preserve order.')[0]).toMatchObject({ title: 'Success criteria', steps: ['Keep duplicates.', 'Preserve order.'] })
    const text = 'CORE \u2014 REQUIRED (target: 8–10 minutes) Clean every entry.'
    expect(instructionTime(text)).toBe('8–10 minutes')
    expect(instructionBody(text)).toBe('Clean every entry.')
    expect(instructionBody('CORE logic must remain unchanged.')).toBe('CORE logic must remain unchanged.')
  })
})
