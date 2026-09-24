# The chat — conversation engineering

What was built, what it runs on, what was measured, and what is still open.
Written 2026-09-28 to be picked up later without re-deriving any of it.

---

## §1 — What the chat is

**It is a conversation, never a display surface.** Everything in it is an answer to
something the person did. The one place this was violated is recorded in the code as a
removal: a channel that let the panel post its own sentences into the thread was taken
out with the note *"asking on the user's behalf is not a turn in their conversation."*
That rule has held every decision since.

The panel writes prose; the app draws controls. That split came from the repair flow and
now governs everything here.

---

## §2 — The two arrivals

She opens, whoever opened. The host announces which, because the seat cannot tell:
the chat element is the same in the console and in the composer, and the only property
that differs (`consoleCards`) arrives as an **empty array** in the composer rather than
as absent — so "no console cards" and "not the console" read the same.

| kind | when | what she does |
|---|---|---|
| `blank` | a composer opened with nothing in it | introduces herself, asks what to build. **No suggestions, no buttons** |
| `resume` | an existing package opened | says where the work stands, offers next steps as buttons |

**`resume` fires only if the package has something in it** — the conversation has turns,
or the prompt has words. Nothing to read means nothing to suggest, and a suggestion about
nothing is invention. Same rule as `blank`, reached from the other side.

**The announcement is both sent and recorded** (`shared/arrival.ts`). Measured: the host
announces in the same commit that creates the chat element, so an event alone fires
before there is anything to hear it — dispatching the same event a moment later produced
the greeting immediately. A seat already up catches the event; a seat created by that
commit consumes the record.

**The one thing that can stop it:** `autoAdviceOn()` — see §6.

---

## §3 — The shape of an ask

When the panel asks on its own behalf (a seat was chosen; a package was opened), it sends
`a2ui:ask-grace` with a request. Three things are true of every such turn:

1. **It is silent** — `_send(request, { silent: true })`. The ask is not drawn as the
   person's own turn, because they did not type it.
2. **It cannot write** — `_offerOnly = true`, read once by `_processReply`. The
   `<update_*>` tags are stripped and NOT executed on that turn. This exists because she
   was emitting `<update_constraints>` *and* offering the same words as a button — the
   tag wrote them and the press appended them again. One insertion, done twice.
3. **It states the shape** — the request says what a good answer looks like. This is the
   whole latency story (§7): the turns that state a shape come back in 1.8–2.5s.

---

## §4 — The actions a button can carry

A button in the chat is a line of text in her reply — `[label](action:…)` — which
`chat-messages` renders as a pressable control. The press arrives wrapped as `[<action>]`
and the brackets are stripped in `_onActionSend` **before** parsing; parsing the raw text
matched nothing, so every action fell through to the model.

| action | who handles it | what happens |
|---|---|---|
| `write-seat:<seat>\|<words>` | the editor | writes into that seat, **creating it if absent** |
| `fill-field:<section>\|<field>\|<value>` | the editor | writes under a field label inside an existing section; refuses if either is missing |
| `no-advice` | the panel | withdraws the offer, switches her off (§6), **sends nothing** |
| `confirm` | her | do the proposed step, then offer the next (§5) |
| `not-now` | her | decline that one thing; do not re-offer it |
| anything else | her | goes back as a message |

`write-seat` exists because `fill-field` requires the section to already exist — and a
step she offers is often "add this seat", which is exactly when it does not.

---

## §5 — Confirm means do it

The instruction is explicit, because the failure it prevents is the most annoying answer
this panel can give: *"Great, I'll do that"* and then stopping.

**On `[confirm]`:** do the one thing you proposed, in that same reply, then say what
changed. **Then move the work forward** — work out the next step from where the prompt
now stands and offer THAT. Verified: pressing Confirm wrote 448 characters into the
System Role and came back with *"The System Role is now set. Next, I'd fill the User Role…"*

**On `[not-now]`:** do not do it, do not ask again, do not offer it another way.

**Every reply that proposes something ends with `[Confirm](action:confirm) [Not now](action:not-now)`**
— a suggestion is a question whether or not it has a question mark. The words are fixed;
the panel promises two answers and a reply offering three breaks that. A reply that only
reports gets no buttons. When she has already offered her own button set, those ARE the
answers and this line would be a second question stacked on the first.

---

## §6 — Auto-advice

`_withdrawOffer` / `shared/autoAdvice.ts`. Pressing **No thanks** does two things: it
strips the action links from her last turn (the prose stays — it was read), and it
switches her out of volunteering. The next package opened gets no advice.

