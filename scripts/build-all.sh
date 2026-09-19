#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION=$(node -p "require('./package.json').version")

echo "=== Step 1: Standalone web build ==="
npm run build

echo ""
echo "=== Step 2: Desktop builds (tauri) ==="
npm run tauri:build

echo ""
echo "=== All builds complete ==="
echo "  Web:         dist/"
echo "  Desktop:     dist/bundle/"
echo "    Binary:    dist/bundle/riff-diff"
echo "    DEB:       dist/bundle/Riff-Diff_${VERSION}_amd64.deb"
echo "    RPM:       dist/bundle/Riff-Diff-${VERSION}-1.x86_64.rpm"
