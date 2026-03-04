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
  showAdded: true,
  showRemoved: true,
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
    summary: { equal, added, removed, changed, tempoChanges, timeSigChanges, totalMeasures: measures.length },
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
  // 1. No overlay when diffResult is null
  it('renders nothing when diffResult is null', () => {
    const api = createMockApi(createBoundsLookup(new Map(), new Map()))
    const { container } = render(
      <DiffOverlay diffResult={null} side="A" api={api} renderKey={0} filters={allFilters} />,
    )
    expect(container.querySelector('[data-testid="diff-overlay-A"]')).toBeNull()
  })

  // 2. No overlay when boundsLookup is null
  it('renders nothing when boundsLookup is null', () => {
    const api = createMockApi(null)
    const diffResult = makeDiffResult([
      {
        measureIndex: 0,
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

  // 3. Added beat → green overlay on side B
  it('renders added beat with green overlay on side B', () => {
    const beatMap = new Map([[beatB1, mockBeatBounds(10, 20, 30, 40)]])
    const masterBarMap = new Map([[0, mockMasterBarBounds(0, 0, 200, 300)]])
    const api = createMockApi(createBoundsLookup(beatMap, masterBarMap))
    const diffResult = makeDiffResult([
      {
        measureIndex: 0,
        beatDiffs: [makeBeatDiff({ status: 'added', beatA: null, beatB: beatB1 })],
        tempoDiff: null,
        timeSigDiff: null,
      },
    ])

    render(<DiffOverlay diffResult={diffResult} side="B" api={api} renderKey={0} filters={allFilters} />)

    const overlay = screen.getByTestId('overlay-beat-0-0-s0')
    expect(overlay.style.backgroundColor).toBe('rgba(34, 197, 94, 0.25)')
    expect(overlay.style.left).toBe('10px')
    expect(overlay.style.top).toBe('20px')
    expect(overlay.style.width).toBe('30px')
    expect(overlay.style.height).toBe('40px')
  })

  // 4. Removed beat → red overlay on side A
  it('renders removed beat with red overlay on side A', () => {
    const beatMap = new Map([[beatA1, mockBeatBounds(50, 60, 70, 80)]])
    const masterBarMap = new Map([[0, mockMasterBarBounds(0, 0, 200, 300)]])
    const api = createMockApi(createBoundsLookup(beatMap, masterBarMap))
    const diffResult = makeDiffResult([
      {
        measureIndex: 0,
        beatDiffs: [makeBeatDiff({ status: 'removed', beatA: beatA1, beatB: null })],
        tempoDiff: null,
        timeSigDiff: null,
      },
    ])

    render(<DiffOverlay diffResult={diffResult} side="A" api={api} renderKey={0} filters={allFilters} />)

    const overlay = screen.getByTestId('overlay-beat-0-0-s0')
    expect(overlay.style.backgroundColor).toBe('rgba(239, 68, 68, 0.25)')
    expect(overlay.style.left).toBe('50px')
  })

  // 5. Changed beat → yellow overlay
  it('renders changed beat with yellow overlay', () => {
    const beatMap = new Map([[beatA1, mockBeatBounds(100, 110, 120, 130)]])
    const masterBarMap = new Map([[0, mockMasterBarBounds(0, 0, 200, 300)]])
    const api = createMockApi(createBoundsLookup(beatMap, masterBarMap))
    const diffResult = makeDiffResult([
      {
        measureIndex: 0,
        beatDiffs: [makeBeatDiff({ status: 'changed', beatA: beatA1, beatB: beatB1 })],
        tempoDiff: null,
        timeSigDiff: null,
      },
    ])

    render(<DiffOverlay diffResult={diffResult} side="A" api={api} renderKey={0} filters={allFilters} />)

    const overlay = screen.getByTestId('overlay-beat-0-0-s0')
    expect(overlay.style.backgroundColor).toBe('rgba(234, 179, 8, 0.25)')
  })

  // 6. Equal beat → no overlay
  it('renders no overlay for equal beats', () => {
    const beatMap = new Map([[beatA1, mockBeatBounds(10, 20, 30, 40)]])
    const masterBarMap = new Map([[0, mockMasterBarBounds(0, 0, 200, 300)]])
    const api = createMockApi(createBoundsLookup(beatMap, masterBarMap))
    const diffResult = makeDiffResult([
      {
        measureIndex: 0,
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

  // 7. Filter: showAdded = false → no added overlays
  it('hides added overlays when filters.showAdded is false', () => {
    const beatMap = new Map([[beatB1, mockBeatBounds(10, 20, 30, 40)]])
    const masterBarMap = new Map([[0, mockMasterBarBounds(0, 0, 200, 300)]])
    const api = createMockApi(createBoundsLookup(beatMap, masterBarMap))
    const diffResult = makeDiffResult([
      {
        measureIndex: 0,
        beatDiffs: [makeBeatDiff({ status: 'added', beatA: null, beatB: beatB1 })],
        tempoDiff: null,
        timeSigDiff: null,
      },
    ])
    const filters = { ...allFilters, showAdded: false }

    const { container } = render(
      <DiffOverlay diffResult={diffResult} side="B" api={api} renderKey={0} filters={filters} />,
    )

    expect(container.querySelector('[data-testid^="overlay-"]')).toBeNull()
  })

  // 8. Filter: showRemoved = false → no removed overlays
  it('hides removed overlays when filters.showRemoved is false', () => {
    const beatMap = new Map([[beatA1, mockBeatBounds(10, 20, 30, 40)]])
    const masterBarMap = new Map([[0, mockMasterBarBounds(0, 0, 200, 300)]])
    const api = createMockApi(createBoundsLookup(beatMap, masterBarMap))
    const diffResult = makeDiffResult([
      {
        measureIndex: 0,
        beatDiffs: [makeBeatDiff({ status: 'removed', beatA: beatA1, beatB: null })],
        tempoDiff: null,
        timeSigDiff: null,
      },
    ])
    const filters = { ...allFilters, showRemoved: false }

    const { container } = render(
      <DiffOverlay diffResult={diffResult} side="A" api={api} renderKey={0} filters={filters} />,
    )

    expect(container.querySelector('[data-testid^="overlay-"]')).toBeNull()
  })

  // 9. Filter: showChanged = false → no changed overlays
  it('hides changed overlays when filters.showChanged is false', () => {
    const beatMap = new Map([[beatA1, mockBeatBounds(10, 20, 30, 40)]])
    const masterBarMap = new Map([[0, mockMasterBarBounds(0, 0, 200, 300)]])
    const api = createMockApi(createBoundsLookup(beatMap, masterBarMap))
    const diffResult = makeDiffResult([
      {
        measureIndex: 0,
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

  // 10. Ghost: added beat in pane A (beatA=null) → colored ghost at masterBar bounds
  it('renders colored ghost for added beat on side A', () => {
    const masterBarMap = new Map([[0, mockMasterBarBounds(0, 0, 200, 300)]])
    const api = createMockApi(createBoundsLookup(new Map(), masterBarMap))
    const diffResult = makeDiffResult([
      {
        measureIndex: 0,
        beatDiffs: [makeBeatDiff({ status: 'added', beatA: null, beatB: beatB1 })],
        tempoDiff: null,
        timeSigDiff: null,
      },
    ])

    render(<DiffOverlay diffResult={diffResult} side="A" api={api} renderKey={0} filters={allFilters} />)

    const ghost = screen.getByTestId('overlay-ghost-0')
    expect(ghost.style.backgroundColor).toBe('rgba(34, 197, 94, 0.12)')
    expect(ghost.style.left).toBe('0px')
    expect(ghost.style.width).toBe('200px')
  })

  // 11. Ghost: removed beat in pane B (beatB=null) → colored ghost at masterBar bounds
  it('renders colored ghost for removed beat on side B', () => {
    const masterBarMap = new Map([[0, mockMasterBarBounds(0, 0, 200, 300)]])
    const api = createMockApi(createBoundsLookup(new Map(), masterBarMap))
    const diffResult = makeDiffResult([
      {
        measureIndex: 0,
        beatDiffs: [makeBeatDiff({ status: 'removed', beatA: beatA1, beatB: null })],
        tempoDiff: null,
        timeSigDiff: null,
      },
    ])

    render(<DiffOverlay diffResult={diffResult} side="B" api={api} renderKey={0} filters={allFilters} />)

    const ghost = screen.getByTestId('overlay-ghost-0')
    expect(ghost.style.backgroundColor).toBe('rgba(239, 68, 68, 0.12)')
  })

  // 12. Ghost deduplication: multiple ghost beats in same measure → one ghost
  it('deduplicates ghost overlays per measure', () => {
    const masterBarMap = new Map([[0, mockMasterBarBounds(0, 0, 200, 300)]])
    const api = createMockApi(createBoundsLookup(new Map(), masterBarMap))
    const diffResult = makeDiffResult([
      {
        measureIndex: 0,
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

  // 13. Tempo diff → amber badge with BPM text
  it('renders amber badge for tempo diff', () => {
    const masterBarMap = new Map([[0, mockMasterBarBounds(0, 50, 200, 300)]])
    const api = createMockApi(createBoundsLookup(new Map(), masterBarMap))
    const diffResult = makeDiffResult([
      {
        measureIndex: 0,
        beatDiffs: [],
        tempoDiff: { tempoA: 120, tempoB: 140 },
        timeSigDiff: null,
      },
    ])

    render(<DiffOverlay diffResult={diffResult} side="A" api={api} renderKey={0} filters={allFilters} />)

    const badge = screen.getByTestId('badge-0')
    expect(badge.textContent).toBe('120 BPM')
    expect(badge.style.backgroundColor).toBe('#d97706')
  })

  // 14. TimeSig diff → badge with signature text
  it('renders badge for time signature diff', () => {
    const masterBarMap = new Map([[0, mockMasterBarBounds(0, 50, 200, 300)]])
    const api = createMockApi(createBoundsLookup(new Map(), masterBarMap))
    const diffResult = makeDiffResult([
      {
        measureIndex: 0,
        beatDiffs: [],
        tempoDiff: null,
        timeSigDiff: { sigA: '4/4', sigB: '3/4' },
      },
    ])

    render(<DiffOverlay diffResult={diffResult} side="B" api={api} renderKey={0} filters={allFilters} />)

    const badge = screen.getByTestId('badge-0')
    expect(badge.textContent).toBe('3/4')
  })

  // 15. Filter: showTempoTimeSig = false → no badges
  it('hides badges when filters.showTempoTimeSig is false', () => {
    const masterBarMap = new Map([[0, mockMasterBarBounds(0, 50, 200, 300)]])
    const api = createMockApi(createBoundsLookup(new Map(), masterBarMap))
    const diffResult = makeDiffResult([
      {
        measureIndex: 0,
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

  // 16. Multi-staff: findBeats returns overlays for both standard notation and tablature
  it('renders overlays for all staves returned by findBeats', () => {
    const staffBounds = [
      mockBeatBounds(10, 20, 30, 40),   // standard notation
      mockBeatBounds(10, 120, 30, 50),   // tablature
    ]
    const beatMap = new Map([[beatA1, staffBounds]])
    const masterBarMap = new Map([[0, mockMasterBarBounds(0, 0, 200, 300)]])
    const api = createMockApi(createBoundsLookup(beatMap, masterBarMap))
    const diffResult = makeDiffResult([
      {
        measureIndex: 0,
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
    // Total 2 beat overlays
    const allOverlays = container.querySelectorAll('[data-testid^="overlay-beat-"]')
    expect(allOverlays.length).toBe(2)
  })

  // 17. Deduplicates overlays at the same position (multiple voices per staff)
  it('deduplicates overlays with identical bounds from findBeats', () => {
    const staffBounds = [
      mockBeatBounds(10, 20, 30, 40),   // voice 1 on staff
      mockBeatBounds(10, 20, 30, 40),   // voice 2 on same staff (identical position)
      mockBeatBounds(10, 120, 30, 50),  // voice 1 on tablature staff
      mockBeatBounds(10, 120, 30, 50),  // voice 2 on tablature (identical position)
    ]
    const beatMap = new Map([[beatA1, staffBounds]])
    const masterBarMap = new Map([[0, mockMasterBarBounds(0, 0, 200, 300)]])
    const api = createMockApi(createBoundsLookup(beatMap, masterBarMap))
    const diffResult = makeDiffResult([
      {
        measureIndex: 0,
        beatDiffs: [makeBeatDiff({ status: 'changed', beatA: beatA1, beatB: beatB1 })],
        tempoDiff: null,
        timeSigDiff: null,
      },
    ])

    const { container } = render(
      <DiffOverlay diffResult={diffResult} side="A" api={api} renderKey={0} filters={allFilters} />,
    )

    // Only 2 unique positions, not 4
    const allOverlays = container.querySelectorAll('[data-testid^="overlay-beat-"]')
    expect(allOverlays.length).toBe(2)
  })

  // 18. Recomputes overlays on renderKey change
  it('recomputes overlays when renderKey changes', () => {
    const beatBounds1 = mockBeatBounds(10, 20, 30, 40)
    const beatBounds2 = mockBeatBounds(100, 200, 30, 40)
    const beatMap = new Map([[beatA1, beatBounds1]])
    const masterBarMap = new Map([[0, mockMasterBarBounds(0, 0, 200, 300)]])
    const lookup = createBoundsLookup(beatMap, masterBarMap)
    const api = createMockApi(lookup)
    const diffResult = makeDiffResult([
      {
        measureIndex: 0,
        beatDiffs: [makeBeatDiff({ status: 'removed', beatA: beatA1, beatB: null })],
        tempoDiff: null,
        timeSigDiff: null,
      },
    ])

    const { rerender } = render(
      <DiffOverlay diffResult={diffResult} side="A" api={api} renderKey={0} filters={allFilters} />,
    )

    let overlay = screen.getByTestId('overlay-beat-0-0-s0')
    expect(overlay.style.left).toBe('10px')

    // Simulate boundsLookup update (alphaTab re-rendered at different position)
    beatMap.set(beatA1, beatBounds2)

    rerender(
      <DiffOverlay diffResult={diffResult} side="A" api={api} renderKey={1} filters={allFilters} />,
    )

    overlay = screen.getByTestId('overlay-beat-0-0-s0')
    expect(overlay.style.left).toBe('100px')
    expect(overlay.style.top).toBe('200px')
  })
})
