# The Package Contract — the requirements, as invariants

**Project:** Deterministic Design System Manager — Raibach Interactive Design Studio
**Status of this document:** Authored 2026-09-15 from a live audit of the running
database. Every claim in §10 was measured against `DATABASE_URL` on that date and
carries its evidence. This is not a description of what the system does; it is the
set of rules the system must obey, and §10 says which ones it currently does.
**Companions:** [`THE_ENGINEERING_PHILOSOPHY.md`](THE_ENGINEERING_PHILOSOPHY.md) ·
[`IMPLEMENTATION_CONFORMANCE.md`](IMPLEMENTATION_CONFORMANCE.md) (protocol, A2UI) ·
[`A2UI_TRUE_VS_FAKE_AUDIT.md`](A2UI_TRUE_VS_FAKE_AUDIT.md) (the method under fire)

---

## §1 — The unit of everything is the package

A **prompt package** (`prompt_sessions`) is the container. Not a screen, not a
session, not a browser tab. One package is one piece of work, owned by one user,
and everything that happens to that work happens *inside it*.

The reason is collaboration. A package is meant to be opened by its author on
Monday and by a colleague on Thursday, and for both of them to find every
conversation, every version, every audit and every correction still attached to
it. That is only possible if the package is the thing the history hangs off —
so it is, and nothing is allowed to hang off anything else.

**`conversations.session_id` is `NOT NULL`.** A conversation cannot exist
outside a package. This is the invariant the rest of the document depends on.

## §2 — What a package owns

| The package owns | Table | Reaches it by |
|---|---|---|
| its conversations | `conversations` | `session_id` |
| everything ever said in them | `conversation_messages` | `conversation_id` → package |
| every version of the prompt | `prompt_versions` | `session_id` |
| assembled context | `prompt_context` | `session_id` |
| suggestions she made | `ai_suggestions` | `session_id` |
| who may open it | `session_permissions` | `session_id` |

Versions are the record of the work growing. A package is expected to
accumulate thousands of them — one package family already holds 4,916 — so
nothing may assume a package is small, and nothing may assume it has stopped
growing.

## §3 — She is scoped, not global

**Grace is not a general assistant.** She exists inside a package and has no
existence outside one. Her history, her recalls, her audit trail, her error
messages and her conversations are all restricted to the package being worked
on, and all of them are stored against that package's id.

The consequence, stated as a rule: **there is no such thing as "her memory" that
is not attached to a package.** A recall that cannot name the package it came
from is not a recall.

## §4 — Two jobs, one character

She does two different jobs, and they are different because of *where the person
is standing when they talk to her*:

| | The talking job | The building job |
|---|---|---|
| Where | the conversation on the right | the prompt on the left |
| Medium | natural language | the language that becomes code |
| What changes | what the person understands | what the prompt *is* |
| Output | sentences, and workspace tags | corrected prompt text |

Same character in both. The two jobs share one thing that makes them one system
rather than two features: **language crosses between them.** She can take what a
person just said in the conversation and write it into the prompt's sections;
she can read the output area and give feedback on it; she can carry a correction
from the right column into the left one without being asked twice.

Her end state, in the author's words: talk to the person through prompt writing,
through complex tasking, through adoption, through feedback on what the output
actually says. She is not a helper bolted to the side of the app — she is the
editor working on the package.

## §5 — The shell is not the package

Some things are about the *application*, not about a piece of work, and those
belong to the React shell. They must never be built inside a package.

| Shell (system-level) | Package (work-level) |
|---|---|
| login and who you are | conversations about this work |
| the left navigation | this work's versions |
| **the Evaluation lens** | this work's audits |
| choosing which package to open | this work's corrections |

**Login in particular is shell-level, because prompts do not have logins.** A
person authenticates once, as themselves; they do not authenticate per package,
and a package must never carry credentials or a session.

**Evaluation is a lens, not another package.** From the shell you can look at a
package through evaluation — load its audits, its scores, its versions as
evidence — instead of through composition. Same package, same id, different
lens. A composer prompt does not stop being a composer prompt to be evaluated;
it is simply seen from elsewhere.

