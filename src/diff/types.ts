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
  hasEffectsDiff?: boolean
}

export interface MeasureDiff {
  measureIndexA: number | null
  measureIndexB: number | null
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
    addedBars: number
    removedBars: number
    tempoChanges: number
    timeSigChanges: number
    totalMeasures: number
  }
}

export interface DiffFilters {
  showAddedRemoved: boolean
  showChanged: boolean
  showTempoTimeSig: boolean
}

export const DEFAULT_DIFF_FILTERS: DiffFilters = {
  showAddedRemoved: true,
  showChanged: true,
  showTempoTimeSig: true,
}
