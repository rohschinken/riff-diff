import { render, screen } from '@testing-library/react'
import type { AlphaTabApi } from '@coderline/alphatab'
import type { model } from '@coderline/alphatab'
import { DiffOverlay } from './DiffOverlay'
import type { DiffResult, DiffFilters, MeasureDiff, BeatDiff } from '../diff/types'

type Beat = model.Beat

// --- Mock builders ---

function mockBounds(x: number, y: number, w: number, h: number) {
  return { x, y, w, h }
}

function mockBeatBounds(x: number, y: number, w: number, h: number) {
  return {
    realBounds: mockBounds(x, y, w, h),
    visualBounds: mockBounds(x, y, w, h),
  }
}

function mockMasterBarBounds(x: number, y: number, w: number, h: number) {
  return {
    realBounds: mockBounds(x, y, w, h),
  }
}

const beatA1 = { id: 'a1' } as unknown as Beat
const beatB1 = { id: 'b1' } as unknown as Beat
const beatB2 = { id: 'b2' } as unknown as Beat

function createBoundsLookup(
  beatMap: Map<unknown, unknown | unknown[]>,
  masterBarMap: Map<number, unknown>,
) {
  return {
    findBeats: (beat: unknown) => {
      const val = beatMap.get(beat)
      if (!val) return []
      return Array.isArray(val) ? val : [val]
    },
    findMasterBarByIndex: (index: number) => masterBarMap.get(index) ?? null,
  }
}

function createMockApi(boundsLookup: unknown): AlphaTabApi | null {
  if (boundsLookup === null) return { renderer: { boundsLookup: null } } as unknown as AlphaTabApi
  return {
    renderer: { boundsLookup },
  } as unknown as AlphaTabApi
}

const allFilters: DiffFilters = {
  showAddedRemoved: true,
  showChanged: true,
  showTempoTimeSig: true,
}

function makeDiffResult(measures: MeasureDiff[]): DiffResult {
  let equal = 0, added = 0, removed = 0, changed = 0, tempoChanges = 0, timeSigChanges = 0
  for (const m of measures) {
    for (const bd of m.beatDiffs) {
      if (bd.status === 'equal') equal++
      else if (bd.status === 'added') added++
      else if (bd.status === 'removed') removed++
      else if (bd.status === 'changed') changed++
    }
    if (m.tempoDiff) tempoChanges++
    if (m.timeSigDiff) timeSigChanges++
  }
  return {
    measures,
    summary: {
      equal, added, removed, changed, tempoChanges, timeSigChanges, totalMeasures: measures.length,
      addedBars: measures.filter(m => m.measureIndexA === null).length,
      removedBars: measures.filter(m => m.measureIndexB === null).length,
    },
  }
}

function makeBeatDiff(overrides: Partial<BeatDiff> & { status: BeatDiff['status'] }): BeatDiff {
  return {
    beatA: null,
    beatB: null,
    ...overrides,
  }
}

// --- Tests ---

