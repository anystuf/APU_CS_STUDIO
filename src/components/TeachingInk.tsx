import { useIdeTabState } from '../utils/useIdeTabState'
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { Eraser, MousePointer2, PenLine, Trash2 } from 'lucide-react'
import { touchesStroke, type InkPoint } from '../utils/ink'
import './teaching-ink.css'

type Stroke = { id: string; color: string; width: number; points: InkPoint[] }
const colors = [{ name: 'Yellow', value: '#ffe066' }, { name: 'Pink', value: '#ff81b4' }, { name: 'Cyan', value: '#65e3ff' }]

/** Temporary teaching annotations. Never writes ink into source code or cloud work. */
export function TeachingInk({ children, syncScope }: { children: ReactNode; syncScope?: string }) {
  const [tool, setTool] = useIdeTabState<'edit' | 'pen' | 'eraser'>(syncScope, 'tool', 'edit')
  const [color, setColor] = useIdeTabState(syncScope, 'color', colors[0]!.value)
  const [width, setWidth] = useIdeTabState(syncScope, 'width', 4)
  const [strokes, setStrokes] = useIdeTabState<Stroke[]>(syncScope, 'strokes', [])
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [cursor, setCursor] = useIdeTabState<InkPoint | null>(syncScope, 'cursor', null, true)
  const [sharedScroll, setSharedScroll] = useIdeTabState(syncScope, 'scroll', { x: 0, y: 0 })
  const appliedScroll = useRef<InkPoint | null>(null)
  const lastMove = useRef(0)
  const surface = useRef<HTMLDivElement>(null)
  const drawing = useRef<string | null>(null)
  const pointer = useRef<number | null>(null)
  const scroll = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const scroller = surface.current?.querySelector('.cm-scroller')
    if (!scroller) return
    const update = () => {
      const next = { x: scroller.scrollLeft, y: scroller.scrollTop }
      scroll.current = next
      setOffset(next)
      const applied = appliedScroll.current
      appliedScroll.current = null
      if (syncScope && (next.x !== applied?.x || next.y !== applied?.y)) setSharedScroll(next)
    }
    scroller.addEventListener('scroll', update, { passive: true })
    return () => scroller.removeEventListener('scroll', update)
  }, [syncScope, setSharedScroll])
  useEffect(() => {
    const scroller = surface.current?.querySelector('.cm-scroller')
    if (!syncScope || !scroller || (scroller.scrollLeft === sharedScroll.x && scroller.scrollTop === sharedScroll.y)) return
    scroller.scrollTo(sharedScroll.x, sharedScroll.y)
    appliedScroll.current = { x: scroller.scrollLeft, y: scroller.scrollTop }
  }, [syncScope, sharedScroll])
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setTool('edit'); drawing.current = null; pointer.current = null } }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [setTool])
  useEffect(() => {
    if (!syncScope) return
    const hideCursor = () => setCursor(null)
    window.addEventListener('blur', hideCursor)
    return () => window.removeEventListener('blur', hideCursor)
  }, [syncScope, setCursor])
  const point = (event: PointerEvent<SVGSVGElement>): InkPoint => {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: event.clientX - rect.left + scroll.current.x, y: event.clientY - rect.top + scroll.current.y }
  }
  const paint = (event: PointerEvent<SVGSVGElement>) => {
    if (pointer.current !== event.pointerId) return
    const p = point(event), id = drawing.current
    if (tool === 'eraser') setStrokes(current => current.filter(stroke => !touchesStroke(p, stroke.points, 16 + stroke.width / 2)))
    else if (id !== null) setStrokes(current => current.map(stroke => stroke.id === id ? { ...stroke, points: [...stroke.points, p] } : stroke))
  }
  return <div className="teaching-ink">
    <div className="ink-toolbar" role="group" aria-label="Teaching annotation tools">
      <button type="button" aria-pressed={tool === 'edit'} onClick={() => setTool('edit')} title="Edit code and scroll (Escape)"><MousePointer2 size={16}/> Edit</button>
      <button type="button" aria-pressed={tool === 'pen'} onClick={() => setTool('pen')}><PenLine size={16}/> Pen</button>
      {colors.map(item => <button type="button" key={item.name} className="ink-color" aria-label={`${item.name} pen`} aria-pressed={tool === 'pen' && color === item.value} onClick={() => { setColor(item.value); setTool('pen') }}><span style={{ background: item.value }}/></button>)}
      <div className="ink-widths" role="group" aria-label="Pen thickness">{[{ name: 'Thin', size: 2 }, { name: 'Medium', size: 4 }, { name: 'Thick', size: 8 }].map(item => <button type="button" key={item.size} aria-label={`${item.name} pen stroke (${item.size} px)`} title={`${item.name} (${item.size} px)`} aria-pressed={width === item.size} onClick={() => { setWidth(item.size); setTool('pen') }}><span aria-hidden="true" style={{ height: item.size }}/><span className="sr-only">{item.name}</span></button>)}</div>
      <button type="button" aria-pressed={tool === 'eraser'} onClick={() => setTool('eraser')}><Eraser size={16}/> Eraser</button>
      <button type="button" disabled={!strokes.length} onClick={() => { setStrokes([]); drawing.current = null }}><Trash2 size={16}/> Clear ink</button>
      <span className="ink-mode" role="status">{tool === 'edit' ? 'Temporary ink - resets on file/font change' : tool === 'pen' ? 'Draw over code - Esc to edit' : 'Touch a stroke to erase - Esc to edit'}</span>
    </div>
    <div className="ink-surface" ref={surface} onPointerMove={event => {
      if (!syncScope || performance.now() - lastMove.current < 32) return
      lastMove.current = performance.now()
      const rect = event.currentTarget.getBoundingClientRect()
      setCursor({ x: event.clientX - rect.left + scroll.current.x, y: event.clientY - rect.top + scroll.current.y })
    }} onPointerLeave={() => { if (syncScope) setCursor(null) }}>
      {children}
      <svg className={`ink-overlay ink-${tool}`} aria-label="Drawing surface over Python code" onPointerDown={event => {
        if (tool === 'edit' || (event.pointerType === 'mouse' && event.button !== 0)) return
        event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); pointer.current = event.pointerId
        if (tool === 'pen') { const id = crypto.randomUUID(), p = point(event); drawing.current = id; setStrokes(current => [...current, { id, color, width, points: [p] }]) }
        else paint(event)
      }} onPointerMove={paint} onPointerUp={event => { if (pointer.current === event.pointerId) { paint(event); drawing.current = null; pointer.current = null } }} onPointerCancel={() => { drawing.current = null; pointer.current = null }}>
        <g transform={`translate(${-offset.x}, ${-offset.y})`}>{strokes.map(stroke => <path key={stroke.id} d={stroke.points.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ') + (stroke.points.length === 1 ? ' l0.01,0' : '')} fill="none" stroke={stroke.color} strokeWidth={stroke.width} strokeLinecap="round" strokeLinejoin="round"/>)}</g>
      </svg>
      {syncScope && cursor && <span className="ink-shared-pointer" aria-hidden="true" style={{ left: cursor.x - offset.x, top: cursor.y - offset.y }}><MousePointer2 size={22} fill="currentColor"/></span>}
    </div>
  </div>
}
