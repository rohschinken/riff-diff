import { useCallback, useEffect, useRef, useState } from 'react'
import { AlphaTabApi } from '@coderline/alphatab'
import type { model } from '@coderline/alphatab'

type Score = model.Score
import { SplitPane } from './components/SplitPane'
import { TrackToolbar, TrackInfo } from './components/TrackToolbar'
import { AlphaTabPane } from './renderer/AlphaTabPane'
import type { AlphaTabPaneHandle } from './renderer/AlphaTabPane'
import { DiffOverlay } from './renderer/DiffOverlay'
import type { ComparisonMode } from './renderer/DiffOverlay'
import { DiffMinimap } from './components/DiffMinimap'
import { DiffFilterBar } from './components/DiffFilterBar'
import { useFileLoader } from './hooks/useFileLoader'
import { useSyncScroll } from './hooks/useSyncScroll'
import { useTheme } from './hooks/useTheme'
import { useNotationToggle } from './hooks/useNotationToggle'
import { useDropZone } from './hooks/useDropZone'
import { useZoom } from './hooks/useZoom'
import { LoadingOverlay } from './components/LoadingOverlay'
import { MetadataOverlay } from './components/MetadataOverlay'
import { forceStaveVisibility } from './forceStaveVisibility'
import { diffScores } from './diff/diffEngine'
import { extractBarPairs, computePhantomPositions, insertPhantomBars, removePhantomBars } from './diff/phantomBars'
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


function renderTrackOnApi(api: AlphaTabApi, trackIndex: number) {
  const track = api.score?.tracks[trackIndex]
  if (track) api.renderTracks([track])
}

