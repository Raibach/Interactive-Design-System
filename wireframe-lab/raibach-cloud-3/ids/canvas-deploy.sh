#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# Canvas deploy — run ON the box (raibach-cloud-3), as root.
#
# Shipping path: the image is built on the Mac (development/canvas/Dockerfile)
# and arrives as /opt/raibach/ids/canvas-image.tar.gz. This script loads it,
# stages the state volume, merges the compose service, swaps the Caddy /dev
# door, brings the service up and verifies it. Idempotent — re-runs are safe.
#
# Expected alongside (rsynced by the deployer):
#   /opt/raibach/ids/canvas-compose.yml     the service snippet
#   /opt/raibach/ids/canvas-stage/          settings.json + secrets.json
# ═══════════════════════════════════════════════════════════════════════════════
set -uo pipefail

IDS=/opt/raibach/ids
WP=/opt/raibach/wp
LOG=/root/canvas-deploy.log
exec >>"$LOG" 2>&1
echo "════════ $(date -u +%FT%TZ) deploy start ════════"

# ── 1. image ─────────────────────────────────────────────────────────────────
if [ -f "$IDS/canvas-image.tar.gz" ]; then
  echo "loading canvas image (gunzip | docker load)…"
  gunzip -c "$IDS/canvas-image.tar.gz" | docker load || { echo "LOAD FAILED"; exit 1; }
else
  echo "no canvas-image.tar.gz present — assuming the image is already loaded"
fi
docker image inspect raibach-canvas:2026-10-11 >/dev/null || { echo "NO IMAGE raibach-canvas:2026-10-11"; exit 1; }
echo "image present"

# ── 2. state volume (first install only — never clobber live state) ─────────
mkdir -p "$IDS/data/canvas/agent-canvas" "$IDS/data/canvas/automation"
for f in settings.json secrets.json; do
  if [ -f "$IDS/canvas-stage/$f" ] && [ ! -f "$IDS/data/canvas/$f" ]; then
    cp "$IDS/canvas-stage/$f" "$IDS/data/canvas/$f"
    echo "staged $f"
  fi
done

# ── 3. compose service (idempotent placement) ────────────────────────────────
cd "$IDS" || exit 1
python3 "$IDS/fix-compose-insert.py" || { echo "COMPOSE INSERT FAILED — stopping"; exit 1; }
docker compose config >/dev/null || { echo "COMPOSE CONFIG INVALID — stopping"; exit 1; }

# ── 4. the door: /dev* -> canvas:8090 (replaces the 503 placeholder) ─────────
# HARDENED 2026-10-11 after a real incident: the first version's regex
# (handle /dev\* \{.*?\n\}\n) ran past the indented closing brace of the old
# block and swallowed everything to the file's last column-0 brace — including
# the catch-all `handle { reverse_proxy studio:5001 }`. The site then answered
# empty 200s for / and /api/* (Caddy: site matched, no handler ran) while every
# section route stayed green. This version replaces the block by BRACE COUNTING
# and refuses to write unless the studio catch-all is still present.
python3 - <<'PY'
p = "/opt/raibach/wp/caddy/Caddyfile"
src = open(p).read()
if "reverse_proxy canvas:8090" in src:
    print("Caddyfile already routes /dev -> canvas")
    raise SystemExit(0)
lines = src.splitlines(keepends=True)
start = next((i for i, l in enumerate(lines) if l.lstrip().startswith("handle /dev* {")), None)
if start is None:
    raise SystemExit("FAIL: no /dev* block found — not touching the Caddyfile")
depth = 0
end = None
for i in range(start, len(lines)):
    depth += lines[i].count("{") - lines[i].count("}")
    if depth == 0:
        end = i
        break
if end is None:
    raise SystemExit("FAIL: /dev* block never closes — not touching")
indent = lines[start][: len(lines[start]) - len(lines[start].lstrip())]
block = [f"{indent}handle /dev* {{\n", f"{indent}\treverse_proxy canvas:8090\n", f"{indent}}}\n"]
out = "".join(lines[:start] + block + lines[end + 1:])
for guard in ("reverse_proxy studio:5001", "reverse_proxy frame-proxy:8080", "reverse_proxy builder:3223"):
    if guard not in out:
        raise SystemExit(f"FAIL: {guard} would be lost — not writing")
open(p, "w").write(out)
print("Caddyfile: /dev -> canvas:8090 (brace-counted; catch-all intact)")
PY
[ $? -ne 0 ] && { echo "DOOR EDIT FAILED — stopping"; exit 1; }

# ── 5. up + reload + verify ──────────────────────────────────────────────────
cd "$IDS" || exit 1
docker compose up -d canvas || { echo "UP FAILED"; exit 1; }
cd "$WP" || exit 1
docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile \
  || echo "WARN: caddy reload returned nonzero — check its log"

echo "waiting for the canvas to answer…"
for i in $(seq 1 20); do
  if docker exec ids-frame-proxy wget -qO- --timeout=4 http://canvas:8090/dev/server_info >/tmp/canvas-verify.json 2>/dev/null; then
    echo "── verify (in-network): /dev/server_info ──"
    head -c 260 /tmp/canvas-verify.json; echo
    echo "OK: canvas answers on /dev/server_info"
    break
  fi
  [ "$i" = "20" ] && {
    echo "VERIFY FAILED after $i tries — container logs:"
    docker logs --tail 80 ids-canvas-1 2>&1
  }
  sleep 6
done

echo "── verify (through the door, box-local) ──"
curl -kfsS --max-time 10 https://design.system.raibach.net/dev/server_info | head -c 260 && echo && echo "OK: the door forwards /dev" || echo "door check failed (check caddy log)"
echo "════════ $(date -u +%FT%TZ) deploy end ════════"
