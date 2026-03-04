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
Owns visual design and interaction. Enforces: consistent colour palette (added=#1a7a2e, removed=#7a1a1a, changed=#7a5a1a, tempo/timesig=#b85c00), accessible contrast ratios, keyboard-navigable controls, meaningful empty/loading/error states. Reviews every UI component before it ships.

### Musician (Domain Expert)
Validates that the app makes sense to a guitarist. Checks: tab renders with correct string/fret layout (string 1 = high e = top line), measure numbers are visible, tempo and time-sig changes are surfaced clearly, diff colours are intuitive. Raises issues if any musical concept is misrepresented in the UI.

### Product Owner
Enforces scope. Blocks anything outside the spec. Approves the deliverable of each phase before the next begins. Immediately flags: < GP7 support (out of scope), audio playback (out of scope), MIDI playback (out of scope for now).

---

## Critical Technical Constraints
> All agents must respect these. Verified during implementation — corrections from the original spec are noted.

### alphaTab API (verified)
- **`api.load(buffer)`** — NOT `api.loadSong()`. The method is just `load()`.
- **Worker file**: `alphaTab.worker.mjs` (ESM module, not `.js`). Copy from `node_modules/@coderline/alphatab/dist/`. Reference via `settings.core.scriptFile = '/alphaTab.worker.mjs'`.
- **Font files**: Bravura music font must be copied to `public/font/`: `cp node_modules/@coderline/alphatab/dist/font/Bravura.{eot,otf,svg,woff,woff2} public/font/`
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
- Rust NOT installed — Tauri backend deferred to Phase 10

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
export interface DiffFilters { showAdded: boolean; showRemoved: boolean; showChanged: boolean; showTempoTimeSig: boolean }
export interface NoteDiff { note: Note; status: 'noteAdded' | 'noteRemoved' | 'noteEqual' }
export interface BeatDiff { beatA: Beat | null; beatB: Beat | null; status: BeatStatus; noteDiffs?: NoteDiff[] }
export interface MeasureDiff {
  measureIndex: number
  beatDiffs: BeatDiff[]
  tempoDiff: { tempoA: number; tempoB: number } | null
  timeSigDiff: { sigA: string; sigB: string } | null
}
export interface DiffResult {
  measures: MeasureDiff[]
  summary: { equal: number; added: number; removed: number; changed: number; tempoChanges: number; timeSigChanges: number; totalMeasures: number }
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
├── src/
│   ├── main.tsx                     React entry point
│   ├── App.tsx                      Main app: dual pane, file loading, track switching, state
│   ├── index.css                    @import "tailwindcss"
│   ├── vite-env.d.ts
│   ├── components/
│   │   ├── SplitPane.tsx            Vertical split (top/bottom) with flex layout
│   │   └── TrackToolbar.tsx         Track tabs + manual mapping dropdowns
│   ├── diff/
│   │   ├── types.ts                 DiffResult, BeatDiff, NoteDiff, MeasureDiff types
│   │   ├── diffEngine.ts           diffScores() — LCS-based beat alignment, note diffs
│   │   └── diffEngine.test.ts      15 tests: signatures, LCS alignment, tempo, timesig
│   ├── hooks/
│   │   ├── useFileLoader.ts         File picker (web + Tauri), extension validation
│   │   ├── useFileLoader.test.ts    11 tests: web/Tauri paths, validation, error handling
│   │   ├── useSyncScroll.ts         Shared scrollbar scroll sync hook
│   │   └── useSyncScroll.test.ts    7 tests: sync, wheel forwarding, cleanup
│   ├── renderer/
│   │   ├── AlphaTabPane.tsx         alphaTab API wrapper with forwardRef + portal lifecycle
│   │   ├── AlphaTabPane.test.tsx    15 tests: config, lifecycle, callbacks, portal, ref
│   │   ├── DiffOverlay.tsx          Diff overlay with computeOverlays() pure fn
│   │   └── DiffOverlay.test.tsx     18 tests: colors, ghosts, badges, dedup, multi-staff
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

```
│   ├── renderer/
│   │   ├── DiffOverlay.tsx        Diff overlay with computeOverlays() pure fn
│   │   └── DiffOverlay.test.tsx   18 tests: colors, ghosts, badges, dedup, filters
│   ├── hooks/
│   │   ├── useSyncScroll.ts       Shared scrollbar sync hook
│   │   └── useSyncScroll.test.ts  7 tests: scroll sync, wheel fwd, cleanup
```

**Future files (not yet created):**
```
src/components/DiffMinimap.tsx       Phase 7
src/components/DiffFilterBar.tsx     Phase 8
src/components/DropZone.tsx          Phase 9
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
| 7 Diff Minimap | Not started | — |
| 8 Diff Filter Toggles | Not started | — |
| 9 UI Polish | Not started | — |
| 10 Tauri Desktop | Not started | — |

**Total: 76 tests passing**, `npm run build` clean.

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
- Measures aligned by index (not fuzzy matching) — matches how musicians think about bar numbers
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

### Phase 7 — Diff Minimap
**Agents:** Lead Engineer, QA Engineer, UX Engineer

**Implement:** `DiffMinimap.tsx` — full-width `<canvas>` (28px tall). Draw one stripe per measure coloured by worst diff status. Draw viewport indicator rect. Clickable/draggable to seek both panes. `ResizeObserver` redraws on resize. Respects `DiffFilters`.

**Tests (`src/components/DiffMinimap.test.ts`):**
- Canvas drawn with correct number of stripes = `totalMeasures`
- Measure with `removed` beat → stripe colour is red-family
- Measure with `equal` only → stripe colour is grey-family
- Filtered-out status → stripe falls back to grey
- Click at 50% canvas width → `onSeek(~0.5)` called
- `ResizeObserver` callback triggers redraw

**Phase gate:** Tests pass. UX confirms minimap reflects diff distribution and clicking seeks both panes correctly.

---

### Phase 8 — Diff Filter Toggles
**Agents:** Lead Engineer, QA Engineer, UX Engineer

**Implement:** `DiffFilterBar.tsx` — four toggle buttons (Added/Removed/Changed/Tempo+TimeSig) showing live counts from `diffResult.summary`. `DiffFilters` state in `App.tsx`, passed down to `DiffOverlay` (×2) and `DiffMinimap`.

**Tests (`src/components/DiffFilterBar.test.ts`):**
- All four buttons render with correct counts
- Clicking Added button toggles `filters.showAdded`
- Active/inactive visual state applied correctly
- Count updates when `diffResult.summary` changes

**Phase gate:** Tests pass. Musician confirms toggling "Removed" hides red overlays in both panes and minimap simultaneously.

---

### Phase 9 — UI Shell & Polish
**Agents:** UX Engineer (leads), Musician, Product Owner

**Implement:**
- Header: logo, file-load buttons, zoom `+`/`−`, file names
- Drag-and-drop on each pane's `DropZone`
- Spinner overlay during alphaTab render
- Error card if `api.load()` throws
- Keyboard shortcuts: `←`/`→` scroll 200px; `1`–`9` switch track; `[`/`]` jump to prev/next diff; `A`/`R`/`C`/`T` toggle filters
- Jump to next/prev diff buttons using `masterBarBounds.realBounds.x`
- Zoom calls `api.updateSettings() + api.render()` on both panes

**Tests (`src/components/DropZone.test.ts`, `src/App.test.ts`):**
- Drop event with valid `.gp` file calls `onFileLoaded`
- Drop event with invalid extension shows error
- Keyboard shortcut `[` calls scroll-to-prev-diff with correct bar index
- Zoom in increments `settings.display.scale` by 0.1

**Phase gate:** PO confirms all features in spec are present. Musician does full walkthrough with a real pair of `.gp` files. UX signs off on visual consistency.

---

### Phase 10 — Tauri Desktop Packaging
**Agents:** Lead Engineer, QA Engineer

**Prerequisites:** Install Rust toolchain.

**Configure** `tauri.conf.json`: identifier `com.yourname.riffdiff`, targets `["msi","dmg","app"]`, window `1440×900` min `960×600`, title `Riff-Diff`. Add `tauri-plugin-dialog` and `tauri-plugin-fs` to `Cargo.toml`.

**Verify** `useFileLoader` Tauri path works end-to-end (file dialog → `readFile` → `ArrayBuffer`).

**Build:**
```bash
npm run build                                            # static web
npm run tauri build -- --target x86_64-pc-windows-msvc  # Windows .msi
npm run tauri build                                      # Mac .dmg/.app
```

**Tests:**
- `useFileLoader` Tauri branch: mock `__TAURI_INTERNALS__`, assert `plugin-dialog` `open()` called with correct extensions, assert buffer returned

**Phase gate:** Web build loads and runs in browser. Desktop installer produces working app on target OS.

---

## Agent Sign-off Matrix

| Phase | Lead Eng | QA | UX | Musician | PO |
|---|---|---|---|---|---|
| 1 Scaffold | ✅ done | ✅ done | — | — | ✅ done |
| 2 alphaTab | ✅ done | ✅ done | — | ✅ done | — |
| 3 Dual Pane | ✅ done | ✅ done | ✅ done | ✅ done | — |
| 4 Diff Engine | ✅ done | ✅ done | — | — | ✅ done |
| 5 Overlay | ✅ req | ✅ req | ✅ req | ✅ req | — |
| 6 Scroll Sync | ✅ req | ✅ req | ✅ req | — | — |
| 7 Minimap | ✅ req | ✅ req | ✅ req | — | — |
| 8 Filters | ✅ req | ✅ req | ✅ req | ✅ req | — |
| 9 Polish | ✅ req | ✅ req | ✅ leads | ✅ req | ✅ req |
| 10 Tauri | ✅ req | ✅ req | — | — | ✅ req |

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

4. **Test file location** — 8 GP test files in `testfiles/` directory (Fever v0.1.3 through v0.3.10), gitignored. Useful for manual testing of diff visualization.

5. **Large bundle warning** — alphaTab is ~1.4MB minified. The Vite build warns about chunk size. Consider code-splitting in Phase 9 if needed.

6. **React portal inside alphaTab DOM** — `createPortal` into `.at-surface` works for positioning (overlays scroll with notation), but alphaTab clears/rebuilds `.at-surface` children on re-render (track switch, zoom). The portal must be cleared BEFORE alphaTab touches the DOM, or React throws `Node.removeChild: not a child`. Solution: listen to `api.renderStarted` (fires synchronously before async worker render) and use `flushSync(setSurfaceEl(null))` to force immediate portal unmount.

7. **`findBeats()` returns null, not `[]`** — `boundsLookup.findBeats(beat)` returns `null` when the beat is not found (e.g. stale beat ref from a different track). Always guard with `?? []`.

8. **`findBeats()` returns duplicates** — Returns one entry per voice/staff rendering. Multiple voices on the same staff produce identical `(x,y,w,h)` bounds. Without deduplication, overlapping overlays cause visible opacity stacking. Deduplicate by position key.

9. **alphaTab does NOT create `.at-viewport`** — The plan originally referenced `.at-viewport` but this element does not exist. alphaTab creates only `.at-surface` inside the container div. The container div itself (with `overflow-auto`) is the scrollable element.

10. **`scrollbarRef.current` timing** — Passing `useRef.current` to a hook doesn't re-trigger the hook's `useEffect` when the ref value changes (refs don't cause re-renders). Use `useState` with a callback ref (`ref={setScrollbarEl}`) instead to ensure the hook re-runs when the element mounts.
