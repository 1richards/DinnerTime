#!/usr/bin/env bash
# Phase 15 purity gate: count hand-rolled back-button Pressables under
# apps/mobile/src/app. Phase 15 thesis is "native stack headers everywhere";
# the recipes/[id]/index hero screen keeps a floating back button over the
# hero image (legitimate exception — hero covers full width w/ no header).
#
# Exits non-zero if the total count exceeds the exception budget.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EXPECTED_MAX=1

# Match the full two-line pattern:
#   <Pressable onPress={() => router.back()} ... >
# We count onPress lines containing router.back() that also appear inside
# a Pressable/TouchableOpacity block. Use a 3-line window around each match.
COUNT=$(grep -rn -B2 "onPress.*router\.back" "$ROOT/src/app" 2>/dev/null \
  | grep -cE "(Pressable|TouchableOpacity)" || true)

# Normalize to a clean integer (in case grep -c ever emits extra lines)
COUNT=${COUNT:-0}

if [[ "$COUNT" -gt "$EXPECTED_MAX" ]]; then
  echo "FAIL: $COUNT hand-rolled back Pressables found; expected <= $EXPECTED_MAX (recipes/[id]/index hero)"
  exit 1
fi
echo "OK: $COUNT / $EXPECTED_MAX hand-rolled back Pressables (within budget)"
