#!/usr/bin/env bash
# Phase 15 purity gate: no Ionicons imports allowed under apps/mobile/src.
# SF Symbols via expo-symbols (components/ui/SymbolIcon) is the only icon
# family. Exits non-zero on violation (no masked failures).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MATCHES=$(grep -rn "from '@expo/vector-icons'" "$ROOT/src" || true)
if [[ -n "$MATCHES" ]]; then
  echo "FAIL: Ionicons imports still present:"
  echo "$MATCHES"
  exit 1
fi
echo "OK: no Ionicons imports under apps/mobile/src"
