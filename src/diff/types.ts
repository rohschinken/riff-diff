import type { model } from '@coderline/alphatab'

type Beat = model.Beat
type Note = model.Note

export type BeatStatus = 'equal' | 'added' | 'removed' | 'changed'

export interface NoteDiff {
  note: Note
  status: 'noteAdded' | 'noteRemoved' | 'noteEqual'
}

export interface BeatDiff {
  beatA: Beat | null
  beatB: Beat | null
  status: BeatStatus
  noteDiffs?: NoteDiff[]
}

export interface MeasureDiff {
  measureIndex: number
  beatDiffs: BeatDiff[]
  tempoDiff: { tempoA: number; tempoB: number } | null
  timeSigDiff: { sigA: string; sigB: string } | null
}

export interface DiffResult {
  measures: MeasureDiff[]
  summary: {
    equal: number
    added: number
    removed: number
    changed: number
    tempoChanges: number
    timeSigChanges: number
    totalMeasures: number
  }
}

export interface DiffFilters {
  showAdded: boolean
  showRemoved: boolean
  showChanged: boolean
  showTempoTimeSig: boolean
}

export const DEFAULT_DIFF_FILTERS: DiffFilters = {
  showAdded: true,
  showRemoved: true,
  showChanged: true,
  showTempoTimeSig: true,
}
