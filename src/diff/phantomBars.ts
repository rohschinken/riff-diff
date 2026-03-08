import { model } from '@coderline/alphatab'

type Score = model.Score
type MasterBar = model.MasterBar

/**
 * Aligned bar pair from the diff engine.
 * indexA/indexB are original (pre-phantom) bar indices.
 */
export interface BarPair {
  indexA: number | null
  indexB: number | null
}

/**
 * Extract aligned bar pairs from the diff result's measures.
 */
export function extractBarPairs(
  measures: { measureIndexA: number | null; measureIndexB: number | null }[],
): BarPair[] {
  return measures.map((m) => ({
    indexA: m.measureIndexA,
    indexB: m.measureIndexB,
  }))
}

/**
 * Compute where phantom (empty) bars need to be inserted in each score
 * to align them visually. Returns insertion positions in unified (final) space.
 *
 * Positions are returned in ascending order — insert lowest first.
 */
export function computePhantomPositions(barPairs: BarPair[]): {
  phantomsA: number[]
  phantomsB: number[]
} {
  const phantomsA: number[] = []
  const phantomsB: number[] = []

  for (let i = 0; i < barPairs.length; i++) {
    if (barPairs[i].indexA === null) phantomsA.push(i)
    if (barPairs[i].indexB === null) phantomsB.push(i)
  }

  return { phantomsA, phantomsB }
}

/**
 * Create a phantom MasterBar cloning time signature from an adjacent bar.
 */
function createPhantomMasterBar(adjacent: MasterBar | null, score: Score): MasterBar {
  const mb = new model.MasterBar()
  if (adjacent) {
    mb.timeSignatureNumerator = adjacent.timeSignatureNumerator
    mb.timeSignatureDenominator = adjacent.timeSignatureDenominator
  } else {
    mb.timeSignatureNumerator = 4
    mb.timeSignatureDenominator = 4
  }
  mb.score = score
  return mb
}

/**
 * Create a phantom Bar matching the voice count of an adjacent bar.
 * alphaTab's internal _chain() traverses voices across bars by index,
 * so phantom bars must have the same number of voices as their neighbors.
 */
function createPhantomBar(staff: model.Staff, adjacentBar: model.Bar | null): model.Bar {
  const bar = new model.Bar()
  bar.staff = staff

  const voiceCount = Math.max(1, adjacentBar?.voices.length ?? 1)
  for (let vi = 0; vi < voiceCount; vi++) {
    const voice = new model.Voice()
    voice.bar = bar
    voice.index = vi
    const beat = new model.Beat()
    beat.voice = voice
    beat.isEmpty = true
    voice.beats = [beat]
    bar.voices.push(voice)
  }

  return bar
}

/**
 * Insert phantom (empty) bars into a score at the given unified positions.
 * Positions MUST be sorted ascending.
 *
 * After insertion, `score.masterBars.length` equals the unified bar count,
 * with phantom bars at the specified positions.
 *
 * Returns the set of unified positions that are phantoms.
 */
export function insertPhantomBars(
  score: Score,
  phantomPositions: number[],
): Set<number> {
  if (phantomPositions.length === 0) return new Set()

  // Insert from lowest to highest — each splice shifts subsequent elements,
  // and the next position is already in shifted space.
  for (const pos of phantomPositions) {
    const adjacent = score.masterBars[Math.min(pos, score.masterBars.length - 1)] ?? null
    const mb = createPhantomMasterBar(adjacent, score)
    score.masterBars.splice(pos, 0, mb)

    for (const track of score.tracks) {
      for (const staff of track.staves) {
        const adjacentBar = staff.bars[Math.min(pos, staff.bars.length - 1)] ?? null
        const bar = createPhantomBar(staff, adjacentBar)
        staff.bars.splice(pos, 0, bar)
      }
    }
  }

  // Fix indices and chain references
  for (let i = 0; i < score.masterBars.length; i++) {
    const mb = score.masterBars[i]
    mb.index = i
    mb.previousMasterBar = i > 0 ? score.masterBars[i - 1] : null
    mb.nextMasterBar = i < score.masterBars.length - 1 ? score.masterBars[i + 1] : null
    mb.score = score
  }

  for (const track of score.tracks) {
    for (const staff of track.staves) {
      for (let i = 0; i < staff.bars.length; i++) {
        const bar = staff.bars[i]
        bar.index = i
        bar.previousBar = i > 0 ? staff.bars[i - 1] : null
        bar.nextBar = i < staff.bars.length - 1 ? staff.bars[i + 1] : null
        bar.staff = staff
      }
    }
  }

  return new Set(phantomPositions)
}

/**
 * Remove phantom bars from a score. Call this before re-computing diff
 * to avoid contaminating the diff with phantom bars.
 *
 * phantomPositions must be sorted ascending.
 */
export function removePhantomBars(
  score: Score,
  phantomPositions: number[],
): void {
  if (phantomPositions.length === 0) return

  // Remove from highest to lowest to avoid index shifting
  const sorted = [...phantomPositions].sort((a, b) => b - a)

  for (const pos of sorted) {
    score.masterBars.splice(pos, 1)
    for (const track of score.tracks) {
      for (const staff of track.staves) {
        staff.bars.splice(pos, 1)
      }
    }
  }

  // Fix indices and chain references
  for (let i = 0; i < score.masterBars.length; i++) {
    const mb = score.masterBars[i]
    mb.index = i
    mb.previousMasterBar = i > 0 ? score.masterBars[i - 1] : null
    mb.nextMasterBar = i < score.masterBars.length - 1 ? score.masterBars[i + 1] : null
  }

  for (const track of score.tracks) {
    for (const staff of track.staves) {
      for (let i = 0; i < staff.bars.length; i++) {
        const bar = staff.bars[i]
        bar.index = i
        bar.previousBar = i > 0 ? staff.bars[i - 1] : null
        bar.nextBar = i < staff.bars.length - 1 ? staff.bars[i + 1] : null
      }
    }
  }
}
