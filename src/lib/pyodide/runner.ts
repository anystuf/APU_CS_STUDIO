let worker: Worker | null = null
let active = false
let cancel: (() => void) | null = null
export type PythonInteractive = { onOutput: (text: string) => void; onInput: () => Promise<string> }

export function stopPython() { cancel?.() }

export async function runPython(code: string, input = '', files?: { name: string; code: string }[], filename = 'main.py', interactive?: PythonInteractive): Promise<{ stdout: string; stderr: string }> {
  if (active) return { stdout: '', stderr: 'Another program is running. Please wait.' }
  active = true
  try {
    worker ??= new Worker(new URL('./python.worker.ts', import.meta.url))
    const current = worker
    return await new Promise(resolve => {
      const finish = (result: { stdout: string; stderr: string }) => { clearTimeout(timeout); cancel = null; current.onmessage = null; current.onerror = null; resolve(result) }
      let timeout = window.setTimeout(() => {
        current.terminate(); worker = null
        finish({ stdout: '', stderr: 'Execution stopped after 30 seconds. Check for an infinite loop or a runtime download issue, then try again.' })
      }, 30000)
      cancel = () => {
        current.terminate(); worker = null
        finish({ stdout: '', stderr: 'Stopped by you. You can edit your code and run again.' })
      }
      current.onmessage = event => {
        if (event.data.type === 'output') { interactive?.onOutput(event.data.text); return }
        if (event.data.type === 'input') {
          clearTimeout(timeout)
          void interactive?.onInput().then(value => {
            if (worker !== current || !active) return
            current.postMessage({ type: 'input', value })
            timeout = window.setTimeout(() => { current.terminate(); worker = null; finish({ stdout: '', stderr: 'Execution stopped after 30 seconds.' }) }, 30000)
          })
          return
        }
        finish(event.data)
      }
      current.onerror = () => { current.terminate(); worker = null; finish({ stdout: '', stderr: 'Could not load Python. Check your internet connection and try again.' }) }
      current.postMessage({ code, input, files, filename, interactive: !!interactive })
    })
  } catch (error) { return { stdout: '', stderr: error instanceof Error ? error.message : String(error) } }
  finally { active = false }
}
