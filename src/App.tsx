import { useCallback, useEffect, useRef, useState } from 'react'
import { AlphaTabApi } from '@coderline/alphatab'
import type { model } from '@coderline/alphatab'

type Score = model.Score
import { SplitPane } from './components/SplitPane'
import { TrackToolbar, TrackInfo } from './components/TrackToolbar'
import { AlphaTabPane } from './renderer/AlphaTabPane'
import type { AlphaTabPaneHandle } from './renderer/AlphaTabPane'
import { DiffOverlay } from './renderer/DiffOverlay'
import { useFileLoader } from './hooks/useFileLoader'
import { useSyncScroll } from './hooks/useSyncScroll'
import { diffScores } from './diff/diffEngine'
import { DEFAULT_DIFF_FILTERS } from './diff/types'
import type { DiffResult, DiffFilters } from './diff/types'

function EmptyPane({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-full text-gray-400">
      <p className="text-lg">{label}</p>
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
  api.renderTracks([api.score!.tracks[trackIndex]])
}

function App() {
  const fileA = useFileLoader()
  const fileB = useFileLoader()

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
  const [filters] = useState<DiffFilters>(DEFAULT_DIFF_FILTERS)

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
      <header className="h-12 flex items-center px-4 border-b border-gray-200">
        <h1 className="text-lg font-semibold text-gray-800">Riff-Diff</h1>
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
              <div className="h-8 flex items-center px-3 border-b border-gray-200 gap-2">
                <button
                  onClick={fileA.openFilePicker}
                  className="text-sm px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                  disabled={fileA.isLoading}
                >
                  {fileA.isLoading ? 'Loading…' : 'Open File A'}
                </button>
                {fileA.fileData && (
                  <span className="text-sm text-gray-600 truncate">{fileA.fileData.fileName}</span>
                )}
                {fileA.error && (
                  <span className="text-sm text-red-600 truncate">{fileA.error}</span>
                )}
              </div>
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
                  <EmptyPane label="File A — click 'Open File A' to load" />
                )}
              </div>
            </div>
          }
          bottom={
            <div className="flex flex-col h-full">
              <div className="h-8 flex items-center px-3 border-b border-gray-200 gap-2">
                <button
                  onClick={fileB.openFilePicker}
                  className="text-sm px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                  disabled={fileB.isLoading}
                >
                  {fileB.isLoading ? 'Loading…' : 'Open File B'}
                </button>
                {fileB.fileData && (
                  <span className="text-sm text-gray-600 truncate">{fileB.fileData.fileName}</span>
                )}
                {fileB.error && (
                  <span className="text-sm text-red-600 truncate">{fileB.error}</span>
                )}
              </div>
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
                  <EmptyPane label="File B — click 'Open File B' to load" />
                )}
              </div>
            </div>
          }
        />
        </div>
        {(scrollWidthA > 0 || scrollWidthB > 0) && (
          <div
            ref={setScrollbarEl}
            className="overflow-x-auto overflow-y-hidden shrink-0"
            style={{ height: 16 }}
          >
            <div style={{ width: Math.max(scrollWidthA, scrollWidthB), height: 1 }} />
          </div>
        )}
      </main>
    </div>
  )
}

export default App
