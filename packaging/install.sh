#!/bin/sh
# Installs Solar System Explorer for the current user (no sudo): a menu entry with an icon.
#   install.sh                    online launcher: opens the live site in your default browser
#   install.sh --offline          also installs a local copy that runs without internet
#   install.sh --offline --from F use tarball F instead of downloading the latest release
set -eu

REPO="WitcherLXXIX/solar-system-explorer"
LIVE_URL="https://witcherlxxix.github.io/solar-system-explorer/"
RAW="https://raw.githubusercontent.com/$REPO/master/packaging"
RELEASE_TAR="https://github.com/$REPO/releases/latest/download/solar-system-explorer.tar.gz"

DATA="${XDG_DATA_HOME:-$HOME/.local/share}"
APP_DIR="$DATA/solar-system-explorer"
BIN_DIR="$HOME/.local/bin"
ICON_DIR="$DATA/icons/hicolor"

offline=0
tarball=""
while [ $# -gt 0 ]; do
  case "$1" in
    --offline) offline=1 ;;
    --from) shift; tarball="${1:?--from needs a file}" ;;
    -h|--help) sed -n '2,6p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
  shift
done

here="$(cd "$(dirname "$0")" 2>/dev/null && pwd || true)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

fetch() { # fetch <url> <dest>
  if command -v curl >/dev/null 2>&1; then curl -fsSL "$1" -o "$2"
  elif command -v wget >/dev/null 2>&1; then wget -q "$1" -O "$2"
  else echo "need curl or wget to download $1" >&2; exit 1; fi
}

# Use files next to this script when run from a checkout; otherwise download them.
asset() { # asset <relative path> -> prints a local path
  if [ -n "$here" ] && [ -f "$here/$1" ]; then echo "$here/$1"; return; fi
  mkdir -p "$work/$(dirname "$1")"
  fetch "$RAW/$1" "$work/$1"
  echo "$work/$1"
}

echo "Installing icon..."
mkdir -p "$ICON_DIR/scalable/apps"
cp "$(asset icons/solar-system-explorer.svg)" "$ICON_DIR/scalable/apps/solar-system-explorer.svg"
for s in 48 128 256; do
  mkdir -p "$ICON_DIR/${s}x${s}/apps"
  cp "$(asset icons/solar-system-explorer-$s.png)" "$ICON_DIR/${s}x${s}/apps/solar-system-explorer.png"
done

if [ "$offline" -eq 1 ]; then
  command -v python3 >/dev/null 2>&1 || { echo "offline mode needs python3" >&2; exit 1; }
  if [ -z "$tarball" ]; then
    echo "Downloading the latest release (about 70 MB)..."
    tarball="$work/release.tar.gz"
    fetch "$RELEASE_TAR" "$tarball"
  fi
  echo "Installing offline copy..."
  rm -rf "$APP_DIR/www"
  mkdir -p "$APP_DIR/www" "$BIN_DIR"
  tar -xzf "$tarball" -C "$APP_DIR/www"
  [ -f "$APP_DIR/www/solar-system-explorer/index.html" ] || { echo "tarball did not contain solar-system-explorer/index.html" >&2; exit 1; }
  cp "$(asset solar-system-explorer-offline)" "$BIN_DIR/solar-system-explorer-offline"
  chmod +x "$BIN_DIR/solar-system-explorer-offline"
  exec_line="$BIN_DIR/solar-system-explorer-offline"
else
  exec_line="xdg-open $LIVE_URL"
fi

mkdir -p "$DATA/applications"
cat > "$DATA/applications/solar-system-explorer.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Solar System Explorer
Comment=High-fidelity WebGL solar system visualization
Exec=$exec_line
Icon=solar-system-explorer
Terminal=false
Categories=Education;
StartupNotify=true
EOF

command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$DATA/applications" 2>/dev/null || true
command -v kbuildsycoca6 >/dev/null 2>&1 && kbuildsycoca6 >/dev/null 2>&1 || true

echo "Done. Look for \"Solar System Explorer\" in your application menu."
echo "If the icon looks blank, log out and back in once so the desktop reloads its icon cache."
if [ "$offline" -eq 1 ]; then
  case ":$PATH:" in *":$BIN_DIR:"*) ;; *) echo "Note: $BIN_DIR is not on your PATH; the menu entry works regardless." ;; esac
fi
