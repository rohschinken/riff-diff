# Riff-Diff

Visual diff tool for Guitar Pro 7/8 (`.gp`, `.gp7`, `.gp8`) files. Load two versions of a song and see exactly what changed — notes, tempo, time signatures — highlighted directly on the sheet music and tablature.

## How It Works

1. **Load two GP files** into the top (File A) and bottom (File B) panes
2. **Colored overlays** appear on beats that differ between the two files:
   - **Green** — beat added in File B
   - **Red** — beat removed from File A
   - **Yellow** — beat changed (different notes, rhythm, or articulation)
   - **Faded ghost** — marks measures where the other file has extra content
   - **Amber badge** — tempo or time signature change
3. **Switch tracks** to compare individual instruments (guitar, bass, drums, etc.)
4. **Scroll both panes together** via the shared scrollbar at the bottom
5. **Diff minimap** above the scrollbar shows a bird's-eye overview — click or drag to seek

The diff engine uses LCS (Longest Common Subsequence) alignment on beat signatures within each measure, so inserted or removed beats don't cause cascading mismatches. Both standard notation and tablature are always shown.

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
- **Phase 6** — Synchronized Scrolling (complete)
- **Phase 7** — Diff Minimap (complete)
- Phase 8 — Diff Filter Toggles
- Phase 9 — UI Polish
- Phase 10 — Tauri Desktop Packaging

## License

GPL-3.0
