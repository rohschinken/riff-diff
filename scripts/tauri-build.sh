#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION=$(node -p "require('./package.json').version")
BUNDLE_DIR="dist/bundle"

echo "=== Step 1: Tauri desktop (deb + rpm) ==="
mkdir -p "$BUNDLE_DIR"
npm run tauri -- build

echo ""
echo "=== Step 2: Collect artifacts ==="
mkdir -p "$BUNDLE_DIR"
cp -v src-tauri/target/release/riff-diff "$BUNDLE_DIR/riff-diff"
cp -v "src-tauri/target/release/bundle/deb/Riff-Diff_${VERSION}_amd64.deb" "$BUNDLE_DIR/" 2>/dev/null || true
cp -v "src-tauri/target/release/bundle/rpm/Riff-Diff-${VERSION}-1.x86_64.rpm" "$BUNDLE_DIR/" 2>/dev/null || true

echo ""
echo "=== Done ==="
echo "  Web:         dist/"
echo "  Binary:      $BUNDLE_DIR/riff-diff"
echo "  DEB:         $BUNDLE_DIR/Riff-Diff_${VERSION}_amd64.deb"
echo "  RPM:         $BUNDLE_DIR/Riff-Diff-${VERSION}-1.x86_64.rpm"
