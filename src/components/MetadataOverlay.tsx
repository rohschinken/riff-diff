import type { model } from '@coderline/alphatab'
import { compareMetadata } from '../diff/metadata'
import type { FieldComparison, TrackComparison } from '../diff/metadata'

type Score = model.Score

export interface MetadataOverlayProps {
  scoreA: Score | null
  scoreB: Score | null
  onClose: () => void
}

function FieldRow({ field, testId }: { field: FieldComparison; testId: string }) {
  const empty = (v: string) => !v || v === '—'
  return (
    <tr
      data-testid={testId}
      className={field.differs ? 'diff-highlight' : ''}
    >
      <td className="py-1.5 px-3 text-xs font-medium text-chrome-text-muted whitespace-nowrap align-top">
        {field.label}
      </td>
      <td className="py-1.5 px-3 text-sm text-chrome-text break-words">
        {empty(field.valueA) ? <span className="text-chrome-text-muted/50">—</span> : field.valueA}
      </td>
      <td className="py-1.5 px-3 text-sm text-chrome-text break-words">
        {empty(field.valueB) ? <span className="text-chrome-text-muted/50">—</span> : field.valueB}
      </td>
    </tr>
  )
}

function TrackSection({ track }: { track: TrackComparison }) {
  const headerLabel = track.nameA === track.nameB
    ? track.nameA
    : `${track.nameA} / ${track.nameB}`
  return (
    <>
      <tr>
        <td colSpan={3} className="pt-3 pb-1 px-3">
          <span className="text-xs font-semibold text-chrome-text uppercase tracking-wider">
            Track {track.trackIndex + 1}: {headerLabel}
          </span>
        </td>
      </tr>
      {track.fields.map((field) => (
        <FieldRow
          key={field.label}
          field={field}
          testId={`track-${track.trackIndex}-${field.label}`}
        />
      ))}
    </>
  )
}

export function MetadataOverlay({ scoreA, scoreB, onClose }: MetadataOverlayProps) {
  if (!scoreA && !scoreB) return null

  // Build comparison — use a dummy empty score for the missing side
  const dummyScore = { title: '', subTitle: '', artist: '', album: '', music: '', words: '', tab: '', copyright: '', instructions: '', notices: '', tracks: [] } as unknown as Score
  const comparison = compareMetadata(scoreA ?? dummyScore, scoreB ?? dummyScore)

  return (
    <div
      data-testid="metadata-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      {/* Backdrop */}
      <div
        data-testid="metadata-backdrop"
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
      />
      {/* Card */}
      <div className="relative z-10 bg-chrome-bg border border-chrome-border rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col theme-transition">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-chrome-border">
          <h2 className="text-sm font-bold text-chrome-text tracking-tight">File Metadata</h2>
          <button
            data-testid="metadata-close"
            onClick={onClose}
            className="p-1 rounded-md text-chrome-text-muted hover:bg-chrome-bg-subtle hover:text-chrome-text transition-colors"
            aria-label="Close metadata overlay"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {/* Body */}
        <div className="overflow-y-auto flex-1 p-2">
          <table className="w-full">
            <thead>
              <tr className="border-b border-chrome-border">
                <th className="py-1.5 px-3 text-left text-[10px] font-semibold uppercase tracking-wider text-chrome-text-muted w-24" />
                <th className="py-1.5 px-3 text-left text-[10px] font-semibold uppercase tracking-wider text-chrome-text-muted">File A</th>
                <th className="py-1.5 px-3 text-left text-[10px] font-semibold uppercase tracking-wider text-chrome-text-muted">File B</th>
              </tr>
            </thead>
            <tbody>
              {/* Score-level fields */}
              {comparison.scoreFields.map((field) => (
                <FieldRow key={field.label} field={field} testId={`field-${field.label}`} />
              ))}
              {/* Track sections */}
              {comparison.tracks.length > 0 && (
                <tr>
                  <td colSpan={3} className="pt-4 pb-1 px-3 border-t border-chrome-border">
                    <span className="text-[10px] font-semibold text-chrome-text-muted uppercase tracking-wider">Tracks</span>
                  </td>
                </tr>
              )}
              {comparison.tracks.map((track) => (
                <TrackSection key={track.trackIndex} track={track} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
