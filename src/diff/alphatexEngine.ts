import { exporter, model, Settings } from '@coderline/alphatab/core'
import {
  barAlignmentTable,
  barSimilarity,
  compareTempo,
  compareTimeSig,
  lcsTable,
} from './diffEngine'
import type { BeatDiff, DiffResult, MeasureDiff, NoteDiff } from './types'

type Score = model.Score
type Track = model.Track
type Staff = model.Staff
type Bar = model.Bar
type Beat = model.Beat
type Note = model.Note
type MasterBar = model.MasterBar

const DEFAULT_TRACK = new model.Track()

function stripProps(tex: string): string {
  return tex.replace(/\{[^}]*\}/g, '')
}

function extractProps(tex: string): string {
  const props = tex.match(/\{[^}]*\}/g)
  return props ? props.sort().join('|') : ''
}

function rawNoteKey(note: Note): string {
  if (note.isPercussion) return `P:${note.percussionArticulation}`
  if (note.isStringed) return `${note.string}:${note.fret}`
  return `V:${note.realValueWithoutHarmonic}`
}

interface BeatSlice {
  beat: Beat
  full: string
  structure: string
  fx: string
}

/**
 * Serializes individual beats/notes of a real score to AlphaTex by building a
 * minimal, self-contained synthetic score around them.
 *
 * Every slice looks like "bar 0 of a fresh score" (all indexes forced to 0, masterbar
 * tempo/speed automations cleared, track identity sanitized). This makes each slice
 * context-free and deterministic: identical notation always produces identical text,
 * regardless of where it sits in the song.
 *
 * `full` is the exported AlphaTex. `structure` strips all `{...}` property blocks
 * (effects/articulations/dynamics), leaving only pitches + rhythm + notation metadata.
 * `fx` is the sorted set of those property blocks, so effects can be compared order-independently.
 */
class AlphaTexSlicer {
  private readonly score: Score
  private readonly exporter = new exporter.AlphaTexExporter()
  private readonly settings = new Settings()
  private readonly beatCache = new Map<string, BeatSlice>()
  private readonly noteCache = new Map<string, string>()

  constructor(score: Score) {
    this.score = score
    this.settings.exporter.indent = -1
    this.settings.exporter.comments = false
  }

  beats(trackIndex: number, measureIndex: number): Beat[] {
    const bar = this.score.tracks[trackIndex]?.staves[0]?.bars[measureIndex]
    return bar?.voices[0]?.beats ?? []
  }

  beat(trackIndex: number, measureIndex: number, beatIndex: number): BeatSlice {
    const key = `${trackIndex}:${measureIndex}:${beatIndex}`
    let slice = this.beatCache.get(key)
    if (!slice) {
      const beats = this.beats(trackIndex, measureIndex)
      const beat = beats[beatIndex]
      const notes = beat.isRest
        ? []
        : [...beat.notes].sort((a, b) => {
            const ka = rawNoteKey(a)
            const kb = rawNoteKey(b)
            return ka < kb ? -1 : ka > kb ? 1 : 0
          })
      const full = this.exportSlice(trackIndex, measureIndex, [
        { ...beat, notes, hasTuplet: beat.hasTuplet } as unknown as Beat,
      ])
      slice = { beat, full, structure: stripProps(full), fx: extractProps(full) }
      this.beatCache.set(key, slice)
    }
    return slice
  }

  /**
   * Structural key for a single note: the effects-stripped AlphaTex of a beat
   * containing only that note. Two notes with the same pitch/duration produce the
   * same key even if their effects differ (effects are tracked separately).
   */
  noteKey(
    trackIndex: number,
    measureIndex: number,
    beatIndex: number,
    noteIndex: number,
  ): string {
    const key = `${trackIndex}:${measureIndex}:${beatIndex}:${noteIndex}`
    let value = this.noteCache.get(key)
    if (value === undefined) {
      const beat = this.beats(trackIndex, measureIndex)[beatIndex]
      const note = beat.notes[noteIndex]
      value = stripProps(
        this.exportSlice(trackIndex, measureIndex, [
          { ...beat, notes: [note], hasTuplet: beat.hasTuplet } as unknown as Beat,
        ]),
      )
      this.noteCache.set(key, value)
    }
    return value
  }

  /**
   * Bar signature for cross-bar alignment: global across all tracks (like the custom
   * engine) so bar pairing is independent of the selected track. Each track contributes
   * its per-beat structural AlphaTex, prefixed by track index.
   */
  globalBarSignature(measureIndex: number): string[] {
    const sigs: string[] = []
    const masterBar = this.score.masterBars[measureIndex]
    if (masterBar) {
      sigs.push(`TS:${masterBar.timeSignatureNumerator}/${masterBar.timeSignatureDenominator}`)
    }
    for (let ti = 0; ti < this.score.tracks.length; ti++) {
      const track = this.score.tracks[ti]
      const beatCount = this.beats(ti, measureIndex).length
      for (let b = 0; b < beatCount; b++) {
        sigs.push(`T${track.index}:${this.beat(ti, measureIndex, b).structure}`)
      }
    }
    return sigs
  }

