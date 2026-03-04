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
  index: number,
  scoreTempoA: number,
  scoreTempoB: number,
): { tempoA: number; tempoB: number } | null {
  const tempoA = getEffectiveTempo(masterBarsA, index, scoreTempoA)
  const tempoB = getEffectiveTempo(masterBarsB, index, scoreTempoB)
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
      summary: { equal: 0, added: 0, removed: 0, changed: 0, tempoChanges: 0, timeSigChanges: 0, totalMeasures: 0 },
    }
  }

  const maxMeasures = Math.max(scoreA.masterBars.length, scoreB.masterBars.length)
  const minMeasures = Math.min(scoreA.masterBars.length, scoreB.masterBars.length)

  const measures: MeasureDiff[] = []
  const summary = {
    equal: 0,
    added: 0,
    removed: 0,
    changed: 0,
    tempoChanges: 0,
    timeSigChanges: 0,
    totalMeasures: maxMeasures,
  }

  for (let i = 0; i < maxMeasures; i++) {
    if (i < minMeasures) {
      const beatsA = extractBeats(trackA, i)
      const beatsB = extractBeats(trackB, i)
      const beatDiffs = diffBeats(beatsA, beatsB)

      const tempoDiff = compareTempo(
        scoreA.masterBars, scoreB.masterBars, i,
        scoreA.tempo, scoreB.tempo,
      )
      const timeSigDiff = compareTimeSig(scoreA.masterBars[i], scoreB.masterBars[i])

      for (const bd of beatDiffs) {
        summary[bd.status]++
      }
      if (tempoDiff) summary.tempoChanges++
      if (timeSigDiff) summary.timeSigChanges++

      measures.push({ measureIndex: i, beatDiffs, tempoDiff, timeSigDiff })
    } else if (i >= scoreA.masterBars.length) {
      const beatsB = extractBeats(trackB, i)
      const beatDiffs: BeatDiff[] = beatsB.map(b => ({
        beatA: null, beatB: b, status: 'added' as const,
      }))
      for (const bd of beatDiffs) summary[bd.status]++
      measures.push({ measureIndex: i, beatDiffs, tempoDiff: null, timeSigDiff: null })
    } else {
      const beatsA = extractBeats(trackA, i)
      const beatDiffs: BeatDiff[] = beatsA.map(b => ({
        beatA: b, beatB: null, status: 'removed' as const,
      }))
      for (const bd of beatDiffs) summary[bd.status]++
      measures.push({ measureIndex: i, beatDiffs, tempoDiff: null, timeSigDiff: null })
    }
  }

  return { measures, summary }
}
