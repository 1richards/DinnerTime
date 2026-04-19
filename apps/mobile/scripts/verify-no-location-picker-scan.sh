#!/usr/bin/env bash
# Phase 18-04 purity gate: LocationPicker is retired. AI classifies each
# pantry item's location; the review-screen chip is the single override
# point. No scan-entry screen or tabs screen may import or render
# LocationPicker. Exits non-zero on violation (no masked failures).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# 1. No `LocationPicker` imports anywhere under src/
IMPORT_HITS=$(grep -rn "from .*pantry/LocationPicker" "$ROOT/src" || true)
if [[ -n "$IMPORT_HITS" ]]; then
  echo "FAIL: LocationPicker imports still present:"
  echo "$IMPORT_HITS"
  exit 1
fi

# 2. No `<LocationPicker ... />` JSX anywhere under src/
JSX_HITS=$(grep -rn "<LocationPicker" "$ROOT/src" || true)
if [[ -n "$JSX_HITS" ]]; then
  echo "FAIL: <LocationPicker /> JSX still rendered:"
  echo "$JSX_HITS"
  exit 1
fi

# 3. No hardcoded sourceLocation route param under scan/
SOURCE_HITS=$(grep -rEn "sourceLocation:[[:space:]]*['\"]pantry['\"]" "$ROOT/src/app/scan" || true)
if [[ -n "$SOURCE_HITS" ]]; then
  echo "FAIL: hardcoded sourceLocation: 'pantry' nav param still present:"
  echo "$SOURCE_HITS"
  exit 1
fi

# 4. LocationPicker.tsx file must be deleted
if [[ -f "$ROOT/src/components/pantry/LocationPicker.tsx" ]]; then
  echo "FAIL: apps/mobile/src/components/pantry/LocationPicker.tsx still exists"
  exit 1
fi

echo "OK: LocationPicker fully retired from apps/mobile/src"
