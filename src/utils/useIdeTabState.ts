import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react'

export function useIdeTabState<T>(scope: string | undefined, field: string, initial: T, remoteOnly = false) {
  const [value, setValue] = useState(initial)
  const current = useRef(initial)
  const channel = useRef<BroadcastChannel | null>(null)
  const changed = useRef(false)

  useEffect(() => {
    if (!scope || typeof BroadcastChannel === 'undefined') return
    const connection = new BroadcastChannel(JSON.stringify(['apu-ide-teaching', scope, field]))
    channel.current = connection
    connection.onmessage = ({ data }) => {
      if (data?.type === 'request') {
        if (!remoteOnly && changed.current) connection.postMessage({ type: 'snapshot', value: current.current })
        return
      }
      if (data?.type !== 'update' && (data?.type !== 'snapshot' || changed.current)) return
      changed.current = true
      current.current = data.value as T
      setValue(current.current)
    }
    connection.postMessage({ type: 'request' })
    return () => { channel.current = null; connection.close() }
  }, [scope, field, remoteOnly])

  const update = useCallback((action: SetStateAction<T>) => {
    const next = typeof action === 'function' ? (action as (previous: T) => T)(current.current) : action
    if (Object.is(next, current.current)) return
    current.current = next
    changed.current = true
    if (!remoteOnly) setValue(next)
    channel.current?.postMessage({ type: 'update', value: next })
  }, [remoteOnly])
  return [value, update] as const
}
