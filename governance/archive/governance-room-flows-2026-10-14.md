# GOVERNANCE ROOM — THE DANCE (user flows, written to be corrected)

Filed 2026-10-14, from the owner's own dictation the same day. This is my read of the goal and of
how the room should behave, written so every flow can be corrected in one word where my read is
off. Everything below is about the GOVERNANCE room only.

## The goal, in the owner's words (2026-10-14)

- "The chat feature is the homepage on every tab. She lands on chat. She's ready to talk about the
  job at hand."
- The header readout — metrics "or some kind of default high-level read out" — is meant to give an
  insight into the governance **no matter which section** the user is in. "That's the eventual goal."
- "The tabs … toggle through the different sections and eventually I'm going to remove them on the
  left hand navigation… We could remove trace now from the left hand navigation because Grace is
  handling it."
- "It's almost like a dance with the user… completely situationally aware of what the user's trying
  to do with a simple click. If I click on trace that means I'm getting ready to work on trace and
  tracing. The default load of the latest trace item is simply a way to fill an empty box and it
  also at the same time teaches the user the relationship visually. Human beings are visual
  learners."
- "The rule is not hardcoded throughout the system. It's completely task based and situational."
- "She can't actually control the governance layer — she can only trigger load of different things
  as the user talks about it."

## Why there were two navigations (the confusion, named)

The app's sections were reachable from TWO places at once: the left-hand nav (clean deep-links) and
Grace's rail (selection-aware deep-links). They disagree by design — a clean jump washes what the
seat is featuring, while her rail carries it. The resolution, per the owner: **the left nav shrinks
to high-level configuration; her rail becomes the navigation.** Trace went first (2026-10-14).

## The cast

1. **The application** — Langfuse, a real program loaded in a frame. Not a surface; it cannot be
   edited field-by-field, and Grace cannot control it.
2. **Her rail** — the vertical menu on her column (Chat, Trace, Preview, Approve, Evals, States,
   Repairs). Its tabs are SITUATIONAL TASK TOGGLES, not app navigation:
   - **Chat** — talk. The conversation lives here, always.
   - **Trace** — "I'm getting ready to work on trace." (a task click: moves the app + loads the
     default)
   - **Preview / Approve / Evals / States / Repairs** — their views.
3. **The readout bar** — rides with the seat. Shows the room's own facts (model usage: traces,
   observations, cost, tokens) while nothing is selected; follows the standing trace whatever the
   rail shows.
4. **The left nav** — being reduced to configuration. Home stays (owner: "you can click on the Home
   icon on the left-hand side which will remain… more high-level configuration than it is
   navigation"). Tracing was removed 2026-10-14. The rest leave one by one as the rail covers them.
5. **Grace** — aware by READING the governance data (traces, what the models cost and how long they
   took). She cannot control the layer; she TRIGGERS LOADS and tells you what she read. (Unlike
   Composer, where she edits the fields themselves.)

## The flows

**F1 — Land.** The room opens on chat; she lands on the conversation with a greeting, once per room
open, even while tucked away at the right. The readout shows the room's facts while nothing is
selected.

**F2 — Click Trace (the task click).** "I'm getting ready to work on trace." The app goes to its
Traces section. If nothing is selected, the **latest** trace loads itself — "fill an empty box" +
"teaches the relationship visually." The table marks what is displayed (the toggle law): the
featured trace's row carries the accent. If a trace already stands, the click returns you to it —
re-marked, not washed.

**F3 — Ask anything, from any view.** Sending in the composer lands the column in Chat (the
conversation lives there; the question carries the TRACE ON SCREEN facts when a trace stands). The
**application does not move.** The standing trace stays standing — the readout keeps it.

**F4 — Working in trace, you click Chat.** The **application stays on the trace section** — rail
clicks and chat turns never move the app; only task clicks (Trace) and confirmed offers do. The
column shows the conversation, because that is where she talks; the trace work is not disturbed.
*(My reading of "it should stay on trace because I'm working in that seat tracing." — if this line
means something else, it changes in one word.)*

**F5 — Back to the work.** Either:
- (a) click Trace — the view returns and the mark returns; or
- (b) she OFFERS, with a confirm affordance in her reply: "Would you like to return to trace and
  load that section?" / "…load that activity from that date?" — you confirm → she pivots the room
  back and loads the requested item.

This replaces the hardcoded word-match pivot (built 2026-10-13: any person turn containing
"trace" auto-pivoted the room). Per the owner's rule — "not hardcoded… task based and situational"
— the offer becomes the mechanism. **NOT BUILT YET — next slice, on the owner's word.**

**F6 — Home.** Always reachable: the logo toggle (top-left) or the Home icon in the left nav.

## Status (receipts, 2026-10-14)

- ✅ Greeting on land — LIVE, in her own words; once per room open; only a thread with nothing in
  it is greeted.
- ✅ Trace click → default latest + table mark — LIVE and verified live today (the marked row
  carries `bg-primary-accent/15` + the inset accent bar; the app's own click adds `&timestamp=`;
  her rail's re-navigation re-marks).
  - What was "gone": the LEFT-NAV Tracing item navigated clean (`/traces` with no selection params),
    which washes the mark while the seat keeps featuring its trace — the two-navigations confusion.
    Fixed by removing that item.
- ✅ Landing readout (model usage) — built 2026-10-14; two real holes closed the same day: the
  address read trusted an empty-string property, and the request asked the app for a 250-row page
  when its own API caps at 100 (HTTP 400 — the read never bound). Now verified live on a fresh
  room open: "Model usage · deepseek-flash · 59 traces · 100 observations · cost $0.007936 ·
  134k tokens · newest 100".
- ✅ Left nav: Tracing REMOVED (Home + configuration-level items stay).
- ⏳ Confirm-offer flow — NOT built; the word-match pivot still fires until replaced.

## Next slices (in order)

1. **The confirm offer** — she offers; a press pivots the room back and loads the requested item;
   the word-match pivot retires.
2. **Readout follows the task** — each section's room facts on the landing read (approvals, evals…),
   still superseded by any concrete selection.
3. **Sections leave the left nav** one by one as the rail covers them.

---
*Written by the room's engineer; corrections welcome in one word per line.*
