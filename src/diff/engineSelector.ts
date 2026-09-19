import type { model } from '@coderline/alphatab'
import { diffScores } from './diffEngine'
import { diffScoresAlphaTex } from './alphatexEngine'
import type { DiffResult } from './types'

type Score = model.Score

export type DiffEngineName = 'custom' | 'alphatex'

/**
 * Selects the active diff engine. The AlphaTex engine is experimental, so it is
 * opt-in: set `VITE_DIFF_ENGINE=alphatex` or `localStorage['riff-diff-engine']='alphatex'`.
 * Defaults to the stable custom engine.
 */
export function resolveDiffEngine(): DiffEngineName {
  const fromEnv = import.meta.env.VITE_DIFF_ENGINE
  const fromStorage =
    typeof localStorage !== 'undefined' ? localStorage.getItem('riff-diff-engine') : null
  return (fromStorage ?? fromEnv) === 'alphatex' ? 'alphatex' : 'custom'
}

export function diffScoresSelected(
  scoreA: Score,
  scoreB: Score,
  trackIndexA: number,
  trackIndexB: number,
): DiffResult {
  return resolveDiffEngine() === 'alphatex'
    ? diffScoresAlphaTex(scoreA, scoreB, trackIndexA, trackIndexB)
    : diffScores(scoreA, scoreB, trackIndexA, trackIndexB)
}
