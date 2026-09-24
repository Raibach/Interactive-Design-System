# Fixing Conversations — the investigation and the fix

**Status: FIXED, APPLIED, AND VERIFIED LIVE IN PRODUCTION on 2026-09-24.**

Two separate failures, both live on 2026-09-24:

1. `⚠️ Not saved — This reply could not be written to this package's conversation: Conversation c6109276… not found or not writable by user`
2. `⚠️ Save failed: AI save failed: 500`

## What the write check does

`conversation_api.py` (`add_message`) gates every write on two conditions, either of
which grants the write:

```sql
SELECT c.id, c.title, c.metadata FROM conversations c
WHERE c.id = %s
  AND ( c.user_id = %s
     OR c.session_id IN (SELECT session_id FROM session_permissions WHERE user_id = %s) )
```

The comment on that query already records the war this code has fought: `conversations.user_id`
was NULL on rows with messages, so the OWNER could not write to his own conversation. The fix
then was "the PACKAGE decides" — ownership flows through `session_permissions` (role `owner`),
because the package's owner is the one stable fact.

## What the database actually says (production DB, queried live)

| fact | count |
|---|---|
| conversations with `user_id IS NULL` | 0 |
| conversations with `session_id IS NULL` | 0 |
| conversations whose session has NO `owner` permission row | **2** |
| total conversations | 14 |

The failing conversation (`c6109276…`, "Insurance News Scout - Chat") HAS its user_id set
(default user) and HAS an owner permission row — so the SQL should have passed. That means the
caller's identity was wrong, not the row's.

## The actual bug — two identities in one app

The frontend has two readers of "who am I":

- `services/authService.ts` → `getStoredUserId()` — **always** returns `DEFAULT_USER_ID`
  (`00000000-…0001`). There is one user; the login row's own id must never leak in. (The file
  records this exact failure from before: the credential row's id became the identity and the
  console assembled zero packages.)
- `components/lit/chat-panel.ts` → `_userId()` — reads `localStorage['grace_user_id']`
  FIRST, then `raibach_user_id`, then the default. `grace_user_id` is the key the app
  WRITES. If any older code path ever wrote a credential-row id (or anything non-default)
  under that key, the chat panel posts that id as `X-User-ID` and the ownership check fails
  for conversations that belong to the default user.

So Save Template (which runs the AI save through WritingAreaIndex, correctly identified) and
the chat reply write (chat-panel, possibly mis-identified) disagree about who is talking.
Same symptom the conversations system has shown for two years: writes intermittently 403/404
because the identity flips.

## The fix

1. **One reader of identity.** Make `chat-panel._userId()` call `getStoredUserId()` — delete
   the localStorage read. The owner is one person; the door is a doorman, not multi-tenant.
   (Or the reverse: have authService actually store and read — but there is only one user, so
   the constant IS the truth.)
2. **One writer.** Find who writes `grace_user_id` and make it write `DEFAULT_USER_ID` only,
   or stop writing it.
3. **Backfill the 2 orphan rows.** Conversations whose session has no owner row: add
   `INSERT INTO session_permissions (session_id, user_id, role, granted_by) SELECT session_id,
   '00000000-…0001', 'owner', '00000000-…0001' FROM conversations c WHERE NOT EXISTS …`.
4. **Verify the write path live:** save a template, then post a chat turn to the package's
   conversation, and confirm both land.

The `AI save failed: 500` is the second failure — the save goes through an AI endpoint, and
while the model was unreachable (the tunnel gap) that endpoint 500'd. It is expected to clear
with the model reachable; if it persists once assembly works, trace it in the backend log
under the save endpoint.

## Not fixed here (do not touch without the owner)

- `conversations.tab` conversation-per-tab switching (Evals/Runs share the chat's conversation;
  that is by design until those tabs get real conversations).
- Anything multi-user: this app is single-owner by the authService contract.

## What happened next (2026-09-24) — applied and verified

**The fix, committed and deployed** (`315ffe8`, `b6c2d04`):

1. **One reader.** `chat-panel._userId()` now returns `getStoredUserId()` — the localStorage
   reads (`grace_user_id` first, then `raibach_user_id`) are deleted. The panel posts the
   default owner's id on every request, so the per-package write check passes for the owner.
2. **One writer.** `authService.storeUserId()` now writes `DEFAULT_USER_ID` regardless of the
   id a login/signup returns, so a credential-row id can never be persisted under
   `grace_user_id` again.
3. **The list adopts what the server created.** When a reply comes back with a conversation
   id the seat did not hold (a first turn in a package with no conversations, or a closed
   thread continuing in a new one), the seat re-reads the package's conversation list — the
   new row appears in the header immediately instead of after a reload (measured live).

**The database, in production (inside the Northflank container):**

- The 2 orphan conversations (both the Console session's) backfilled: one `owner` row for the
  Console session, orphans 2 → 0.
- The owner approved wiping conversations entirely ("wipe them clean"). Wiped: 13
  conversations, 150 messages, 10 session pointers nulled first (no dangling `conversation_id`).
  `session_permissions` and packages were kept — the package↔owner chain is not conversation
  data. On next landing the console re-seeded its own two conversations ("Console — Chat" with
  the welcome, "Console — Approvals"), written by the backend as the owner.

**Live verification against production (browser, 2026-09-24), with the database checked after
each step:**

- Chat turn auto-saves: user turn + Grace's reply both landed in `conversation_messages` with
  no error, and the exchange survived a full reload — the audit trail.
- New conversation: the old one was renamed from its first turn, archived (messages intact),
  a new one created, and the seat moved into it. Archived rows stay openable, per the
  owner's rule.
- Remove: two-click arm/confirm deleted the row PERMANENTLY (`DELETE FROM conversations`),
  the session pointer moved with the delete, and the seat moved off it.
- Per-package isolation: the package's turn landed in the package's own session
  (Insurance News Scout), the console's turns in the Console session — no crossover, and the
  seat refuses any conversation not in its own package's list.
- Template save: "Template saved — Saved with 3 sections". The old `AI save failed: 500`
  (dead conversation id after a delete + unreachable model) no longer occurs.

**Notes for whoever reads this later:**

- The failing conversation `c6109276…` no longer exists in production — it was removed during
  the earlier testing, so the live symptom was re-produced from a fresh conversation instead.
- The owner's model for conversations, stated again during verification: conversations are an
  audit trail (same class of storage as evals/tries/runs), they are per-package
  (conversation → package id → user id), the console has its own package and sees nothing
  else, and remove is a deliberate permanent delete with no undo. All of that is what the
  code now does.
