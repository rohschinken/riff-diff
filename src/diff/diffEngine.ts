import type { model } from '@coderline/alphatab'

type Score = model.Score
type Beat = model.Beat
type Note = model.Note
type MasterBar = model.MasterBar
import type { BeatDiff, DiffResult, MeasureDiff, NoteDiff } from './types'

function noteSignature(note: Note): string {
  if (note.isPercussion) {
    return `P:${note.percussionArticulation}`
  }
  return `${note.string}:${note.fret}`
}

export function beatSignature(beat: Beat): string {
  if (beat.isRest) {
    return `R:${beat.duration}`
  }

  const notesSig = beat.notes
    .map(n => noteSignature(n))
    .sort()
    .join(',')

  let durationSig = `${beat.duration}`
  if (beat.dots > 0) durationSig += `.${beat.dots}`
  if (beat.hasTuplet) durationSig += `t${beat.tupletNumerator}/${beat.tupletDenominator}`

  return `${durationSig}|${notesSig}`
}

function lcsTable(a: string[], b: string[]): number[][] {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  return dp
}

function diffNotes(beatA: Beat, beatB: Beat): NoteDiff[] {
  const result: NoteDiff[] = []

  const mapA = new Map<string, Note>()
  for (const note of beatA.notes) {
    mapA.set(noteSignature(note), note)
  }

  const mapB = new Map<string, Note>()
  for (const note of beatB.notes) {
    mapB.set(noteSignature(note), note)
  }

  for (const [sig, note] of mapA) {
    if (mapB.has(sig)) {
      result.push({ note, status: 'noteEqual' })
    } else {
      result.push({ note, status: 'noteRemoved' })
    }
  }

  for (const [sig, note] of mapB) {
    if (!mapA.has(sig)) {
      result.push({ note, status: 'noteAdded' })
    }
  }

  return result
}

function diffBeats(beatsA: Beat[], beatsB: Beat[]): BeatDiff[] {
  if (beatsA.length === 0 && beatsB.length === 0) return []

  const sigsA = beatsA.map(beatSignature)
  const sigsB = beatsB.map(beatSignature)

  const dp = lcsTable(sigsA, sigsB)

  const stack: BeatDiff[] = []
  let i = beatsA.length
  let j = beatsB.length

  while (i > 0 && j > 0) {
    if (sigsA[i - 1] === sigsB[j - 1]) {
      stack.push({ beatA: beatsA[i - 1], beatB: beatsB[j - 1], status: 'equal' })
      i--
      j--
    } else if (dp[i - 1][j] === dp[i][j - 1]) {
      // Both directions yield same LCS length — treat as changed
      const noteDiffs = diffNotes(beatsA[i - 1], beatsB[j - 1])
      stack.push({ beatA: beatsA[i - 1], beatB: beatsB[j - 1], status: 'changed', noteDiffs })
      i--
      j--
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      stack.push({ beatA: beatsA[i - 1], beatB: null, status: 'removed' })
      i--
    } else {
      stack.push({ beatA: null, beatB: beatsB[j - 1], status: 'added' })
      j--
    }
  }

  while (i > 0) {
    stack.push({ beatA: beatsA[i - 1], beatB: null, status: 'removed' })
    i--
  }

  while (j > 0) {
    stack.push({ beatA: null, beatB: beatsB[j - 1], status: 'added' })
    j--
  }

  return stack.reverse()
}

function extractBeats(track: Score['tracks'][0], measureIndex: number): Beat[] {
  const bar = track.staves[0]?.bars[measureIndex]
  if (!bar) return []
  const voice = bar.voices[0]
  if (!voice) return []
  return voice.beats
}

function getEffectiveTempo(masterBars: MasterBar[], index: number, scoreTempo: number): number {
  for (let i = index; i >= 0; i--) {
    if (masterBars[i].tempoAutomations.length > 0) {
      return masterBars[i].tempoAutomations[0].value
    }
  }
  return scoreTempo
}

function compareTempo(
  masterBarsA: MasterBar[],
  masterBarsB: MasterBar[],
  indexA: number,
  indexB: number,
  scoreTempoA: number,
  scoreTempoB: number,
): { tempoA: number; tempoB: number } | null {
  const tempoA = getEffectiveTempo(masterBarsA, indexA, scoreTempoA)
  const tempoB = getEffectiveTempo(masterBarsB, indexB, scoreTempoB)
  if (tempoA !== tempoB) {
    return { tempoA, tempoB }
  }
  return null
}

function compareTimeSig(
  mbA: MasterBar,
  mbB: MasterBar,
): { sigA: string; sigB: string } | null {
  const sigA = `${mbA.timeSignatureNumerator}/${mbA.timeSignatureDenominator}`
  const sigB = `${mbB.timeSignatureNumerator}/${mbB.timeSignatureDenominator}`
  if (sigA !== sigB) {
    return { sigA, sigB }
  }
  return null
}

function barBeatSignatures(track: Score['tracks'][0], measureIndex: number): string[] {
  const beats = extractBeats(track, measureIndex)
  return beats.map(beatSignature)
}

/**
 * Compute similarity between two bars (0.0 = completely different, 1.0 = identical).
 * Uses beat-level LCS to measure how many beats match.
 */
function barSimilarity(beatSigsA: string[], beatSigsB: string[]): number {
  if (beatSigsA.length === 0 && beatSigsB.length === 0) return 1.0
  const maxLen = Math.max(beatSigsA.length, beatSigsB.length)
  if (maxLen === 0) return 1.0

  const dp = lcsTable(beatSigsA, beatSigsB)
  const lcsLen = dp[beatSigsA.length][beatSigsB.length]
  return lcsLen / maxLen
}

