import { useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { python } from '@codemirror/lang-python'
import { Play, Terminal } from 'lucide-react'
import { runPython } from '../lib/pyodide/runner'
import type { AssessmentQuestion as Question, QuestionAnswer } from '../types/assessment'

const pythonExtension = [python()]
function QuestionPrompt({ prompt }: { prompt: string }) {
  return <div className="question-prompt question-prompt-content">{prompt.split(/(```(?:python|text)?\n[\s\S]*?```)/g).filter(Boolean).map((part, index) => {
    if (part.startsWith('```')) return <pre className="question-code" key={index}><code>{part.replace(/^```(?:python|text)?\n|```$/g, '')}</code></pre>
    return <p key={index}>{part.trim()}</p>
  })}</div>
}
export function AssessmentQuestion({ question, number, answer, locked, result, onChange }: { question: Question; number: number; answer: QuestionAnswer; locked: boolean; result?: { correct: boolean; correct_choice: number; feedback: string }; onChange: (answer: QuestionAnswer) => void }) {
  const [running, setRunning] = useState(false)
  const [runOutput, setRunOutput] = useState<string | null>(null)
  const run = async () => {
    setRunning(true); setRunOutput('Running Python… The first run may download the runtime.')
    try {
      const result = await runPython(answer.code ?? '', answer.input ?? '')
      setRunOutput([result.stdout, result.stderr].filter(Boolean).join('\n') || '(Program finished with no output)')
      if (!locked) onChange({ ...answer, stdout: result.stdout, stderr: result.stderr })
    } finally { setRunning(false) }
  }
  return <section className="panel assessment-question" id={`question-${question.id}`}>
    <div className="question-header"><h2>Question {number} <span>{question.kind === 'python' ? 'Python' : question.kind === 'short_answer' ? 'Short answer' : 'Multiple choice'}{question.required === false ? ' · Optional' : ''}</span></h2><strong>{question.points} {question.points === 1 ? 'point' : 'points'}</strong></div><QuestionPrompt prompt={question.prompt}/>
    {question.hint && <details className="assessment-hint"><summary>Show a hint</summary><pre>{question.hint}</pre></details>}
    {question.kind === 'multiple_choice' && <fieldset className="quiz-options" disabled={locked}><legend className="sr-only">Answer for question {number}</legend>{question.options?.map((option, i) => <label className={`quiz-option ${answer.choice === i ? 'selected' : ''}`} key={i}><input type="radio" name={`question-${question.id}`} checked={answer.choice === i} onChange={() => onChange({ choice: i })}/><span className="option-letter">{String.fromCharCode(65 + i)}</span><span>{option}</span></label>)}</fieldset>}
    {question.kind === 'short_answer' && <label className="field">Answer<textarea disabled={locked} value={answer.text ?? ''} onChange={e => onChange({ text: e.target.value })} placeholder="Write your answer…" maxLength={50000}/></label>}
    {question.kind === 'python' && <><div className="ide assessment-ide"><section className="editor-pane"><header>main.py <span>Python 3</span></header><CodeMirror aria-label={`Python code for question ${number}`} value={answer.code ?? ''} extensions={pythonExtension} height="340px" theme="dark" editable={!locked && !running} onChange={code => { setRunOutput(null); onChange({ ...answer, code, stdout: '', stderr: '' }) }}/></section><section className="console-pane"><header><Terminal size={17}/> Output</header><pre aria-live="polite">{runOutput ?? ([answer.stdout, answer.stderr].filter(Boolean).join('\n') || 'Click Run to see the output.')}</pre><label className="console-input">Program input (one value per line)<textarea disabled={locked || running} value={answer.input ?? ''} onChange={e => { setRunOutput(null); onChange({ ...answer, input: e.target.value, stdout: '', stderr: '' }) }} placeholder="Values for input()" maxLength={50000}/></label></section></div><div className="lab-actions"><button className="button secondary" disabled={running || locked} onClick={() => void run()}><Play size={16}/> {running ? 'Running…' : 'Run'}</button><span className="work-meta">Run your code to check it. Code is saved with your submission.</span></div></>}
    {result && question.kind === 'multiple_choice' && <p className={result.correct ? 'answer-feedback correct' : 'answer-feedback incorrect'} role="status">{result.correct ? 'Correct.' : `Not quite. Correct answer: ${question.options?.[result.correct_choice] ?? 'Review with your teacher.'}`} {result.feedback}</p>}
  </section>
}
