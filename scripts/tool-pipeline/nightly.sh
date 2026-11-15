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

set +e
nice -n 10 node scripts/tool-pipeline/tick.mjs --slot nightly "$@"
rc=$?
set -e
echo "=== $(date -Iseconds) tool pipeline tick exit:$rc ==="

# A successful publish still needs the GitHub quality workflow and the Cloudflare
# Pages deploy to finish. Poll until that settles so a broken deploy is reverted
# the same night instead of waiting for a human or the next morning's report.
if [[ "$rc" -eq 0 && "${SKIP_VERIFY:-0}" != "1" ]]; then
  verify_rc=0
  MAX_ATTEMPTS="${VERIFY_MAX_ATTEMPTS:-25}" bash scripts/tool-pipeline/verify-later.sh || verify_rc=$?
  echo "=== $(date -Iseconds) verify-later exit:$verify_rc ==="
fi

echo "=== $(date -Iseconds) tool pipeline done ==="
exit "$rc"
