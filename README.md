![Riff-Diff Icon](https://github.com/rohschinken/riff-diff/blob/main/assets/rd-desktop-icon-128.png?raw=true)

# Riff-Diff v1.0.0

Visual diff tool for Guitar Pro 7/8 (`.gp`, `.gp7`, `.gp8`) files. Load two versions of a song and see exactly what changed — notes, tempo, time signatures — highlighted directly on the sheet music and tablature.

![Riff-Diff Screenshot](https://github.com/rohschinken/riff-diff/blob/main/assets/Riff-Diff_Screenshot_1.png?raw=true)

## Try It

**[Use Riff-Diff in your browser](https://rohschinken.github.io/riff-diff/)** — no installation needed.

## Download

**[Windows (portable .exe)](https://github.com/rohschinken/riff-diff/releases/download/v1.0.0/riff-diff.exe)** — standalone desktop app, no installation needed. Requires Windows 10 1803+ or Windows 11 (WebView2).

See [all releases](https://github.com/rohschinken/riff-diff/releases) for installers (MSI, NSIS).

## How It Works

1. **Load two GP files** into the top (File A) and bottom (File B) panes — click the Open button or drag-and-drop files onto each pane
2. **Colored overlays** appear on beats that differ between the two files:
   - **Green** — beat added in File B
   - **Red** — beat removed from File A
   - **Yellow** — beat changed (different notes, rhythm, or articulation)
   - **Yellow badge** — tempo or time signature change
   - **Faded ghost** — marks measures where the other file has extra content
3. **Switch tracks** to compare individual instruments (guitar, bass, drums, etc.)
4. **Scroll both panes together** via the shared scrollbar at the bottom
5. **Diff minimap** above the scrollbar shows a bird's-eye overview — click or drag to seek
6. **Filter toggles** in the header let you show/hide Added, Removed, Changed, and Tempo/TimeSig diffs
7. **Light/Dark theme** — toggle via the moon/sun icon in the header; preference is persisted
8. **Notation toggle** — show or hide the standard notation stave via the header button; tablature is always visible. Percussion tracks keep notation on (alphaTab can't render tab for percussion). Preference is persisted
9. **Zoom** — zoom in/out via header buttons or Ctrl/Cmd +/-/0; both panes zoom together; preference is persisted

The diff engine uses similarity-based alignment at two levels: bars are aligned across measures using a Needleman-Wunsch algorithm that scores content similarity (not just exact match), and beats within each matched bar pair are aligned via LCS (Longest Common Subsequence). Phantom (empty) bars are inserted to visually align added/removed measures between panes.

## Stack

React, TypeScript, Vite, Tailwind v4, alphaTab, Vitest, Tauri v2.

## Getting Started

```bash
npm install
cp node_modules/@coderline/alphatab/dist/alphaTab.{worker.*,core.mjs} public/
mkdir -p public/assets && cp public/alphaTab.{worker.*,core.mjs} public/assets/
mkdir -p public/font && cp node_modules/@coderline/alphatab/dist/font/Bravura.{eot,otf,svg,woff,woff2} public/font/
npm run dev
```

Open `http://localhost:5173`. Click "Open File A" / "Open File B" to load `.gp` files into the top and bottom panes. Use the track tabs to switch between instruments.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Type-check + production web build |
| `npm test` | Run tests (Vitest) |
| `npm run test:ui` | Vitest browser UI |
| `npm run tauri:dev` | Tauri desktop dev (hot reload) |
| `npm run tauri:build` | Build desktop installer |

## Building

### Web

```bash
npm run build
```

Output: `dist/` — static files ready for any web server. Serve with `npm run preview` to test locally.

### Windows

Requires [Rust](https://www.rust-lang.org/tools/install) and Visual Studio Build Tools with "Desktop development with C++" (includes Windows SDK).

```bash
npm run tauri:build
```

Output:
- **Portable:** `src-tauri/target/release/riff-diff.exe` — standalone, no installation needed
- **MSI installer:** `src-tauri/target/release/bundle/msi/Riff-Diff_0.1.0_x64_en-US.msi`
- **NSIS installer:** `src-tauri/target/release/bundle/nsis/Riff-Diff_0.1.0_x64-setup.exe`

The portable `.exe` is fully self-contained (frontend embedded in the binary) and can be run directly without installation. The installers add Start Menu shortcuts and register for uninstall. All variants require WebView2 (pre-installed on Windows 10 1803+ and Windows 11).

### macOS

Requires [Rust](https://www.rust-lang.org/tools/install) and Xcode Command Line Tools.

```bash
npm run tauri:build
```

Output:
- `src-tauri/target/release/bundle/dmg/Riff-Diff_0.1.0_aarch64.dmg` (Apple Silicon)
- `src-tauri/target/release/bundle/macos/Riff-Diff.app`

### Linux

Requires [Rust](https://www.rust-lang.org/tools/install) and system dependencies (`libwebkit2gtk-4.1-dev`, `libappindicator3-dev`, etc.).

```bash
npm run tauri:build
```

Output:
- `src-tauri/target/release/bundle/deb/riff-diff_0.1.0_amd64.deb`
- `src-tauri/target/release/bundle/appimage/riff-diff_0.1.0_amd64.AppImage`

> **Note:** Desktop builds are platform-specific — you can only build for the OS you're currently running on.

## License

GPL-3.0
