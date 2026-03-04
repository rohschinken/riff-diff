# Riff-Diff

Visual diff tool for Guitar Pro 7/8 (`.gp`, `.gp7`, `.gp8`) files. Load two versions of a song and see exactly what changed — notes, tempo, time signatures — highlighted directly on the tab notation.

## Stack

React, TypeScript, Vite, Tailwind v4, alphaTab, Vitest. Tauri v2 desktop packaging planned.

## Getting Started

```bash
npm install
cp node_modules/@coderline/alphatab/dist/alphaTab.worker.* public/
mkdir -p public/font && cp node_modules/@coderline/alphatab/dist/font/Bravura.{eot,otf,svg,woff,woff2} public/font/
npm run dev
```

Open `http://localhost:5173`. Click "Open File A" / "Open File B" to load `.gp` files into the top and bottom panes. Use the track tabs to switch between instruments.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Type-check + production build |
| `npm test` | Run tests (Vitest) |
| `npm run test:ui` | Vitest browser UI |

## Project Status

- **Phase 1** — Scaffold & Tooling (complete)
- **Phase 2** — alphaTab Rendering, single pane (complete)
- **Phase 3** — Dual Pane & Track Switcher (complete)
- **Phase 4** — Diff Engine (complete)
- **Phase 5** — Diff Overlay (complete)
- Phase 6 — Synchronized Scrolling
- Phase 7 — Diff Minimap
- Phase 8 — Diff Filter Toggles
- Phase 9 — UI Polish
- Phase 10 — Tauri Desktop Packaging

## License

GPL-3.0