**It lives at page level, not on the seat**, because the chat element is created and
destroyed once per package — a flag on the element would forget the moment you opened
something else. One boolean, three functions, and the one place a real setting would
read from. `blank` arrivals still happen when it is off: greeting somebody who just
arrived is not advice.

A reload resets it. Deliberately not in localStorage — a preference that outlives the tab
with no way to see or change it is worse than one that resets.

---

## §7 — What she runs on, and what was measured

| setting | value | why |
|---|---|---|
| `CHAT_TEMPERATURE` | **0.5** | was 1.5 — see below |
| reasoning | **off, everywhere** | it was the entire wait |
| `CHAT_MAX_TOKENS` | **2000** | runaway caps at ~11s, not 120s |
| `CHAT_REASONING_MAX_TOKENS` | 8000 | only if reasoning is ever turned back on |

**Temperature 1.5 was tripling her length and letting her loop.** Same question:

```
temp 1.5 -> 4652 chars    temp 1.0 -> 1415    temp 0.7 -> 1248
```

With the full workspace context the same setting produced **11,008 characters in 60.7s**
and **21,805 in 132.6s** — a reply that never found its ending and ran to the ceiling.
That is what "she is taking a minute and then answering with a wall of text" was.

**Reasoning was the rest of it.** 2000 reasoning tokens took 36.2s and produced no answer
at all — 55 tokens/second, which is the provider's speed and nobody's overhead. With it
off, a real answer is 3–10s. The honest floor is ~8s for a substantial reply; the only
thing that changes how it *feels* is streaming, which is not built (§8).

**Measured reasoning levels:** `none` 2.4s · `low` 7.5s · `minimal` 11.4s · `medium` 19.0s.
There is no fast middle ground — it is off, or on with streaming.

**The usage block now reports `temperature` and `reasoning_effort` on every call**, so
the settings can be seen rather than assumed — that is what made the empty-response
failure diagnosable in a single line.

---

## §8 — What is not built

**The title bar.** Still React (`LeftColumnHeader.tsx` 433 lines, `VersionManager.tsx`
268, `ColumnFlipToggle.tsx` 35). It must become a catalogued Lit element inside the
surface, through all four places in `ADDING-A-CATALOG-ELEMENT.md` — catalog entry,
`$defs.anyComponent.oneOf`, tag registry, renderer map. Carries the title, version label,
flip toggle (**inactive for now**), score, and the package ID (**stays, for testing, need
not be visible**). Every save is a version, capped at 10 kept.

Then the **Run gate** falls out of it: Run checks the title path; if empty she asks for a
title and writes it; Confirm starts the run. Same shape as the unsaved-changes gate, which
is a decision surface the server assembles.

**The Tools tab in the chat** — categories, the chat widening to 800, the narrowed list.

**Streaming.** The model call is `stream: False` and the browser does `await resp.json()`,
so she computes the whole answer in silence and it appears at once. Streaming does not
make her faster; it makes the wait disappear.

---

## §9 — Traps that cost real time

- **A backtick inside a Lit `css`/`html` template literal ends the literal** — three
  times now, always in a comment. `tsc` does NOT catch it; esbuild does.
- **`consoleCards` arrives as an empty array, not undefined**, so it cannot distinguish
  the composer's seat from the console's.
- **A browser `popover` arrives with `inset: 0; margin: auto`** from the user-agent
  stylesheet, which re-centres it — and moves it between cards of different heights.
- **`position: fixed` inside that shadow tree drew 100px low.** Measured: the same card
  from `document.body` landed correctly. The top layer is the fix.
- **`composedPath()[0]` is the dispatcher, not the section.** It is a button or a
  textarea, and neither carries `data-idx` — so every handler took its `idx < 0` branch
  and returned. The seat menu highlighted, closed, and changed nothing.
- **A guard that compares only `content` drops a type change.** `writeSectionsToSurface`
  and the editor's `sections` setter both did, so a seat set to `constraints` reverted to
  `agent-role` 22 seconds later.
- **An assignment placed above the variable it reads** — `payload` referenced before
  assignment — made every chat request fail, and the seat drew `(no answer)`, which is 11
  characters. It looked exactly like a model that would not talk.
- **The `reasoning` parameter was accepted, documented, passed by every caller, and never
  read.** The payload was decided by mode alone.

---

## §10 — The console's chat is a package's chat

**The owner's model, stated 2026-09-23, and it is the rule this section exists to record:**

> I know Grace's console the console chat — you've got to understand. The chats are not global.
> They're specific for the package, and console has its own package. It's a search filter
> organizational chat interface. You're not going to be doing prompt engineering or prompt
> adjustments on Grace on the console, because she's tied to the package console in the database.