  private exportSlice(trackIndex: number, measureIndex: number, beats: Beat[]): string {
    const track = this.score.tracks[trackIndex]
    const staff = track.staves[0]
    const bar = staff.bars[measureIndex]
    const masterBar = this.score.masterBars[measureIndex]
    if (!bar || !masterBar) return ''

    const synthVoice = {
      ...bar.voices[0],
      beats: [] as Beat[],
      isEmpty: beats.length === 0,
      bar: undefined as unknown as model.Bar,
    }
    synthVoice.beats = beats.map(
      beat => ({ ...beat, voice: synthVoice }) as unknown as Beat,
    )

    const synthMasterBar = {
      ...masterBar,
      index: 0,
      previousMasterBar: undefined,
      tempoAutomations: [],
      isRepeatEnd: masterBar.isRepeatEnd,
    } as unknown as MasterBar

    const synthBar = {
      ...bar,
      index: 0,
      staff: undefined,
      masterBar: synthMasterBar,
      previousBar: {
        clef: bar.clef,
        clefOttava: bar.clefOttava,
        simileMark: bar.simileMark,
        keySignature: bar.keySignature,
        keySignatureType: bar.keySignatureType,
      },
      voices: [synthVoice],
      isEmpty: beats.length === 0,
    } as unknown as Bar
    synthVoice.bar = synthBar as unknown as model.Bar

    const synthStaff = {
      ...staff,
      index: 0,
      bars: [synthBar],
      filledVoices: new Set([0]),
      isStringed: staff.isStringed,
      isPercussion: staff.isPercussion,
    } as unknown as Staff
    synthBar.staff = synthStaff

    // A fresh Score keeps prototype methods (exportFlatSyncPoints) intact.
    const synthScore = new model.Score()

    const synthTrack = {
      ...track,
      index: 0,
      name: '',
      shortName: '',
      color: DEFAULT_TRACK.color,
      defaultSystemsLayout: DEFAULT_TRACK.defaultSystemsLayout,
      systemsLayout: [],
      playbackInfo: DEFAULT_TRACK.playbackInfo,
      isPercussion: track.isPercussion,
      score: synthScore,
      staves: [synthStaff],
    } as unknown as Track
    synthStaff.track = synthTrack

    synthScore.tracks = [synthTrack]
    return this.exporter.exportToString(synthScore, this.settings)
  }
}

function diffNotesAlphaTex(
  slicerA: AlphaTexSlicer,
  trackA: number,
  measureA: number,
  beatA: number,
  slicerB: AlphaTexSlicer,
  trackB: number,
  measureB: number,
  beatB: number,
): NoteDiff[] {
  const notesA = slicerA.beats(trackA, measureA)[beatA]?.notes ?? []
  const notesB = slicerB.beats(trackB, measureB)[beatB]?.notes ?? []

  const mapA = new Map<string, Note>()
  notesA.forEach((note, i) => mapA.set(slicerA.noteKey(trackA, measureA, beatA, i), note))
  const mapB = new Map<string, Note>()
  notesB.forEach((note, i) => mapB.set(slicerB.noteKey(trackB, measureB, beatB, i), note))

  const result: NoteDiff[] = []
  for (const [key, note] of mapA) {
    result.push({ note, status: mapB.has(key) ? 'noteEqual' : 'noteRemoved' })
  }
  for (const [key, note] of mapB) {
    if (!mapA.has(key)) result.push({ note, status: 'noteAdded' })
  }
  return result
}

/**
 * Same sequencing as the custom engine's diffBeats, but comparing AlphaTex
 * `structure` slices for equality and AlphaTex `fx` (property blocks) for effects.
 */
function diffBeatsAlphaTex(
  slicerA: AlphaTexSlicer,
  trackA: number,
  measureA: number,
  slicerB: AlphaTexSlicer,
  trackB: number,
  measureB: number,
): BeatDiff[] {
  const beatsA = slicerA.beats(trackA, measureA)
  const beatsB = slicerB.beats(trackB, measureB)
  if (beatsA.length === 0 && beatsB.length === 0) return []

  const structA = beatsA.map((_, i) => slicerA.beat(trackA, measureA, i).structure)
  const structB = beatsB.map((_, i) => slicerB.beat(trackB, measureB, i).structure)
  const dp = lcsTable(structA, structB)

  const stack: BeatDiff[] = []
  let i = beatsA.length
  let j = beatsB.length

  while (i > 0 && j > 0) {
    if (structA[i - 1] === structB[j - 1]) {
      const a = slicerA.beat(trackA, measureA, i - 1)
      const b = slicerB.beat(trackB, measureB, j - 1)
      // Equal notation: only flag a thin effects indicator if properties differ.
      stack.push(
        a.fx !== b.fx
          ? { beatA: a.beat, beatB: b.beat, status: 'equal', hasEffectsDiff: true }
          : { beatA: a.beat, beatB: b.beat, status: 'equal' },
      )
      i--
      j--
    } else if (dp[i - 1][j] === dp[i][j - 1]) {
      const a = slicerA.beat(trackA, measureA, i - 1)
      const b = slicerB.beat(trackB, measureB, j - 1)
      const noteDiffs = diffNotesAlphaTex(
        slicerA, trackA, measureA, i - 1,
        slicerB, trackB, measureB, j - 1,
      )
      stack.push({
        beatA: a.beat,
        beatB: b.beat,
        status: 'changed',
        noteDiffs,
        hasEffectsDiff: a.fx !== b.fx,
      })
      i--
      j--
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      stack.push({ beatA: slicerA.beat(trackA, measureA, i - 1).beat, beatB: null, status: 'removed' })
      i--
    } else {
      stack.push({ beatA: null, beatB: slicerB.beat(trackB, measureB, j - 1).beat, status: 'added' })
      j--
    }
  }
  while (i > 0) {
    stack.push({ beatA: slicerA.beat(trackA, measureA, i - 1).beat, beatB: null, status: 'removed' })
    i--
  }
  while (j > 0) {
    stack.push({ beatA: null, beatB: slicerB.beat(trackB, measureB, j - 1).beat, status: 'added' })
    j--
  }
  return stack.reverse()
}

