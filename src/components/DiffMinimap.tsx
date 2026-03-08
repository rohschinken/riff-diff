import { useEffect, useRef, useCallback, type PointerEvent as ReactPointerEvent } from 'react'
import type { DiffResult, DiffFilters, MeasureDiff, BeatStatus } from '../diff/types'
import { DIFF_COLORS } from '../diff/colors'

const MINIMAP_HEIGHT = 40

export const MINIMAP_COLORS: Record<BeatStatus, string> = {
  equal: DIFF_COLORS.equal.solid,
  added: DIFF_COLORS.added.rgb,
  removed: DIFF_COLORS.removed.rgb,
  changed: DIFF_COLORS.changed.rgb,
}

const STATUS_PRIORITY: Record<BeatStatus, number> = {
  equal: 0,
  added: 1,
  changed: 2,
  removed: 3,
}

export interface ViewportInfo {
  start: number
  width: number
}

export function computeMeasureStatus(
  measure: MeasureDiff,
  filters: DiffFilters,
): BeatStatus {
  // Bar-level add/remove
  if (measure.measureIndexA === null && filters.showAddedRemoved) return 'added'
  if (measure.measureIndexB === null && filters.showAddedRemoved) return 'removed'
  if (measure.measureIndexA === null || measure.measureIndexB === null) return 'equal'

  let worst: BeatStatus = 'equal'

  for (const bd of measure.beatDiffs) {
    if (bd.status === 'equal') continue
    if (bd.status === 'added' && !filters.showAddedRemoved) continue
    if (bd.status === 'removed' && !filters.showAddedRemoved) continue
    if (bd.status === 'changed' && !filters.showChanged) continue

    if (STATUS_PRIORITY[bd.status] > STATUS_PRIORITY[worst]) {
      worst = bd.status
    }
  }

  if (
    filters.showTempoTimeSig &&
    (measure.tempoDiff || measure.timeSigDiff) &&
    STATUS_PRIORITY[worst] < STATUS_PRIORITY['changed']
  ) {
    worst = 'changed'
  }

  return worst
}

export function drawMinimap(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  statuses: BeatStatus[],
  viewport: ViewportInfo | null,
): void {
  ctx.clearRect(0, 0, width, height)

  const totalMeasures = statuses.length
  if (totalMeasures === 0) return

  const stripeWidth = width / totalMeasures

  for (let i = 0; i < totalMeasures; i++) {
    ctx.fillStyle = MINIMAP_COLORS[statuses[i]]
    ctx.fillRect(i * stripeWidth, 0, Math.max(stripeWidth, 1), height)
  }

  if (viewport) {
    const x = viewport.start * width
    const w = viewport.width * width
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
    ctx.fillRect(x, 0, w, height)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)'
    ctx.lineWidth = 1
    ctx.strokeRect(x + 0.5, 0.5, w - 1, height - 1)
  }
}

export interface DiffMinimapProps {
  diffResult: DiffResult | null
  filters: DiffFilters
  scrollbarEl: HTMLElement | null
  contentWidth?: number
}

export function DiffMinimap({ diffResult, filters, scrollbarEl, contentWidth }: DiffMinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef(false)

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container || !diffResult) return

    const dpr = window.devicePixelRatio || 1
    const cssWidth = container.clientWidth
    const cssHeight = MINIMAP_HEIGHT

    canvas.width = cssWidth * dpr
    canvas.height = cssHeight * dpr

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.scale(dpr, dpr)

    const statuses = diffResult.measures.map((m) => computeMeasureStatus(m, filters))

    let viewport: ViewportInfo | null = null
    if (scrollbarEl && scrollbarEl.scrollWidth > 0) {
      viewport = {
        start: scrollbarEl.scrollLeft / scrollbarEl.scrollWidth,
        width: scrollbarEl.clientWidth / scrollbarEl.scrollWidth,
      }
    }

    drawMinimap(ctx, cssWidth, cssHeight, statuses, viewport)
  }, [diffResult, filters, scrollbarEl, contentWidth])

  // Redraw on diffResult/filters/scrollbarEl change
  useEffect(() => {
    redraw()
  }, [redraw])

  // ResizeObserver for container width changes
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver(() => {
      redraw()
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [redraw])

  // Listen for scroll events on scrollbarEl to update viewport indicator
  useEffect(() => {
    if (!scrollbarEl) return

    const onScroll = () => redraw()
    scrollbarEl.addEventListener('scroll', onScroll)
    return () => scrollbarEl.removeEventListener('scroll', onScroll)
  }, [scrollbarEl, redraw])

  // Pointer event handlers as React events — always in sync with latest props
  const seekToPosition = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!scrollbarEl) return
      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX - rect.left
      const fraction = Math.max(0, Math.min(1, x / rect.width))
      const maxScroll = scrollbarEl.scrollWidth - scrollbarEl.clientWidth
      scrollbarEl.scrollLeft = fraction * maxScroll
    },
    [scrollbarEl],
  )

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      isDraggingRef.current = true
      e.currentTarget.setPointerCapture(e.pointerId)
      seekToPosition(e)
    },
    [seekToPosition],
  )

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!isDraggingRef.current) return
      seekToPosition(e)
    },
    [seekToPosition],
  )

  const handlePointerUp = useCallback(() => {
    isDraggingRef.current = false
  }, [])

  if (!diffResult) return null

  return (
    <div ref={containerRef} className="w-full shrink-0" style={{ height: MINIMAP_HEIGHT }}>
      <canvas
        ref={canvasRef}
        data-testid="diff-minimap"
        className="w-full cursor-pointer"
        style={{ height: MINIMAP_HEIGHT, display: 'block' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />
    </div>
  )
}
