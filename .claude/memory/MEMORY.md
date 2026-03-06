# Riff-Diff Project Memory

## User Preferences
- **ALWAYS ask questions when uncertain** - never make large assumptions about user intent
- **Maintain README.md** — keep it up to date as phases complete (Lead Engineer responsibility)
- Project: Riff-Diff — visual diff tool for Guitar Pro 7/8 (.gp) files
- Stack: React + TypeScript + Vite + Tauri v2 + alphaTab + Tailwind v4 + Vitest
- Test-first execution: write failing tests -> implement -> tests pass
- Plan document: `riff-diff-claude-code-plan.md` (master spec)
- Package manager: npm
- Scaffold in current dir (gp-diff), not a subdirectory

## Dev Environment
- Windows 11, bash shell, nvm for Node version management
- Node 22.22.0 (upgraded from 20.18.1 to fix engine warnings)
- Rust 1.94.0 via rustup, MSVC build tools via VS 2022 Community

## Project State
- Phase 1 COMPLETE: scaffold, tooling, useFileLoader hook, SplitPane, 11 tests passing
- Phase 2 COMPLETE: AlphaTabPane component, alphaTab rendering, 20 tests passing
- Phase 3 COMPLETE: dual pane, TrackToolbar, track switching, 32 tests passing
- Phase 4 COMPLETE: diff engine (LCS beat alignment, note-level diffs, tempo/timesig comparison), 47 tests passing
- Phase 5 COMPLETE: DiffOverlay (colored beat overlays, ghost markers, tempo/timesig badges), 68 tests passing
- Phase 6 COMPLETE: Synchronized scrolling (shared scrollbar, useSyncScroll hook, forwardRef on AlphaTabPane), 76 tests passing
- Phase 7 COMPLETE: Diff Minimap (canvas-based, computeMeasureStatus + drawMinimap pure fns, click/drag seek, viewport indicator), 92 tests passing
- Phase 8 COMPLETE: Diff Filter Toggles (DiffFilterBar colored pill badges in header, 4 toggles with live counts, data-driven PILLS config), 105 tests passing
- Phase 9 COMPLETE: UI Polish (theme system with light/dark-chrome modes, shared diff color palette, redesigned header/pane headers/empty panes/split divider, favicon/manifest, indigo accent color), 110 tests passing
- Phase 10 COMPLETE: Tauri Desktop Packaging (src-tauri scaffold, Cargo.toml, tauri.conf.json, capabilities, icons, MSI+NSIS installers), 113 tests passing
- 8 test .gp files in testfiles/ (Fever v0.1.3 through v0.3.10) — gitignored
- GPL-3.0 licensed

## Key Technical Decisions
- alphaTab Vite plugin (`@coderline/alphatab-vite`) has CJS/ESM interop issue — skipped, using manual worker copy + optimizeDeps.exclude instead
- Using `happy-dom` instead of `jsdom` for vitest (jsdom had CJS/ESM compat issues with @csstools packages)
- Tailwind v4: CSS-first approach, just `@import "tailwindcss"` in index.css
- alphaTab worker files (`alphaTab.worker.*` + `alphaTab.core.mjs`) manually copied to `public/` AND `public/assets/` (production bundles resolve via `import.meta.url` → `/assets/`)
- alphaTab model types MUST be imported via namespace: `import type { model } from '@coderline/alphatab'` then `type Score = model.Score` (direct imports like `import { Score }` fail tsc)
- GP file view preferences (showStandardNotation/showTablature) are force-overridden via `forceStaveVisibility()` on scoreLoaded — diff tool needs consistent rendering
- Percussion drum tab rendering is an alphaTab limitation (hideOnPercussionTrack + Staff.finish clears tuning) — deferred to TODO.md

## alphaTab API (corrections from master plan)
- `api.load(buffer)` NOT `api.loadSong()` — method is just `load()`
- `StaveProfile.Tab = 3` NOT `StaveProfile.TabOnly` (doesn't exist); use `Default` (not `Tab`) to support percussion tracks
- `updateSettings()` syncs settings to worker but can cause crashes if followed by `renderTracks()` — prefer `StaveProfile.Default` + staff-level visibility
- Events use `.on()` pattern: `api.postRenderFinished.on(handler)` returns unsubscribe fn
- `postRenderFinished` (no args) fires after DOM fully updated; use over `renderFinished`
- `scoreLoaded: IEventEmitterOfT<Score>` fires with parsed Score after `api.load()`
- `renderTracks(tracks: Track[])` — takes array of Track objects, not indices
- Font files (Bravura.*) must be copied to `public/font/` + explicit `core.fontDirectory: '/font/'` in AlphaTabApi settings (auto-detection resolves to `/assets/font/` in production bundles)

## Deferred Tasks
- Deferred Phase 9 features planned for Phase 11: keyboard shortcuts, zoom controls, drag-and-drop, spinner overlay, diff navigation
- Git's `link.exe` can shadow MSVC linker on Windows — need Windows SDK + VS Build Tools "Desktop development with C++"

## Key Technical Constraints
- See `riff-diff-claude-code-plan.md` for full constraints
- alphaTab parses GP natively — NO JSZip
- Worker files (`alphaTab.worker.*` + `alphaTab.core.mjs`) must be copied to `public/` AND `public/assets/`
- Font files must be copied to `public/font/`; set `core.fontDirectory: '/font/'` explicitly
- Tauri asset protocol serves `.mjs` as `text/html` — must override Content-Type in `on_web_resource_request`
- Tauri release builds need COOP/COEP headers injected via `WebviewWindowBuilder::on_web_resource_request`
- File filters: .gp, .gp7, .gp8 only (no GP5/GP6)
