# PLAN — the chat is the primary filter, and a saved conversation is the preset

> Written after reading the Governance seat, the sessions lane, `QUERY-LANES.md`, `TODO.md`, the
> replay route, the app's own sessions filter and the left navigation. No code is changed by this
> plan. It is the exploration of a larger project, not the first slice of it.

## What the person will experience

The person opens Governance and clicks Sessions in the chat rail. The input is a filter search,
not a message. They type what they want in their own words — "failed evaluations in the last week
for the product team" — and the rows that answer it draw in the output column. Grace writes no
reply, because the rows are the answer.

The turn is saved as a conversation under the Sessions tab, named with the person's words. That
saved conversation is the preset. Opening it again re-applies its stored filter and draws the same
rows. The left navigation no longer carries a separate Sessions page; the chat rail's Sessions tab
is the one interface. The application's own Columns, Filters and sort controls leave the interface
once the chat covers them; the application's data, facets and operators stay.

## The goal, in the owner's words

> *"Governance sessions already has an extensive filter that is absolutely ridiculous and difficult
> to understand; all of those functions to filter that sessions table in the application just get
> applied to the chat interface. That could be a bigger project, but that is the goal."*

So the target is **the full filter vocabulary**, not a reduced one. The app's sessions filter is
the specification. The chat is the new surface for it: the person says the filter in words, the
model produces the app's own `FilterState`, the lane validates and executes it, and the rows are
drawn. The saved conversation is the reusable form of that filter.

## What is already built

- The sessions lane: `backend/governance_lanes.py` + `POST /api/governance/sessions/query`, with
  the catalogue at `runtime/governance/filters/sessions.json` and the contract
  `{sort, filter[], explain}` or `{unexpressible}`.
- The replay: `POST /api/governance/sessions/query/replay`.
- The query captured as a conversation under the tab's package (`tab: 'sessions'`, the query in
  its metadata); the title is the person's words.
- The sessions list, its first-row selection and its purple highlight in the seat's Sessions tab.
- The left nav's Sessions entry is removed (2026-10-24); the chat panel is the interface.

## The gap

- The Governance seat's `_onMessageSent` on `sessions` still calls `_send()`, the conversation
  reply path. It must call the sessions lane and bind its answer to the feed: `queryRows`,
  `receipt`, `laneError`.
- Selecting a saved conversation whose `tab` is `sessions` does not call the replay route yet.
- The app's own filter controls are still in its Sessions page; Phase 3b removes them from the
  interface once the lane draws the rows.
- The full sessions vocabulary has not been measured against the chat's ability to express it. The
  catalogue is the source of truth; every facet and operator the app offers must be represented,
  refused by name if the model cannot express it, and covered by a test.

## The rule

**A saved conversation under a filter tab IS the preset.** The conversation ID is the key. The
title is the preset's name. The stored filter is the preset's view. There is no separate preset
store, and there is no second Sessions interface. The input is the filter; the rows are the answer;
the conversation is the preset.

## The stages

1. **The lane's door.** The Sessions input calls `/api/governance/sessions/query`; the feed binds
   the rows, the receipt and the refusal. The input's label is **Search Query**. No reply turn is
   written; the turn is stored as the conversation.
2. **The preset.** Selecting a saved `tab: 'sessions'` conversation calls
   `/api/governance/sessions/query/replay` and draws its stored filter. The conversation list is the
   preset list; the saved conversation is its own preset.
3. **The full vocabulary.** Audit the app's sessions filter — the 21 facets and every operator —
   against the lane catalogue. Every function the app offers is expressible through the chat or
   refused by name; the tests prove it. This is the largest piece and the reason the project is
   bigger than a lane wire-up.
4. **The app's controls leave the interface.** The Columns picker, the Filters sidebar and the sort
   dropdowns come out of the app's Sessions list once the chat lane draws the rows. The data, the
   facets and the operators stay; they are the vocabulary the lane is generated from.
5. **The other lanes.** Evals is the reference implementation; the same shape — input, rows,
   saved conversation as preset — applies to each tab as it is cleaned, one tab at a time.
6. **Verification in the room at 5001.** Type a filter; the rows draw; no reply; the conversation
   is saved under Sessions; select it and the same rows return; the left nav has no Sessions entry;
   the app's own filter controls are gone once Phase 3b lands; the application's data is unchanged.

## The bigger project, stated plainly

The first two stages are a lane and a replay. The third and fourth are the real project: the chat
must carry the app's entire filtering vocabulary, and the app's own filtering interface must leave
the screen. That work is deliberately not started here. It needs the vocabulary audit, the
conversation-as-preset behaviour, and the owner's word on when the app's controls come out.

## Not in this plan

Department scoping (no data maps a person to a department), the native trace store, and any change
to the application's data or its filter configuration. The application remains the source of the
vocabulary; the chat becomes the source of the question.
