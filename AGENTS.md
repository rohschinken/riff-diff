# Riff-Diff — Agent Guidance

Full spec: `docs/architecture.md`. Keep `README.md` up to date.

## Stack
React 19, TypeScript 7, Vite 8, Tailwind v4 (`@import "tailwindcss"` — no config file), alphaTab 1.8, Vitest 4 (happy-dom), Tauri v2.

## Workflow
- **Ask when uncertain** — don't assume user intent.
- **Test-first**: write failing tests → implement → tests pass.
- **No JSZip** — alphaTab parses GP natively.

## Dev Commands
| Command | Purpose |
|---------|---------|
| `npm run dev` | Vite dev server on `localhost:5173` |
| `npm run build` | `tsc -b && vite build` (typecheck first) |
| `npm test` | `vitest run` |
| `npm run tauri:dev` | Tauri desktop with hot reload |
| `npm run tauri:build` | Desktop builds — deb + rpm + flatpak, outputs to `dist/bundle/` |
| `npm run build:flatpak` | Flatpak only |
| `npm run build:all` | All builds (web + desktop + flatpak) |

## First-Time Setup
After `npm install`, copy alphaTab assets:
```
cp node_modules/@coderline/alphatab/dist/alphaTab.{worker.*,core.mjs} public/
mkdir -p public/assets && cp public/alphaTab.{worker.*,core.mjs} public/assets/
mkdir -p public/font && cp node_modules/@coderline/alphatab/dist/font/Bravura.{eot,otf,svg,woff,woff2} public/font/
```

## Tests
- `test.globals: true` — do **not** import `describe`/`it`/`expect`.
- Files: `src/**/*.test.{ts,tsx}`, co-located with source.
- Environment: happy-dom (not jsdom — CJS/ESM compat issues).
- Setup: `src/test/setup.ts` imports `@testing-library/jest-dom`.
- No `#root` div in happy-dom — tests needing `getElementById('root')` must create it in `beforeEach`.

## alphaTab Criticals

### Type Imports
`import type { model } from '@coderline/alphatab'` then alias: `type Score = model.Score`. Direct `import { Score }` crashes `tsc -b`.

### API Quirks
- `api.load(buffer)` — NOT `loadSong()`.
- Events use `.on()`: `api.postRenderFinished.on(handler)` returns unsubscribe fn. Use `postRenderFinished` (fires after DOM updated), not `renderFinished`.
- `api.renderTracks([track])` takes Track **objects**, not indices: `api.score!.tracks[i]`.
- `settings.display.layoutMode = LayoutMode.Horizontal`. Do NOT set `staveProfile`.
- Player disabled: `enablePlayer: false, enableCursor: false`.
- `settings.core.scriptFile = '/alphaTab.worker.mjs'`.
- **Must set** `core.fontDirectory: '/font/'` explicitly (auto-detection wrong in prod bundles).
- Worker is ESM (`.mjs`). The worker imports `./alphaTab.core.mjs` — both must exist in `public/` AND `public/assets/` (Vite prod resolves via `import.meta.url` relative to `/assets/`).

### forceStaveVisibility()
Call **after every `scoreLoaded`** to override GP file view prefs and prevent percussion crash:
```ts
for (const track of score.tracks)
  for (const staff of track.staves) {
    staff.showStandardNotation = staff.isPercussion ? true : showNotation
    staff.showTablature = true
  }
```
Without this, percussion tracks produce zero renderers → crash.

### BoundsLookup
- `boundsLookup.findBeats(beat)` returns `null` (not `[]`) for missing beats — guard with `?? []`.
- Returns duplicates (one per voice/staff) — deduplicate by position key.
- `boundsLookup.masterBarBounds[index]` for bar bounds.

