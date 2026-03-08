# Riff-Diff — Claude Code Plan Mode

## Mission
Build **Riff-Diff**: a cross-platform visual diff tool for Guitar Pro 7/8 (`.gp`) files.
Stack: **React 19 + TypeScript + Vite 6 + Tauri v2 + alphaTab 1.8 + Tailwind v4 + Vitest 4**.
Each phase follows strict **test-first execution**: write failing tests → implement → tests pass → phase complete.

---

## Subagents

You will operate as a team of specialist subagents. Invoke each by name when their concern is active. Every phase requires sign-off from the relevant agents before proceeding.

### Lead Engineer
Owns architecture and code quality. Makes all structural decisions. Enforces: no JSZip (alphaTab parses GP natively), no custom SVG renderer, overlay must be `position:absolute` inside the alphaTab scroll container, `DiffFilters` flows as props to both `DiffOverlay` and `DiffMinimap`. Breaks implementation into the smallest working increment possible. Maintains `README.md` (concise, not bloated).

### QA Engineer
Writes **all tests before implementation begins** in each phase. Uses Vitest with happy-dom. Defines acceptance criteria as runnable assertions. A phase is not complete until `npx vitest run` exits 0. Also responsible for edge-case coverage: empty measures, mismatched track counts, identical files, single-note changes.

### UX Engineer
Owns visual design and interaction. Enforces: consistent colour palette (added=`#22c55e`, removed=`#ef4444`, changed=`#eab308`, meta/tempo=`#6366f1`, equal=`#374151` — centralized in `src/diff/colors.ts`), accessible contrast ratios, keyboard-navigable controls, meaningful empty/loading/error states. Reviews every UI component before it ships.

### Musician (Domain Expert)
Validates that the app makes sense to a guitarist. Checks: tab renders with correct string/fret layout (string 1 = high e = top line), measure numbers are visible, tempo and time-sig changes are surfaced clearly, diff colours are intuitive. Raises issues if any musical concept is misrepresented in the UI.

### Product Owner
Enforces scope. Blocks anything outside the spec. Approves the deliverable of each phase before the next begins. Immediately flags: < GP7 support (out of scope), audio playback (out of scope), MIDI playback (out of scope for now).

---

## Critical Technical Constraints
> All agents must respect these. Verified during implementation — corrections from the original spec are noted.

### alphaTab API (verified)
- **`api.load(buffer)`** — NOT `api.loadSong()`. The method is just `load()`.
- **Worker file**: `alphaTab.worker.mjs` (ESM module, not `.js`). Copy from `node_modules/@coderline/alphatab/dist/`. Reference via `settings.core.scriptFile = '/alphaTab.worker.mjs'`. Also copy `alphaTab.core.mjs` (the actual engine, ~3.1MB) — the worker imports it as a sibling. Both must also exist in `public/assets/` for production builds (Vite bundles resolve via `import.meta.url` relative to `/assets/`).
- **Font files**: Bravura music font must be copied to `public/font/`: `cp node_modules/@coderline/alphatab/dist/font/Bravura.{eot,otf,svg,woff,woff2} public/font/`. Must also set `core.fontDirectory: '/font/'` explicitly — alphaTab auto-detects from `import.meta.url` which points to `/assets/` in production bundles.
- **Events use `.on()` pattern**: `api.postRenderFinished.on(handler)` returns an unsubscribe function. Use `postRenderFinished` (no args, fires after DOM fully updated) rather than `renderFinished`.
- **`scoreLoaded`**: `IEventEmitterOfT<Score>` — fires with parsed Score object after `api.load()`.
- **`renderTracks(tracks: Track[])`** — takes an array of Track **objects**, not indices: `api.renderTracks([api.score!.tracks[trackIndex]])`.
- Player disabled: `settings.player.enablePlayer = false; settings.player.enableCursor = false`.
- Layout: `settings.display.layoutMode = LayoutMode.Horizontal`. Do NOT set `staveProfile` — use `Default` (not `Tab` or `TabOnly`) to support percussion tracks.

### alphaTab Type Imports (critical)
Model types (`Score`, `Beat`, `Note`, `MasterBar`, etc.) are NOT directly exported from `@coderline/alphatab`. They are only available via the `model` namespace. **Always use this pattern:**
```typescript
import type { model } from '@coderline/alphatab'
type Score = model.Score
type Beat = model.Beat
// etc.
```
Direct `import { Score } from '@coderline/alphatab'` will fail `tsc -b`.

### GP File View Preferences — Force Override
GP files store per-staff view preferences (`showStandardNotation`, `showTablature`) that vary between files and tracks. Our diff tool needs consistent rendering across both panes. **Always call `forceStaveVisibility(score)` after `scoreLoaded`:**
```typescript
function forceStaveVisibility(score: Score) {
  for (const track of score.tracks) {
    for (const staff of track.staves) {
      staff.showStandardNotation = true
      staff.showTablature = true
    }
  }
}
```
Without this, percussion tracks crash alphaTab (zero renderers → `Cannot read properties of undefined (reading 'staves')` at `StaffSystem.addBars`). The root cause: `TabBarRendererFactory.hideOnPercussionTrack = true` + `showStandardNotation = false` from GP file = zero renderers.

### Percussion / Drum Track Limitations
- Standard percussion notation renders correctly (via `showStandardNotation = true`).
- **Drum tab notation is NOT possible** without alphaTab upstream changes. `Staff.finish()` explicitly clears `stringTuning.tunings = []` and sets `showTablature = false` for percussion. `TabBarRendererFactory` also checks `staff.tuning.length > 0`. Deferred to `TODO.md`.

### Vite / Build Configuration
- **`@coderline/alphatab-vite`** plugin has CJS/ESM interop issues — **skip it**. Use manual worker copy + `optimizeDeps.exclude: ['@coderline/alphatab']`.
- **Vite config**: Use `import { defineConfig } from 'vitest/config'` (NOT `from 'vite'`). The `/// <reference types="vitest" />` directive doesn't work with `tsc -b`.
- **COOP/COEP headers** required for SharedArrayBuffer (alphaTab worker): add to `server.headers` in vite config.
- **Test environment**: `happy-dom` (NOT `jsdom` — jsdom has CJS/ESM compat issues with `@csstools` packages).
- **Tailwind v4**: CSS-first config. Just `@import "tailwindcss"` in `index.css`. No `tailwind.config.js` needed.