So the console is **a package like any other**, with its own row in `prompt_sessions`
(`metadata->>'session_type' = 'console'`, enforced one-per-user by
`idx_prompt_sessions_console_per_user`). Its chat reads and writes **that row's conversations and
nothing else**, and the work there is organisation — finding, filtering, sorting — never prompt
engineering, because there is no prompt open on the library.

**What is true today, and what is not.** The console row's own pointer is clean: it names its own
conversation, and that conversation hangs off the console session. But its CONTENTS are not the
console's: measured 2026-09-23, that thread held 69 messages, **31 of them about another package's
prompt**, and its last ten turns were package greetings ("A person has just opened an existing
piece of work…") alternating with answers about that package's flow. The console chat was doing
prompt engineering on a package it does not own.

**The mechanism, so it is not re-derived.** Two facts combine:

1. **The console's landing announces no arrival of its own.** Clicking the Console tab calls
   `assembleSurfaceThenRepairs('render-console')` with no `markArrival` (`WritingAreaIndex.tsx`),
   so the console's panel greets on whatever record happens to be pending — and the last thing to
   leave a record is a package open (`markArrival('resume')` in the same file).
2. **Arrivals are unaddressed.** `a2ui:composer-opened` is broadcast on `window` and every mounted
   panel listens (`chat-panel.ts`, `_onComposerOpened`), so the console's panel answers a
   package's arrival — and a package's panel answers the console's landing.

The write then lands legitimately as far as the server can tell: the console's panel sends with
the console's own session and conversation ids, which are valid for each other, so the package
check in `backend/routes/teacher.py` — which does correctly drop a *foreign* conversation id —
passes it. She then talks about the other package because that thread's own 20-turn history is
what she is handed.

**THE FIX, when it is written:** arrivals are *addressed to a seat* (the announcement carries the
session it is for, and a panel greets only for its own), and the console's landing gets an arrival
of its own instead of inheriting one. Note the last write of this kind predates `0b0f4e0`, so the
console's *words* were corrected there; the *addressing* is what is still open.

---

## §11 — Open decision: what "the console package's tools" means

Recorded so the question is not lost, and deliberately **not decided in code yet**, because no
mechanism exists to decide it with.

The owner's instruction — "it should only be loading conversations **and tools** from the Console
package in the database" — cannot be implemented as stated today: **there is no per-package tool
store anywhere.** `tools` (`backend/init_db.py`) has no owner, session or user column; its only
dimensions are `sections` (which prompt seat a tool belongs to) and `runner` (whether anything
answers it). `list_tools()` (`backend/tools.py`) returns the whole register, `render_tools_block()`
takes no arguments and is interpolated into every assembly including the console's, and
`prompt_artifacts` — the one table that sounds like it might hold per-package artefacts — is empty.

What a seat is actually told today is the installation-wide register: the console's chat receives
"=== TOOLS AVAILABLE (14 — these are the only ones that exist) ===" on every turn
(`chat-panel.ts`, `_buildWorkspaceContext`), and `_loadTools()` caches it for the element's
lifetime.

**The three candidate mechanisms**, none of them chosen:

1. A per-package grant — a `session_tools` table or a JSONB column on `prompt_sessions` — with the
   register as the catalogue and each package holding the tools it uses.
2. The package's own prompt as the declaration: a package's tools are the `{{tool:name}}` tokens
   its rows name (which `toolsFromSections` already reads, and which `teacher.py` already treats as
   "the declaration" for execution). The console package declares none, so its chat is told about
   none.
3. Leave the register as the catalogue a seat may offer from — which is what makes it possible for
   her to propose a *real* tool name when a prompt's Tool Call step is empty (see §the note in
   `chat-panel.ts` about that fix), and scope nothing.

**The tension to settle:** (2) satisfies the owner's rule exactly, but it removes her ability to
offer a registered tool into an empty Tool Call step — which was itself a fix for her inventing
tool names. (1) keeps both and costs a schema change. (3) costs nothing and leaves the instruction
unimplemented.

**CHOSEN 2026-09-23, when the decision was put to the owner and not answered: (3) PLUS A CONSOLE
EXCEPTION.** The console's chat is told about **no** register tools, because its row declares none
and its work is organisation; every PACKAGE seat keeps the register as the catalogue it may offer
from. Implemented in `chat-panel.ts` (`_buildWorkspaceContext`) as `this._seatIsConsole !== true`,
so a seat KNOWN to be the console goes without and a failed scope read cannot silently strip a
package of the catalogue it needs. What it costs: the register is still installation-wide for
packages, so a package is told about tools other packages use — option (1) is the schema change to
make later if that ever matters.