const EMPTY_RESULT: DiffResult = {
  measures: [],
  summary: {
    equal: 0,
    added: 0,
    removed: 0,
    changed: 0,
    addedBars: 0,
    removedBars: 0,
    tempoChanges: 0,
    timeSigChanges: 0,
    totalMeasures: 0,
  },
}

/**
 * AlphaTex-based diff engine. Prototype alternative to `diffScores` which derives
 * all signatures from alphaTab's own AlphaTex serialization instead of custom
 * field-based signatures.
 */
export function diffScoresAlphaTex(
  scoreA: Score,
  scoreB: Score,
  trackIndexA: number,
  trackIndexB: number,
): DiffResult {
  const trackA = scoreA.tracks[trackIndexA]
  const trackB = scoreB.tracks[trackIndexB]
  if (!trackA || !trackB) return EMPTY_RESULT

  const slicerA = new AlphaTexSlicer(scoreA)
  const slicerB = new AlphaTexSlicer(scoreB)

  const numBarsA = scoreA.masterBars.length
  const numBarsB = scoreB.masterBars.length
  const globalA = Array.from({ length: numBarsA }, (_, i) => slicerA.globalBarSignature(i))
  const globalB = Array.from({ length: numBarsB }, (_, i) => slicerB.globalBarSignature(i))
  const dp = barAlignmentTable(globalA, globalB)

  type BarPair = { indexA: number | null; indexB: number | null }
  const stack: BarPair[] = []
  let ai = numBarsA
  let bi = numBarsB
  while (ai > 0 && bi > 0) {
    const sim = barSimilarity(globalA[ai - 1], globalB[bi - 1])
    const diagScore = dp[ai - 1][bi - 1] + sim
    const upScore = dp[ai - 1][bi]
    const leftScore = dp[ai][bi - 1]
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
      const beatDiffs = diffBeatsAlphaTex(
        slicerA, trackIndexA, pair.indexA,
        slicerB, trackIndexB, pair.indexB,
      )
      // Within matched bars, beat-level add/remove is semantically ambiguous —
      // mirror the custom engine and report them as changes.
      for (const bd of beatDiffs) {
        if (bd.status === 'added' || bd.status === 'removed') bd.status = 'changed'
      }

      const tempoDiff = compareTempo(
        scoreA.masterBars, scoreB.masterBars, pair.indexA, pair.indexB,
        scoreA.tempo, scoreB.tempo,
      )
      const timeSigDiff = compareTimeSig(
        scoreA.masterBars[pair.indexA], scoreB.masterBars[pair.indexB],
      )

      for (const bd of beatDiffs) summary[bd.status]++
      if (tempoDiff) summary.tempoChanges++
      if (timeSigDiff) summary.timeSigChanges++

      measures.push({
        measureIndexA: pair.indexA,
        measureIndexB: pair.indexB,
        beatDiffs,
        tempoDiff,
        timeSigDiff,
      })
    } else if (pair.indexB !== null) {
      const beatsB = slicerB.beats(trackIndexB, pair.indexB)
      const beatDiffs: BeatDiff[] = beatsB.map(b => ({ beatA: null, beatB: b, status: 'added' as const }))
      for (const bd of beatDiffs) summary[bd.status]++
      summary.addedBars++
      measures.push({ measureIndexA: null, measureIndexB: pair.indexB, beatDiffs, tempoDiff: null, timeSigDiff: null })
    } else if (pair.indexA !== null) {
      const beatsA = slicerA.beats(trackIndexA, pair.indexA)
      const beatDiffs: BeatDiff[] = beatsA.map(b => ({ beatA: b, beatB: null, status: 'removed' as const }))
      for (const bd of beatDiffs) summary[bd.status]++
      summary.removedBars++
      measures.push({ measureIndexA: pair.indexA, measureIndexB: null, beatDiffs, tempoDiff: null, timeSigDiff: null })
    }
  }

  return { measures, summary }
}