### Other Constraints
- Tauri v2 detection: `Boolean((window as any).__TAURI_INTERNALS__)`.
- Tempo/time-sig data lives on `score.masterBars[i]`, not on `Beat`.
- Overlay scroll: `DiffOverlay` wrapper = `position:absolute; top:0; left:0; pointer-events:none; z-index:10` **inside** `.at-viewport`.
- Zoom re-render: `postRenderFinished` fires again after `api.updateSettings() + api.render()` — `DiffOverlay` must recompute `BoundsLookup` inside that handler.
- Minimap uses `ResizeObserver` — never hardcode canvas width.
- File filters: `.gp, .gp7, .gp8` only. GP5 & GP6 excluded.

---

## Dev Environment
- Windows 11, bash shell (Unix syntax — forward slashes, `/dev/null`)
- Node 22.22.0 via nvm
- npm (not yarn/pnpm)
- Rust 1.94.0 via rustup, MSVC build tools via VS 2022 Community

---

## Data Model Reference

```
Score.masterBars[]: MasterBar       ← tempo (via tempoAutomations[]), timeSignatureNumerator/Denominator
Score.tracks[]: Track
  └── staves[0].bars[]: Bar         ← one per measure
        └── voices[0].beats[]: Beat
              ├── duration: Duration (numeric enum)
              ├── dots: number
              ├── isRest: boolean
              ├── hasTuplet: boolean
              ├── tupletNumerator / tupletDenominator: number
              └── notes[]: Note
                    ├── string: number
                    ├── fret: number
                    ├── isPercussion: boolean
                    ├── percussionArticulation: number
                    └── isTieDestination: boolean
```

```typescript
// BoundsLookup (available after postRenderFinished)
api.renderer.boundsLookup.findBeat(beat)          // → { realBounds: {x,y,width,height} }
api.renderer.boundsLookup.masterBarBounds[index]  // → MasterBarBounds
```

---

## Diff Types (implemented in `src/diff/types.ts`)

```typescript
import type { model } from '@coderline/alphatab'
type Beat = model.Beat
type Note = model.Note

export type BeatStatus = 'equal' | 'added' | 'removed' | 'changed'
export interface DiffFilters { showAddedRemoved: boolean; showChanged: boolean; showTempoTimeSig: boolean }
export interface NoteDiff { note: Note; status: 'noteAdded' | 'noteRemoved' | 'noteEqual' }
export interface BeatDiff { beatA: Beat | null; beatB: Beat | null; status: BeatStatus; noteDiffs?: NoteDiff[] }
export interface MeasureDiff {
  measureIndexA: number | null  // null = added bar (only in B)
  measureIndexB: number | null  // null = removed bar (only in A)
  beatDiffs: BeatDiff[]
  tempoDiff: { tempoA: number; tempoB: number } | null
  timeSigDiff: { sigA: string; sigB: string } | null
}
export interface DiffResult {
  measures: MeasureDiff[]
  summary: { equal: number; added: number; removed: number; changed: number; addedBars: number; removedBars: number; tempoChanges: number; timeSigChanges: number; totalMeasures: number }
}
```

---

## Current File Structure

```
riff-diff/
├── public/
│   ├── alphaTab.worker.mjs         (copied from node_modules)
│   ├── alphaTab.worker.min.mjs
│   └── font/
│       └── Bravura.{eot,otf,svg,woff,woff2}
├── assets/
│   ├── riff-diff-favicon-16.png     16×16 favicon source
│   ├── riff-diff-favicon-32.png     32×32 favicon source
│   ├── riff-diff-icon-512.png       512×512 app icon
│   └── riff-diff-wordmark.png       Wordmark logo
├── public/
│   ├── alphaTab.worker.mjs          (copied from node_modules)
│   ├── alphaTab.worker.min.mjs
│   ├── riff-diff-favicon-16.png     16×16 favicon
│   ├── riff-diff-favicon-32.png     32×32 favicon
│   ├── riff-diff-icon-512.png       512×512 app icon
│   ├── riff-diff-wordmark.png       Wordmark logo
│   ├── site.webmanifest              PWA manifest
│   └── font/
│       └── Bravura.{eot,otf,svg,woff,woff2}
├── src/
│   ├── main.tsx                     React entry point
│   ├── App.tsx                      Main app: header, panes, theme toggle, state
│   ├── index.css                    Tailwind + @theme tokens + dark-chrome overrides
│   ├── vite-env.d.ts
│   ├── components/
│   │   ├── SplitPane.tsx            Vertical split (top/bottom) with explicit divider
│   │   ├── SplitPane.test.tsx
│   │   ├── TrackToolbar.tsx         Track tabs + manual mapping dropdowns
│   │   ├── TrackToolbar.test.tsx    8 tests
│   │   ├── DiffFilterBar.tsx        Four colored pill toggle buttons with live counts
│   │   ├── DiffFilterBar.test.tsx   13 tests
│   │   ├── DiffMinimap.tsx          Canvas minimap with shared DIFF_COLORS + contentWidth prop
│   │   ├── DiffMinimap.test.tsx     16 tests
│   │   ├── LoadingOverlay.tsx       Spinner overlay (visible/hidden)
│   │   └── LoadingOverlay.test.tsx  4 tests
│   ├── diff/
│   │   ├── types.ts                 DiffResult, BeatDiff, NoteDiff, MeasureDiff, DiffFilters
│   │   ├── colors.ts               Shared DIFF_COLORS palette (solid, rgb, overlay, ghost)
│   │   ├── diffEngine.ts           diffScores() — similarity-based bar alignment + LCS beat alignment
│   │   ├── diffEngine.test.ts      15 tests
│   │   ├── phantomBars.ts          Phantom bar computation and insertion for visual alignment
│   │   └── phantomBars.test.ts     11 tests
│   ├── hooks/
│   │   ├── useFileLoader.ts         File picker (web + Tauri), extension validation
│   │   ├── useFileLoader.test.ts    14 tests
│   │   ├── useSyncScroll.ts         Shared scrollbar scroll sync hook
│   │   ├── useSyncScroll.test.ts    7 tests
│   │   ├── useTheme.ts             Theme toggle hook (light / dark-chrome)
│   │   ├── useTheme.test.ts        5 tests
│   │   ├── useDropZone.ts          Drag-and-drop hook with enter/leave counter
│   │   ├── useDropZone.test.ts     9 tests
│   │   ├── useZoom.ts              Zoom state with 7 steps, localStorage persistence
│   │   ├── useZoom.test.ts         9 tests
│   │   ├── useNotationToggle.ts    Notation toggle hook with localStorage
│   │   └── useNotationToggle.test.ts 5 tests
│   ├── renderer/
│   │   ├── AlphaTabPane.tsx         alphaTab API wrapper with forwardRef + portal + scale + content width
│   │   ├── AlphaTabPane.test.tsx    18 tests
│   │   ├── DiffOverlay.tsx          Diff overlay with shared DIFF_COLORS, indigo badges
│   │   └── DiffOverlay.test.tsx     18 tests
│   └── test/
│       └── setup.ts                 @testing-library/jest-dom matchers
├── testfiles/                       8 GP test files (gitignored)
├── TODO.md                          Deferred features (drum tab notation)
├── riff-diff-claude-code-plan.md   This file
├── vite.config.ts
├── tsconfig.json                    References tsconfig.app.json + tsconfig.node.json
├── tsconfig.app.json                Strict, ES2020, types: ["vitest/globals", "@testing-library/jest-dom"]
├── tsconfig.node.json               Covers vite.config.ts
└── package.json
```

