#!/usr/bin/env bash
# Deferred post-publish verification for the CloverTools tool pipeline.
#
# `tick.mjs --verify` only observes reality once, returning "pending" while the
# GitHub quality workflow / Cloudflare Pages deploy is still running. This script
# polls it until the result settles (verified / reverted / failed) so a broken
# publish is auto-reverted minutes after it lands instead of waiting for a human.
#
# Usage: bash scripts/tool-pipeline/verify-later.sh
# Env:   MAX_ATTEMPTS (default 25), SLEEP_BETWEEN (default 60s)
# Exit:  0 settled ok (verified or nothing to verify), 1 verification failed or
#        reverted, 2 still pending after MAX_ATTEMPTS.
set -u

REPO="/home/ubuntu/Clovertools"
cd "$REPO" || exit 2

export HOME="/home/ubuntu"
export PATH="/usr/local/bin:/usr/bin:/bin"

LOG="${VERIFY_LOG:-$REPO/.editorial/tool-runs/verify-later.log}"
mkdir -p "$(dirname "$LOG")"
exec >>"$LOG" 2>&1
echo "=== verify-later start $(date -Iseconds) ==="

MAX_ATTEMPTS="${MAX_ATTEMPTS:-25}"
SLEEP_BETWEEN="${SLEEP_BETWEEN:-60}"

parse_status() {
  node -e 'let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => {
    try { process.stdout.write(String(JSON.parse(s).status ?? "")); } catch { process.stdout.write(""); }
  });'
}

parse_field() {
  node -e 'let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => {
    try {
      const value = JSON.parse(s)[process.argv[1]];
      process.stdout.write(value === undefined || value === null ? "" : String(value));
    } catch { process.stdout.write(""); }
  });' "$1"
}

attempt=1
incident_attempted=0
while [ "$attempt" -le "$MAX_ATTEMPTS" ]; do
  out="$(node scripts/tool-pipeline/tick.mjs --verify 2>>"$LOG")"
  rc=$?
  status="$(printf '%s' "$out" | parse_status)"
  echo "[$attempt] $(date -Iseconds) rc=$rc status=${status:-none} $(printf '%s' "$out" | tr '\n' ' ' | head -c 400)"
  if [ "$rc" -ne 0 ]; then
    echo "verify-later: verify command failed (rc=$rc)"
    exit 1
  fi
  case "$status" in
    verified|skipped)
      echo "=== verify-later done: $status $(date -Iseconds) ==="
      exit 0
      ;;
    deploy-failed)
      echo "=== verify-later failed: $status $(date -Iseconds) ==="
      exit 1
      ;;
    reverted|ci-failed|production-failed)
      # 失败后最多自动修复一次；修复成功则继续轮询新发布的验证结果。
      if [ "${AUTO_INCIDENT_REPAIR:-1}" != "0" ] && [ "$incident_attempted" -eq 0 ]; then
        incident_attempted=1
        echo "=== verify-later incident repair start $(date -Iseconds) status=$status ==="
        inc_rc=0
        inc_out="$(node scripts/tool-pipeline/tick.mjs --repair-incident --json 2>>"$LOG")" || inc_rc=$?
        inc_ok="$(printf '%s' "$inc_out" | parse_field ok)"
        inc_status="$(printf '%s' "$inc_out" | parse_status)"
        echo "incident repair rc=$inc_rc ok=${inc_ok:-none} status=${inc_status:-none} $(printf '%s' "$inc_out" | tr '\n' ' ' | head -c 400)"
        if [ "$inc_rc" -eq 0 ] && [ "$inc_ok" = "true" ] && [ "$inc_status" = "published" ]; then
          echo "=== verify-later incident repair published; polling new result $(date -Iseconds) ==="
          attempt=1
          sleep "$SLEEP_BETWEEN"
          continue
        fi
        echo "verify-later: incident repair did not publish (rc=$inc_rc, status=${inc_status:-none})"
        exit 1
      fi
      echo "=== verify-later failed: $status $(date -Iseconds) ==="
      exit 1
      ;;
    pending|'')
      # The quality workflow has not finished yet, or the deploy job is still
      # running. Keep polling.
      ;;
    *)
      echo "verify-later: unknown status '$status'"
      exit 1
      ;;
  esac
  sleep "$SLEEP_BETWEEN"
  attempt=$((attempt + 1))
done

echo "=== verify-later: still pending after $MAX_ATTEMPTS attempts $(date -Iseconds) ==="
exit 2
