![Riff-Diff Icon](https://github.com/rohschinken/riff-diff/blob/main/assets/rd-desktop-icon-128.png?raw=true&v=1.3.0)

# Riff-Diff v1.3.0

Visual diff tool for Guitar Pro 7/8 (`.gp`, `.gp7`, `.gp8`) files. Load two versions of a song and see exactly what changed - notes, tempo, time signatures - highlighted directly on the sheet music and tablature.

![Riff-Diff Screenshot](https://github.com/rohschinken/riff-diff/blob/main/assets/Riff-Diff_Screenshot_1.png?raw=true&v=1.3.0)

## Try It

**[Use Riff-Diff in your browser](https://rohschinken.github.io/riff-diff/)** — no installation needed.

## Download

Desktop installers for Windows, macOS, and Linux are attached to every [release](https://github.com/rohschinken/riff-diff/releases):

| Platform | Installers |
|----------|------------|
| Windows 10 1803+ / Windows 11 | NSIS installer (`.exe`) · MSI (`.msi`) |
| macOS | DMG — Apple Silicon |
| Linux | `.deb` · `.rpm` |

Starting with **v1.3.0**, every installer — Windows, macOS, and Linux — is built automatically by [GitHub Actions](.github/workflows/release.yml) when a version tag is pushed, so every release ships installers for all platforms. Windows installers use the built-in WebView2 runtime. The [browser version](https://rohschinken.github.io/riff-diff/) is published to GitHub Pages on the same tag, keeping the hosted app in sync with each release.

## How It Works

1. **Load two GP files** into the top (File A) and bottom (File B) panes — click the Open button or drag-and-drop files onto each pane
2. **Colored overlays** appear on beats that differ between the two files:
   - **Green** — bar added in File B
   - **Red** — bar removed from File A
   - **Yellow** — beat changed (different notes, rhythm, or articulation)
   - **Purple** — tempo or time signature changes
3. **Comparison direction** — toggle A → B / B → A to swap the meaning of added and removed
4. **Switch tracks** to compare individual instruments (guitar, bass, drums, etc.)
5. **Diff minimap** a color-coded bird's-eye overview — click or drag to seek
6. **Filter toggles** in the header let you show/hide Changed, Added/Removed, and Tempo/TimeSig diffs
7. **Notation toggle** — show or hide the standard notation stave via the header button
8. **Bar width** — adjust with +/- buttons so both panes use uniform bar widths for easier visual alignment
9. **Zoom** — zoom in/out via header buttons or Ctrl/Cmd +/-/0; both panes zoom together; preference is persisted

The diff engine uses similarity-based alignment at two levels: bars are aligned across measures using a Needleman-Wunsch algorithm that scores content similarity (not just exact match), and beats within each matched bar pair are aligned via LCS (Longest Common Subsequence). Phantom (empty) bars are inserted to visually align added/removed measures between panes.

## Contributing

**We welcome contributions** — bug reports, feature ideas, documentation, and pull requests are all appreciated. See [CONTRIBUTING.md](CONTRIBUTING.md) for how to get involved.

See [docs/development.md](docs/development.md) for the tech stack, local setup, available scripts, and how to build installers for each platform.

## Known Issues

- **UI flickering**: Changing the bar width can sometimes cause the UI to start flickering randomly. This seems to happen more often when working with large files. Changing the zoom level triggers a re-render, which usually stops the flickering.
- **Mobile responsive styles**: The web app is not yet optimized for small screens (window widths below ~960px). Menus / buttons may not wrap gracefully on small displays.
- **File picker does not work on iOS**: iOS Safari blocks the in-browser file picker for the web version. Please use the desktop app or a desktop browser instead.
- **Drum tab notation**: Percussion tracks render standard notation only. Showing drum tabs alongside standard percussion notation would require upstream alphaTab support.

## License

GPL-3.0