---

## Phase Completion Status

| Phase | Status | Tests |
|-------|--------|-------|
| 1 Scaffold & Tooling | **COMPLETE** | 11 → grew to 13 (useFileLoader) |
| 2 alphaTab Rendering | **COMPLETE** | +9 → grew to 10 (AlphaTabPane) |
| 3 Dual Pane & Track Switcher | **COMPLETE** | +12 → grew to 11 (TrackToolbar) |
| 4 Diff Engine | **COMPLETE** | +15 (diffEngine) |
| 5 Diff Overlay | **COMPLETE** | +18 (DiffOverlay) |
| 6 Synchronized Scrolling | **COMPLETE** | +7 (useSyncScroll) + 1 (AlphaTabPane) |
| 7 Diff Minimap | **COMPLETE** | +16 (DiffMinimap) |
| 8 Diff Filter Toggles | **COMPLETE** | +13 (DiffFilterBar) |
| 9 UI Polish | **COMPLETE** | +5 (useTheme) |
| 10 Tauri Desktop | **COMPLETE** | +3 (useFileLoader Tauri edge cases) |
| 11 UX Enhancements | **COMPLETE** | +34 (useDropZone 9, useZoom 9, LoadingOverlay 4, AlphaTabPane 3, notation toggle 5, zoom hook 4) |
| 12 Diff Engine Improvements | **COMPLETE** | No new tests (existing 26 diff tests pass) |

**Total: 147 tests passing**, `npm run build` clean, `npm run tauri:build` produces installers.

---

## Phases

Each phase: **QA Engineer writes tests first → Lead Engineer implements → tests pass → UX/Musician/PO sign off → next phase.**

---

### Phase 1 — Scaffold & Tooling ✅ COMPLETE

**What was built:**
- Vite + React + TypeScript scaffold (NOT from `create tauri-app` — done manually since Tauri/Rust deferred)
- `useFileLoader` hook with web `<input type="file">` and Tauri `plugin-dialog`/`plugin-fs` paths
- `<SplitPane>` component (vertical top/bottom split)
- Tailwind v4 via `@tailwindcss/vite` plugin
- Vitest with happy-dom environment

**Key decisions:**
- Scaffolded in current directory (`gp-diff`), not a subdirectory
- happy-dom over jsdom due to CJS/ESM compat issues
- alphaTab Vite plugin skipped, manual worker copy instead

---

### Phase 2 — alphaTab Rendering ✅ COMPLETE

**What was built:**
- `AlphaTabPane.tsx` — mounts alphaTab API on a `ref`, loads buffer via `api.load(buffer)`, fires callbacks on `postRenderFinished` and `scoreLoaded`, calls `api.destroy()` on unmount
- Settings: Horizontal layout, player disabled, no stave profile override

**Key decisions:**
- Uses `postRenderFinished` (fires after DOM fully updated) not `renderFinished`
- `scoreLoaded` event provides parsed Score for track extraction
- Worker file is `.mjs` (ESM), not `.js`
- Font files (Bravura) must be in `public/font/`

---

### Phase 3 — Dual Pane & Track Switcher ✅ COMPLETE

**What was built:**
- Two `<AlphaTabPane>` instances in `App.tsx` (top = File A, bottom = File B)
- `<TrackToolbar>` with track name buttons + manual-mapping `<select>` dropdowns
- Warning badge when track counts differ between files
- `forceStaveVisibility(score)` called on every `scoreLoaded` to ensure consistent rendering
- Track switching via `api.renderTracks([api.score!.tracks[trackIndex]])`

**Key decisions:**
- GP file view preferences completely ignored — always show both standard notation and tablature
- This fixes the percussion crash (zero renderers when both tab and standard notation disabled)
- State is minimal: `selectedTrackIndex`, `trackMapA`, `trackMapB`, track lists, API refs
- No Context/Redux — all state in `App.tsx` with `useState`/`useCallback`

---

### Phase 4 — Diff Engine ✅ COMPLETE

**What was built:**
- `src/diff/types.ts` — All diff type definitions
- `src/diff/diffEngine.ts` — Pure function `diffScores()` with:
  - Beat signatures: `${duration}|${notes}` for comparison, notes sorted for order-independence
  - Percussion support: `P:${percussionArticulation}` in note signatures
  - LCS (Longest Common Subsequence) on beat signature arrays for optimal alignment
  - Note-level diff for `changed` beats (maps by note signature)
  - Tempo resolution: walks backwards through `masterBar.tempoAutomations` to find effective tempo
  - Time signature comparison per measure
  - Summary accumulation across all measures
- `src/diff/diffEngine.test.ts` — 15 tests with mock builders (`mockNote`, `mockBeat`, `mockScore`)

**Key decisions:**
- Pure function, zero side effects, no React/DOM dependency
- Originally aligned measures by index; replaced with bar-level similarity alignment in Phase 12
- LCS prevents cascading mismatches when beats inserted/removed mid-measure
- `diffScores()` NOT yet wired into the UI — that's Phase 5

---

### Phase 5 — Diff Overlay ✅ COMPLETE

**What was built:**
- `DiffOverlay.tsx` — `computeOverlays()` pure function + React component
- `DiffOverlay` portaled into `.at-surface` via `createPortal` with lifecycle managed by `renderStarted`/`postRenderFinished`
- `AlphaTabPane` gained `children` prop for portal injection

