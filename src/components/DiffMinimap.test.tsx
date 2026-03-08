import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { computeMeasureStatus, drawMinimap, DiffMinimap, MINIMAP_COLORS } from './DiffMinimap'
import type { ViewportInfo } from './DiffMinimap'
import type { MeasureDiff, DiffFilters, BeatStatus } from '../diff/types'
import { DEFAULT_DIFF_FILTERS } from '../diff/types'
import type { DiffResult } from '../diff/types'

// --- Helpers ---

function makeBeatDiff(status: BeatStatus) {
  return { beatA: null, beatB: null, status, noteDiffs: [] }
}

function makeMeasure(
  index: number,
  statuses: BeatStatus[],
  opts?: { tempoDiff?: MeasureDiff['tempoDiff']; timeSigDiff?: MeasureDiff['timeSigDiff'] },
): MeasureDiff {
  return {
    measureIndexA: index,
    measureIndexB: index,
    beatDiffs: statuses.map((s) => makeBeatDiff(s)),
    tempoDiff: opts?.tempoDiff ?? null,
    timeSigDiff: opts?.timeSigDiff ?? null,
  }
}

function makeDiffResult(measures: MeasureDiff[]): DiffResult {
  return {
    measures,
    summary: {
      equal: 0,
      added: 0,
      removed: 0,
      changed: 0,
      addedBars: 0,
      removedBars: 0,
      tempoChanges: 0,
      timeSigChanges: 0,
      totalMeasures: measures.length,
    },
  }
}

// --- Canvas mock ---

interface MockContext {
  fillRect: ReturnType<typeof vi.fn>
  strokeRect: ReturnType<typeof vi.fn>
  clearRect: ReturnType<typeof vi.fn>
  scale: ReturnType<typeof vi.fn>
  fillStyle: string
  strokeStyle: string
  lineWidth: number
  fillStyleHistory: string[]
}

function createMockContext(): MockContext {
  const fillStyleHistory: string[] = []
  const ctx: MockContext = {
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    clearRect: vi.fn(),
    scale: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    fillStyleHistory,
  }

  // Track fillStyle assignments by proxying the fillRect calls
  ctx.fillRect = vi.fn(() => {
    fillStyleHistory.push(ctx.fillStyle)
  })

  return ctx
}

// --- ResizeObserver mock ---

