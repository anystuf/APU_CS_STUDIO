import { useEffect, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { python } from '@codemirror/lang-python'
import { Check, ChevronLeft, ChevronRight, Play, RotateCcw, Square } from 'lucide-react'
import { runPython, stopPython } from '../lib/pyodide/runner'
import './guided-lesson.css'

type GuidedCheck = { question: string; options: string[]; answer: number; feedback: string }
type GuidedDemo = { code: string; output: string; explanation: string; visual?: { label: string; items: string[] }[] }

function ConceptCheck({ data }: { data: GuidedCheck }) {
  const [selected, setSelected] = useState<number | null>(null)
  return <div className="guided-check"><h3>Check your understanding</h3><p>{data.question}</p><div className="guided-options" role="group" aria-label={data.question}>{data.options.map((option, i) => <button type="button" key={i} aria-pressed={selected === i} className={selected === i ? (i === data.answer ? 'guided-correct' : 'guided-retry') : ''} onClick={() => setSelected(i)}>{option}</button>)}</div>{selected !== null && <p role="status" className={`guided-feedback ${selected === data.answer ? "guided-feedback-correct" : "guided-feedback-retry"}`}>{selected === data.answer ? 'Correct! ' + data.feedback : 'Not quite. Revisit the example and try again.'}</p>}</div>
}
function GuidedRun({ data }: { data: GuidedDemo }) {
  const [code, setCode] = useState(data.code)
  const [result, setResult] = useState('')
  const [running, setRunning] = useState(false)
  const [revealed, setRevealed] = useState(false)
  useEffect(() => () => stopPython(), [])
  async function run() {
    setRunning(true); setResult('')
    try { const r = await runPython(code, ''); setResult(r.stderr || r.stdout || '(No output)') }
    catch (error) { setResult(error instanceof Error ? error.message : 'Unable to run Python. Try again.') }
    finally { setRunning(false) }
  }
  return <div className="guided-demo"><div className="guided-editor"><div className="guided-editor-bar"><span>Python</span><span>example.py</span></div><CodeMirror aria-label="Editable Python example" value={code} onChange={setCode} extensions={[python()]} theme="dark" minHeight="128px" readOnly={running} basicSetup={{lineNumbers:true,foldGutter:false}}/></div><div className="guided-actions"><button type="button" className="button compact" disabled={running} onClick={() => void run()}><Play size={15} aria-hidden="true"/> {running ? 'Running…' : 'Run code'}</button>{running && <button type="button" className="button compact secondary" onClick={stopPython}><Square size={15} aria-hidden="true"/> Stop</button>}<button type="button" className="button compact secondary" disabled={running} onClick={() => { setCode(data.code); setResult(''); setRevealed(false) }}><RotateCcw size={15} aria-hidden="true"/> Reset</button><button type="button" className="button compact secondary" aria-expanded={revealed} onClick={() => setRevealed(v => !v)}>{revealed ? 'Hide explanation' : 'Show explanation'}</button></div>{result && <div aria-live="polite"><h4>Output</h4><pre>{result}</pre></div>}{revealed && <div><h4>Expected output (original example)</h4><pre>{data.output}</pre>{Array.isArray(data.visual) && data.visual.map((row, i) => <div key={i} style={{margin: '.75rem 0'}}><p><strong>{row.label}</strong></p><div style={{display:'flex',flexWrap:'wrap',gap:'.35rem'}}>{row.items.map((item, j) => <span key={j} style={{border:'1px solid #9aaea4',borderRadius:'.45rem',padding:'.5rem',fontFamily:'monospace'}}>{item}</span>)}</div></div>)}<p>{data.explanation}</p></div>}</div>
}
function GuidedSectionBody({ markdown }: { markdown: string }) {
  const parts = markdown.split(/(```(?:check|demo)\n[\s\S]*?\n```)/g)
  return <>{parts.map((part, i) => {
    const match = part.match(/^```(check|demo)\n([\s\S]*?)\n```$/)
    if (match) {
      try {
        const data = JSON.parse(match[2]!)
        if (match[1] === 'check' && typeof data.question === 'string' && Array.isArray(data.options) && data.options.every((v: unknown) => typeof v === 'string') && Number.isInteger(data.answer) && data.answer >= 0 && data.answer < data.options.length && typeof data.feedback === 'string') return <ConceptCheck key={i} data={data as GuidedCheck}/>
        if (match[1] === 'demo' && typeof data.code === 'string' && typeof data.output === 'string' && typeof data.explanation === 'string') return <GuidedRun key={i} data={data as GuidedDemo}/>
      } catch { /* malformed content remains visible as Markdown */ }
    }
    return <Markdown key={i} allowedElements={bodyElements} unwrapDisallowed>{part.replace(/\u2014/g, '-')}</Markdown>
  })}</>
}
export function GuidedLesson({ text }: { text: string }) {
  const sections = guidedSections(text)
  const [active, setActive] = useState(0)
  const [complete, setComplete] = useState<number[]>([])
  const current = sections[active]
  if (!current) return <LearningInstructions text={text}/>
  const next = () => { setComplete(old => old.includes(active) ? old : [...old, active]); if (active < sections.length - 1) setActive(active + 1) }
  const cleanTitle = (title: string) => title.replace(/^\d+\.\s*/, '').split(' · ')[0]!
  const duration = (title: string) => title.split(' · ')[1]
  return <section className="guided-lesson" aria-label="Guided lesson">
    <div className="guided-header"><strong>Lesson content</strong><span>{complete.length}/{sections.length} sections reviewed</span></div>
    <progress value={complete.length} max={sections.length} aria-label="Sections reviewed"/>
    <div className="guided-layout">
      <nav className="guided-nav" aria-label="Lesson sections">{sections.map((section, i) => <button type="button" key={i} aria-current={i === active ? 'step' : undefined} onClick={() => setActive(i)}><span className="guided-step-number">{complete.includes(i) ? <Check size={15} aria-label="Reviewed"/> : i + 1}</span><span className="guided-step-name">{cleanTitle(section.title)}{duration(section.title) && <small>{duration(section.title)}</small>}</span></button>)}</nav>
      <div className="guided-main"><section key={active} className="guided-content"><div className="guided-section-meta">Section {active+1} of {sections.length}{duration(current.title) ? ' · '+duration(current.title) : ''}</div><h2>{cleanTitle(current.title)}</h2><GuidedSectionBody markdown={current.markdown}/></section>
      <div className="guided-actions guided-pagination"><button type="button" className="button compact secondary" disabled={active === 0} onClick={() => setActive(active - 1)}><ChevronLeft size={16} aria-hidden="true"/> Previous</button><button type="button" className="button compact" onClick={next}>{active === sections.length - 1 ? (complete.includes(active) ? 'Reviewed' : 'Mark as reviewed') : 'Continue'}{active < sections.length - 1 && <ChevronRight size={16} aria-hidden="true"/>}</button></div></div>
    </div><p className="work-meta">Reading progress is tracked for this session. Submit your coding activity to save your work.</p></section>
}

import Markdown, { type Components } from 'react-markdown'
import { guidedSections, instructionBody, instructionSections, instructionTime } from '../utils/learningContent'

const titleComponents: Components = { p: ({ children }) => <h2>{children}</h2> }
const titleElements = ['p', 'strong', 'em', 'code']
const bodyElements = ['p', 'strong', 'em', 'code', 'pre', 'ol', 'ul', 'li', 'a', 'blockquote', 'hr', 'h2', 'h3', 'h4', 'br']

export function LearningInstructions({ text }: { text: string }) {
  const time = instructionTime(text)
  const separatorHelp = /registrations?/i.test(text) && /split\(\s*['"]\|['"]\s*\)|separated by (?:the )?`?\|/i.test(text)
  return <div className="learning-instructions">{time && <p className="filter-summary">Estimated time: {time}</p>}{separatorHelp && <p className="separator-help">The vertical bar <code>|</code> separates registrations. For example, <code>Billy|Kent</code> contains two registrations.</p>}{instructionSections(instructionBody(text)).map((section, index) => <section key={index} className="instruction-section"><Markdown components={titleComponents} allowedElements={titleElements} unwrapDisallowed>{section.title.replace(/\s+\|\s+/g, ' · ').replace(/\u2014/g, '-')}</Markdown><Markdown allowedElements={bodyElements} unwrapDisallowed>{section.markdown.replace(/\u2014/g, '-')}</Markdown></section>)}</div>
}