**Key decisions:**
- **Portal lifecycle**: `renderStarted` + `flushSync(setSurfaceEl(null))` clears portal before alphaTab modifies DOM on re-render (e.g. track switch), preventing `Node.removeChild` crash. `postRenderFinished` re-establishes the portal.
- **`findBeats()` (plural)** used instead of `findBeat()` (singular) — returns all staff instances (standard notation + tablature), not just first match. Returns `null` not `[]` for missing beats — guarded with `?? []`.
- **Position deduplication**: `findBeats()` returns one entry per voice/staff rendering; multiple voices on the same staff share identical bounds. Deduplicated via `Set<string>` keyed by `(x,y,w,h)` to prevent opacity stacking.
- **Vivid Tailwind colors at 0.25 opacity**: `added=rgba(34,197,94,0.25)`, `removed=rgba(239,68,68,0.25)`, `changed=rgba(234,179,8,0.25)`. Ghost overlays at 0.12. Tempo badge `#d97706`.
- **renderKey pattern**: Counter incremented on each `postRenderFinished`; DiffOverlay's `useMemo` depends on it, forcing overlay recomputation when alphaTab re-renders.
- Scores stored as refs (large, identity-stable), DiffResult as state (drives rendering).

---

### Phase 6 — Synchronized Scrolling ✅ COMPLETE

**What was built:**
- `useSyncScroll(elA, elB, scrollbar)` hook — single shared scrollbar at bottom of window
- `AlphaTabPane` converted to `forwardRef` with `useImperativeHandle` exposing `AlphaTabPaneHandle.getScrollContainer()`
- Shared scrollbar div in `App.tsx` (conditionally rendered, sized to `max(scrollWidthA, scrollWidthB)`)

**Key decisions:**
- **Shared scrollbar (not two-scrollbar sync)**: Single scrollbar at the bottom like VS Code's diff view. Avoids the tricky infinite-loop prevention needed by bidirectional scroll mirroring. Each pane has `overflow-x: hidden` — cannot scroll independently.
- **Horizontal only**: In alphaTab Horizontal layout mode, all measures render in one wide row. Vertical overflow is rare.
- **Absolute pixel positions**: `scrollLeft` mirrored as-is. Shorter file's pane simply stops at its max. Keeps measures pixel-aligned.
- **Wheel event forwarding**: `wheel` events with `deltaX !== 0` on panes are forwarded to the scrollbar div (`passive: false` to `preventDefault`). Vertical `deltaY` passes through for natural `overflow-y: auto` behavior.
- **alphaTab doesn't interfere**: With `enablePlayer: false`, alphaTab never reads/writes scroll CSS on the container. `getScrollContainer()` is never called. Setting `overflow-x: hidden` is safe.
- **Callback ref for scrollbar**: Uses `useState<HTMLDivElement | null>` (not `useRef`) for the scrollbar element, ensuring `useSyncScroll` re-runs when the element mounts.

---

### Phase 7 — Diff Minimap ✅ COMPLETE

**Implementation:** `DiffMinimap.tsx` — 28px-tall `<canvas>` between SplitPane and the shared scrollbar. One stripe per measure, colored by worst diff status (priority: removed > changed > added > equal). Viewport indicator shows visible scroll fraction. Click/drag to seek both panes. `ResizeObserver` redraws on resize. Respects `DiffFilters`.

**Actual decisions:**
- **Single shared minimap** (not two per pane) — diff is per-measure, one minimap is cleaner
- **Canvas rendering** with extracted pure functions (`computeMeasureStatus`, `drawMinimap`) for testability
- **Also acts as scrollbar** — writes directly to `scrollbarEl.scrollLeft`, existing `useSyncScroll` propagates
- **PointerEvents** (not MouseEvents) — unifies mouse + touch; `setPointerCapture` for drag outside bounds
- **HiDPI support** — canvas internal resolution × `devicePixelRatio`, CSS size fixed at 28px
- **Worst-status priority** — `removed(3) > changed(2) > added(1) > equal(0)`; tempo/timeSig bumps to `changed` if enabled and no worse beat status exists
- **Colors** match DiffOverlay hues (green/red/yellow) at full opacity; equal = `#374151` (grey-700)
- **Canvas mock strategy** for happy-dom: `vi.spyOn(HTMLCanvasElement.prototype, 'getContext')` + fillStyleHistory tracking

**Tests (16):** computeMeasureStatus (7 pure function tests), drawMinimap (4 canvas mock tests), component rendering (3 tests), edge cases (2 tests).

**Total: 92 tests passing**, `npm run build` clean.

---

### Phase 8 — Diff Filter Toggles ✅ COMPLETE

**What was built:**
- `DiffFilterBar.tsx` — four colored pill toggle buttons (Added/Removed/Changed/Tempo+TimeSig) with live counts from `diffResult.summary`
- Data-driven `PILLS` config array mapping filter keys to labels, active CSS classes, test IDs, and count getter functions
- `DiffFilters` state in `App.tsx`, passed to `DiffOverlay` (×2) and `DiffMinimap`
- Disabled state (greyed, no-click) when no diff result exists

**Key decisions:**
- **Data-driven pill config** — `PILLS: PillConfig[]` array drives rendering; adding a new filter = adding one config entry
- **Filter bar positioned in header** — pills sit inline between title and theme toggle, eliminating a separate toolbar row
- **Pill colors match diff overlay colors** — Added=green, Removed=red, Changed=yellow, Tempo/Sig=indigo. Inactive pills get neutral `bg-chrome-bg-subtle`
- **`disabled` prop on buttons** — when `summary === null`, pills show count 0, have `opacity-50 cursor-default`, and `onClick` is a no-op
- **Counts are combined for Tempo/Sig** — `tempoChanges + timeSigChanges` shown as one number

**Tests (13):** Rendering (5), toggle behavior (3), visual states (2), disabled state (2), rerender count update (1).

---

### Phase 9 — UI Polish (Visual Redesign) ✅ COMPLETE

**Scope change:** Original spec included keyboard shortcuts, zoom controls, drag-and-drop, and spinner overlays. These were **deferred** — Phase 9 became a focused visual redesign only, per user request. No new functionality was added.

