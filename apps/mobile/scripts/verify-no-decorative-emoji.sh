#!/usr/bin/env bash
# Phase 15 purity gate: no decorative emoji (U+1F300-U+1F9FF) under
# apps/mobile/src/app. Empty states must use EmptyState with FOOD_IMAGES
# or SF Symbols — never a raw <Text>📸</Text>.
#
# Leaf components (e.g. RecipeFilterSheet chip emojis, RemixSheet modes)
# are OUT OF SCOPE for Phase 15 — Phase 19's chip/remix rewrite owns them.
#
# BSD grep on Darwin does NOT support -P, so we use perl with -CSD for UTF-8
# input/output handling. Perl is guaranteed on macOS and CI runners.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FILES=$(find "$ROOT/src/app" -type f \( -name '*.ts' -o -name '*.tsx' \))
MATCHES=$(perl -CSD -ne 'print "$ARGV:$.:$_" if /[\x{1F300}-\x{1F9FF}]/' $FILES 2>/dev/null || true)
if [[ -n "$MATCHES" ]]; then
  echo "FAIL: decorative emoji detected in app routes:"
  echo "$MATCHES"
  exit 1
fi
echo "OK: no decorative emoji under apps/mobile/src/app"
