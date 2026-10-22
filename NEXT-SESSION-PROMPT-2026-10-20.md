# Next session prompt — Raibach_IDS (2026-10-20)

Paste this into a fresh chat to continue from where the last session closed.

## One-line state
The local store is restored and running like a server. Hetzner is abandoned — local is the permanent home. Every engine runs off runtimes vendored inside the repo, and a detached supervisor keeps them all up.

## Verified facts (do not re-litigate)
- **All seven doors are up:** backend :8000 · site :5001 (vite dev source) · builder :3223 + engine :4000 · dev room :8090 (OpenHands) · governance :3100 (Langfuse) · preview :4173 (built).
- **Tunnel:** ngrok → `https://astragalar-santa-unbelligerently.ngrok-free.dev` → `127.0.0.1:4173`, which is the BUILT preview served by `vite preview`. After a source change, rebuild: `cd frontend && npx vite build` (the preview serves the new dist/).
- **Vendored runtimes (all inside the repo):** `runtime/node` (v24.9.0), `runtime/uv/bin` (uv/uvx 0.11.3), `runtime/bin` (docker 29.8.2, colima 0.10.3, lima, limactl 2.2.1). The start scripts lead PATH with `runtime/bin:runtime/node/bin:runtime/uv/bin`.
- **Supervisor:** `development/ops/supervise-all.sh` — one loop that checks ports 8000/5001/3223+4000/8090/4173 **+ the ngrok tunnel** every 15s and starts anything down. **Now runs under launchd (2026-10-20):** LaunchAgent `com.raibach.ids-supervisor` at `~/Library/LaunchAgents/` (source `development/ops/com.raibach.ids-supervisor.plist`), auto-starts at login with KeepAlive. It requires Full Disk Access on `/bin/bash` (granted) — otherwise launchd can't read `~/Documents`. Stop: `launchctl bootout gui/$(id -u)/com.raibach.ids-supervisor`. Manual fallback: `nohup bash development/ops/supervise-all.sh < /dev/null >> ~/Library/Logs/raibach/supervisor.log 2>&1 &` (stop: `pkill -f supervise-all.sh`).
- **Today's changes are already in the built preview:** background images re-encoded to webp (roughly halved: product/composer 516K→231K, canvas art 580K→301K, governance wave 356K→177K, dev lab 236K→77K); gate minimum cut 3000ms→800ms for Product/Governance; `warmLabGrounds` warms five grounds at landing; `DesignSeatShell` accepts ngrok hosts for the PostHog frame.

## The mission for this session
1. **Tab loading — find and remove the artificial delays.** The owner's words: the spinner + fade on each tab is "emotion, not purposeful." Investigate the intentional delays/blockers/fallbacks and remove what isn't needed for a fast, consistent load. Candidates already mapped:
   - Gate clocks: `frontend/src/gate/gateTimings.ts` (PRODUCT/GOVERNANCE min 800ms, max 25s dead stop).
   - The 700ms opacity fades on every gate/cover reveal.
   - The room-switch cover: `#room-handoff-cover` in `WritingAreaIndex.tsx` (`handoffCoverShown`), 10s bound.
   - The Design room's own gate: `frontend/src/design/DesignSeatShell.tsx` (`DESIGN_GATE_MIN_MS = 3000` — still 3s, unlike the others).
   - Cold boots (builder, OpenHands, Langfuse) are the real weight behind the spinners — the gate holds while they boot.
2. **Clean restart of the dev room.** An 8-day-old OpenHands orphan still holds :8090 while the fresh one crashed (`kill EPERM` in `development/dev-tool/node_modules/@openhands/agent-canvas/scripts/dev-process-utils.mjs` `signalProcessTree`). The supervisor guards it now, but the orphan blocks a real restart (the port reads "up").
3. **Langfuse optimization** (owner: "struggling a bit, optimize later").

## Standing laws (hold them)
- Say **restore**, never "rip out" / "tear down" (the owner's framing: this is restoration of the pre-Hetzner local store).
- **Local-only, sovereign.** No Hetzner (abandoned — owner can't access the card, too expensive, 8GB too small). No vendor services. PostHog stays as a reference only — do NOT restore its full stack; the UX tab becomes our own lightweight analytics on our own capture door.
- **Nothing outside the repo** — one sanctioned exception (owner-approved 2026-10-20): the LaunchAgent `~/Library/LaunchAgents/com.raibach.ids-supervisor.plist` (source lives in the repo), which needs Full Disk Access on `/bin/bash`. No other Mac system patches; do not touch `~/Library` otherwise.
- **Investigate before fixing.** Confirm the cause, report facts, end with a decision point. No explanations, no jargon.
- **Verify in-room (browser) only.** Never resize the browser. The sign-in is `dev@local` + the PIN in `frontend/index.html` — use it, but never write it into chat or memory.
- **Do not push anything to a remote.**

## Key files
- Gate clocks: `frontend/src/gate/gateTimings.ts`
- Room-switch cover + preloader: `frontend/src/pages/WritingAreaIndex.tsx`
- Design gate: `frontend/src/design/DesignSeatShell.tsx`
- Supervisor: `development/ops/supervise-all.sh`
- Vendored runtimes: `runtime/node`, `runtime/uv`, `runtime/bin`
