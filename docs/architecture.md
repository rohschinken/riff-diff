# Riff-Diff — Architecture & Design Decisions

A cross-platform visual diff tool for Guitar Pro 7/8 (`.gp`, `.gp7`, `.gp8`) files. Load two versions of a song and see exactly what changed — notes, tempo, time signatures — highlighted directly on the sheet music and tablature.

**Stack:** React 19 · TypeScript · Vite · Tailwind v4 · alphaTab 1.8 · Vitest (happy-dom) · Tauri v2.

---

## Scope

- Only `.gp`, `.gp7`, `.gp8` files. GP5/GP6 are excluded.
- Out of scope (blocked): audio/MIDI playback, server-side processing, JSZip (alphaTab parses GP natively).
- **Percussion drum tab notation is not possible** — an alphaTab limitation. `Staff.finish()` clears `stringTuning.tunings` and forces `showTablature = false`; standard percussion notation works via `showStandardNotation = true`.

---

## alphaTab Integration

### API
- `api.load(buffer)` — the method is just `load()`, not `loadSong()`.
- Events use `.on()`: `api.postRenderFinished.on(handler)` returns an unsubscribe fn. Prefer `postRenderFinished` (fires after DOM fully updated) over `renderFinished`.
- `scoreLoaded` is an `IEventEmitterOfT<Score>` that fires with the parsed Score after `api.load()`.
- `api.renderTracks([track])` takes Track **objects**, not indices: `api.renderTracks([api.score!.tracks[i]])`.
- Player disabled: `settings.player.enablePlayer = false; settings.player.enableCursor = false`.
- Layout: `settings.display.layoutMode = LayoutMode.Horizontal`. Do **not** set `staveProfile` — use `Default` to support percussion tracks.

### Type imports (critical)
Model types (`Score`, `Beat`, `Note`, `MasterBar`, …) are only available via the `model` namespace:

```typescript
import type { model } from '@coderline/alphatab'
type Score = model.Score
```

Direct `import { Score } from '@coderline/alphatab'` fails `tsc -b`.

### Assets (worker + fonts)
- Copy `alphaTab.worker.mjs` + `alphaTab.core.mjs` (the engine, ~3.1 MB; the worker imports it as a sibling) to **both** `public/` and `public/assets/`. Production bundles resolve the worker via `import.meta.url` relative to `/assets/`.
- Copy the Bravura font to `public/font/` and set `core.fontDirectory: '/font/'` explicitly (auto-detection resolves to `/assets/font/` in production).
- `settings.core.scriptFile = '/alphaTab.worker.mjs'`.

### forceStaveVisibility()
GP files store per-staff view prefs that vary between files/tracks. Diffing needs consistent rendering, so call this after every `scoreLoaded`:

```typescript
function forceStaveVisibility(score: Score, showNotation: boolean) {
  for (const track of score.tracks)
    for (const staff of track.staves) {
      staff.showStandardNotation = staff.isPercussion ? true : showNotation
      staff.showTablature = true
    }
}
```

Without this, percussion tracks produce zero renderers → crash (`Cannot read properties of undefined (reading 'staves')` at `StaffSystem.addBars`).

### Known alphaTab pitfalls
- `boundsLookup.findBeats(beat)` returns `null` (not `[]`) for missing beats — guard with `?? []`. It also returns duplicates (one per voice/staff) — deduplicate by position key.
- alphaTab does **not** create an `.at-viewport` element; it creates only `.at-surface` inside the container div. The container (with `overflow-auto`) is the scrollable element.
- `updateSettings()` + immediate `renderTracks()` can crash — set staff visibility flags on the Score before the initial render instead.
- Both `api.load()` and `renderTracks()` serialize the Score to JSON for the worker — mutations (e.g. `forceStaveVisibility`) must happen in the `scoreLoaded` handler.

---

## Diff Engine (`src/diff/`)

Pure functions, zero React/DOM dependencies.

