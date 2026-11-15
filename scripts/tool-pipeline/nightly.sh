#!/usr/bin/env bash
# systemd entry point for the CloverTools daily tool pipeline.
set -euo pipefail

REPO="/home/ubuntu/Clovertools"
cd "$REPO"

export PATH="/usr/local/bin:/usr/bin:/bin:/usr/local/sbin:/usr/sbin"
export HOME="/home/ubuntu"
export TZ="Asia/Shanghai"
export ASTRO_TELEMETRY_DISABLED="1"
export GIT_TERMINAL_PROMPT="0"

mkdir -p "$REPO/.editorial/tool-runs"

# Host-wide single-instance guard (the Node process also has a per-run lock).
exec 9>"$REPO/.editorial/tool-runs/pipeline.lock"
if ! flock -n 9; then
  echo "[nightly] another pipeline process holds the lock; exiting"
  exit 0
fi

LOG="$REPO/.editorial/tool-runs/nightly.log"
exec >>"$LOG" 2>&1

echo "=== $(date -Iseconds) tool pipeline start ==="

if [[ -z "${PLAYWRIGHT_EXECUTABLE_PATH:-}" ]]; then
  CHROME="$(find "$REPO/.playwright-browsers" -maxdepth 3 -type f -name chrome 2>/dev/null | head -n 1 || true)"
  if [[ -n "$CHROME" ]]; then
    export PLAYWRIGHT_EXECUTABLE_PATH="$CHROME"
  fi
fi

exec nice -n 10 node scripts/tool-pipeline/tick.mjs --slot nightly "$@"
