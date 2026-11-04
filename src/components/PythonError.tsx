import { describePythonError } from '../utils/pythonError'
export function PythonError({ error }: { error: string }) {
  const { summary, hint } = describePythonError(error)
  return <div className="python-error"><strong>Program error</strong><pre>{summary}</pre>{hint && <p>{hint}</p>}<details><summary>Full error details</summary><pre>{error}</pre></details></div>
}