## §6 — Conversations are not equal weight

The conversation area is **not a widget that appears everywhere equally.**
Conversations belong to the package, so:

- one package may hold **five** conversations,
- another may hold **one**,
- a repair package may hold **none at all** — the person fixes it on the left and
  presses Run, and no conversation is ever created.

**Zero is a valid, first-class state.** It is not an error, not an empty widget
and not an invitation to speak. A seat with no conversation shows nothing,
because nothing has been said.

**A conversation is created by speaking, not by loading.** A row that exists
because a surface mounted is a conversation that claims work which never
happened — measured this session: **230 of 238 conversations held zero
messages**. Creation is on first message, and a package that is never spoken to
stays at zero.

## §7 — Access derives from the package, never from the conversation

Because the package is the container, **permission is a property of the
package.** `session_permissions` holds one row per person per package, with a
role (`owner` / `editor` / `viewer`).

The rule:

> If you may open the package, you may read and write every conversation inside
> it. There is no second permission check per conversation.

Storing access per conversation would mean a package with five conversations
needs five grants to be as shared as the package is, and every new conversation
would be born unshared — so the package would silently become *less* shared the
more it was used. That is the failure this rule exists to prevent.

Corollary, and it is not optional: **a denial must be loud.** Returning an empty
list for "you may not read this" is indistinguishable from "nothing was ever
said here", and the person reads it as the second one. Access failure gets its
own answer (`403`); an empty conversation still returns an empty list, because
that one is true.

## §8 — Failure is loud

Inherited from `IMPLEMENTATION_CONFORMANCE.md` R7 and restated here because it
applies to the whole package, not only to A2UI:

- an A2UI surface that cannot be assembled is a **503 with the §1 envelope** —
  never a substituted provider, never a fabricated surface, never a fallback
  rendering;
- a query that cannot resolve access **says so** (`403`) rather than returning an
  empty result that reads as success;
- a provider that is down is reported as down. Producing a different answer
  without saying so is a lie about what happened.

The model is the architect. It either assembles the surface or the failure is
visible.

## §9 — The database is the application

There is no second copy of the truth. Postgres holds the packages, the
conversations, the messages, the versions, the permissions and the identities;
Zilliz holds the vectors. The Lit component library is the *design framework* —
the visual grammar — and holds no state that matters.

What this forbids:

- a conversation held in browser memory as the system of record — it is a view of
  a row, or it is a bug;
- identity held as a localStorage flag, when `users` is a table with a
  `password_hash`, a `failed_login_attempts` and a `last_login_at`;
- a report file a build can delete, when the same report is a row.

Packages are expected to be **multi-megabyte** and to keep growing, so the
content columns are `TEXT` to carry that. Nothing may assume a package fits in
memory, and no build step may be able to erase the record of work.

---

## §10 — Invariant status, measured

Measured against the running database on **2026-09-15**. `ENFORCED` means it is
true and something makes it true. `VIOLATED` means the code contradicts the
rule. `NOT BUILT` means the rule has no implementation yet. Nothing here is
aspirational: a row without evidence did not earn its state.

