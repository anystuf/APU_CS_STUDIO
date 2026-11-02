export function displayTitle(value: string) { return value.replace(/—/g, '-') }
export function displayActivityTitle(value: string) {
  return displayTitle(value).replace(/^(\d+\s*[·.]\s*)(?:CORE|CHALLENGE|STRETCH|LIVE CODING)\s*-\s*/i, '$1')
}

export type InstructionSection = { title: string; paragraphs: string[]; steps: string[] }
/** Plain text only: explicit headings and numbered instructions, never HTML. */
export function instructionSections(text: string): InstructionSection[] {
  const sections: InstructionSection[] = []
  let current: InstructionSection = { title: 'Your task', paragraphs: [], steps: [] }
  let explicitHeading = false
  const push = () => { if (current.paragraphs.length || current.steps.length) sections.push(current) }
  // Legacy teacher-authored text often has numbered steps flattened onto one line.
  const lines = text.replace(/\s+(?=\d{1,2}\.\s+[A-Z])/g, '\n')
    .replace(/\s+(?=(?:Submit your|Remember:|Textbook reference:|ESSENTIAL QUESTION:|TODAY:|FLOW:))/g, '\n').split(/\r?\n/)
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    const heading = line.match(/^#{1,3}\s+(.+)$/)
    if (heading) { push(); current = { title: heading[1]!, paragraphs: [], steps: [] }; explicitHeading = true; continue }
    const step = line.match(/^\d{1,2}\.\s+(.+)$/)
    if (step) {
      if (!explicitHeading && current.title !== 'Steps' && !current.steps.length) { push(); current = { title: 'Steps', paragraphs: [], steps: [] } }
      current.steps.push(step[1]!); continue
    }
    const marker = line.match(/^(ESSENTIAL QUESTION|TODAY|FLOW|Textbook reference|Remember):\s*(.*)$/)
    if (marker) {
      push(); explicitHeading = false; current = { title: ({ 'ESSENTIAL QUESTION': 'Essential question', TODAY: 'Today’s learning', FLOW: 'Lesson schedule', 'Textbook reference': 'Reference', Remember: 'Keep in mind' } as Record<string, string>)[marker[1]!] ?? marker[1]!, paragraphs: [marker[2]!], steps: [] }; continue
    }
    if (/^Submit your/.test(line)) { push(); current = { title: 'Before you submit', paragraphs: [line], steps: [] }; continue }
    current.paragraphs.push(line)
  }
  push()
  return sections
}

export function activityRequirement(required: boolean | undefined) {
  return required === false ? 'Extension' : required === true ? 'Required' : 'Activity'
}

export function instructionTime(text: string) { return text.match(/\(target:\s*([^)]*)\)/i)?.[1] ?? null }
export function instructionBody(text: string) {
  return text.replace(/^(?:CORE|CHALLENGE|STRETCH)\s*[—-]\s*(?:REQUIRED|OPTIONAL)\s*\(target:[^)]*\)\s*/i, '')
}