**What was built:**
- `src/diff/colors.ts` — centralized `DIFF_COLORS` palette (solid, rgb, overlay, ghost variants). Single source of truth for all overlay/minimap/filter colors
- `src/hooks/useTheme.ts` — theme toggle hook with localStorage persistence. Two modes: `light` (default) and `dark-chrome`
- Theme system via CSS custom properties in `@theme` block (Tailwind v4), toggled by `data-theme="dark-chrome"` attribute on `#root`
- Redesigned header (h-14, branded "Riff-Diff" title with indigo accent, filter pills inline, moon/sun theme toggle)
- New `PaneHeader` component (side label A/B, vertical divider, filename, contextual Open/Change button)
- New `EmptyPane` component (full-width drop zone with file icon, instruction text, prominent Open File button)
- Explicit split pane divider (h-1.5, subtle shadow) replacing thin border
- Minimap + scrollbar wrapped in chrome footer container
- DiffOverlay badges changed from gray `#374151` to indigo `#6366f1` with box-shadow
- Favicon and PWA manifest with custom app icon (split-pane diff icon with red/green/yellow/indigo bars)

**Theme tokens (CSS custom properties):**

| Token | Light | Dark-Chrome |
|-------|-------|-------------|
| `chrome-bg` | `#f8fafc` | `#1e293b` |
| `chrome-bg-subtle` | `#f1f5f9` | `#334155` |
| `chrome-border` | `#e2e8f0` | `#475569` |
| `chrome-text` | `#1e293b` | `#f1f5f9` |
| `chrome-text-muted` | `#64748b` | `#94a3b8` |
| `chrome-accent` | `#6366f1` | `#818cf8` |

Diff colors (`diff-added`, `diff-removed`, `diff-changed`, `diff-meta`, `diff-equal`) are theme-invariant.

**Key decisions:**
- **Notation panes always white** — alphaTab renders black notation on white; dark backgrounds would require alphaTab-level changes. Only "chrome" (header, toolbars, pane headers, footer) changes with theme
- **CSS custom properties via Tailwind v4 `@theme`** — registered as `--color-chrome-*` / `--color-diff-*`, consumed as Tailwind utilities (`bg-chrome-bg`, `text-chrome-text`, etc.)
- **No `DropZone` component** — drag-and-drop deferred. EmptyPane has a styled Open File button instead
- **No keyboard shortcuts, zoom, or spinner** — deferred to keep Phase 9 purely visual
- **Filter bar merged into header** — eliminates a separate toolbar row, cleaner layout
- **Icon assets:** `riff-diff-favicon-16.png`, `riff-diff-favicon-32.png`, `riff-diff-icon-512.png`, `riff-diff-wordmark.png` in `assets/` and `public/`

**Tests (5 new → 110 total):** useTheme hook — default theme, toggle, data-theme attribute, localStorage persistence, restore from localStorage. All existing test assertions updated for new class names.

**Deferred from original Phase 9 spec:**
- Keyboard shortcuts (`←`/`→` scroll, `1`–`9` track switch, `[`/`]` jump to diff, filter toggles)
- Zoom controls (`+`/`−`)
- Drag-and-drop file loading (`DropZone` component)
- Spinner overlay during alphaTab render
- Jump to next/prev diff buttons

---

### Phase 10 — Tauri Desktop Packaging ✅ COMPLETE

**What was built:**
- `src-tauri/` directory with full Rust backend scaffold
- `src-tauri/Cargo.toml` — tauri v2 + tauri-plugin-dialog + tauri-plugin-fs
- `src-tauri/src/main.rs` — registers dialog + fs plugins, runs app
- `src-tauri/tauri.conf.json` — identifier `com.andiman5000.riffdiff`, window 1440×900 (min 960×600), `frontendDist: ../dist`, `devUrl: http://localhost:5173`
- `src-tauri/capabilities/default.json` — permissions: `core:default`, `dialog:allow-open`, `fs:allow-read`
- `src-tauri/icons/` — generated from `assets/riff-diff-icon-512.png` via `npx tauri icon` (all platform sizes)
- npm scripts: `tauri`, `tauri:dev`, `tauri:build`
- 3 new Tauri edge-case tests: dialog cancel, Windows backslash paths, readFile error handling

**Key decisions:**
- **Single `main.rs`** (not `lib.rs` + `main.rs` pair) — simpler for apps with no custom Rust commands
- **`security.csp: null`** — alphaTab uses inline styles, data URIs, and worker blobs; CSP would block it
- **`strictPort: true` in vite.config.ts** — ensures Tauri's `devUrl` always matches the Vite port
- **`clearScreen: false`** — prevents Vite from clearing Tauri's output in the terminal
- **`vi.doMock` / `vi.doUnmock` pattern** — allows per-test mock overrides for Tauri plugin imports (hoisted `vi.mock` only allows one factory per module)
- **Git's `link.exe` shadows MSVC linker** — on Windows with Git in PATH, Rust may invoke the wrong `link.exe`. Fixed by ensuring Windows SDK + MSVC build tools are installed (sets up correct PATH via VS environment)
- **SharedArrayBuffer in Tauri release builds** — WebView2 requires COOP/COEP headers even for Tauri's `tauri://localhost` origin. Solved via `WebviewWindowBuilder::on_web_resource_request` to inject headers on every response. This required creating the window programmatically in `setup()` (empty `app.windows` in tauri.conf.json)
- **`alphaTab.core.mjs` must be in `public/` and `public/assets/`** — `alphaTab.worker.mjs` is a thin wrapper that imports `./alphaTab.core.mjs`. In Vite dev mode this resolves from `node_modules`, but in production builds the file must physically exist in `dist/`. Additionally, alphaTab's bundled code resolves the worker path via `import.meta.url` (relative to the JS bundle at `/assets/`), so worker files must also exist at `public/assets/`
- **Tauri asset protocol doesn't recognize `.mjs` MIME type** — `.mjs` files are served as `text/html`, causing `Failed to load module script` errors. Fixed by checking the request URI in `on_web_resource_request` and overriding `Content-Type` to `application/javascript` for `.mjs` files
- **alphaTab font path auto-detection** — alphaTab derives `fontDirectory` from `Environment.scriptFile` (auto-detected via `import.meta.url`). In a Vite production bundle, this resolves to `/assets/font/` instead of `/font/`. Fixed by explicitly setting `core.fontDirectory: '/font/'` in AlphaTabApi settings

**Build outputs (Windows):**
- `src-tauri/target/release/bundle/msi/Riff-Diff_0.1.0_x64_en-US.msi`
- `src-tauri/target/release/bundle/nsis/Riff-Diff_0.1.0_x64-setup.exe`

