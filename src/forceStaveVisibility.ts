import type { model } from '@coderline/alphatab'

type Score = model.Score

/**
 * Force stave visibility for all tracks.
 * When showNotation is true: both standard notation and tablature are shown.
 * When showNotation is false: only tablature is shown — except for percussion
 * tracks which always keep notation ON (alphaTab can't render tab for percussion).
 */
export function forceStaveVisibility(score: Score, showNotation: boolean) {
  for (const track of score.tracks) {
    for (const staff of track.staves) {
      staff.showStandardNotation = staff.isPercussion ? true : showNotation
      staff.showTablature = true
    }
  }
}
