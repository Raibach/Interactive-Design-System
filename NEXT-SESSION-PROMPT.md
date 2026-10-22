# NEXT SESSION — START HERE (written 2026-10-16, evening)

Read this file first. Then the tail of `/memories/repo/raibach-ids.md` (the full day's record —
receipts, hashes, mechanisms). The working file of the day:
`frontend/src/pages/WritingAreaIndex.tsx` (md5 32566d74f24e18b038bf9a06939f0547 = exactly what
is live on the box).

## PHASE PROTOCOL (owner, 2026-10-16 — IN FORCE)

Live-site problems: edit **locally** → verify locally (typecheck + in-frame) → files match
(md5 both sides) → **push immediately** (rsync the file list → build studio on the box →
`up -d studio` → caddy reload → verify from outside → door sweep) → **test/measure live**.
No separate per-push word while this phase holds. "Because it's a live site that's causing
the problems."

Box: `ssh -i Keys/hetzner_cloud3 -o UserKnownHostsFile=Keys/known_hosts_hetzner root@188.245.25.26`
· rsync: always `/opt/homebrew/bin/rsync` · declare every command before running · never touch
`.env`/`data/` on the box.

## STATE (all verified today)

**Live (design.system.raibach.net):** entry `assets/index-CewCrXbs.js`, chunk
`WritingAreaIndex-MJipnz9N.js` — carries both Development fixes:
1. **The staged assembly is REMOVED** — no gate cover, no 3s minimum, no seat-wait, no 25s
   ceiling. The room opens straight into the workspace. (The old gate held a READY workspace
   hidden at opacity 0 up to 25s — the owner called it error suppression; it's gone.)
2. **The room-switch hand-off cover** (`#room-handoff-cover`) = solid `#2b2635` + lab tile —
   the transparent grid no longer tints purple over an outgoing room. Ring + sentence are
   HIDDEN for Development targets ("no spinner of ours may stand over that room") and kept
   for Product/Governance. The phrase "Standing up the development workspace…" = **0
   occurrences** in the live bundle.
All doors 200 · 17 containers · box RAM 4.1/7.6 GB · no memory pressure · live builder engine
`{"ok":true}`.

**Local:** builder pair (`:3223` + engine `:4000`) restarted today — it died silently on
10-15 13:45 (log ends with no exit line; the documented hard-kill mode). **RESTART FILE MAP:**
`RESTART-LOCAL.sh` does NOT contain the builder (backend/site/checks only);
`development/ops/start-all-local.sh` §5 → `product/ai-app-builder-open/run-dev-local.sh`
is the builder's home (one detached start form, documented in the script header).

## THE MISSION (owner's words, this evening — the ONLY focus)

> "it snaps and it jerks and it lands hard. It's got a very awkward feeling about it. I just
> wished I could have consistency across all of my tabs. … Governance is loading correctly,
> but as that memory grows and that ram is pressed, it'll slow down and I'll suddenly start
> seeing the Langfuse spinner — so I've got Langfuse spinner, I've got [OpenHands] spinner,
> and development… I'm loading product correctly and all the other tabs — but we can't seem to
> get a handle on the embedded programs."

**One consistent, house-owned loading experience across the embedded rooms** (Product =
builder · Development = OpenHands canvas · Governance = Langfuse), with no snap, no jerk, and
clean landings:

1. **MEASURE FIRST, in-frame** (live + :5001): capture the Development landing at 50–100 ms
   intervals — the owner's exact path: Console → Product (with an open project, so the exit
   guard actually runs) → Development. Identify the snap/jerk/hard-landing frames. The
   residual "purple flash" the owner still reported mid-evening: the guard-window cover
   measured clean (+150 ms: solid ground, no ring, no text) — find the remaining beat with
   tight frames or close it with receipts.
2. **The design direction:** each room's own ground + the ONE house ring/sentence while an
   embedded app is not yet ready → **soft fade** in when the app signals ready (no
   `display:none` snap). The apps' own boot faces (Langfuse's spinner, OpenHands's) either
   retire behind the house face or get restyled to match inside their forks
   (`governance/langfuse-main`, `development/OpenHands-main`). NO manufactured ceilings —
   ten seconds and then the truth, at most.
3. **Consistency inventory, per room:** which spinner shows, when it shows, how the room
   lands (fade vs snap), what the seat/rail does during load. Product currently "loads
   correctly" per the owner — use it as the reference feel, not as untouched ground.

## OPEN THREADS (do NOT start without his word)

- Add the builder pair to `RESTART-LOCAL.sh` so one script brings everything back (offer made).
- Product + Governance rooms still carry staged openings (and their 25s ceilings) — his eye
  may flag them next; Development is the decided shape ("just fade in").
- Room-switch cover face for PRODUCT targets: cover = lab tile vs product gate = composer
  image (seam mismatch since 10-14).
- The unused-but-heavy RAM tenant: Langfuse web+worker ≈ 1.5 GB on the 7.6 GB box — "the
  memory overload… for something that no one's actually using." Trim/replace/split: OPEN.
- 63.78 GB box docker build cache reclaimable (parked, his word).
- WP: one-by-one image fills on his URLs · plugins are HIS reinstalls, never touch without word.

## LAWS (standing)

No suppression · blank beats fake · no fallbacks · fail fast · verify in-frame · notes in
line (AI-to-AI, operative constraints) · declare commands and what they read · deletions only
on his explicit word · he watches live — verify on the shared page when he offers it.
