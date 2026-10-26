#!/bin/bash
# Flight recorder for the local container stack.
#
# WHY THIS EXISTS: when the colima VM or the Docker daemon inside it dies, every
# log written inside that VM dies with it. The observer has to live on the Mac
# side and write into the workspace, or the death leaves no evidence at all.
#
# WHAT IT READS (nothing else):
#   - `docker ps` / `docker stats --no-stream` / `docker events` -> the LOCAL Docker daemon only
#   - `colima ssh -- free -m`                                   -> the VM's own memory counters
# It never starts, stops, restarts or prunes anything.
#
# OUTPUT (inside the workspace):
#   logs/stack-recorder/samples-<date>.log   one line per container per sample + one heartbeat
#   logs/stack-recorder/events-<date>.log    docker events: die/oom/kill/start/stop with exit codes
#   logs/stack-recorder/crash-<name>-<ts>.log  full `docker logs --tail 400` captured the moment a container dies
#   logs/stack-recorder/daemon-loss-<ts>.log   last known state written when the daemon stops answering
#
# START: nohup bash development/ops/record-stack.sh < /dev/null >> ~/Library/Logs/raibach/stack-recorder.log 2>&1 &
# STOP:  pkill -f record-stack.sh
#
# The interval is a knob, not a fallback: SAMPLE_SECS defaults to 15.

set -u
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export PATH="$ROOT/runtime/bin:$PATH"
OUT="$ROOT/logs/stack-recorder"
SAMPLE_SECS="${SAMPLE_SECS:-15}"
mkdir -p "$OUT"

now() { date -u +%Y-%m-%dT%H:%M:%SZ; }
day() { date -u +%Y-%m-%d; }

# --- events watcher: records every state change and captures the dying container's own log ---
(
  while :; do
    # Reconnects by design: when the daemon dies, this loop notices and keeps waiting.
    # A reconnect is not a failure being hidden -- the gap is written to the events log.
    if ! docker events --format '{{.Time}}|{{.Action}}|{{.Actor.Attributes.name}}|{{.Actor.Attributes.exitCode}}|{{.Actor.Attributes.image}}' >> "$OUT/events-$(day).log" 2>>"$OUT/events-$(day).log"; then
      echo "$(now)|EVENTS-LOST|daemon unreachable, watching for return" >> "$OUT/events-$(day).log"
      sleep 3
    fi
  done
) &
EVENTS_PID=$!

# --- crash capture: the instant a container dies, keep its own words ---
# A `die` event fires for exit 137 and for a clean exit alike; the exit code is in the
# events log, and the container's last 400 log lines land beside it before anything recycles.
(
  while :; do
    docker events --filter event=die --format '{{.Actor.Attributes.name}}' 2>/dev/null \
      | while read -r name; do
          [ -z "$name" ] && continue
          safe="$(echo "$name" | tr -c 'A-Za-z0-9._-' '_')"
          docker logs --tail 400 "$name" > "$OUT/crash-$safe-$(date -u +%Y%m%dT%H%M%SZ).log" 2>&1
        done
    sleep 3
  done
) &

# --- sampler: heartbeat + per-container memory timeline ---
daemon_ok=""
while :; do
  ts="$(now)"
  if docker info >/dev/null 2>&1; then
    if [ "$daemon_ok" = "no" ]; then
      echo "$ts|DAEMON-BACK" >> "$OUT/samples-$(day).log"
    fi
    daemon_ok="yes"
    count="$(docker ps -q 2>/dev/null | wc -l | tr -d ' ')"
    vm="$(colima ssh -- sh -c 'free -m' 2>/dev/null | awk '/^Mem:/{printf "%s/%s", $3, $2}')"
    [ -z "$vm" ] && vm="vm-ssh-refused"
    echo "$ts|HEARTBEAT|containers=$count|vm_used_mb/$vm" >> "$OUT/samples-$(day).log"
    docker stats --no-stream --format '{{.Name}}|{{.MemUsage}}|{{.MemPerc}}|{{.CPUPerc}}' 2>/dev/null \
      | while IFS='|' read -r name mem pct cpu; do
          [ -z "$name" ] && continue
          echo "$ts|CONTAINER|$name|$mem|$pct|$cpu" >> "$OUT/samples-$(day).log"
        done
  else
    if [ "$daemon_ok" != "no" ]; then
      # The moment the daemon stops answering: write everything still readable, then stop pretending.
      d="$OUT/daemon-loss-$(date -u +%Y%m%dT%H%M%SZ).log"
      {
        echo "daemon lost at $ts"
        echo "--- last 60 sample lines ---"
        tail -60 "$OUT/samples-$(day).log" 2>/dev/null
        echo "--- last 40 event lines ---"
        tail -40 "$OUT/events-$(day).log" 2>/dev/null
        echo "--- colima status ---"
        colima status 2>&1
      } > "$d"
      echo "$ts|DAEMON-LOST|wrote $d" >> "$OUT/samples-$(day).log"
      daemon_ok="no"
    fi
  fi
  sleep "$SAMPLE_SECS"
done
