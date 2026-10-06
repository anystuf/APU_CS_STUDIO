type PythonRuntime = {
  runPythonAsync: (code: string) => Promise<unknown>
  setStdin: (options: { stdin: () => string | null }) => void
  setStdout: (options: { batched: (text: string) => void }) => void
  setStderr: (options: { batched: (text: string) => void }) => void
}
const pythonWorker = self as unknown as {
  importScripts: (...urls: string[]) => void
  loadPyodide: (options: { indexURL: string }) => Promise<PythonRuntime>
  postMessage: (result: { stdout: string; stderr: string } | { type: string; text?: string }) => void
  requestInput?: (prompt: string) => Promise<string>
  onmessage: ((event: MessageEvent<{ code: string; input: string; files?: { name: string; code: string }[]; filename?: string; interactive?: boolean; type?: string; value?: string }>) => void) | null
}
const pythonIndex = 'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/'
let pythonRuntime: Promise<PythonRuntime> | null = null
let resolveInput: ((value: string) => void) | null = null
let outputSoFar = ''
pythonWorker.requestInput = prompt => new Promise(resolve => {
  resolveInput = resolve
  pythonWorker.postMessage({ type: 'output', text: outputSoFar + (outputSoFar ? '\n' : '') + prompt })
  pythonWorker.postMessage({ type: 'input' })
})
pythonWorker.onmessage = async event => {
  if (event.data.type === 'input') { resolveInput?.(event.data.value ?? ''); resolveInput = null; return }
  const stdout: string[] = []; const stderr: string[] = []
  outputSoFar = ''
  try {
    if (!pythonRuntime) {
      pythonWorker.importScripts(`${pythonIndex}pyodide.js`)
      pythonRuntime = pythonWorker.loadPyodide({ indexURL: pythonIndex })
    }
    const runtime = await pythonRuntime.catch(error => { pythonRuntime = null; throw error })
    const values = event.data.input.split(/\r?\n/); let cursor = 0
    let captured = 0
    const capture = (list: string[], text: string) => { if (captured < 50000) { const part = text.slice(0, 50000 - captured); list.push(part); captured += part.length } }
    runtime.setStdout({ batched: text => { const before = captured; capture(stdout, text); outputSoFar = stdout.join('\n'); if (event.data.interactive && captured !== before) pythonWorker.postMessage({ type: 'output', text: outputSoFar }) } })
    runtime.setStderr({ batched: text => capture(stderr, text) })
    runtime.setStdin({ stdin: () => values[cursor++] ?? null })
    const files = event.data.files ?? [{ name: 'main.py', code: event.data.code }]
    if (files.some(file => !/^[A-Za-z_][A-Za-z0-9_]*\.py$/.test(file.name))) throw new Error('Invalid filename')
    const filename = event.data.filename ?? 'main.py'
    if (!files.some(file => file.name === filename)) throw new Error('Run file does not exist')
    await runtime.runPythonAsync(`
import os, sys, json, shutil, importlib, builtins
from pyodide.ffi import run_sync
from js import requestInput
if not hasattr(builtins, '_apu_original_input'):
    builtins._apu_original_input = builtins.input
def _apu_input(prompt=''):
    value = str(run_sync(requestInput(str(prompt))))
    print(str(prompt) + value)
    return value
builtins.input = _apu_input if ${event.data.interactive ? 'True' : 'False'} else builtins._apu_original_input
_workspace = '/apu_workspace'
for _name, _module in list(sys.modules.items()):
    if str(getattr(_module, '__file__', '')).startswith(_workspace + '/'):
        del sys.modules[_name]
os.chdir('/')
if os.path.exists(_workspace):
    shutil.rmtree(_workspace)
os.makedirs(_workspace)
for _file in json.loads(${JSON.stringify(JSON.stringify(files))}):
    with open(_workspace + '/' + _file['name'], 'w', encoding='utf-8') as _handle:
        _handle.write(_file['code'])
os.chdir(_workspace)
if _workspace not in sys.path:
    sys.path.insert(0, _workspace)
importlib.invalidate_caches()
_filename = ${JSON.stringify(filename)}
sys.argv = [_filename]
with open(_filename, encoding='utf-8') as _handle:
    exec(compile(_handle.read(), _filename, 'exec'), {'__name__': '__main__', '__file__': _workspace + '/' + _filename})
`)
  } catch (error) { stderr.push((error instanceof Error ? error.message : String(error)).slice(0, 50000)) }
  pythonWorker.postMessage({ stdout: stdout.join('\n'), stderr: stderr.join('\n') })
}
