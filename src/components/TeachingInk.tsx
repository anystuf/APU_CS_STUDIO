import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { Eraser, MousePointer2, PenLine, Trash2 } from 'lucide-react'
import { touchesStroke, type InkPoint } from '../utils/ink'
import './teaching-ink.css'

type Stroke = { id: number; color: string; points: InkPoint[] }
const colors = [{ name: 'Yellow', value: '#ffe066' }, { name: 'Pink', value: '#ff81b4' }, { name: 'Cyan', value: '#65e3ff' }]

/** Temporary teaching annotations. Never writes ink into source code or cloud work. */
export function TeachingInk({ children }: { children: ReactNode }) {
  const [tool, setTool] = useState<'edit' | 'pen' | 'eraser'>('edit')
  const [color, setColor] = useState(colors[0]!.value)
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const surface = useRef<HTMLDivElement>(null)
  const drawing = useRef<number | null>(null)
  const pointer = useRef<number | null>(null)
  const counter = useRef(0)
  const scroll = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const scroller = surface.current?.querySelector('.cm-scroller')
    if (!scroller) return
    const update = () => { scroll.current = { x: scroller.scrollLeft, y: scroller.scrollTop }; setOffset(scroll.current) }
    update(); scroller.addEventListener('scroll', update, { passive: true })
    return () => scroller.removeEventListener('scroll', update)
  }, [])
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setTool('edit'); drawing.current = null; pointer.current = null } }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [])
  const point = (event: PointerEvent<SVGSVGElement>): InkPoint => {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: event.clientX - rect.left + scroll.current.x, y: event.clientY - rect.top + scroll.current.y }
  }
  const paint = (event: PointerEvent<SVGSVGElement>) => {
    if (pointer.current !== event.pointerId) return
    const p = point(event), id = drawing.current
    if (tool === 'eraser') setStrokes(current => current.filter(stroke => !touchesStroke(p, stroke.points, 16)))
    else if (id !== null) setStrokes(current => current.map(stroke => stroke.id === id ? { ...stroke, points: [...stroke.points, p] } : stroke))
  }
  return <div className="teaching-ink">
    <div className="ink-toolbar" role="group" aria-label="Teaching annotation tools">
      <button type="button" aria-pressed={tool === 'edit'} onClick={() => setTool('edit')} title="Edit code and scroll (Escape)"><MousePointer2 size={16}/> Edit</button>
      <button type="button" aria-pressed={tool === 'pen'} onClick={() => setTool('pen')}><PenLine size={16}/> Pen</button>
      {colors.map(item => <button type="button" key={item.name} className="ink-color" aria-label={`${item.name} pen`} aria-pressed={tool === 'pen' && color === item.value} onClick={() => { setColor(item.value); setTool('pen') }}><span style={{ background: item.value }}/></button>)}
      <button type="button" aria-pressed={tool === 'eraser'} onClick={() => setTool('eraser')}><Eraser size={16}/> Eraser</button>
      <button type="button" disabled={!strokes.length} onClick={() => { setStrokes([]); drawing.current = null }}><Trash2 size={16}/> Clear ink</button>
      <span className="ink-mode" role="status">{tool === 'edit' ? 'Temporary ink - resets on file/font change' : tool === 'pen' ? 'Draw over code - Esc to edit' : 'Touch a stroke to erase - Esc to edit'}</span>
    </div>
    <div className="ink-surface" ref={surface}>
      {children}
      <svg className={`ink-overlay ink-${tool}`} aria-label="Drawing surface over Python code" onPointerDown={event => {
        if (tool === 'edit' || (event.pointerType === 'mouse' && event.button !== 0)) return
        event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); pointer.current = event.pointerId
        if (tool === 'pen') { const id = ++counter.current, p = point(event); drawing.current = id; setStrokes(current => [...current, { id, color, points: [p] }]) }
        else paint(event)
      }} onPointerMove={paint} onPointerUp={event => { if (pointer.current === event.pointerId) { paint(event); drawing.current = null; pointer.current = null } }} onPointerCancel={() => { drawing.current = null; pointer.current = null }}>
        <g transform={`translate(${-offset.x}, ${-offset.y})`}>{strokes.map(stroke => <path key={stroke.id} d={stroke.points.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ') + (stroke.points.length === 1 ? ' l0.01,0' : '')} fill="none" stroke={stroke.color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>)}</g>
      </svg>
    </div>
  </div>
}
