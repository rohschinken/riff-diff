import { describe, it, expect } from 'vitest'
import {
  extractBarPairs,
  computePhantomPositions,
  insertPhantomBars,
  removePhantomBars,
} from './phantomBars'

// Minimal mock Score for testing insertion/removal
function mockScore(barCount: number): {
  masterBars: { index: number; timeSignatureNumerator: number; timeSignatureDenominator: number; score: unknown; previousMasterBar: unknown; nextMasterBar: unknown }[]
  tracks: { staves: { bars: { index: number; staff: unknown; previousBar: unknown; nextBar: unknown; voices: unknown[] }[] }[] }[]
} {
  const masterBars = Array.from({ length: barCount }, (_, i) => ({
    index: i,
    timeSignatureNumerator: 4,
    timeSignatureDenominator: 4,
    score: null as unknown,
    previousMasterBar: null as unknown,
    nextMasterBar: null as unknown,
  }))
  for (let i = 0; i < masterBars.length; i++) {
    masterBars[i].previousMasterBar = i > 0 ? masterBars[i - 1] : null
    masterBars[i].nextMasterBar = i < masterBars.length - 1 ? masterBars[i + 1] : null
  }

  const bars = Array.from({ length: barCount }, (_, i) => ({
    index: i,
    staff: null as unknown,
    previousBar: null as unknown,
    nextBar: null as unknown,
    voices: [],
  }))
  for (let i = 0; i < bars.length; i++) {
    bars[i].previousBar = i > 0 ? bars[i - 1] : null
    bars[i].nextBar = i < bars.length - 1 ? bars[i + 1] : null
  }

  const score = {
    masterBars,
    tracks: [{ staves: [{ bars }] }],
  }
  for (const mb of masterBars) mb.score = score
  for (const bar of bars) bar.staff = score.tracks[0].staves[0]
  return score
}

describe('extractBarPairs', () => {
  it('extracts pairs from diff measures', () => {
    const measures = [
      { measureIndexA: 0, measureIndexB: 0 },
      { measureIndexA: 1, measureIndexB: null },
      { measureIndexA: null, measureIndexB: 1 },
    ]
    const pairs = extractBarPairs(measures as never)
    expect(pairs).toEqual([
      { indexA: 0, indexB: 0 },
      { indexA: 1, indexB: null },
      { indexA: null, indexB: 1 },
    ])
  })
})

describe('computePhantomPositions', () => {
  it('identifies phantom positions for each side', () => {
    const pairs = [
      { indexA: 0, indexB: 0 },
      { indexA: 1, indexB: null },   // B needs phantom at position 1
      { indexA: 2, indexB: 1 },
      { indexA: null, indexB: 2 },   // A needs phantom at position 3
    ]
    const { phantomsA, phantomsB } = computePhantomPositions(pairs)
    expect(phantomsA).toEqual([3])
    expect(phantomsB).toEqual([1])
  })

  it('returns empty arrays when no phantoms needed', () => {
    const pairs = [
      { indexA: 0, indexB: 0 },
      { indexA: 1, indexB: 1 },
    ]
    const { phantomsA, phantomsB } = computePhantomPositions(pairs)
    expect(phantomsA).toEqual([])
    expect(phantomsB).toEqual([])
  })

  it('handles multiple phantoms on same side', () => {
    const pairs = [
      { indexA: 0, indexB: 0 },
      { indexA: 1, indexB: null },
      { indexA: 2, indexB: null },
      { indexA: 3, indexB: 1 },
    ]
    const { phantomsA, phantomsB } = computePhantomPositions(pairs)
    expect(phantomsA).toEqual([])
    expect(phantomsB).toEqual([1, 2])
  })
})

describe('insertPhantomBars', () => {
  it('inserts phantom bars at specified positions', () => {
    const score = mockScore(3) // bars 0, 1, 2
    const origBar0 = score.masterBars[0]
    const origBar1 = score.masterBars[1]
    const origBar2 = score.masterBars[2]

    const phantoms = insertPhantomBars(score as never, [1, 3])
    // Result: [origBar0, phantom, origBar1, phantom, origBar2]

    expect(score.masterBars.length).toBe(5)
    expect(score.masterBars[0]).toBe(origBar0)
    expect(score.masterBars[2]).toBe(origBar1)
    expect(score.masterBars[4]).toBe(origBar2)
    expect(phantoms.has(1)).toBe(true)
    expect(phantoms.has(3)).toBe(true)
    expect(phantoms.has(0)).toBe(false)
  })

  it('fixes indices after insertion', () => {
    const score = mockScore(2)
    insertPhantomBars(score as never, [1])

    for (let i = 0; i < score.masterBars.length; i++) {
      expect(score.masterBars[i].index).toBe(i)
    }
    for (const track of score.tracks) {
      for (const staff of track.staves) {
        for (let i = 0; i < staff.bars.length; i++) {
          expect(staff.bars[i].index).toBe(i)
        }
      }
    }
  })

  it('fixes chain references after insertion', () => {
    const score = mockScore(2)
    insertPhantomBars(score as never, [1])

    // masterBars chain
    expect(score.masterBars[0].previousMasterBar).toBeNull()
    expect(score.masterBars[0].nextMasterBar).toBe(score.masterBars[1])
    expect(score.masterBars[1].previousMasterBar).toBe(score.masterBars[0])
    expect(score.masterBars[2].nextMasterBar).toBeNull()

    // bars chain
    const bars = score.tracks[0].staves[0].bars
    expect(bars[0].previousBar).toBeNull()
    expect(bars[0].nextBar).toBe(bars[1])
    expect(bars[2].previousBar).toBe(bars[1])
    expect(bars[2].nextBar).toBeNull()
  })

  it('returns empty set when no insertions', () => {
    const score = mockScore(3)
    const phantoms = insertPhantomBars(score as never, [])
    expect(phantoms.size).toBe(0)
    expect(score.masterBars.length).toBe(3)
  })
})

describe('removePhantomBars', () => {
  it('removes previously inserted phantom bars', () => {
    const score = mockScore(3)
    const origBar0 = score.masterBars[0]
    const origBar1 = score.masterBars[1]
    const origBar2 = score.masterBars[2]

    insertPhantomBars(score as never, [1, 3])
    expect(score.masterBars.length).toBe(5)

    removePhantomBars(score as never, [1, 3])
    expect(score.masterBars.length).toBe(3)
    expect(score.masterBars[0]).toBe(origBar0)
    expect(score.masterBars[1]).toBe(origBar1)
    expect(score.masterBars[2]).toBe(origBar2)
  })

  it('fixes indices after removal', () => {
    const score = mockScore(3)
    insertPhantomBars(score as never, [1])
    removePhantomBars(score as never, [1])

    for (let i = 0; i < score.masterBars.length; i++) {
      expect(score.masterBars[i].index).toBe(i)
    }
  })

  it('does nothing when no positions given', () => {
    const score = mockScore(3)
    removePhantomBars(score as never, [])
    expect(score.masterBars.length).toBe(3)
  })
})
