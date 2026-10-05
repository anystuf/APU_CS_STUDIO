let worker: Worker | null = null
let active = false
let cancel: (() => void) | null = null

export function stopPython() { cancel?.() }

export async function runPython(code: string, input = '', files?: { name: string; code: string }[], filename = 'main.py'): Promise<{ stdout: string; stderr: string }> {
  if (active) return { stdout: '', stderr: 'Một chương trình khác đang chạy. Vui lòng đợi.' }
  active = true
  try {
    worker ??= new Worker(new URL('./python.worker.ts', import.meta.url))
    const current = worker
    return await new Promise(resolve => {
      const finish = (result: { stdout: string; stderr: string }) => { clearTimeout(timeout); cancel = null; current.onmessage = null; current.onerror = null; resolve(result) }
      const timeout = window.setTimeout(() => {
        current.terminate(); worker = null
        finish({ stdout: '', stderr: 'Chương trình dừng sau 30 giây. Kiểm tra vòng lặp hoặc kết nối tải Python, rồi chạy lại.' })
      }, 30000)
      cancel = () => {
        current.terminate(); worker = null
        finish({ stdout: '', stderr: 'Stopped by you. You can edit your code and run again.' })
      }
      current.onmessage = event => finish(event.data)
      current.onerror = () => { current.terminate(); worker = null; finish({ stdout: '', stderr: 'Không tải được Python. Kiểm tra kết nối mạng rồi chạy lại.' }) }
      current.postMessage({ code, input, files, filename })
    })
  } catch (error) { return { stdout: '', stderr: error instanceof Error ? error.message : String(error) } }
  finally { active = false }
}
