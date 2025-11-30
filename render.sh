#!/usr/bin/env bash
# Convenience wrapper to render Sonic Pi .rb files to .mid

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: ./render.sh path/to/file.rb [bars]" >&2
  exit 1
fi

SRC="$1"
if [[ ! -f "$SRC" ]]; then
  echo "File not found: $SRC" >&2
  exit 1
fi

BARS="${2:-8}"
BASE="${SRC%.*}"
OUT="${BASE}.mid"

node "$(dirname "$0")/mcp/render/cli.js" --path "$SRC" --bars "$BARS" --output "$OUT"

echo "Rendered -> $OUT"
