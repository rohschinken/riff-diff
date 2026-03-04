import { useMemo } from 'react'
import type { AlphaTabApi } from '@coderline/alphatab'
import type { DiffResult, DiffFilters, MeasureDiff } from '../diff/types'

export type OverlaySide = 'A' | 'B'

export interface DiffOverlayProps {
  diffResult: DiffResult | null
  side: OverlaySide
  api: AlphaTabApi | null
  renderKey: number
  filters: DiffFilters
}

const COLORS = {
  added: 'rgba(34, 197, 94, 0.25)',
  removed: 'rgba(239, 68, 68, 0.25)',
  changed: 'rgba(234, 179, 8, 0.25)',
  ghostAdded: 'rgba(34, 197, 94, 0.12)',
  ghostRemoved: 'rgba(239, 68, 68, 0.12)',
  tempoBadge: '#374151',
} as const

interface OverlayRect {
  key: string
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
): { overlays: OverlayRect[]; badges: BadgeRect[] } {
  const overlays: OverlayRect[] = []
  const badges: BadgeRect[] = []

  for (const measure of diffResult.measures) {
    // Tempo/TimeSig badges
    if (filters.showTempoTimeSig && (measure.tempoDiff || measure.timeSigDiff)) {
      const mbBounds = boundsLookup.findMasterBarByIndex(measure.measureIndex)
      if (mbBounds) {
        badges.push({
          key: `${measure.measureIndex}`,
          x: mbBounds.realBounds.x,
          y: mbBounds.realBounds.y,
          label: buildBadgeLabel(measure, side),
        })
      }
    }

    const ghostMeasures = new Set<number>()

    for (let bi = 0; bi < measure.beatDiffs.length; bi++) {
      const bd = measure.beatDiffs[bi]

      if (bd.status === 'equal') continue
      if (bd.status === 'added' && !filters.showAdded) continue
      if (bd.status === 'removed' && !filters.showRemoved) continue
      if (bd.status === 'changed' && !filters.showChanged) continue

      const beat = side === 'A' ? bd.beatA : bd.beatB

      if (beat) {
        const allBeatBounds = boundsLookup.findBeats(beat) ?? []
        // Deduplicate: findBeats returns one entry per voice/staff rendering,
        // but multiple voices on the same staff share identical bounds.
        const seen = new Set<string>()
        let uniqueIdx = 0
        for (const beatBounds of allBeatBounds) {
          const { x, y, w, h } = beatBounds.realBounds
          const posKey = `${x},${y},${w},${h}`
          if (seen.has(posKey)) continue
          seen.add(posKey)
          overlays.push({
            key: `beat-${measure.measureIndex}-${bi}-s${uniqueIdx}`,
            x,
            y,
            w,
            h,
            color: COLORS[bd.status],
          })
          uniqueIdx++
        }
      } else {
        // Ghost overlay: beat doesn't exist in this pane
        if (!ghostMeasures.has(measure.measureIndex)) {
          ghostMeasures.add(measure.measureIndex)
          const mbBounds = boundsLookup.findMasterBarByIndex(measure.measureIndex)
          if (mbBounds) {
            const ghostColor = bd.status === 'added' ? COLORS.ghostAdded : COLORS.ghostRemoved
            overlays.push({
              key: `ghost-${measure.measureIndex}`,
              x: mbBounds.realBounds.x,
              y: mbBounds.realBounds.y,
              w: mbBounds.realBounds.w,
              h: mbBounds.realBounds.h,
              color: ghostColor,
            })
          }
        }
      }
    }
  }

  return { overlays, badges }
}

export function DiffOverlay({ diffResult, side, api, renderKey, filters }: DiffOverlayProps) {
  const { overlays, badges } = useMemo(() => {
    const boundsLookup = (api as unknown as { renderer?: { boundsLookup?: BoundsLike } })?.renderer?.boundsLookup
    if (!diffResult || !boundsLookup) {
      return { overlays: [], badges: [] }
    }
    return computeOverlays(diffResult, side, boundsLookup, filters)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diffResult, side, api, renderKey, filters])

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
            left: rect.x,
            top: rect.y,
            width: rect.w,
            height: rect.h,
            backgroundColor: rect.color,
            borderRadius: 2,
          }}
        />
      ))}
      {badges.map((badge) => (
        <div
          key={badge.key}
          data-testid={`badge-${badge.key}`}
          style={{
            position: 'absolute',
            left: badge.x,
            top: badge.y - 22,
            zIndex: 20,
            backgroundColor: COLORS.tempoBadge,
            color: '#fff',
            fontSize: 11,
            fontWeight: 700,
            lineHeight: '16px',
            padding: '2px 6px',
            borderRadius: 4,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          {badge.label}
        </div>
      ))}
    </div>
  )
}
