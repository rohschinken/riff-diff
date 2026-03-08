import { useMemo } from 'react'
import type { AlphaTabApi } from '@coderline/alphatab'
import type { DiffResult, DiffFilters, MeasureDiff } from '../diff/types'
import { DIFF_COLORS } from '../diff/colors'

export type OverlaySide = 'A' | 'B'
export type ComparisonMode = 'aToB' | 'bToA'

export interface DiffOverlayProps {
  diffResult: DiffResult | null
  side: OverlaySide
  api: AlphaTabApi | null
  renderKey: number
  filters: DiffFilters
  comparisonMode?: ComparisonMode
}

const COLORS = {
  added: DIFF_COLORS.added.overlay,
  removed: DIFF_COLORS.removed.overlay,
  changed: DIFF_COLORS.changed.overlay,
  ghostAdded: DIFF_COLORS.added.ghost,
  ghostRemoved: DIFF_COLORS.removed.ghost,
  tempoBadge: DIFF_COLORS.meta.solid,
} as const

interface OverlayRect {
  key: string
  type: 'beat' | 'ghost' | 'bar'
  x: number
  y: number
  w: number
  h: number
  color: string
}

interface BadgeRect {
  key: string
  x: number
  y: number
  label: string
}

interface RealBounds {
  x: number
  y: number
  w: number
  h: number
}

interface BoundsLike {
  findBeats: (beat: unknown) => { realBounds: RealBounds }[] | null
  findMasterBarByIndex: (index: number) => { realBounds: RealBounds } | null
}

function buildBadgeLabel(measure: MeasureDiff, side: OverlaySide): string {
  const parts: string[] = []
  if (measure.tempoDiff) {
    const tempo = side === 'A' ? measure.tempoDiff.tempoA : measure.tempoDiff.tempoB
    parts.push(`${tempo} BPM`)
  }
  if (measure.timeSigDiff) {
    const sig = side === 'A' ? measure.timeSigDiff.sigA : measure.timeSigDiff.sigB
    parts.push(sig)
  }
  return parts.join(' | ')
}