describe('DiffOverlay', () => {
  it('renders nothing when diffResult is null', () => {
    const api = createMockApi(createBoundsLookup(new Map(), new Map()))
    const { container } = render(
      <DiffOverlay diffResult={null} side="A" api={api} renderKey={0} filters={allFilters} />,
    )
    expect(container.querySelector('[data-testid="diff-overlay-A"]')).toBeNull()
  })

  it('renders nothing when boundsLookup is null', () => {
    const api = createMockApi(null)
    const diffResult = makeDiffResult([
      {
        measureIndexA: 0,
        measureIndexB: 0,
        beatDiffs: [makeBeatDiff({ status: 'changed', beatA: beatA1, beatB: beatB1 })],
        tempoDiff: null,
        timeSigDiff: null,
      },
    ])
    const { container } = render(
      <DiffOverlay diffResult={diffResult} side="A" api={api} renderKey={0} filters={allFilters} />,
    )
    expect(container.querySelector('[data-testid="diff-overlay-A"]')).toBeNull()
  })

  // Bar-level added: ghost on side A (bar doesn't exist in A)
  it('renders green ghost for added bar on side A', () => {
    // measureIndexB=0 is the only index available; side A has no bar (measureIndexA=null)
    // Ghost uses the other side's index to find position
    const masterBarMap = new Map([[0, mockMasterBarBounds(0, 0, 200, 300)]])
    const api = createMockApi(createBoundsLookup(new Map(), masterBarMap))
    const diffResult = makeDiffResult([
      {
        measureIndexA: null,
        measureIndexB: 0,
        beatDiffs: [makeBeatDiff({ status: 'added', beatA: null, beatB: beatB1 })],
        tempoDiff: null,
        timeSigDiff: null,
      },
    ])

    render(<DiffOverlay diffResult={diffResult} side="A" api={api} renderKey={0} filters={allFilters} />)

    const ghost = screen.getByTestId('overlay-ghost-0')
    expect(ghost.style.backgroundColor).toBe('rgba(34, 197, 94, 0.12)')
  })

  // Bar-level added: full green bar overlay on side B
  it('renders green bar-level overlay for added bar on side B', () => {
    const masterBarMap = new Map([[0, mockMasterBarBounds(0, 0, 200, 300)]])
    const api = createMockApi(createBoundsLookup(new Map(), masterBarMap))
    const diffResult = makeDiffResult([
      {
        measureIndexA: null,
        measureIndexB: 0,
        beatDiffs: [makeBeatDiff({ status: 'added', beatA: null, beatB: beatB1 })],
        tempoDiff: null,
        timeSigDiff: null,
      },
    ])

    render(<DiffOverlay diffResult={diffResult} side="B" api={api} renderKey={0} filters={allFilters} />)

    const overlay = screen.getByTestId('overlay-bar-0')
    expect(overlay.style.backgroundColor).toBe('rgba(34, 197, 94, 0.25)')
    // Bar overlay has inset: w - 4
    expect(overlay.style.width).toBe('196px')
    expect(overlay.style.height).toBe('300px')
  })

  // Bar-level removed: ghost on side B
  it('renders red ghost for removed bar on side B', () => {
    const masterBarMap = new Map([[0, mockMasterBarBounds(0, 0, 200, 300)]])
    const api = createMockApi(createBoundsLookup(new Map(), masterBarMap))
    const diffResult = makeDiffResult([
      {
        measureIndexA: 0,
        measureIndexB: null,
        beatDiffs: [makeBeatDiff({ status: 'removed', beatA: beatA1, beatB: null })],
        tempoDiff: null,
        timeSigDiff: null,
      },
    ])

    render(<DiffOverlay diffResult={diffResult} side="B" api={api} renderKey={0} filters={allFilters} />)

    const ghost = screen.getByTestId('overlay-ghost-0')
    expect(ghost.style.backgroundColor).toBe('rgba(239, 68, 68, 0.12)')
  })

  // Bar-level removed: full red bar overlay on side A
  it('renders red bar-level overlay for removed bar on side A', () => {
    const beatMap = new Map([[beatA1, mockBeatBounds(50, 60, 70, 80)]])
    const masterBarMap = new Map([[0, mockMasterBarBounds(0, 0, 200, 300)]])
    const api = createMockApi(createBoundsLookup(beatMap, masterBarMap))
    const diffResult = makeDiffResult([
      {
        measureIndexA: 0,
        measureIndexB: null,
        beatDiffs: [makeBeatDiff({ status: 'removed', beatA: beatA1, beatB: null })],
        tempoDiff: null,
        timeSigDiff: null,
      },
    ])

    render(<DiffOverlay diffResult={diffResult} side="A" api={api} renderKey={0} filters={allFilters} />)

    const overlay = screen.getByTestId('overlay-bar-0')
    expect(overlay.style.backgroundColor).toBe('rgba(239, 68, 68, 0.25)')
    // Bar overlay has inset: w - 4
    expect(overlay.style.width).toBe('196px')
  })

  it('renders changed beat with yellow overlay', () => {
    const beatMap = new Map([[beatA1, mockBeatBounds(100, 110, 120, 130)]])
    const masterBarMap = new Map([[0, mockMasterBarBounds(0, 0, 200, 300)]])
    const api = createMockApi(createBoundsLookup(beatMap, masterBarMap))
    const diffResult = makeDiffResult([
      {
        measureIndexA: 0,
        measureIndexB: 0,
        beatDiffs: [makeBeatDiff({ status: 'changed', beatA: beatA1, beatB: beatB1 })],
        tempoDiff: null,
        timeSigDiff: null,
      },
    ])

    render(<DiffOverlay diffResult={diffResult} side="A" api={api} renderKey={0} filters={allFilters} />)

    const overlay = screen.getByTestId('overlay-beat-0-0-s0')
    expect(overlay.style.backgroundColor).toBe('rgba(234, 179, 8, 0.25)')
  })

  it('renders overlay for effects-only diff (equal status with hasEffectsDiff)', () => {
    const beatMap = new Map([[beatA1, mockBeatBounds(100, 110, 120, 130)]])
    const masterBarMap = new Map([[0, mockMasterBarBounds(0, 0, 200, 300)]])
    const api = createMockApi(createBoundsLookup(beatMap, masterBarMap))
    const diffResult = makeDiffResult([
      {
        measureIndexA: 0,
        measureIndexB: 0,
        beatDiffs: [makeBeatDiff({ status: 'equal', beatA: beatA1, beatB: beatB1, hasEffectsDiff: true })],
        tempoDiff: null,
        timeSigDiff: null,
      },
    ])

    render(<DiffOverlay diffResult={diffResult} side="A" api={api} renderKey={0} filters={allFilters} />)

    const overlay = screen.getByTestId('overlay-beat-0-0-s0')
    expect(overlay.style.backgroundColor).toBe('rgba(234, 179, 8, 0.25)')
  })

  it('renders no overlay for equal beats', () => {
    const beatMap = new Map([[beatA1, mockBeatBounds(10, 20, 30, 40)]])
    const masterBarMap = new Map([[0, mockMasterBarBounds(0, 0, 200, 300)]])
    const api = createMockApi(createBoundsLookup(beatMap, masterBarMap))
    const diffResult = makeDiffResult([
      {
        measureIndexA: 0,
        measureIndexB: 0,
        beatDiffs: [makeBeatDiff({ status: 'equal', beatA: beatA1, beatB: beatB1 })],
        tempoDiff: null,
        timeSigDiff: null,
      },
    ])

    const { container } = render(
      <DiffOverlay diffResult={diffResult} side="A" api={api} renderKey={0} filters={allFilters} />,
    )

    expect(container.querySelector('[data-testid^="overlay-beat"]')).toBeNull()
  })

  it('hides added/removed overlays when filters.showAddedRemoved is false', () => {
    const masterBarMap = new Map([[0, mockMasterBarBounds(0, 0, 200, 300)]])
    const api = createMockApi(createBoundsLookup(new Map(), masterBarMap))
    const diffResult = makeDiffResult([
      {
        measureIndexA: null,
        measureIndexB: 0,
        beatDiffs: [makeBeatDiff({ status: 'added', beatA: null, beatB: beatB1 })],
        tempoDiff: null,
        timeSigDiff: null,
      },
    ])
    const filters = { ...allFilters, showAddedRemoved: false }

    const { container } = render(
      <DiffOverlay diffResult={diffResult} side="B" api={api} renderKey={0} filters={filters} />,
    )

    expect(container.querySelector('[data-testid^="overlay-"]')).toBeNull()
  })

  it('hides changed overlays when filters.showChanged is false', () => {
    const beatMap = new Map([[beatA1, mockBeatBounds(10, 20, 30, 40)]])
    const masterBarMap = new Map([[0, mockMasterBarBounds(0, 0, 200, 300)]])
    const api = createMockApi(createBoundsLookup(beatMap, masterBarMap))
    const diffResult = makeDiffResult([
      {
        measureIndexA: 0,
        measureIndexB: 0,
        beatDiffs: [makeBeatDiff({ status: 'changed', beatA: beatA1, beatB: beatB1 })],
        tempoDiff: null,
        timeSigDiff: null,
      },
    ])
    const filters = { ...allFilters, showChanged: false }

    const { container } = render(
      <DiffOverlay diffResult={diffResult} side="A" api={api} renderKey={0} filters={filters} />,
    )

    expect(container.querySelector('[data-testid^="overlay-"]')).toBeNull()
  })

  it('renders only one bar-level overlay per added measure (not per beat)', () => {
    const masterBarMap = new Map([[0, mockMasterBarBounds(0, 0, 200, 300)]])
    const api = createMockApi(createBoundsLookup(new Map(), masterBarMap))
    const diffResult = makeDiffResult([
      {
        measureIndexA: null,
        measureIndexB: 0,
        beatDiffs: [
          makeBeatDiff({ status: 'added', beatA: null, beatB: beatB1 }),
          makeBeatDiff({ status: 'added', beatA: null, beatB: beatB2 }),
        ],
        tempoDiff: null,
        timeSigDiff: null,
      },
    ])

    const { container } = render(
      <DiffOverlay diffResult={diffResult} side="A" api={api} renderKey={0} filters={allFilters} />,
    )

    const ghosts = container.querySelectorAll('[data-testid^="overlay-ghost-"]')
    expect(ghosts.length).toBe(1)
  })

  it('renders amber badge for tempo diff', () => {
    const masterBarMap = new Map([[0, mockMasterBarBounds(0, 50, 200, 300)]])
    const api = createMockApi(createBoundsLookup(new Map(), masterBarMap))
    const diffResult = makeDiffResult([
      {
        measureIndexA: 0,
        measureIndexB: 0,
        beatDiffs: [],
        tempoDiff: { tempoA: 120, tempoB: 140 },
        timeSigDiff: null,
      },
    ])

    render(<DiffOverlay diffResult={diffResult} side="A" api={api} renderKey={0} filters={allFilters} />)

    const badge = screen.getByTestId('badge-0')
    expect(badge.textContent).toBe('120 BPM')
    expect(badge.style.backgroundColor).toBe('#6366f1')
  })

  it('renders badge for time signature diff', () => {
    const masterBarMap = new Map([[0, mockMasterBarBounds(0, 50, 200, 300)]])
    const api = createMockApi(createBoundsLookup(new Map(), masterBarMap))
    const diffResult = makeDiffResult([
      {
        measureIndexA: 0,
        measureIndexB: 0,
        beatDiffs: [],
        tempoDiff: null,
        timeSigDiff: { sigA: '4/4', sigB: '3/4' },
      },
    ])

    render(<DiffOverlay diffResult={diffResult} side="B" api={api} renderKey={0} filters={allFilters} />)

    const badge = screen.getByTestId('badge-0')
    expect(badge.textContent).toBe('3/4')
  })

  it('hides badges when filters.showTempoTimeSig is false', () => {
    const masterBarMap = new Map([[0, mockMasterBarBounds(0, 50, 200, 300)]])
    const api = createMockApi(createBoundsLookup(new Map(), masterBarMap))
    const diffResult = makeDiffResult([
      {
        measureIndexA: 0,
        measureIndexB: 0,
        beatDiffs: [],
        tempoDiff: { tempoA: 120, tempoB: 140 },
        timeSigDiff: null,
      },
    ])
    const filters = { ...allFilters, showTempoTimeSig: false }

    const { container } = render(
      <DiffOverlay diffResult={diffResult} side="A" api={api} renderKey={0} filters={filters} />,
    )

    expect(container.querySelector('[data-testid^="badge-"]')).toBeNull()
  })

  it('renders overlays for all staves returned by findBeats', () => {
    const staffBounds = [
      mockBeatBounds(10, 20, 30, 40),
      mockBeatBounds(10, 120, 30, 50),
    ]
    const beatMap = new Map([[beatA1, staffBounds]])
    const masterBarMap = new Map([[0, mockMasterBarBounds(0, 0, 200, 300)]])
    const api = createMockApi(createBoundsLookup(beatMap, masterBarMap))
    const diffResult = makeDiffResult([
      {
        measureIndexA: 0,
        measureIndexB: 0,
        beatDiffs: [makeBeatDiff({ status: 'changed', beatA: beatA1, beatB: beatB1 })],
        tempoDiff: null,
        timeSigDiff: null,
      },
    ])

    const { container } = render(
      <DiffOverlay diffResult={diffResult} side="A" api={api} renderKey={0} filters={allFilters} />,
    )

    const overlayS0 = screen.getByTestId('overlay-beat-0-0-s0')
    const overlayS1 = screen.getByTestId('overlay-beat-0-0-s1')
    expect(overlayS0.style.top).toBe('20px')
    expect(overlayS1.style.top).toBe('120px')
    const allOverlays = container.querySelectorAll('[data-testid^="overlay-beat-"]')
    expect(allOverlays.length).toBe(2)
  })

  it('deduplicates overlays with identical bounds from findBeats', () => {
    const staffBounds = [
      mockBeatBounds(10, 20, 30, 40),
      mockBeatBounds(10, 20, 30, 40),
      mockBeatBounds(10, 120, 30, 50),
      mockBeatBounds(10, 120, 30, 50),
    ]
    const beatMap = new Map([[beatA1, staffBounds]])
    const masterBarMap = new Map([[0, mockMasterBarBounds(0, 0, 200, 300)]])
    const api = createMockApi(createBoundsLookup(beatMap, masterBarMap))
    const diffResult = makeDiffResult([
      {
        measureIndexA: 0,
        measureIndexB: 0,
        beatDiffs: [makeBeatDiff({ status: 'changed', beatA: beatA1, beatB: beatB1 })],
        tempoDiff: null,
        timeSigDiff: null,
      },
    ])

    const { container } = render(
      <DiffOverlay diffResult={diffResult} side="A" api={api} renderKey={0} filters={allFilters} />,
    )

    const allOverlays = container.querySelectorAll('[data-testid^="overlay-beat-"]')
    expect(allOverlays.length).toBe(2)
  })

  it('never renders green/red at beat level (only yellow changed)', () => {
    // Even within matched bars, if beats somehow have added/removed status,
    // they should be skipped at beat level
    const beatMap = new Map([[beatA1, mockBeatBounds(10, 20, 30, 40)]])
    const masterBarMap = new Map([[0, mockMasterBarBounds(0, 0, 200, 300)]])
    const api = createMockApi(createBoundsLookup(beatMap, masterBarMap))
    const diffResult = makeDiffResult([
      {
        measureIndexA: 0,
        measureIndexB: 0,
        beatDiffs: [
          makeBeatDiff({ status: 'added', beatA: null, beatB: beatB1 }),
          makeBeatDiff({ status: 'removed', beatA: beatA1, beatB: null }),
        ],
        tempoDiff: null,
        timeSigDiff: null,
      },
    ])

    const { container } = render(
      <DiffOverlay diffResult={diffResult} side="A" api={api} renderKey={0} filters={allFilters} />,
    )

    expect(container.querySelector('[data-testid^="overlay-beat"]')).toBeNull()
  })

  it('in bToA mode, bar only in A renders green (added) on side A', () => {
    const masterBarMap = new Map([[0, mockMasterBarBounds(0, 0, 200, 300)]])
    const api = createMockApi(createBoundsLookup(new Map(), masterBarMap))
    const diffResult = makeDiffResult([
      {
        measureIndexA: 0,
        measureIndexB: null,
        beatDiffs: [makeBeatDiff({ status: 'removed', beatA: beatA1, beatB: null })],
        tempoDiff: null,
        timeSigDiff: null,
      },
    ])

    render(
      <DiffOverlay diffResult={diffResult} side="A" api={api} renderKey={0} filters={allFilters} comparisonMode="bToA" />,
    )

    const overlay = screen.getByTestId('overlay-bar-0')
    // In bToA mode, bar only in A = added = green
    expect(overlay.style.backgroundColor).toBe('rgba(34, 197, 94, 0.25)')
  })

  it('in bToA mode, bar only in B renders red ghost on side A', () => {
    const masterBarMap = new Map([[0, mockMasterBarBounds(0, 0, 200, 300)]])
    const api = createMockApi(createBoundsLookup(new Map(), masterBarMap))
    const diffResult = makeDiffResult([
      {
        measureIndexA: null,
        measureIndexB: 0,
        beatDiffs: [makeBeatDiff({ status: 'added', beatA: null, beatB: beatB1 })],
        tempoDiff: null,
        timeSigDiff: null,
      },
    ])

    render(
      <DiffOverlay diffResult={diffResult} side="A" api={api} renderKey={0} filters={allFilters} comparisonMode="bToA" />,
    )

    const ghost = screen.getByTestId('overlay-ghost-0')
    // In bToA mode, bar only in B = removed = red ghost
    expect(ghost.style.backgroundColor).toBe('rgba(239, 68, 68, 0.12)')
  })

  it('recomputes overlays when renderKey changes', () => {
    const beatBounds1 = mockBeatBounds(10, 20, 30, 40)
    const beatBounds2 = mockBeatBounds(100, 200, 30, 40)
    const beatMap = new Map([[beatA1, beatBounds1]])
    const masterBarMap = new Map([[0, mockMasterBarBounds(0, 0, 200, 300)]])
    const lookup = createBoundsLookup(beatMap, masterBarMap)
    const api = createMockApi(lookup)
    const diffResult = makeDiffResult([
      {
        measureIndexA: 0,
        measureIndexB: 0,
        beatDiffs: [makeBeatDiff({ status: 'changed', beatA: beatA1, beatB: beatB1 })],
        tempoDiff: null,
        timeSigDiff: null,
      },
    ])

    const { rerender } = render(
      <DiffOverlay diffResult={diffResult} side="A" api={api} renderKey={0} filters={allFilters} />,
    )

    let overlay = screen.getByTestId('overlay-beat-0-0-s0')
    expect(overlay.style.left).toBe('10px')

    beatMap.set(beatA1, beatBounds2)

    rerender(
      <DiffOverlay diffResult={diffResult} side="A" api={api} renderKey={1} filters={allFilters} />,
    )

    overlay = screen.getByTestId('overlay-beat-0-0-s0')
    expect(overlay.style.left).toBe('100px')
    expect(overlay.style.top).toBe('200px')
  })
})
