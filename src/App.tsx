import { useCallback, useEffect, useRef, useState } from 'react'
import { AlphaTabApi } from '@coderline/alphatab'
import type { model } from '@coderline/alphatab'

type Score = model.Score
import { SplitPane } from './components/SplitPane'
import { TrackToolbar, TrackInfo } from './components/TrackToolbar'
import { AlphaTabPane } from './renderer/AlphaTabPane'
import type { AlphaTabPaneHandle } from './renderer/AlphaTabPane'
import { DiffOverlay } from './renderer/DiffOverlay'
import { DiffMinimap } from './components/DiffMinimap'
import { DiffFilterBar } from './components/DiffFilterBar'
import { useFileLoader } from './hooks/useFileLoader'
import { useSyncScroll } from './hooks/useSyncScroll'
import { useTheme } from './hooks/useTheme'
import { diffScores } from './diff/diffEngine'
import { DEFAULT_DIFF_FILTERS } from './diff/types'
import type { DiffResult, DiffFilters } from './diff/types'

function EmptyPane({ side, onOpenFile, isLoading }: { side: 'A' | 'B'; onOpenFile: () => void; isLoading: boolean }) {
  return (
    <div className="flex items-center justify-center h-full bg-slate-50/50">
      <div className="flex flex-col items-center gap-4 max-w-xs text-center">
        <div className="w-16 h-16 rounded-2xl bg-chrome-bg-subtle border-2 border-dashed border-chrome-border flex items-center justify-center theme-transition">
          <svg className="w-8 h-8 text-chrome-text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-medium text-chrome-text-muted mb-1">
            File {side}
          </p>
          <p className="text-xs text-chrome-text-muted/70">
            Load a Guitar Pro file (.gp, .gp7, .gp8)
          </p>
        </div>
        <button
          onClick={onOpenFile}
          disabled={isLoading}
          className="text-sm px-4 py-2 bg-chrome-accent text-white rounded-lg hover:bg-chrome-accent-hover transition-colors font-medium shadow-sm disabled:opacity-50"
        >
          {isLoading ? 'Loading\u2026' : 'Open File'}
        </button>
      </div>
    </div>
  )
}

function PaneHeader({ side, fileName, error, isLoading, onOpenFile }: {
  side: 'A' | 'B'
  fileName: string | null
  error: string | null
  isLoading: boolean
  onOpenFile: () => void
}) {
  return (
    <div className="h-10 flex items-center px-4 bg-chrome-bg border-b border-chrome-border gap-3 theme-transition">
      <span className="text-xs font-semibold uppercase tracking-wider text-chrome-text-muted w-4 shrink-0">
        {side}
      </span>
      <button
        onClick={onOpenFile}
        disabled={isLoading}
        className="text-xs px-3 py-1.5 bg-chrome-accent text-white rounded-md hover:bg-chrome-accent-hover transition-colors font-medium disabled:opacity-50"
      >
        {isLoading ? 'Loading\u2026' : fileName ? 'Change' : 'Open'}
      </button>
      <div className="h-4 w-px bg-chrome-border" />
      {fileName ? (
        <span className="text-sm font-medium text-chrome-text truncate">{fileName}</span>
      ) : (
        <span className="text-sm text-chrome-text-muted italic">No file loaded</span>
      )}
      {error && (
        <span className="text-xs text-red-500 bg-red-50 px-2 py-0.5 rounded truncate">{error}</span>
      )}
    </div>
  )
}

function extractTracks(score: Score): TrackInfo[] {
  return score.tracks.map((t) => ({ index: t.index, name: t.name }))
}

/**
 * Force all staves to show both standard notation and tablature.
 * GP files store per-staff view preferences that we ignore — our diff
 * tool always needs consistent rendering across both panes.
 * Percussion tracks especially need this: alphaTab hides the tab renderer
 * on percussion, so without standard notation there are zero renderers.
 */
function forceStaveVisibility(score: Score) {
  for (const track of score.tracks) {
    for (const staff of track.staves) {
      staff.showStandardNotation = true
      staff.showTablature = true
    }
  }
}

