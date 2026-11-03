export function displayTitle(value: string) { return value.replace(/—/g, '-') }
export function displayActivityTitle(value: string) {
  return displayTitle(value).replace(/^(\d+\s*[·.]\s*)(?:CORE|CHALLENGE|STRETCH|LIVE CODING)\s*-\s*/i, '$1')
}

export type InstructionSection = { title: string; paragraphs: string[]; steps: string[]; markdown: string }
/** Organize legacy prose without modifying literal input or Python examples. */
export function instructionSections(text: string): InstructionSection[] {
  const sections: InstructionSection[] = []
  const section = (title: string): InstructionSection => ({ title, paragraphs: [], steps: [], markdown: '' })
  let current = section('Your task')
  let explicitHeading = false
  let fence: string | null = null
  const append = (line: string) => { current.markdown += `${line}\n` }
  const push = () => { if (current.markdown.trim()) sections.push(current) }
  // Legacy teacher-authored text often has numbered steps flattened onto one line.
  // Never interpret numbers or # comments inside code as prose structure.
  const lines = text.split(/(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)/g).map((part, index) => index % 2 ? part : part
    .replace(/\s+(?=\d{1,2}\.\s+[A-Z])/g, '\n')
    .replace(/\s+(?=(?:Submit your|Remember:|Textbook reference:|ESSENTIAL QUESTION:|TODAY:|FLOW:))/g, '\n')).join('').split(/\r?\n/)
  for (const raw of lines) {
    const line = raw.trim()
    const boundary = line.match(/^(`{3,}|~{3,})/)
    if (fence) {
      append(raw)
      if (boundary && boundary[1]![0] === fence[0] && boundary[1]!.length >= fence.length) fence = null
      continue
    }
    if (boundary) { fence = boundary[1]!; append(raw); continue }
    if (!line) { append(''); continue }
    const heading = line.match(/^#{1,3}\s+(.+)$/)
    if (heading) { push(); current = section(heading[1]!); explicitHeading = true; continue }
    const step = line.match(/^\d{1,2}\.\s+(.+)$/)
    if (step) {
      if (!explicitHeading && current.title !== 'Steps' && !current.steps.length) { push(); current = section('Steps') }
      current.steps.push(step[1]!); append(raw); continue
    }
    const marker = line.match(/^(ESSENTIAL QUESTION|TODAY|FLOW|Textbook reference|Remember):\s*(.*)$/)
    if (marker) {
      push(); explicitHeading = false; current = section(({ 'ESSENTIAL QUESTION': 'Essential question', TODAY: 'Today’s learning', FLOW: 'Lesson schedule', 'Textbook reference': 'Reference', Remember: 'Keep in mind' } as Record<string, string>)[marker[1]!] ?? marker[1]!); current.paragraphs.push(marker[2]!); append(marker[2]!); continue
    }
    if (/^Submit your/.test(line)) { push(); explicitHeading = false; current = section('Before you submit') }
    current.paragraphs.push(line); append(raw)
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
