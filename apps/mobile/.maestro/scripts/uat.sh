#!/usr/bin/env bash
# UAT helper for DinnerTime — drives the iOS Simulator + Maestro from one place.
#
# Usage:
#   ./uat.sh boot          # boot the configured simulator
#   ./uat.sh shot [name]   # save a screenshot to .maestro/screenshots/
#   ./uat.sh log           # tail the simulator's syslog filtered to DinnerTime
#   ./uat.sh smoke         # run the smoke flow
#   ./uat.sh all           # run every flow
#   ./uat.sh open          # open the booted simulator window
#   ./uat.sh reset         # erase the simulator (fresh state)

set -euo pipefail

SIM_NAME="${SIM_NAME:-iPhone 17 Pro}"
APP_ID="${APP_ID:-com.dinnertime.app}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"        # .maestro/
APP_ROOT="$(cd "$ROOT/.." && pwd)"               # apps/mobile/
SHOT_DIR="$ROOT/screenshots"
mkdir -p "$SHOT_DIR"

cmd="${1:-help}"
shift || true

case "$cmd" in
  boot)
    xcrun simctl boot "$SIM_NAME" 2>/dev/null || true
    open -a Simulator
    xcrun simctl list devices | grep "$SIM_NAME " | head -1
    ;;
  open)
    open -a Simulator
    ;;
  shot)
    name="${1:-shot-$(date +%s)}"
    out="$SHOT_DIR/${name}.png"
    xcrun simctl io booted screenshot "$out"
    echo "$out"
    ;;
  log)
    xcrun simctl spawn booted log stream --level debug \
      --predicate "process == \"DinnerTime\" OR processImagePath CONTAINS \"DinnerTime\""
    ;;
  reset)
    xcrun simctl shutdown "$SIM_NAME" 2>/dev/null || true
    xcrun simctl erase "$SIM_NAME"
    ;;
  smoke)
    cd "$APP_ROOT"
    maestro test .maestro/smoke.yaml
    ;;
  all)
    cd "$APP_ROOT"
    maestro test .maestro/
    ;;
  help|*)
    grep '^#' "$0" | sed 's/^# \{0,1\}//'
    ;;
esac