**Tests (3 new → 113 total):** Tauri dialog cancel, Windows backslash path extraction, readFile error propagation.

---

### Phase 11 — UX Enhancements ✅ COMPLETE

**Scope:** Three UX features prioritized by user: drag-and-drop (high), loading spinner (medium), zoom controls (medium). Keyboard shortcuts and diff navigation were excluded from scope.

**What was built:**

1. **Drag-and-drop file loading**
   - `src/hooks/useDropZone.ts` — hook with enter/leave counter pattern to prevent flicker from nested DOM elements
   - Per-pane drop zones: drop a `.gp/.gp7/.gp8` file onto top pane → File A, bottom pane → File B
   - Visual drop overlay with dashed border and "Drop GP file here" text
   - Reuses existing `loadFromFile(file: File)` from `useFileLoader`

2. **Loading spinner overlay**
   - `src/components/LoadingOverlay.tsx` — semi-transparent overlay with CSS spinner animation
   - Visible during both file reading (`isLoading`) and alphaTab rendering (between `renderStarted` and `postRenderFinished`)
   - `AlphaTabPane` gained `onRenderStarted` callback prop

3. **Zoom controls**
   - `src/hooks/useZoom.ts` — zoom state with 7 steps (0.25–2.0×), localStorage persistence
   - Header buttons: `[-]` zoom out, percentage label (click to reset), `[+]` zoom in
   - Keyboard shortcuts: Ctrl/Cmd +/-/0
   - Both panes zoom together via `scale` prop on `AlphaTabPane`
   - `AlphaTabPane` gained `scale` prop with update effect: `api.settings.display.scale` + `updateSettings()` + `render()`