class MockResizeObserver {
  callback: ResizeObserverCallback
  constructor(cb: ResizeObserverCallback) {
    this.callback = cb
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal('ResizeObserver', MockResizeObserver)

// --- Tests ---

describe('computeMeasureStatus', () => {
  const filters = DEFAULT_DIFF_FILTERS

  it('returns "equal" when all beats are equal', () => {
    const measure = makeMeasure(0, ['equal', 'equal', 'equal'])
    expect(computeMeasureStatus(measure, filters)).toBe('equal')
  })

  it('returns "removed" when any beat is removed (highest priority)', () => {
    const measure = makeMeasure(0, ['equal', 'added', 'removed', 'changed'])
    expect(computeMeasureStatus(measure, filters)).toBe('removed')
  })

  it('returns "changed" when worst beat is changed (no removed)', () => {
    const measure = makeMeasure(0, ['equal', 'added', 'changed'])
    expect(computeMeasureStatus(measure, filters)).toBe('changed')
  })

  it('returns "added" when worst beat is added (no removed/changed)', () => {
    const measure = makeMeasure(0, ['equal', 'added', 'equal'])
    expect(computeMeasureStatus(measure, filters)).toBe('added')
  })

  it('falls back to next worst when removed is filtered out', () => {
    const measure = makeMeasure(0, ['equal', 'removed', 'changed'])
    const f: DiffFilters = { ...filters, showAddedRemoved: false }
    expect(computeMeasureStatus(measure, f)).toBe('changed')
  })

  it('returns "changed" for tempo diff when showTempoTimeSig is true', () => {
    const measure = makeMeasure(0, ['equal'], {
      tempoDiff: { tempoA: 120, tempoB: 140 },
    })
    expect(computeMeasureStatus(measure, filters)).toBe('changed')
  })

  it('returns "equal" for tempo diff when showTempoTimeSig is false', () => {
    const measure = makeMeasure(0, ['equal'], {
      tempoDiff: { tempoA: 120, tempoB: 140 },
    })
    const f: DiffFilters = { ...filters, showTempoTimeSig: false }
    expect(computeMeasureStatus(measure, f)).toBe('equal')
  })
})

describe('drawMinimap', () => {
  let ctx: MockContext

  beforeEach(() => {
    ctx = createMockContext()
  })

  it('draws correct number of stripes for measures', () => {
    const statuses: BeatStatus[] = ['equal', 'added', 'removed', 'changed', 'equal']
    drawMinimap(ctx as unknown as CanvasRenderingContext2D, 500, 28, statuses, null)
    // 5 stripes
    expect(ctx.fillRect).toHaveBeenCalledTimes(5)
  })

  it('uses red for removed status stripe', () => {
    const statuses: BeatStatus[] = ['equal', 'removed', 'equal']
    drawMinimap(ctx as unknown as CanvasRenderingContext2D, 300, 28, statuses, null)
    // Second fillRect should have been called with red fillStyle
    expect(ctx.fillStyleHistory[1]).toBe(MINIMAP_COLORS.removed)
  })

  it('uses grey for equal status stripe', () => {
    const statuses: BeatStatus[] = ['equal']
    drawMinimap(ctx as unknown as CanvasRenderingContext2D, 100, 28, statuses, null)
    expect(ctx.fillStyleHistory[0]).toBe(MINIMAP_COLORS.equal)
  })

  it('draws viewport indicator after stripes', () => {
    const statuses: BeatStatus[] = ['equal', 'equal']
    const viewport: ViewportInfo = { start: 0.25, width: 0.5 }
    drawMinimap(ctx as unknown as CanvasRenderingContext2D, 200, 28, statuses, viewport)
    // 2 stripe fillRects + 1 viewport fillRect = 3 fillRect calls
    expect(ctx.fillRect).toHaveBeenCalledTimes(3)
    // viewport strokeRect called once
    expect(ctx.strokeRect).toHaveBeenCalledTimes(1)
  })
})

describe('DiffMinimap component', () => {
  let getContextSpy: ReturnType<typeof vi.spyOn>
  let mockCtx: MockContext

  beforeEach(() => {
    mockCtx = createMockContext()
    getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(mockCtx as unknown as CanvasRenderingContext2D)
  })

  afterEach(() => {
    getContextSpy.mockRestore()
  })

  it('renders a canvas with data-testid="diff-minimap"', () => {
    const result = makeDiffResult([makeMeasure(0, ['equal'])])
    render(
      <DiffMinimap diffResult={result} filters={DEFAULT_DIFF_FILTERS} scrollbarEl={null} />,
    )
    expect(screen.getByTestId('diff-minimap')).toBeInstanceOf(HTMLCanvasElement)
  })

  it('does not render when diffResult is null', () => {
    render(
      <DiffMinimap diffResult={null} filters={DEFAULT_DIFF_FILTERS} scrollbarEl={null} />,
    )
    expect(screen.queryByTestId('diff-minimap')).toBeNull()
  })

  it('seeks to ~50% on click at canvas midpoint', () => {
    const result = makeDiffResult([makeMeasure(0, ['equal']), makeMeasure(1, ['added'])])
    const scrollbarEl = document.createElement('div')
    // Simulate scrollbar dimensions
    Object.defineProperties(scrollbarEl, {
      scrollWidth: { value: 1000, configurable: true },
      clientWidth: { value: 200, configurable: true },
    })
    scrollbarEl.scrollLeft = 0

    render(
      <DiffMinimap diffResult={result} filters={DEFAULT_DIFF_FILTERS} scrollbarEl={scrollbarEl} />,
    )

    const canvas = screen.getByTestId('diff-minimap')
    // Mock getBoundingClientRect to return known dimensions
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      right: 400,
      width: 400,
      top: 0,
      bottom: 28,
      height: 28,
      x: 0,
      y: 0,
      toJSON: () => {},
    })

    // Click at 50% (x=200 of 400 width) — use fireEvent for React synthetic events
    fireEvent.pointerDown(canvas, { clientX: 200 })

    // maxScroll = 1000 - 200 = 800, fraction = 0.5 → scrollLeft = 400
    expect(scrollbarEl.scrollLeft).toBe(400)
  })
})

describe('DiffMinimap edge cases', () => {
  let getContextSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    const mockCtx = createMockContext()
    getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(mockCtx as unknown as CanvasRenderingContext2D)
  })

  afterEach(() => {
    getContextSpy.mockRestore()
  })

  it('handles zero measures without crashing', () => {
    const result = makeDiffResult([])
    expect(() =>
      render(
        <DiffMinimap diffResult={result} filters={DEFAULT_DIFF_FILTERS} scrollbarEl={null} />,
      ),
    ).not.toThrow()
  })

  it('renders but interactions are no-ops when scrollbarEl is null', () => {
    const result = makeDiffResult([makeMeasure(0, ['added'])])
    render(
      <DiffMinimap diffResult={result} filters={DEFAULT_DIFF_FILTERS} scrollbarEl={null} />,
    )
    const canvas = screen.getByTestId('diff-minimap')
    // Click should not throw
    expect(() => {
      fireEvent.pointerDown(canvas, { clientX: 50 })
    }).not.toThrow()
  })
})
