#!/bin/sh
# Removes everything install.sh put on this system.
set -eu

DATA="${XDG_DATA_HOME:-$HOME/.local/share}"

rm -rf "$DATA/solar-system-explorer"
rm -f "$HOME/.local/bin/solar-system-explorer-offline"
rm -f "$DATA/applications/solar-system-explorer.desktop"
rm -f "$DATA/icons/hicolor/scalable/apps/solar-system-explorer.svg"
for s in 48 128 256; do
  rm -f "$DATA/icons/hicolor/${s}x${s}/apps/solar-system-explorer.png"
done

command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$DATA/applications" 2>/dev/null || true
command -v kbuildsycoca6 >/dev/null 2>&1 && kbuildsycoca6 >/dev/null 2>&1 || true
echo "Solar System Explorer removed."
