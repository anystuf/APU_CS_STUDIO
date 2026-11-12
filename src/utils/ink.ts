export type InkPoint = { x: number; y: number }
/** Segment hit testing erases between sparse pointer samples as well as at dots. */
export function touchesStroke(point: InkPoint, points: InkPoint[], radius: number): boolean {
  return points.some((end, i) => {
    const start = points[Math.max(0, i - 1)]!
    const dx = end.x - start.x, dy = end.y - start.y
    const length = dx * dx + dy * dy
    const t = length ? Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / length)) : 0
    return Math.hypot(point.x - start.x - t * dx, point.y - start.y - t * dy) <= radius
  })
}