/**
 * Build a similarity-based alignment table (Needleman-Wunsch style).
 * Each cell dp[i][j] = best cumulative similarity aligning first i bars of A
 * with first j bars of B.
 */
function barAlignmentTable(
  beatSigsA: string[][],
  beatSigsB: string[][],
): number[][] {
  const m = beatSigsA.length
  const n = beatSigsB.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const sim = barSimilarity(beatSigsA[i - 1], beatSigsB[j - 1])
      dp[i][j] = Math.max(
        dp[i - 1][j - 1] + sim, // align bars
        dp[i - 1][j],            // skip bar from A (removed)
        dp[i][j - 1],            // skip bar from B (added)
      )
    }
  }

  return dp
}

export function diffScores(
  scoreA: Score,
  scoreB: Score,
  trackIndexA: number,
  trackIndexB: number,
): DiffResult {
  const trackA = scoreA.tracks[trackIndexA]
  const trackB = scoreB.tracks[trackIndexB]

  if (!trackA || !trackB) {
    return {
      measures: [],
      summary: { equal: 0, added: 0, removed: 0, changed: 0, addedBars: 0, removedBars: 0, tempoChanges: 0, timeSigChanges: 0, totalMeasures: 0 },
    }
  }

  const numBarsA = scoreA.masterBars.length
  const numBarsB = scoreB.masterBars.length

  // Bar-level similarity alignment: align bars by content similarity, not just exact match
  const beatSigsA = Array.from({ length: numBarsA }, (_, i) => barBeatSignatures(trackA, i))
  const beatSigsB = Array.from({ length: numBarsB }, (_, i) => barBeatSignatures(trackB, i))
  const dp = barAlignmentTable(beatSigsA, beatSigsB)

  // Walk the alignment table to produce aligned bar pairs
  type BarPair = { indexA: number | null; indexB: number | null }
  const stack: BarPair[] = []
  let ai = numBarsA
  let bi = numBarsB

  while (ai > 0 && bi > 0) {
    const sim = barSimilarity(beatSigsA[ai - 1], beatSigsB[bi - 1])
    const diagScore = dp[ai - 1][bi - 1] + sim
    const upScore = dp[ai - 1][bi]
    const leftScore = dp[ai][bi - 1]

    // Prefer diagonal (pairing) when it's at least as good as skip
    if (diagScore >= upScore && diagScore >= leftScore) {
      stack.push({ indexA: ai - 1, indexB: bi - 1 })
      ai--
      bi--
    } else if (upScore >= leftScore) {
      stack.push({ indexA: ai - 1, indexB: null })
      ai--
    } else {
      stack.push({ indexA: null, indexB: bi - 1 })
      bi--
    }
  }
  while (ai > 0) {
    stack.push({ indexA: ai - 1, indexB: null })
    ai--
  }
  while (bi > 0) {
    stack.push({ indexA: null, indexB: bi - 1 })
    bi--
  }
  const barPairs = stack.reverse()

  const measures: MeasureDiff[] = []
  const summary = {
    equal: 0,
    added: 0,
    removed: 0,
    changed: 0,
    addedBars: 0,
    removedBars: 0,
    tempoChanges: 0,
    timeSigChanges: 0,
    totalMeasures: barPairs.length,
  }

  for (const pair of barPairs) {
    if (pair.indexA !== null && pair.indexB !== null) {
      // Matched bars: beat-level diff
      const beatsA = extractBeats(trackA, pair.indexA)
      const beatsB = extractBeats(trackB, pair.indexB)
      const beatDiffs = diffBeats(beatsA, beatsB)

      // Within bars that exist in both versions, remap added/removed beats
      // to 'changed'. Beat-level add/remove is semantically ambiguous.
      for (const bd of beatDiffs) {
        if (bd.status === 'added' || bd.status === 'removed') {
          bd.status = 'changed'
        }
      }

      const tempoDiff = compareTempo(
        scoreA.masterBars, scoreB.masterBars, pair.indexA, pair.indexB,
        scoreA.tempo, scoreB.tempo,
      )
      const timeSigDiff = (pair.indexA < scoreA.masterBars.length && pair.indexB < scoreB.masterBars.length)
        ? compareTimeSig(scoreA.masterBars[pair.indexA], scoreB.masterBars[pair.indexB])
        : null

      for (const bd of beatDiffs) summary[bd.status]++
      if (tempoDiff) summary.tempoChanges++
      if (timeSigDiff) summary.timeSigChanges++

      measures.push({ measureIndexA: pair.indexA, measureIndexB: pair.indexB, beatDiffs, tempoDiff, timeSigDiff })
    } else if (pair.indexB !== null) {
      // Added bar (only in B)
      const beatsB = extractBeats(trackB, pair.indexB)
      const beatDiffs: BeatDiff[] = beatsB.map(b => ({
        beatA: null, beatB: b, status: 'added' as const,
      }))
      for (const bd of beatDiffs) summary[bd.status]++
      summary.addedBars++
      measures.push({ measureIndexA: null, measureIndexB: pair.indexB, beatDiffs, tempoDiff: null, timeSigDiff: null })
    } else if (pair.indexA !== null) {
      // Removed bar (only in A)
      const beatsA = extractBeats(trackA, pair.indexA)
      const beatDiffs: BeatDiff[] = beatsA.map(b => ({
        beatA: b, beatB: null, status: 'removed' as const,
      }))
      for (const bd of beatDiffs) summary[bd.status]++
      summary.removedBars++
      measures.push({ measureIndexA: pair.indexA, measureIndexB: null, beatDiffs, tempoDiff: null, timeSigDiff: null })
    }
  }

  return { measures, summary }
}
