#!/bin/bash
# THE BUILDER'S WATCHDOG (2026-10-19).
#
# The builder pair (Next dev :3223 + the local engine :4000) has died silently more than once —
# sometimes with the pair's own hard-fail ("the engine exited — stopping the builder too"), once
# with no exit trace at all (an outside kill). Nothing restarts it: macOS refuses to run a
# launchd job whose script lives under ~/Documents (measured 2026-10-15:
# "/bin/bash: …/start-all-local.sh: Operation not permitted"). This loop is the supervisor that
# does: when the pair exits, it says so and starts it again. It lives with the login session —
# after a reboot, start it once with the command in the header below.
#
# Start detached (the only start form):
#   nohup bash development/ops/watch-builder.sh < /dev/null >> runtime/builder-watchdog.log 2>&1 &
#
# Stop it:
#   pkill -f watch-builder.sh   (the pair it started is stopped with the same signal group)
set -u
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT/product/ai-app-builder-open" || exit 1
while true; do
  echo "[watchdog] $(date '+%Y-%m-%d %H:%M:%S') starting the builder pair"
  bash run-dev-local.sh
  code=$?
  echo "[watchdog] $(date '+%Y-%m-%d %H:%M:%S') builder pair exited ($code) — restarting in 5s"
  sleep 5
done