| # | Invariant | State | Evidence |
|---|---|---|---|
| 1 | A conversation cannot exist outside a package | **ENFORCED** | `conversations.session_id` is `NOT NULL`; FK `conversations_session_id_fkey` |
| 2 | Versions, context, suggestions, permissions hang off the package | **ENFORCED** | `prompt_versions` / `prompt_context` / `ai_suggestions` / `session_permissions` all carry `session_id` |
| 3 | She is scoped to a package, not global | **VIOLATED** (module retired 2026-09-18; seat-level corrections in `open-items.json` #022–#026) | The singleton it named — `frontend/src/shared/chatSeat.ts:45` — was uncalled by any production module (only its own test), so its promises ("the seat is the one funnel… written as it arrives") never ran; it and its test are now retired to `retired-files/dead-code-20260918/`. The seat itself now holds the line instead: `_enterPackage` (a package change empties `_local` and the loaded history, #022), `_pendingOwner` (a pending turn is written only into the package it was spoken in, #023), `_conversationBelongsToPackage` (reads AND writes refuse a conversation the package's own list contradicts, #024), adoption-on-difference with the move shown (#025). Still open: the host's `a2ui:system-message` events carry no package, so a seat cannot filter one by origin (#032). |
| 4 | One character, two jobs | **PARTIAL** | chat and surface assembly both exist and both now run on the local model; the language bridge (conversation → prompt sections) is not built |
| 5 | Login is shell-level and backed by a row | **PARTIAL** | `POST /api/auth/login` built and live; but `PinGate.tsx:5` still hardcodes PIN `7377` → `DEFAULT_USER_ID` and never calls it; not yet in `LeftVerticalMenu` |
| 6 | Evaluation is a lens on a package | **NOT BUILT** | no Evaluation view exists; catalog audit data exists as a file + `GET /api/catalog/audit` |
| 7 | Zero conversations is a valid state | **ENFORCED** | all 267 packages sit at 0 conversations and nothing errors |
| 8 | A conversation is created by speaking | **VIOLATED** | 230 of 238 conversations held 0 messages before the cleanup — created at mount |
| 9 | Read access derives from the package | **ENFORCED** | `conversation_api.get_messages` resolves through `session_permissions`; verified: B reads the owner's conversation, a stranger gets 403 |
| 10 | Write access derives from the package | **ENFORCED** | `conversation_api.add_message` same predicate; verified: owner **and** colleague both wrote to one conversation |
| 11 | The conversation **list** derives from the package | **VIOLATED** | `get_all_conversations` is still `WHERE user_id = %s` — B sees 1 package but 0 of its conversations |
| 12 | A denial is loud | **ENFORCED** | was `return []`; now `403` — verified live |
| 13 | Sharing happens at the package | **ENFORCED** | first non-owner row in the system's history: `session_id=aa620afd…, role=editor`; packages visible to B = 1 |
| 14 | Access is never stored per conversation | **VIOLATED** | `prompt_shares` and `prompt_permissions` are keyed on `conversation_id` — the wrong container. Both are empty and dead |
| 15 | One container, one pointer | **VIOLATED** | `prompt_sessions.conversation_id` still exists and is still `SELECT`ed, while `WritingAreaIndex.tsx:2696` states it "was dropped". Now 0 rows set — the natural moment to retire it |
| 16 | A database floor under every access check | **NOT BUILT** | `relrowsecurity = false` on every table and **no policies exist**; `SET app.current_user_id` is a no-op, so every rule above rests on a hand-written `WHERE` |
| 17 | A surface fails loud (503 + §1 envelope) | **ENFORCED** | `ai.py` raises 503 on empty/invalid JSON; §6 verification of `IMPLEMENTATION_CONFORMANCE.md` passes |
| 18 | Identity is a row | **ENFORCED** | 11 users with real bcrypt; login writes `last_login_at` / `last_login_ip` |
| 19 | A package may be multi-megabyte | **UNTESTED** | content columns are `TEXT` (sufficient); database is 16 MB, so the ceiling has never been reached |

### What the table says to build next, in order

1. **#11** — the conversation list. It is the last thing between "a colleague can
   open the package" and "a colleague can see the work inside it".
2. **#3** — the seat as a view of a row, not a browser singleton. Until this is
   true, §9 is a claim the frontend does not honour.
3. **#8** — create a conversation on first message, not at mount.
4. **#5** — move login into the shell and delete the hardcoded PIN.
5. **#16** — make RLS real, so a forgotten `WHERE` fails closed instead of
   leaking. This is the only row where a missing check is *silent*.
6. **#14**, **#15** — retire the mis-keyed tables and the vestigial column, so
   the schema stops disagreeing with this document.
7. **#19** — write a deliberately large package and confirm nothing truncates.
8. **#6** — the Evaluation lens.


