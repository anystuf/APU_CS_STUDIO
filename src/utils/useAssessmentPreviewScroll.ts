import { useEffect, useRef } from 'react'
import { useIdeTabState } from './useIdeTabState'

/** Mirror the visible document position without echoing programmatic scrolls. */
export function useAssessmentPreviewScroll(scope: string | undefined) {
  const [position, setPosition] = useIdeTabState<number | null>(scope, 'scroll', null)
  const applied = useRef<number | null>(null)

  useEffect(() => {
    if (!scope) return
    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        const top = window.scrollY
        if (top === applied.current) return
        applied.current = null
        setPosition(top)
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [scope, setPosition])

  useEffect(() => {
    if (!scope || position === null || window.scrollY === position) return
    window.scrollTo({ top: position, behavior: 'instant' })
    applied.current = window.scrollY
  }, [scope, position])
}