### Portal Lifecycle
DiffOverlay portals into `.at-surface`. alphaTab clears/rebuilds `.at-surface` children on re-render. **Must clear portal before alphaTab touches DOM**:
- Listen to `api.renderStarted` (fires synchronously before async worker render)
- Call `flushSync(() => setSurfaceEl(null))` to force immediate unmount.
- Re-establish portal in `postRenderFinished`.

### Stale Render Errors
Phantom bar insertion can race async worker renders. Suppress with global `window.addEventListener('error', ...)` matching `alphaTab` filename + `'id'`/`'voices'` in message.

## Diff Engine
- `src/diff/diffEngine.ts` — pure `diffScores()` fn.
- Bar alignment: Needleman-Wunsch with similarity scoring (not binary LCS). Global bar signatures merge all tracks so alignment is track-independent.
- Beat alignment: LCS on beat signatures.
- Phantom bars: `src/diff/phantomBars.ts` — deferred until both panes idle. Voice count must match adjacent bars.

## State & Architecture
- **No Context/Redux** — all state in `App.tsx` via `useState`/`useCallback`.
- Test files in `testfiles/` (gitignored, 8 GP files for manual testing).
- `src/diff/colors.ts` — centralized `DIFF_COLORS` shared by overlay, minimap, filters.

## Vite Config
- Use `import { defineConfig } from 'vitest/config'` (NOT from `'vite'`). `/// <reference types="vitest" />` doesn't work with `tsc -b`.
- `optimizeDeps.exclude: ['@coderline/alphatab']`.
- Set `GITHUB_PAGES=true` env var for GitHub Pages deploy (sets base to `/riff-diff/`).
- `strictPort: true` ensures Tauri devUrl aligns.

## Tauri Desktop
- Tauri detection: `Boolean((window as any).__TAURI_INTERNALS__)`.
- CSP disabled (`null`) — alphaTab uses inline styles, data URIs, worker blobs.
- Window created **programmatically** in `setup()` (empty `windows: []` in config) to inject COOP/COEP headers via `on_web_resource_request` (SharedArrayBuffer requirement).
- `.mjs` served as `text/html` by default — override `Content-Type` to `application/javascript`.
- For Tauri per-test mocking: use `vi.doMock`/`vi.doUnmock` (not hoisted `vi.mock`).
- Build targets: `["deb", "rpm"]` in `tauri.conf.json`. AppImage excluded (FUSE issues in CI).
- `npm run tauri:build` chains Tauri build → optional Flatpak → collects all artifacts into `dist/bundle/`.
- Flatpak: `flatpak/` directory — not a Tauri native target. Built via `build:flatpak` or automatically by `tauri:build`/`build:all` if `flatpak-builder` is installed.

### Flatpak
- Manifest: `flatpak/com.andiman5000.riffdiff.yml`.
- Uses **`org.gnome.Platform//50`** runtime (Freedesktop doesn't include WebKit2GTK).
- **Pre-built binary bundling**: builds from source, network was unavailable (EAI_AGAIN). The `flatpak/` directory is more customized.
  - Build is simply `npm run build` + `node_modules/.bin/tsc -b`.
  - Binary (`src-tauri/target/release/riff-diff`) is pre-built on the host; Flatpak just wraps it.
- **Wayland**: On KDE Plasma + NVIDIA, WebKit2GTK may crash on Wayland. Add `--env=WEBKIT_DISABLE_DMABUF_RENDERER=1` to finish-args as workaround.
- **Locale**: Add `--env=LC_ALL=C.UTF-8` to finish-args to suppress locale warnings.
- **Artifact**: `dist/bundle/Riff-Diff.flatpak` (~15 MB). Install with `flatpak install --bundle`.

## File Formats
Only `.gp`, `.gp7`, `.gp8`. GP5/6 blocked. Percussion drum tab notation not possible (alphaTab limitation).

## CI/CD
`.github/workflows/deploy-pages.yml` — push to `main` deploys to GitHub Pages. Runs `npm ci && npm run build` with `GITHUB_PAGES: true`.
