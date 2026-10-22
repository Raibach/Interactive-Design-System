/**
 * THE ROOM GATES' CEILING — the dead stop, and the ONLY clock left in a room's opening.
 *
 * THE MINIMUMS ARE GONE (owner, 2026-10-21: *"remove those time minimums"*). They were a floor
 * against a single-frame pop while the layout measured itself — 3 000 ms, retuned to 800 ms on
 * 2026-10-19 — but a floor is still a hold: it kept the ring turning after the room was ready.
 * What is left is the truth of the room: a gate lifts the moment its real hands have landed
 * (Product: the frame's load AND the seat; Governance: the seat), and the ceiling is the only
 * timer — ten seconds, the owner's law (2026-10-21), after which the gate comes down whatever
 * has or has not happened and the room shows its real state. A cover may never outlive the
 * truth it stands over. One ceiling per room, because a room may retune its own gate without
 * touching another's.
 */
export const PRODUCT_GATE_MAX_MS = 10_000;
export const GOVERNANCE_GATE_MAX_MS = 10_000;

/*
 * TEN SECONDS, BOTH ROOMS (owner's law, 2026-10-21). This was briefly widened to thirty for
 * Product because the app builder's project page measured nine seconds to finish loading — and
 * that was the wrong fix: a longer stopwatch does not make a page arrive sooner, it only moves
 * the moment the room tells the truth. The load time is the defect, and it is being fixed at its
 * source (the builder's project page), not here. When a room's own hand cannot arrive inside the
 * bound, the room says so — the ceiling is the honest end of a wait, never a way to avoid it.
 */