export function computeOverlays(
  diffResult: DiffResult,
  side: OverlaySide,
  boundsLookup: BoundsLike,
  filters: DiffFilters,
  comparisonMode: ComparisonMode = 'aToB',
): { overlays: OverlayRect[]; badges: BadgeRect[] } {
  const overlays: OverlayRect[] = []
  const badges: BadgeRect[] = []

  // In bToA mode (B is original), swap added/removed semantics:
  // bar only in A = added (green), bar only in B = removed (red)
  const reversed = comparisonMode === 'bToA'

  for (let mi = 0; mi < diffResult.measures.length; mi++) {
    const measure = diffResult.measures[mi]
    // After phantom bar insertion, `mi` is the unified position.
    // Both scores have bars at every unified position (real or phantom).
    // Use `mi` for bounds lookup since it maps to the score's bar index.

    // Detect bar-level add/remove (entire bar only exists in one version)
    const onlyInB = measure.measureIndexA === null && measure.measureIndexB !== null
    const onlyInA = measure.measureIndexA !== null && measure.measureIndexB === null
    const thisSideHasReal = side === 'A' ? measure.measureIndexA !== null : measure.measureIndexB !== null

    // Determine visual meaning based on comparison direction
    const isBarAdded = reversed ? onlyInA : onlyInB

    // Bar-level add/remove: render full-bar overlay on the side that has the real bar,
    // ghost on the side that has a phantom bar
    if ((onlyInA || onlyInB) && filters.showAddedRemoved) {
      const mbBounds = boundsLookup.findMasterBarByIndex(mi)
      if (mbBounds) {
        if (thisSideHasReal) {
          // This side HAS the real bar — full bar-level overlay
          overlays.push({
            key: `bar-${mi}`,
            type: 'bar',
            x: mbBounds.realBounds.x,
            y: mbBounds.realBounds.y,
            w: mbBounds.realBounds.w,
            h: mbBounds.realBounds.h,
            color: isBarAdded ? COLORS.added : COLORS.removed,
          })
        } else {
          // This side has a phantom bar — ghost overlay
          overlays.push({
            key: `ghost-${mi}`,
            type: 'ghost',
            x: mbBounds.realBounds.x,
            y: mbBounds.realBounds.y,
            w: mbBounds.realBounds.w,
            h: mbBounds.realBounds.h,
            color: isBarAdded ? COLORS.ghostAdded : COLORS.ghostRemoved,
          })
        }
      }
      continue
    }

    // Skip phantom positions when filter is off
    if (!thisSideHasReal) continue

    // Tempo/TimeSig badges
    if (filters.showTempoTimeSig && (measure.tempoDiff || measure.timeSigDiff)) {
      const mbBounds = boundsLookup.findMasterBarByIndex(mi)
      if (mbBounds) {
        badges.push({
          key: `${mi}`,
          x: mbBounds.realBounds.x,
          y: mbBounds.realBounds.y,
          label: buildBadgeLabel(measure, side),
        })
      }
    }

    // Beat-level overlays for matched bars
    for (let bi = 0; bi < measure.beatDiffs.length; bi++) {
      const bd = measure.beatDiffs[bi]

      if (bd.status === 'equal') continue
      // Beat-level overlays are only for 'changed' — added/removed are handled at bar level
      if (bd.status === 'added' || bd.status === 'removed') continue
      if (bd.status === 'changed' && !filters.showChanged) continue

      const beat = side === 'A' ? bd.beatA : bd.beatB
      if (!beat) continue

      const allBeatBounds = boundsLookup.findBeats(beat) ?? []
      const seen = new Set<string>()
      let uniqueIdx = 0
      for (const beatBounds of allBeatBounds) {
        const { x, y, w, h } = beatBounds.realBounds
        const posKey = `${x},${y},${w},${h}`
        if (seen.has(posKey)) continue
        seen.add(posKey)
        overlays.push({
          key: `beat-${mi}-${bi}-s${uniqueIdx}`,
          type: 'beat',
          x,
          y,
          w,
          h,
          color: COLORS[bd.status],
        })
        uniqueIdx++
      }
    }
  }

  return { overlays, badges }
}

export function DiffOverlay({ diffResult, side, api, renderKey, filters, comparisonMode = 'aToB' }: DiffOverlayProps) {
  const { overlays, badges } = useMemo(() => {
    const boundsLookup = (api as unknown as { renderer?: { boundsLookup?: BoundsLike } })?.renderer?.boundsLookup
    if (!diffResult || !boundsLookup) {
      return { overlays: [], badges: [] }
    }
    return computeOverlays(diffResult, side, boundsLookup, filters, comparisonMode)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diffResult, side, api, renderKey, filters, comparisonMode])

  if (overlays.length === 0 && badges.length === 0) return null

  return (
    <div
      data-testid={`diff-overlay-${side}`}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 10,
      }}
    >
      {overlays.map((rect) => (
        <div
          key={rect.key}
          data-testid={`overlay-${rect.key}`}
          style={{
            position: 'absolute',
            left: rect.type === 'bar' || rect.type === 'ghost' ? rect.x + 2 : rect.x,
            top: rect.y,
            width: rect.type === 'bar' || rect.type === 'ghost' ? rect.w - 4 : rect.w,
            height: rect.h,
            backgroundColor: rect.color,
            borderRadius: rect.type === 'bar' || rect.type === 'ghost' ? 6 : 0,
          }}
        />
      ))}
      {badges.map((badge) => (
        <div
          key={badge.key}
          data-testid={`badge-${badge.key}`}
          style={{
            position: 'absolute',
            left: badge.x + 2,
            top: badge.y - 24,
            zIndex: 20,
            backgroundColor: COLORS.tempoBadge,
            color: '#fff',
            fontSize: 11,
            fontWeight: 700,
            lineHeight: '16px',
            padding: '2px 8px',
            borderRadius: 6,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
          }}
        >
          {badge.label}
        </div>
      ))}
    </div>
  )
}
