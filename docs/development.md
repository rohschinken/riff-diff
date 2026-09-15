# Riff-Diff — Development & Building

Developer-focused docs for the Riff-Diff codebase: the tech stack, local setup, available scripts, and how to build desktop installers for each platform. For contribution guidelines see [CONTRIBUTING.md](../CONTRIBUTING.md); for design decisions see [architecture.md](architecture.md).

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
| `npm run tauri:build` | Desktop builds — deb + rpm |
| `npm run build:all` | All builds (web + desktop) |

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
- **MSI installer:** `src-tauri/target/release/bundle/msi/Riff-Diff_1.3.0_x64_en-US.msi`
- **NSIS installer:** `src-tauri/target/release/bundle/nsis/Riff-Diff_1.3.0_x64-setup.exe`

The portable `.exe` is fully self-contained (frontend embedded in the binary) and can be run directly without installation. The installers add Start Menu shortcuts and register for uninstall. All variants require WebView2 (pre-installed on Windows 10 1803+ and Windows 11).

### macOS

Requires [Rust](https://www.rust-lang.org/tools/install) and Xcode Command Line Tools.

```bash
npm run tauri:build
```

Output:
- `src-tauri/target/release/bundle/dmg/Riff-Diff_1.3.0_aarch64.dmg` (Apple Silicon)
- `src-tauri/target/release/bundle/macos/Riff-Diff.app`

### Linux

Requires [Rust](https://www.rust-lang.org/tools/install) and system dependencies (`libwebkit2gtk-4.1-dev`, `libappindicator3-dev`, etc.).

```bash
# Desktop only (deb + rpm)
npm run tauri:build

# Or everything at once (web + desktop)
npm run build:all
```

Output:
- Binary: `dist/bundle/riff-diff`
- DEB: `dist/bundle/Riff-Diff_1.3.0_amd64.deb`
- RPM: `dist/bundle/Riff-Diff-1.3.0-1.x86_64.rpm`

> **Note:** Desktop builds are platform-specific — you can only build for the OS you're currently running on.