function App() {
  const fileA = useFileLoader()
  const fileB = useFileLoader()
  const { theme, toggleTheme } = useTheme()
  const { showNotation, toggleNotation } = useNotationToggle()
  const showNotationRef = useRef(showNotation)
  showNotationRef.current = showNotation

  const dropA = useDropZone(fileA.loadFromFile)
  const dropB = useDropZone(fileB.loadFromFile)
  const { zoomLevel, zoomIn, zoomOut, resetZoom, canZoomIn, canZoomOut } = useZoom()

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
  const prevPhantomsARef = useRef<number[]>([])
  const prevPhantomsBRef = useRef<number[]>([])
  const [renderKeyA, setRenderKeyA] = useState(0)
  const [renderKeyB, setRenderKeyB] = useState(0)
  const [isRenderingA, setIsRenderingA] = useState(false)
  const [isRenderingB, setIsRenderingB] = useState(false)
  const [filters, setFilters] = useState<DiffFilters>(() => {
    try {
      const stored = localStorage.getItem('riff-diff-filters')
      if (stored) {
        const parsed = JSON.parse(stored)
        // Validate shape matches DiffFilters
        if (
          typeof parsed.showAddedRemoved === 'boolean' &&
          typeof parsed.showChanged === 'boolean' &&
          typeof parsed.showTempoTimeSig === 'boolean'
        ) {
          return parsed as DiffFilters
        }
      }
    } catch { /* ignore */ }
    return DEFAULT_DIFF_FILTERS
  })
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>('aToB')
  const [showMetadata, setShowMetadata] = useState(false)
  const [barWidthOffset, setBarWidthOffset] = useState(0)
  const barWidthOffsetRef = useRef(barWidthOffset)
  barWidthOffsetRef.current = barWidthOffset

  const [scrollElA, setScrollElA] = useState<HTMLElement | null>(null)
  const [scrollElB, setScrollElB] = useState<HTMLElement | null>(null)
  const [scrollWidthA, setScrollWidthA] = useState(0)
  const [scrollWidthB, setScrollWidthB] = useState(0)
  const [scrollbarEl, setScrollbarEl] = useState<HTMLDivElement | null>(null)
  const scrollFractionRef = useRef<number | null>(null)
  const prevZoomRef = useRef(zoomLevel)

  // Persist filter state to localStorage
  useEffect(() => {
    localStorage.setItem('riff-diff-filters', JSON.stringify(filters))
  }, [filters])

  // Capture scroll fraction synchronously when zoom changes (before effects fire)
  if (zoomLevel !== prevZoomRef.current) {
    prevZoomRef.current = zoomLevel
    if (scrollbarEl) {
      const maxScroll = scrollbarEl.scrollWidth - scrollbarEl.clientWidth
      scrollFractionRef.current = maxScroll > 0 ? scrollbarEl.scrollLeft / maxScroll : 0
    }
  }

  const handleRenderStartedA = useCallback(() => { setIsRenderingA(true) }, [])
  const handleRenderStartedB = useCallback(() => { setIsRenderingB(true) }, [])

  const [barWidthsA, setBarWidthsA] = useState<number[]>([])
  const [barWidthsB, setBarWidthsB] = useState<number[]>([])

  const handleRenderFinishedA = useCallback((api: AlphaTabApi, contentWidth: number, barWidths: number[]) => {
    apiARef.current = api
    setIsRenderingA(false)
    setRenderKeyA((prev) => prev + 1)
    const el = paneARef.current?.getScrollContainer() ?? null
    setScrollElA(el)
    setScrollWidthA(contentWidth)
    // Only update base bar widths when no manual offset is active;
    // otherwise the adjusted widths feed back into autoBarWidth causing a loop.
    if (barWidthOffsetRef.current === 0) {
      setBarWidthsA(barWidths)
    }
  }, [])

  const handleRenderFinishedB = useCallback((api: AlphaTabApi, contentWidth: number, barWidths: number[]) => {
    apiBRef.current = api
    setIsRenderingB(false)
    setRenderKeyB((prev) => prev + 1)
    const el = paneBRef.current?.getScrollContainer() ?? null
    setScrollElB(el)
    setScrollWidthB(contentWidth)
    if (barWidthOffsetRef.current === 0) {
      setBarWidthsB(barWidths)
    }
  }, [])

  const handleScoreLoadedA = useCallback((score: Score) => {
    forceStaveVisibility(score, showNotationRef.current)
    scoreARef.current = score
    // Clear stale phantom state — the old score's phantom positions are invalid
    // for the new score and would corrupt it by removing real bars.
    prevPhantomsARef.current = []
    pendingPhantomsRef.current = null
    // Mark as rendering immediately — the actual renderStarted event arrives
    // asynchronously (separate worker message), so without this guard the
    // phantom insertion effect could run before isRenderingA becomes true.
    setIsRenderingA(true)
    setTracksA(extractTracks(score))
    setSelectedTrackIndex(0)
    setTrackMapA(0)
    setDiffResult(null)
  }, [])

  const handleScoreLoadedB = useCallback((score: Score) => {
    forceStaveVisibility(score, showNotationRef.current)
    scoreBRef.current = score
    prevPhantomsBRef.current = []
    pendingPhantomsRef.current = null
    setIsRenderingB(true)
    setTracksB(extractTracks(score))
    setTrackMapB(0)
    setDiffResult(null)
  }, [])

  // Clear scroll state when files are unloaded
  useEffect(() => {
    if (!fileA.fileData) {
      setScrollElA(null)
      setScrollWidthA(0)
      setBarWidthsA([])
    }
  }, [fileA.fileData])

  useEffect(() => {
    if (!fileB.fileData) {
      setScrollElB(null)
      setScrollWidthB(0)
      setBarWidthsB([])
    }
  }, [fileB.fileData])

  // Compute uniform bar width: max across all bars in both panels + manual offset
  const autoBarWidth = barWidthsA.length > 0 && barWidthsB.length > 0
    ? Math.max(...barWidthsA, ...barWidthsB)
    : null
  const uniformBarWidth = autoBarWidth !== null
    ? Math.max(20, autoBarWidth + barWidthOffset)
    : null

  useSyncScroll(scrollElA, scrollElB, scrollbarEl)

  // Restore scroll fraction after zoom causes re-render (scrollWidth changes)
  useEffect(() => {
    if (scrollFractionRef.current !== null && scrollbarEl) {
      const maxScroll = scrollbarEl.scrollWidth - scrollbarEl.clientWidth
      scrollbarEl.scrollLeft = scrollFractionRef.current * maxScroll
      scrollFractionRef.current = null
    }
  }, [scrollWidthA, scrollWidthB, scrollbarEl])

  // Keyboard shortcuts for zoom
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      if (e.key === '=' || e.key === '+') {
        e.preventDefault()
        zoomIn()
      } else if (e.key === '-') {
        e.preventDefault()
        zoomOut()
      } else if (e.key === '0') {
        e.preventDefault()
        resetZoom()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [zoomIn, zoomOut, resetZoom])

  // Re-apply stave visibility and re-render when notation toggle changes
  useEffect(() => {
    if (scoreARef.current) {
      forceStaveVisibility(scoreARef.current, showNotation)
      if (apiARef.current) renderTrackOnApi(apiARef.current, trackMapA)
    }
    if (scoreBRef.current) {
      forceStaveVisibility(scoreBRef.current, showNotation)
      if (apiBRef.current) renderTrackOnApi(apiBRef.current, trackMapB)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showNotation])

  // Pending phantom positions: computed in diff effect, applied when panes are idle.
  // rerenderA/B flags track whether a pane's score was mutated (phantom removal)
  // and needs a re-render even if no new phantoms are being inserted.
  const pendingPhantomsRef = useRef<{
    posA: number[]; posB: number[]; result: DiffResult
    rerenderA: boolean; rerenderB: boolean
  } | null>(null)

  // Compute diff when both scores are loaded or track selection changes
  useEffect(() => {
    const scoreA = scoreARef.current
    const scoreB = scoreBRef.current
    if (!scoreA || !scoreB) {
      setDiffResult(null)
      pendingPhantomsRef.current = null
      prevPhantomsARef.current = []
      prevPhantomsBRef.current = []
      return
    }

    // Strip any previously inserted phantom bars before re-diffing.
    // Track which scores were mutated so the insertion effect knows
    // to re-render those panes even if no new phantoms are needed.
    let removedFromA = false
    let removedFromB = false
    if (prevPhantomsARef.current.length > 0) {
      removePhantomBars(scoreA, prevPhantomsARef.current)
      prevPhantomsARef.current = []
      removedFromA = true
    }
    if (prevPhantomsBRef.current.length > 0) {
      removePhantomBars(scoreB, prevPhantomsBRef.current)
      prevPhantomsBRef.current = []
      removedFromB = true
    }

    // Compute diff on original (phantom-free) scores
    const result = diffScores(scoreA, scoreB, trackMapA, trackMapB)
    setDiffResult(result)

    // Compute phantom positions but don't insert yet — wait for panes to be idle
    const barPairs = extractBarPairs(result.measures)
    const { phantomsA: posA, phantomsB: posB } = computePhantomPositions(barPairs)

    const needsWork = posA.length > 0 || posB.length > 0 || removedFromA || removedFromB
    if (needsWork) {
      pendingPhantomsRef.current = {
        posA, posB, result,
        rerenderA: posA.length > 0 || removedFromA,
        rerenderB: posB.length > 0 || removedFromB,
      }
    } else {
      pendingPhantomsRef.current = null
    }
  }, [trackMapA, trackMapB, tracksA, tracksB])

  // Insert phantom bars only when both panes are idle (not mid-render).
  // This avoids mutating the score while alphaTab's worker is still
  // deserializing bounds from a previous render.
  useEffect(() => {
    if (isRenderingA || isRenderingB) return
    const pending = pendingPhantomsRef.current
    if (!pending) return
    pendingPhantomsRef.current = null

    const scoreA = scoreARef.current
    const scoreB = scoreBRef.current
    if (!scoreA || !scoreB) return

    const { posA, posB, rerenderA, rerenderB } = pending

    insertPhantomBars(scoreA, posA)
    insertPhantomBars(scoreB, posB)

    prevPhantomsARef.current = posA
    prevPhantomsBRef.current = posB

    // Re-render panes whose scores were modified (phantom removal or insertion)
    if (rerenderA && apiARef.current) {
      const track = apiARef.current.score?.tracks[trackMapA]
      if (track) apiARef.current.renderTracks([track])
    }
    if (rerenderB && apiBRef.current) {
      const track = apiBRef.current.score?.tracks[trackMapB]
      if (track) apiBRef.current.renderTracks([track])
    }
  }, [isRenderingA, isRenderingB, trackMapA, trackMapB])

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
          <span className="text-[10px] text-chrome-text-muted/50 font-medium -ml-2">v{__APP_VERSION__}</span>
          <DiffFilterBar
            filters={filters}
            onFiltersChange={setFilters}
            summary={diffResult?.summary ?? null}
          />
          <div className="h-5 w-px bg-chrome-border mx-2" />
          <div className="flex items-center gap-1">
            <span
              className="text-xs font-semibold text-chrome-text-muted tabular-nums"
              data-testid="comparison-direction-label"
            >
              {comparisonMode === 'aToB' ? 'A \u2192 B' : 'B \u2192 A'}
            </span>
            <button
              data-testid="comparison-swap"
              onClick={() => setComparisonMode((m) => m === 'aToB' ? 'bToA' : 'aToB')}
              title={comparisonMode === 'aToB' ? 'A is original — click to swap' : 'B is original — click to swap'}
              className="p-1 rounded text-chrome-text-muted hover:bg-chrome-bg-subtle hover:text-chrome-text transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-0.5 mr-2" data-testid="bar-width-controls">
            <span className="text-[10px] text-chrome-text-muted mr-0.5">Bar</span>
            <button
              onClick={() => setBarWidthOffset((o) => o - 25)}
              disabled={autoBarWidth === null || autoBarWidth + barWidthOffset - 25 < 20}
              className="p-1.5 rounded text-chrome-text-muted hover:bg-chrome-bg-subtle hover:text-chrome-text transition-colors disabled:opacity-30 disabled:cursor-default"
              aria-label="Decrease bar width"
              title="Decrease bar width"
              data-testid="bar-width-decrease"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
              </svg>
            </button>
            <button
              onClick={() => setBarWidthOffset(0)}
              disabled={barWidthOffset === 0}
              className="text-[10px] font-medium text-chrome-text-muted hover:text-chrome-text tabular-nums min-w-[2.5rem] text-center disabled:opacity-50"
              title="Reset bar width to auto"
              data-testid="bar-width-reset"
            >
              {barWidthOffset === 0 ? 'Auto' : `${barWidthOffset > 0 ? '+' : ''}${barWidthOffset}`}
            </button>
            <button
              onClick={() => setBarWidthOffset((o) => o + 25)}
              disabled={autoBarWidth === null}
              className="p-1.5 rounded text-chrome-text-muted hover:bg-chrome-bg-subtle hover:text-chrome-text transition-colors disabled:opacity-30 disabled:cursor-default"
              aria-label="Increase bar width"
              title="Increase bar width"
              data-testid="bar-width-increase"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14" />
              </svg>
            </button>
          </div>
          <div className="h-5 w-px bg-chrome-border" />
          <div className="flex items-center gap-0.5 mr-2">
            <button
              onClick={zoomOut}
              disabled={!canZoomOut}
              className="p-1.5 rounded text-chrome-text-muted hover:bg-chrome-bg-subtle hover:text-chrome-text transition-colors disabled:opacity-30 disabled:cursor-default"
              aria-label="Zoom out"
              title="Zoom out (Ctrl+-)"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
              </svg>
            </button>
            <button
              onClick={resetZoom}
              className="text-xs font-medium text-chrome-text-muted hover:text-chrome-text tabular-nums min-w-[3rem] text-center"
              title="Reset zoom (Ctrl+0)"
            >
              {Math.round(zoomLevel * 100)}%
            </button>
            <button
              onClick={zoomIn}
              disabled={!canZoomIn}
              className="p-1.5 rounded text-chrome-text-muted hover:bg-chrome-bg-subtle hover:text-chrome-text transition-colors disabled:opacity-30 disabled:cursor-default"
              aria-label="Zoom in"
              title="Zoom in (Ctrl++)"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14" />
              </svg>
            </button>
          </div>
          <div className="h-5 w-px bg-chrome-border" />
          <button
            onClick={toggleNotation}
            className={`p-2 rounded-lg transition-colors ${showNotation ? 'text-chrome-text-muted hover:bg-chrome-bg-subtle hover:text-chrome-text' : 'text-chrome-text-muted/40 hover:bg-chrome-bg-subtle hover:text-chrome-text-muted'}`}
            aria-label={showNotation ? 'Hide standard notation' : 'Show standard notation'}
            title={showNotation ? 'Hide standard notation' : 'Show standard notation'}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              {/* Eighth note: oval notehead + stem + flag */}
              <ellipse cx="9" cy="17" rx="3.5" ry="2.5" fill="currentColor" stroke="none" transform="rotate(-15 9 17)" />
              <line x1="12.2" y1="15.2" x2="12.2" y2="4" strokeWidth={1.8} strokeLinecap="round" />
              <path d="M12.2 4 C14 6, 16 8, 15 11" strokeWidth={1.5} strokeLinecap="round" fill="none" />
              {!showNotation && (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2 2l20 20" />
              )}
            </svg>
          </button>
          <button
            data-testid="metadata-toggle"
            onClick={() => setShowMetadata((v) => !v)}
            disabled={!scoreARef.current && !scoreBRef.current}
            className={`p-2 rounded-lg transition-colors ${showMetadata ? 'text-chrome-accent hover:bg-chrome-bg-subtle' : 'text-chrome-text-muted hover:bg-chrome-bg-subtle hover:text-chrome-text'} disabled:opacity-30 disabled:cursor-default`}
            aria-label="Toggle file metadata comparison"
            title="File metadata comparison"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
          </button>
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
          <a
            href="https://github.com/rohschinken/riff-diff"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg text-chrome-text-muted hover:bg-chrome-bg-subtle hover:text-chrome-text transition-colors"
            aria-label="About Riff-Diff on GitHub"
            title="About Riff-Diff on GitHub"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
            </svg>
          </a>
        </div>
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
            <div className="flex flex-col h-full relative" {...dropA.dropHandlers}>
              <PaneHeader
                side="A"
                fileName={fileA.fileData?.fileName ?? null}
                error={fileA.error}
                isLoading={fileA.isLoading}
                onOpenFile={fileA.openFilePicker}
              />
              <div className="flex-1 overflow-hidden relative">
                {fileA.fileData ? (
                  <AlphaTabPane
                    ref={paneARef}
                    buffer={fileA.fileData.buffer}
                    scale={zoomLevel}
                    uniformBarWidth={uniformBarWidth}
                    onRenderStarted={handleRenderStartedA}
                    onRenderFinished={handleRenderFinishedA}
                    onScoreLoaded={handleScoreLoadedA}
                  >
                    <DiffOverlay
                      diffResult={comparisonMode === 'aToB' ? null : diffResult}
                      side="A"
                      api={apiARef.current}
                      renderKey={renderKeyA}
                      filters={filters}
                      comparisonMode={comparisonMode}
                    />
                  </AlphaTabPane>
                ) : (
                  <EmptyPane side="A" onOpenFile={fileA.openFilePicker} isLoading={fileA.isLoading} />
                )}
                <LoadingOverlay visible={fileA.isLoading || isRenderingA} testId="loading-overlay-A" />
              </div>
              {dropA.isDragOver && (
                <div className="absolute inset-0 top-10 z-50 flex items-center justify-center bg-chrome-accent/10 border-2 border-dashed border-chrome-accent rounded-lg pointer-events-none" data-testid="drop-overlay-A">
                  <span className="text-chrome-accent font-semibold text-sm">Drop GP file here</span>
                </div>
              )}
            </div>
          }
          bottom={
            <div className="flex flex-col h-full relative" {...dropB.dropHandlers}>
              <PaneHeader
                side="B"
                fileName={fileB.fileData?.fileName ?? null}
                error={fileB.error}
                isLoading={fileB.isLoading}
                onOpenFile={fileB.openFilePicker}
              />
              <div className="flex-1 overflow-hidden relative">
                {fileB.fileData ? (
                  <AlphaTabPane
                    ref={paneBRef}
                    buffer={fileB.fileData.buffer}
                    scale={zoomLevel}
                    uniformBarWidth={uniformBarWidth}
                    onRenderStarted={handleRenderStartedB}
                    onRenderFinished={handleRenderFinishedB}
                    onScoreLoaded={handleScoreLoadedB}
                  >
                    <DiffOverlay
                      diffResult={comparisonMode === 'bToA' ? null : diffResult}
                      side="B"
                      api={apiBRef.current}
                      renderKey={renderKeyB}
                      filters={filters}
                      comparisonMode={comparisonMode}
                    />
                  </AlphaTabPane>
                ) : (
                  <EmptyPane side="B" onOpenFile={fileB.openFilePicker} isLoading={fileB.isLoading} />
                )}
                <LoadingOverlay visible={fileB.isLoading || isRenderingB} testId="loading-overlay-B" />
              </div>
              {dropB.isDragOver && (
                <div className="absolute inset-0 top-10 z-50 flex items-center justify-center bg-chrome-accent/10 border-2 border-dashed border-chrome-accent rounded-lg pointer-events-none" data-testid="drop-overlay-B">
                  <span className="text-chrome-accent font-semibold text-sm">Drop GP file here</span>
                </div>
              )}
            </div>
          }
        />
        </div>
        <div className="bg-chrome-bg border-t border-chrome-border theme-transition">
          <DiffMinimap
            diffResult={diffResult}
            filters={filters}
            scrollbarEl={scrollbarEl}
            contentWidth={Math.max(scrollWidthA, scrollWidthB)}
            comparisonMode={comparisonMode}
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
      {showMetadata && (
        <MetadataOverlay
          scoreA={scoreARef.current}
          scoreB={scoreBRef.current}
          onClose={() => setShowMetadata(false)}
        />
      )}
    </div>
  )
}

export default App
