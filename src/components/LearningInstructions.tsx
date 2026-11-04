import Markdown, { type Components } from 'react-markdown'
import { instructionBody, instructionSections, instructionTime } from '../utils/learningContent'

const titleComponents: Components = { p: ({ children }) => <h2>{children}</h2> }
const titleElements = ['p', 'strong', 'em', 'code']
const bodyElements = ['p', 'strong', 'em', 'code', 'pre', 'ol', 'ul', 'li', 'a', 'blockquote', 'hr', 'h2', 'h3', 'h4', 'br']

export function LearningInstructions({ text }: { text: string }) {
  const time = instructionTime(text)
  const separatorHelp = /registrations?/i.test(text) && /split\(\s*['"]\|['"]\s*\)|separated by (?:the )?`?\|/i.test(text)
  return <div className="learning-instructions">{time && <p className="filter-summary">Estimated time: {time}</p>}{separatorHelp && <p className="separator-help">The vertical bar <code>|</code> separates registrations. For example, <code>Billy|Kent</code> contains two registrations.</p>}{instructionSections(instructionBody(text)).map((section, index) => <section key={index} className="instruction-section"><Markdown components={titleComponents} allowedElements={titleElements} unwrapDisallowed>{section.title.replace(/\s+\|\s+/g, ' · ').replace(/\u2014/g, '-')}</Markdown><Markdown allowedElements={bodyElements} unwrapDisallowed>{section.markdown.replace(/\u2014/g, '-')}</Markdown></section>)}</div>
}
