type PythonRuntime = {
  runPythonAsync: (code: string) => Promise<unknown>
  setStdin: (options: { stdin: () => string | null }) => void
  setStdout: (options: { batched: (text: string) => void }) => void
  setStderr: (options: { batched: (text: string) => void }) => void
}
const pythonWorker = self as unknown as {
  importScripts: (...urls: string[]) => void
  loadPyodide: (options: { indexURL: string }) => Promise<PythonRuntime>
  postMessage: (result: { stdout: string; stderr: string }) => void
  onmessage: ((event: MessageEvent<{ code: string; input: string }>) => void) | null
}
const pythonIndex = 'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/'
let pythonRuntime: Promise<PythonRuntime> | null = null
pythonWorker.onmessage = async event => {
  const stdout: string[] = []; const stderr: string[] = []
  try {
    if (!pythonRuntime) {
      pythonWorker.importScripts(`${pythonIndex}pyodide.js`)
      pythonRuntime = pythonWorker.loadPyodide({ indexURL: pythonIndex })
    }
    const runtime = await pythonRuntime.catch(error => { pythonRuntime = null; throw error })
    const values = event.data.input.split(/\r?\n/); let cursor = 0
    let captured = 0
    const capture = (list: string[], text: string) => { if (captured < 50000) { const part = text.slice(0, 50000 - captured); list.push(part); captured += part.length } }
    runtime.setStdout({ batched: text => capture(stdout, text) })
    runtime.setStderr({ batched: text => capture(stderr, text) })
    runtime.setStdin({ stdin: () => values[cursor++] ?? null })
    await runtime.runPythonAsync(`exec(${JSON.stringify(event.data.code)}, {"__name__": "__main__"})`)
  } catch (error) { stderr.push(error instanceof Error ? error.message : String(error)) }
  pythonWorker.postMessage({ stdout: stdout.join('\n'), stderr: stderr.join('\n') })
}