function renderTrackOnApi(api: AlphaTabApi, trackIndex: number) {
  const track = api.score?.tracks[trackIndex]
  if (track) api.renderTracks([track])
}

function App() {
  const fileA = useFileLoader()
  const fileB = useFileLoader()
  const { theme, toggleTheme } = useTheme()

  const apiARef = useRef<AlphaTabApi | null>(null)
  const apiBRef = useRef<AlphaTabApi | null>(null)
  const scoreARef = useRef<Score | null>(null)
  const scoreBRef = useRef<Score | null>(null)
  const paneARef = useRef<AlphaTabPaneHandle>(null)
  const paneBRef = useRef<AlphaTabPaneHandle>(null)

  const [tracksA, setTracksA] = useState<TrackInfo[] | null>(null)
  const [tracksB, setTracksB] = useState<TrackInfo[] | null>(null)

  const [selectedTrackIndex, setSelectedTrackIndex] = useState(0)
  const [trackMapA, setTrackMapA] = useState(0)
  const [trackMapB, setTrackMapB] = useState(0)

  const [diffResult, setDiffResult] = useState<DiffResult | null>(null)
  const [renderKeyA, setRenderKeyA] = useState(0)
  const [renderKeyB, setRenderKeyB] = useState(0)
  const [filters, setFilters] = useState<DiffFilters>(DEFAULT_DIFF_FILTERS)

  const [scrollElA, setScrollElA] = useState<HTMLElement | null>(null)
  const [scrollElB, setScrollElB] = useState<HTMLElement | null>(null)
  const [scrollWidthA, setScrollWidthA] = useState(0)
  const [scrollWidthB, setScrollWidthB] = useState(0)
  const [scrollbarEl, setScrollbarEl] = useState<HTMLDivElement | null>(null)

  const handleRenderFinishedA = useCallback((api: AlphaTabApi) => {
    apiARef.current = api
    setRenderKeyA((prev) => prev + 1)
    const el = paneARef.current?.getScrollContainer() ?? null
    setScrollElA(el)
    setScrollWidthA(el?.scrollWidth ?? 0)
  }, [])

  const handleRenderFinishedB = useCallback((api: AlphaTabApi) => {
    apiBRef.current = api
    setRenderKeyB((prev) => prev + 1)
    const el = paneBRef.current?.getScrollContainer() ?? null
    setScrollElB(el)
    setScrollWidthB(el?.scrollWidth ?? 0)
  }, [])

  const handleScoreLoadedA = useCallback((score: Score) => {
    forceStaveVisibility(score)
    scoreARef.current = score
    setTracksA(extractTracks(score))
    setSelectedTrackIndex(0)
    setTrackMapA(0)
    setDiffResult(null)
  }, [])

  const handleScoreLoadedB = useCallback((score: Score) => {
    forceStaveVisibility(score)
    scoreBRef.current = score
    setTracksB(extractTracks(score))
    setTrackMapB(0)
    setDiffResult(null)
  }, [])

  // Clear scroll state when files are unloaded
  useEffect(() => {
    if (!fileA.fileData) {
      setScrollElA(null)
      setScrollWidthA(0)
    }
  }, [fileA.fileData])

  useEffect(() => {
    if (!fileB.fileData) {
      setScrollElB(null)
      setScrollWidthB(0)
    }
  }, [fileB.fileData])

  useSyncScroll(scrollElA, scrollElB, scrollbarEl)

  // Compute diff when both scores are loaded or track selection changes
  useEffect(() => {
    if (!scoreARef.current || !scoreBRef.current) {
      setDiffResult(null)
      return
    }
    setDiffResult(diffScores(scoreARef.current, scoreBRef.current, trackMapA, trackMapB))
  }, [trackMapA, trackMapB, tracksA, tracksB])

  const handleTrackChange = useCallback((index: number) => {
    setSelectedTrackIndex(index)
    setTrackMapA(index)
    setTrackMapB(index)
    if (apiARef.current?.score) {
      renderTrackOnApi(apiARef.current, index)
    }
    if (apiBRef.current?.score) {
      renderTrackOnApi(apiBRef.current, index)
    }
  }, [])

  const handleTrackMapChange = useCallback((side: 'A' | 'B', index: number) => {
    if (side === 'A') {
      setTrackMapA(index)
      if (apiARef.current?.score) {
        renderTrackOnApi(apiARef.current, index)
      }
    } else {
      setTrackMapB(index)
      if (apiBRef.current?.score) {
        renderTrackOnApi(apiBRef.current, index)
      }
    }
  }, [])

  return (
    <div className="h-screen w-screen flex flex-col bg-white">
      <header className="h-14 flex items-center justify-between px-5 bg-chrome-bg border-b border-chrome-border shadow-header theme-transition">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold tracking-tight text-chrome-text">
            <span className="text-chrome-accent">Riff</span><span className="text-chrome-text-muted">-</span>Diff
          </h1>
          <DiffFilterBar
            filters={filters}
            onFiltersChange={setFilters}
            summary={diffResult?.summary ?? null}
          />
        </div>
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg text-chrome-text-muted hover:bg-chrome-bg-subtle hover:text-chrome-text transition-colors"
          aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        >
          {theme === 'light' ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
            </svg>
          )}
        </button>
      </header>
      <TrackToolbar
        tracksA={tracksA}
        tracksB={tracksB}
        selectedTrackIndex={selectedTrackIndex}
        trackMapA={trackMapA}
        trackMapB={trackMapB}
        onTrackChange={handleTrackChange}
        onTrackMapChange={handleTrackMapChange}
      />
      <main className="flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="flex-1 min-h-0">
        <SplitPane
          top={
            <div className="flex flex-col h-full">
              <PaneHeader
                side="A"
                fileName={fileA.fileData?.fileName ?? null}
                error={fileA.error}
                isLoading={fileA.isLoading}
                onOpenFile={fileA.openFilePicker}
              />
              <div className="flex-1 overflow-hidden">
                {fileA.fileData ? (
                  <AlphaTabPane
                    ref={paneARef}
                    buffer={fileA.fileData.buffer}
                    onRenderFinished={handleRenderFinishedA}
                    onScoreLoaded={handleScoreLoadedA}
                  >
                    <DiffOverlay
                      diffResult={diffResult}
                      side="A"
                      api={apiARef.current}
                      renderKey={renderKeyA}
                      filters={filters}
                    />
                  </AlphaTabPane>
                ) : (
                  <EmptyPane side="A" onOpenFile={fileA.openFilePicker} isLoading={fileA.isLoading} />
                )}
              </div>
            </div>
          }
          bottom={
            <div className="flex flex-col h-full">
              <PaneHeader
                side="B"
                fileName={fileB.fileData?.fileName ?? null}
                error={fileB.error}
                isLoading={fileB.isLoading}
                onOpenFile={fileB.openFilePicker}
              />
              <div className="flex-1 overflow-hidden">
                {fileB.fileData ? (
                  <AlphaTabPane
                    ref={paneBRef}
                    buffer={fileB.fileData.buffer}
                    onRenderFinished={handleRenderFinishedB}
                    onScoreLoaded={handleScoreLoadedB}
                  >
                    <DiffOverlay
                      diffResult={diffResult}
                      side="B"
                      api={apiBRef.current}
                      renderKey={renderKeyB}
                      filters={filters}
                    />
                  </AlphaTabPane>
                ) : (
                  <EmptyPane side="B" onOpenFile={fileB.openFilePicker} isLoading={fileB.isLoading} />
                )}
              </div>
            </div>
          }
        />
        </div>
        <div className="bg-chrome-bg border-t border-chrome-border theme-transition">
          <DiffMinimap
            diffResult={diffResult}
            filters={filters}
            scrollbarEl={scrollbarEl}
          />
          {(scrollWidthA > 0 || scrollWidthB > 0) && (
            <div
              ref={setScrollbarEl}
              className="scrollbar-always-visible overflow-y-hidden shrink-0"
            >
              <div style={{ width: Math.max(scrollWidthA, scrollWidthB), height: 1 }} />
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default App