### Bar alignment — Needleman-Wunsch (similarity, not binary LCS)
- `barSimilarity()` scores 0.0–1.0 between bars via beat-level LCS (identical = 1.0, similar ≈ 0.8, different = 0.0).
- `barAlignmentTable()` builds a DP table accumulating best cumulative similarity; backtracking prefers pairing (diagonal) when its score is ≥ skipping.
- **Why:** binary LCS treats "almost identical" bars the same as completely different (both 0), so repeated content could produce shifted alignments with more exact matches at wrong positions. Similarity scoring makes positional alignment win.
- Global bar signatures merge **all tracks**, so structural alignment (bars added/removed) is track-independent.

### Beat alignment — LCS
- Beat signatures: `${duration}|${notes}` with notes sorted for order-independence; percussion uses `P:${percussionArticulation}`.
- LCS prevents cascading mismatches when beats are inserted/removed mid-measure.
- Changed beats get note-level diffs (mapped by note signature).
- Tempo is resolved by walking back through `masterBar.tempoAutomations`; time signatures compared per measure.

### Phantom bars (`src/diff/phantomBars.ts`)
- Insertion (deferred) so added/removed measures align visually between panes.
- Must maintain correct `previousBar`/`nextBar` chains, `masterBar` indices, and **voice counts matching adjacent bars** (alphaTab's internal `_chain()` traverses `bar.nextBar.voices[index]` — voice-count mismatch crashes with `nextVoice is undefined`).
- **Deferred insertion:** phantoms are computed in the diff effect and applied only when both panes are idle, plus a global `window.addEventListener('error', …)` suppressing residual stale-render errors from alphaTab's async worker (`.bind(this)` in the alphaTab constructor prevents monkeypatching).

### Diff types (`src/diff/types.ts`)
```typescript
type BeatStatus = 'equal' | 'added' | 'removed' | 'changed'
interface DiffFilters { showAddedRemoved: boolean; showChanged: boolean; showTempoTimeSig: boolean }
interface MeasureDiff {
  measureIndexA: number | null  // null = added bar (only in B)
  measureIndexB: number | null  // null = removed bar (only in A)
  beatDiffs: BeatDiff[]
  tempoDiff: { tempoA: number; tempoB: number } | null
  timeSigDiff: { sigA: string; sigB: string } | null
}
interface DiffResult {
  measures: MeasureDiff[]
  summary: { equal; added; removed; changed; addedBars; removedBars; tempoChanges; timeSigChanges; totalMeasures }
}
```

---

## Rendering & Overlay

### Colors
Centralized in `src/diff/colors.ts` — single source of truth shared by the overlay, minimap, and filter pills. Palette: added `#22c55e`, removed `#ef4444`, changed `#eab308`, meta/tempo `#6366f1`, equal `#374151`.

### DiffOverlay portal
- Overlay portaled into `.at-surface` (`position:absolute` inside the alphaTab scroll container).
- **Portal lifecycle:** alphaTab clears/rebuilds `.at-surface` children on re-render. Listen to `api.renderStarted` (fires synchronously before the async worker render) and `flushSync(() => setSurfaceEl(null))` to force an immediate portal unmount before alphaTab touches the DOM; re-establish the portal in `postRenderFinished`. Without this, React throws `Node.removeChild: not a child`.
- A `renderKey` counter incremented on each `postRenderFinished` forces overlay recomputation when alphaTab re-renders (track switch, zoom).

### DiffMinimap
- Single shared 28px canvas (not one per pane); colored per measure by worst diff status (`removed > changed > added > equal`).
- Sizes via `ResizeObserver`, never hardcoded canvas width; HiDPI-aware (`devicePixelRatio`).
- Uses PointerEvents with `setPointerCapture` for click/drag seek; writes to `scrollbarEl.scrollLeft`, which the shared scrollbar already propagates.

### Synchronized scrolling
- **One shared bottom scrollbar** (like VS Code), panes have `overflow-x: hidden` — avoids bidirectional-sync loops. `scrollLeft` mirrored as-is; the shorter file's pane just stops at its max.
- `wheel` events with `deltaX !== 0` are forwarded to the scrollbar (`passive: false`); vertical `deltaY` passes through for natural `overflow-y: auto`.
- Callback ref via `useState` (not `useRef`) so the hook re-runs when the element mounts.

### Zoom
- 7 steps (0.25–2.0×), persisted to localStorage; both panes scale together; `settings.display.scale` + `updateSettings()` + `render()`.
- alphaTab sets `.at-surface` width independently of `display.scale` — expand the surface from children's rightmost edge (`offsetLeft + offsetWidth`, +30px padding) after render.
- `container.scrollWidth` is unreliable with `overflow-x: hidden` — read content width from child elements and pass explicitly via callbacks.

---

## State & Architecture

- **No Context/Redux** — all state lives in `App.tsx` via `useState`/`useCallback`; scores are refs (large, identity-stable), `DiffResult` is state.
- Purge prefs decoupled from scores so minimal re-renders.
- Test-first: write failing tests → implement → tests pass. Vitest with happy-dom, co-located tests (`src/**/*.test.{ts,tsx}`).
- Vite config uses `import { defineConfig } from 'vitest/config'` (not `'vite'`); `optimizeDeps.exclude: ['@coderline/alphatab']`; `base` switches to `/riff-diff/` when `GITHUB_PAGES=true`.
- Tailwind v4 is CSS-first: `@import "tailwindcss"` in `index.css`, no config file; theme tokens via `@theme` CSS custom properties (`--color-chrome-*`, `--color-diff-*`) toggled by `data-theme` on `#root`.
- Tauri detection: `Boolean((window as any).__TAURI_INTERNALS__)`.

---

## Desktop (Tauri v2)

- CSP disabled (`csp: null`) — alphaTab uses inline styles, data URIs, worker blobs.
- Window created **programmatically** in `setup()` (empty `windows: []` in config) to inject COOP/COEP headers via `on_web_resource_request` (SharedArrayBuffer requirement for the alphaTab worker).
- Tauri's asset protocol serves `.mjs` as `text/html` — override `Content-Type` to `application/javascript` in `on_web_resource_request` when the request path ends in `.mjs`.
- Build targets: `["deb", "rpm"]`; AppImage excluded (FUSE issues in CI).
- Releases are CI-automated: `.github/workflows/release.yml` builds deb/rpm (Linux), NSIS/MSI (Windows), DMG (macOS Apple Silicon) on every `v*` tag; the release is a draft until published manually. The same workflow deploys the web version to GitHub Pages (`deploy-web` job), so the hosted app only updates per release tag rather than every commit on `main`.
- For per-test Tauri mocks use `vi.doMock`/`vi.doUnmock` (hoisted `vi.mock` only allows one factory per module).

---

## Test Environment Notes

- happy-dom, **not** jsdom (jsdom had CJS/ESM compat issues with `@csstools`).
- happy-dom has no `#root` div — tests needing `getElementById('root')` create it in `beforeEach`.
- `test.globals: true` — do not import `describe`/`it`/`expect`.
- Canvas mocks: `vi.spyOn(HTMLCanvasElement.prototype, 'getContext')`.

---

## Repository Layout

```
public/            alphaTab worker+core, Bravura fonts, favicons, PWA manifest
assets/            App icon + README screenshot
src/
  components/      SplitPane, TrackToolbar, DiffFilterBar, DiffMinimap, LoadingOverlay, PaneHeader, EmptyPane
  diff/            types.ts, colors.ts, diffEngine.ts, phantomBars.ts
  hooks/           useFileLoader, useSyncScroll, useTheme, useDropZone, useZoom, useNotationToggle
  renderer/        AlphaTabPane (alphaTab wrapper + portal), DiffOverlay
  test/setup.ts    @testing-library/jest-dom
scripts/           tauri-build.sh, build-all.sh
docs/              architecture.md (design + decisions), development.md (dev setup + builds)
```