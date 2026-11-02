import { instructionBody, instructionSections, instructionTime } from '../utils/learningContent'

export function LearningInstructions({ text }: { text: string }) {
  const time = instructionTime(text)
  return <div className="learning-instructions">{time && <p className="filter-summary">Estimated time: {time}</p>}{instructionSections(instructionBody(text)).map((section, index) => <section key={index} className="instruction-section"><h2>{section.title}</h2>{section.paragraphs.map((paragraph, i) => <p key={i}>{paragraph}</p>)}{section.steps.length > 0 && <ol>{section.steps.map((step, i) => <li key={i}>{step}</li>)}</ol>}</section>)}</div>
}