4. **Notation toggle** (bonus, implemented in Phase 10)
   - `src/hooks/useNotationToggle.ts` — show/hide standard notation stave, localStorage persistence
   - Percussion tracks always keep notation on (alphaTab can't render tab for percussion)

**Key decisions & bug fixes:**

- **`initialScaleRef` pattern** — guards against running scale update effect on initial mount. Must update `initialScaleRef.current = scale` after each scale change to prevent stale comparisons (bug: reset-to-100% was skipped because it matched the stale initial value).

- **alphaTab surface width doesn't track zoom** — alphaTab sets `.at-surface` width independently of `display.scale`. At >100% zoom, children overflow the surface; at <100%, the surface is wider than content. Fix: compute actual content width from children's rightmost edge (`offsetLeft + offsetWidth`), then expand the surface element if children overflow. A 30px right-side gap is added for visual padding.

- **Content width for scrollbar/minimap** — `onRenderFinished` callback now passes `(api, contentWidth)` so the scrollbar and minimap can size correctly at any zoom level. Previously used `container.scrollWidth` which was unreliable due to `overflow-x: hidden`.

- **Scroll position preservation on zoom** — Captures scroll fraction synchronously during render when zoom changes, then restores it via `useEffect` after `scrollWidthA`/`scrollWidthB` update.

- **Minimap redraws on content width change** — `DiffMinimap` gained `contentWidth` prop included in `redraw` callback dependency, ensuring viewport indicator stays in sync after zoom.

- **Vitest `vi.mock` hoisting** — Adding class property declarations inside `vi.mock` factory caused `Cannot access before initialization` errors. Fixed by using `(this as any)` constructor assignments instead of class-level declarations.

**Files created:**
| File | Purpose |
|------|---------|
| `src/hooks/useDropZone.ts` | Drag-and-drop hook with enter/leave counter |
| `src/hooks/useDropZone.test.ts` | 9 tests |
| `src/hooks/useZoom.ts` | Zoom state hook with localStorage |
| `src/hooks/useZoom.test.ts` | 9 tests |
| `src/components/LoadingOverlay.tsx` | Spinner overlay component |
| `src/components/LoadingOverlay.test.tsx` | 4 tests |
| `src/hooks/useNotationToggle.ts` | Notation toggle hook with localStorage |
| `src/hooks/useNotationToggle.test.ts` | 5 tests |

**Files modified:**
| File | Change |
|------|--------|
| `src/App.tsx` | Wired all features: drop zones, spinner state, zoom hook + header buttons + keyboard shortcuts, notation toggle, scroll fraction preservation |
| `src/renderer/AlphaTabPane.tsx` | Added `onRenderStarted`, `scale` prop, `apiRef`, content width calculation, surface width fix |
| `src/renderer/AlphaTabPane.test.tsx` | +3 tests (onRenderStarted, scale settings, scale update) |
| `src/components/DiffMinimap.tsx` | Added `contentWidth` prop for zoom-aware redraws |
| `src/forceStaveVisibility.ts` | Added `showNotation` parameter |
| `src/forceStaveVisibility.test.ts` | +4 tests for notation toggle |

**Tests: 147 total (34 new).** `npm run build` clean.

**Deferred (out of scope per user):**
- Keyboard shortcuts for scrolling, track switching, diff jumping, filter toggles
- Diff navigation (prev/next diff buttons)

---

### Phase 12 — Diff Engine Improvements ✅ COMPLETE

**Scope:** Post-release bug fixes and algorithmic improvements to the diff engine, phantom bar system, and rendering stability.

**What was built / fixed:**

1. **Similarity-based bar alignment (Needleman-Wunsch)**
   - Replaced binary-match LCS with a similarity-scoring alignment algorithm for bar-level alignment
   - `barSimilarity()` computes 0.0–1.0 score between bars using beat-level LCS (identical=1.0, similar≈0.8, different=0.0)
   - `barAlignmentTable()` builds a DP table where each cell accumulates best cumulative similarity
   - Backtracking prefers pairing (diagonal) when its score is at least as good as skipping
   - **Why:** Pure LCS with exact-match signatures could prefer shifted alignments (matching bars at wrong positions) when content happened to repeat. "Almost identical" bars scored the same as completely different bars (both 0), letting the algorithm skip them in favor of shifted exact matches elsewhere.

2. **Phantom bar insertion for visual alignment**
   - `src/diff/phantomBars.ts` — inserts empty bars into scores so added/removed measures align visually between panes
   - `extractBarPairs()`, `computePhantomPositions()`, `insertPhantomBars()`, `removePhantomBars()`
   - Phantom bars maintain correct `previousBar`/`nextBar` chain, `masterBar` indices, and voice counts
   - Voice count matching: phantom bars must have the same number of voices as adjacent bars (alphaTab's `_chain()` traverses `bar.nextBar.voices[index]`)

3. **Stale render error suppression**
   - alphaTab's web worker renders asynchronously; phantom bar insertion between `renderStarted` and `postRenderFinished` causes `bounds.beat is undefined` in `BoundsLookup.fromJson`
   - Root cause: uniform bar width handler in `postRenderFinished` triggers internal `api.render()` of pre-phantom score; phantoms are inserted, then stale render completes against modified score
   - Fix: deferred phantom insertion until both panes are idle (`!isRenderingA && !isRenderingB`), plus global `window.addEventListener('error')` to suppress remaining stale-render errors from alphaTab
   - `isRendering` flag set in `handleScoreLoaded` (not just `renderStarted`) to close the gap

4. **Filter pill bar count fix**
   - Added `addedBars` and `removedBars` to `DiffResult.summary` (distinct from beat-level `added`/`removed`)
   - "Added/Removed Bars" filter pill now shows bar count instead of beat count
   - `MeasureDiff` gained `measureIndexA`/`measureIndexB` (nullable) instead of single `measureIndex`

**Files created:**
| File | Purpose |
|------|---------|
| `src/diff/phantomBars.ts` | Phantom bar computation and insertion |
| `src/diff/phantomBars.test.ts` | 11 tests for phantom bar logic |

**Files modified:**
| File | Change |
|------|--------|
| `src/diff/diffEngine.ts` | Similarity-based bar alignment (Needleman-Wunsch), `addedBars`/`removedBars` summary, `measureIndexA`/`measureIndexB` |
| `src/diff/types.ts` | Updated `MeasureDiff`, `DiffResult.summary`, `DiffFilters` (3 filters instead of 4) |
| `src/App.tsx` | Phantom bar lifecycle (pending/insert/remove), deferred insertion, stale render guard |
| `src/renderer/AlphaTabPane.tsx` | Global error handler for stale render suppression |
| `src/components/DiffFilterBar.tsx` | Uses `addedBars`/`removedBars` for pill count |
| `src/renderer/DiffOverlay.tsx` | Updated for nullable `measureIndexA`/`measureIndexB` |

**Key decisions:**
- **Needleman-Wunsch over LCS for bars** — LCS is binary (match/no-match); Needleman-Wunsch uses continuous similarity scores. This prevents the algorithm from preferring shifted alignments when bars repeat with minor variations.
- **Deferred phantom insertion** — phantoms computed in diff effect, stored in `pendingPhantomsRef`, applied only when both panes finish rendering. Prevents race condition with alphaTab's async worker.
- **Global error handler over monkeypatching** — alphaTab registers worker message handlers via `.bind(this)` in the constructor, making method-level patches impossible. Global `window.addEventListener('error')` with `e.preventDefault()` is the pragmatic fix for the remaining stale-render errors.
- **Voice count matching for phantom bars** — alphaTab's internal `_chain()` traverses voices across bars by index. Phantom bars with fewer voices than real bars cause `nextVoice is undefined` crashes.

---

## Agent Sign-off Matrix

| Phase | Lead Eng | QA | UX | Musician | PO |
|---|---|---|---|---|---|
| 1 Scaffold | ✅ done | ✅ done | — | — | ✅ done |
| 2 alphaTab | ✅ done | ✅ done | — | ✅ done | — |
| 3 Dual Pane | ✅ done | ✅ done | ✅ done | ✅ done | — |
| 4 Diff Engine | ✅ done | ✅ done | — | — | ✅ done |
| 5 Overlay | ✅ done | ✅ done | ✅ done | ✅ done | — |
| 6 Scroll Sync | ✅ done | ✅ done | ✅ done | — | — |
| 7 Minimap | ✅ done | ✅ done | ✅ done | — | — |
| 8 Filters | ✅ done | ✅ done | ✅ done | ✅ done | — |
| 9 Polish | ✅ done | ✅ done | ✅ done | ✅ done | ✅ done |
| 10 Tauri | ✅ done | ✅ done | — | — | ✅ done |
| 11 UX Enhancements | ✅ done | ✅ done | ✅ done | ✅ done | ✅ done |
| 12 Diff Improvements | ✅ done | ✅ done | — | ✅ done | — |

---

## Out of Scope — Block Immediately
- GP5, GP6 file support
- Audio or MIDI playback
- Server-side processing of any kind
- JSZip (alphaTab handles parsing)
- Drum tab notation (see `TODO.md` — alphaTab limitation)

---

## Known Pitfalls (learned during implementation)

1. **`updateSettings()` + `renderTracks()` can crash** — alphaTab's `updateSettings()` syncs settings to the worker, but calling `renderTracks()` immediately after can cause undefined stave errors. Prefer setting staff visibility flags on the Score object before the initial render.

2. **alphaTab JSON serialization round-trip** — Both `api.load()` and `api.renderTracks()` serialize the Score to JSON via `JsonConverter.scoreToJsObject` → worker → `JsonConverter.jsObjectToScore`. This means any mutations to the Score object (like `forceStaveVisibility`) must happen in the `scoreLoaded` handler, before the score gets serialized for rendering.

3. **`staff.isPercussion` detection** — alphaTab marks percussion staves during `Staff.finish()`, which also clears `stringTuning.tunings` and forces `showTablature = false`. The `TabBarRendererFactory.canCreate()` checks `!this.hideOnPercussionTrack || !staff.isPercussion` AND `staff.tuning.length > 0`.

4. **Test file location** — 8 GP test files in `testfiles/` directory, gitignored. Useful for manual testing of diff visualization.

5. **Large bundle warning** — alphaTab is ~1.4MB minified. The Vite build warns about chunk size. Consider code-splitting in Phase 9 if needed.

6. **React portal inside alphaTab DOM** — `createPortal` into `.at-surface` works for positioning (overlays scroll with notation), but alphaTab clears/rebuilds `.at-surface` children on re-render (track switch, zoom). The portal must be cleared BEFORE alphaTab touches the DOM, or React throws `Node.removeChild: not a child`. Solution: listen to `api.renderStarted` (fires synchronously before async worker render) and use `flushSync(setSurfaceEl(null))` to force immediate portal unmount.

7. **`findBeats()` returns null, not `[]`** — `boundsLookup.findBeats(beat)` returns `null` when the beat is not found (e.g. stale beat ref from a different track). Always guard with `?? []`.

8. **`findBeats()` returns duplicates** — Returns one entry per voice/staff rendering. Multiple voices on the same staff produce identical `(x,y,w,h)` bounds. Without deduplication, overlapping overlays cause visible opacity stacking. Deduplicate by position key.

9. **alphaTab does NOT create `.at-viewport`** — The plan originally referenced `.at-viewport` but this element does not exist. alphaTab creates only `.at-surface` inside the container div. The container div itself (with `overflow-auto`) is the scrollable element.

10. **`scrollbarRef.current` timing** — Passing `useRef.current` to a hook doesn't re-trigger the hook's `useEffect` when the ref value changes (refs don't cause re-renders). Use `useState` with a callback ref (`ref={setScrollbarEl}`) instead to ensure the hook re-runs when the element mounts.

11. **Vite CSS cache stale asset references** — When removing/renaming files referenced from CSS (e.g. favicons, background images), the Vite dev server may cache the old CSS transform and error with `ENOENT`. Restart the dev server to clear the cache.

12. **happy-dom has no `#root` div** — Unlike a real browser loading `index.html`, happy-dom's test environment doesn't create the `#root` element. Tests that need `document.getElementById('root')` (e.g. useTheme) must create it manually in `beforeEach`.

13. **Git's `link.exe` shadows MSVC linker on Windows** — `C:\Program Files\Git\usr\bin\link.exe` (a Unix utility) can shadow the MSVC `link.exe` in PATH, causing Rust compilation to fail with `link: extra operand` or `LNK1181: cannot open input file 'kernel32.lib'`. Fix: ensure Windows SDK is installed and the MSVC build tools PATH is configured (VS installer "Desktop development with C++" workload).

14. **`vi.doMock` vs `vi.mock` for per-test overrides** — `vi.mock` is hoisted to file top, so all tests share one mock factory. For Tauri tests needing different mock return values per test, use `vi.doMock` (not hoisted) in `beforeEach` with `vi.doUnmock` in `afterEach`.

15. **`alphaTab.core.mjs` not in `public/`** — The README copy command originally only copied `alphaTab.worker.*` files. The worker is a thin wrapper (~1.7KB) that does `import * as alphaTab from './alphaTab.core.mjs'` — without the core module (3.1MB), the worker silently fails in production builds. Must copy both worker and core files.

16. **Tauri asset protocol serves `.mjs` as `text/html`** — Tauri's built-in asset protocol doesn't have a MIME mapping for `.mjs` files. Module scripts fail with "non-JavaScript MIME type" error. Fix in `on_web_resource_request` by checking `request.uri().path().ends_with(".mjs")` and setting `Content-Type: application/javascript`.

17. **alphaTab resolves worker path via `import.meta.url`** — In production bundles, alphaTab's first attempt to create a worker uses `new URL('./alphaTab.worker.mjs', import.meta.url)`, which resolves relative to the bundled JS in `/assets/`. Worker files must exist at both `/` (for explicit `scriptFile` setting) and `/assets/` (for `import.meta.url` resolution).

18. **alphaTab `fontDirectory` auto-detection wrong in production** — `Environment._detectFontDirectory()` derives the font path from `Environment.scriptFile` (set via `import.meta.url` → `/assets/index-*.js`), producing `/assets/font/` instead of `/font/`. Explicitly set `core.fontDirectory: '/font/'` to override.

19. **alphaTab `.at-surface` width doesn't track zoom scale** — alphaTab sets the surface element's width independently of `display.scale`. At >100% zoom, children overflow the surface (scrollWidth > offsetWidth); at <100%, the surface is wider than content (scrollWidth = offsetWidth, but content is narrower). Fix: after `postRenderFinished`, compute actual content width from children's rightmost edge (`offsetLeft + offsetWidth`) and expand the surface if needed.

20. **`container.scrollWidth` unreliable with `overflow-x: hidden`** — When the container has `overflow-x: hidden` and the surface uses absolute positioning, `scrollWidth` may not reflect the actual content extent. Read content width from child elements directly and pass it explicitly via callbacks rather than relying on `scrollWidth`.

21. **Vitest `vi.mock` class property declarations cause hoisting crash** — Adding typed class property declarations (e.g. `updateSettings: ReturnType<typeof vi.fn>`) inside a `vi.mock` factory class can cause `Cannot access '__vi_import_2__' before initialization`. Workaround: omit class property declarations and use `(this as any).prop = value` in the constructor.

22. **Zoom scale effect must update guard ref** — When using a ref to skip the scale update effect on initial mount (`initialScaleRef`), the ref must be updated to the new scale value at the end of the effect. Otherwise, resetting zoom back to the initial value (e.g. 1.0) will match the stale ref and skip the update.

23. **Phantom bar voice count must match neighbors** — alphaTab's internal `_chain()` method traverses `this.bar.nextBar.voices[this.index]` during rendering. Phantom bars with only 1 voice adjacent to real bars with multiple voices cause `nextVoice is undefined` crash. Always match the adjacent bar's voice count when creating phantom bars.

24. **Phantom bar insertion race condition with alphaTab worker** — alphaTab serializes the score to JSON and sends it to a web worker for rendering. `BoundsLookup.fromJson` on the main thread maps worker results back to the current score by index. If phantom bars are inserted between `renderStarted` and `postRenderFinished`, indices are stale → `bounds.beat is undefined`. Fix: defer phantom insertion until both panes are idle, and suppress residual stale-render errors via global error handler.

25. **`.bind(this)` prevents alphaTab monkeypatching** — alphaTab registers `this._worker.addEventListener('message', this._handleWorkerMessage.bind(this))` in the constructor. The bound copy is what's registered, so replacing the method on the prototype or instance has no effect. Only `window.addEventListener('error')` with `e.preventDefault()` works to suppress stale-render errors.

26. **Binary LCS produces wrong bar alignment with repeated content** — Pure LCS on bar signatures uses binary match (equal/not-equal). When bars have similar but not identical content (e.g. same riff with minor note changes), the algorithm may prefer a shifted alignment that has more exact matches at wrong positions. Fix: use similarity-based scoring (Needleman-Wunsch) where "almost identical" bars contribute ~0.8 instead of 0, making positional alignment win over shifted exact matches.

27. **`uniformBarWidth` triggers render cascade** — When `uniformBarWidth` is set in `AlphaTabPane.postRenderFinished`, alphaTab may trigger an internal `api.render()` if bar widths don't match. This creates an intermediate render whose completion can race with phantom bar insertion. The deferred phantom insertion pattern (`pendingPhantomsRef` + idle check) handles this.
