import { useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { python } from '@codemirror/lang-python'
import { Code2, Play, RotateCcw, Save, Terminal } from 'lucide-react'
import { runPython } from '../lib/pyodide/runner'

const starterCode = `# Write Python here
name = input("What is your name? ")
print(f"Hello, {name}!")
`
const storageKey = 'cs-python-ide-code'

export function PythonIdePage() {
  const [code, setCode] = useState(() => localStorage.getItem(storageKey) ?? starterCode)
  const [input, setInput] = useState('Student')
  const [output, setOutput] = useState('Press Run code to see your result.')
  const [running, setRunning] = useState(false)
  const [saved, setSaved] = useState(Boolean(localStorage.getItem(storageKey)))

  const run = async () => {
    setRunning(true)
    setOutput('Loading Python environment…')
    const result = await runPython(code, input)
    setOutput([result.stdout, result.stderr].filter(Boolean).join('\n') || '(Program finished with no output)')
    setRunning(false)
  }
  const save = () => { localStorage.setItem(storageKey, code); setSaved(true) }
  const reset = () => { setCode(starterCode); setOutput('New Python file ready.'); setInput('Student') }

  return <main className="lab-page">
    <div className="lab-heading"><div><p className="eyebrow">PYTHON WORKSPACE</p><h1>Python IDE</h1><p>Write and run Python directly in your browser. Exercise submissions are saved separately inside each assigned activity.</p></div><div className="heading-actions"><button className="button secondary" onClick={save}><Save size={17}/> {saved ? 'Saved' : 'Save file'}</button><button className="button" disabled={running} onClick={() => void run()}><Play size={17}/> {running ? 'Running…' : 'Run code'}</button></div></div>
    <div className="ide"><section className="editor-pane"><header><Code2 size={17}/> main.py <span>Python 3</span></header><CodeMirror value={code} height="500px" extensions={[python()]} onChange={(value) => { setCode(value); setSaved(false) }} theme="dark" basicSetup={{ lineNumbers: true, foldGutter: false }}/></section><section className="console-pane"><header><Terminal size={17}/> Output</header><pre>{output}</pre><label className="console-input"><span>Program input (one value per line)</span><textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder="Values used by input()"/></label></section></div>
    <div className="lab-actions"><button className="button" disabled={running} onClick={() => void run()}><Play size={17}/> Run code</button><button className="button ghost" onClick={reset}><RotateCcw size={17}/> New file</button></div>
  </main>
}
