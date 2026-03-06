export interface TrackInfo {
  index: number
  name: string
}

export interface TrackToolbarProps {
  tracksA: TrackInfo[] | null
  tracksB: TrackInfo[] | null
  selectedTrackIndex: number
  trackMapA: number
  trackMapB: number
  onTrackChange: (index: number) => void
  onTrackMapChange: (side: 'A' | 'B', index: number) => void
}

export function TrackToolbar({
  tracksA,
  tracksB,
  selectedTrackIndex,
  trackMapA,
  trackMapB,
  onTrackChange,
  onTrackMapChange,
}: TrackToolbarProps) {
  if (!tracksA) return null

  const hasMismatch = tracksB !== null && tracksA.length !== tracksB.length

  return (
    <div className="flex items-center gap-2 px-5 py-1.5 border-b border-chrome-border bg-chrome-bg overflow-x-auto theme-transition">
      <div className="flex items-center gap-1">
        {tracksA.map((track) => (
          <button
            key={track.index}
            onClick={() => onTrackChange(track.index)}
            className={`text-sm px-3 py-1.5 rounded-md font-medium transition-colors ${
              track.index === selectedTrackIndex
                ? 'bg-chrome-accent text-white shadow-sm'
                : 'bg-chrome-bg-subtle text-chrome-text-muted hover:text-chrome-text hover:bg-chrome-border'
            }`}
          >
            {track.name}
          </button>
        ))}
      </div>

      {hasMismatch && (
        <>
          <span className="text-xs text-amber-700 bg-amber-100 px-2.5 py-1 rounded-md font-medium">
            Track count mismatch!
          </span>

          <span className="text-xs text-chrome-text-muted font-medium ml-auto">
            Track mapping:
          </span>
          <div className="flex items-center gap-2">
            <label className="text-xs text-chrome-text-muted">
              A:
              <select
                className="ml-1 text-sm border border-chrome-border rounded-md px-1 bg-chrome-accent text-white"
                value={trackMapA}
                onChange={(e) => onTrackMapChange('A', Number(e.target.value))}
              >
                {tracksA.map((t) => (
                  <option key={t.index} value={t.index}>{t.name}</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-chrome-text-muted">
              B:
              <select
                className="ml-1 text-sm border border-chrome-border rounded-md px-1 bg-chrome-accent text-white"
                value={trackMapB}
                onChange={(e) => onTrackMapChange('B', Number(e.target.value))}
              >
                {tracksB!.map((t) => (
                  <option key={t.index} value={t.index}>{t.name}</option>
                ))}
              </select>
            </label>
          </div>
        </>
      )}
    </div>
  )
}
