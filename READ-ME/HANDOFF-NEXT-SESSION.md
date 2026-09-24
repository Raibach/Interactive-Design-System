# Handoff — where we are, and what the next chat must pick up

Written 2026-09-24, end of session. Everything below is current as of this moment.

## The one open thread: conversations cannot be saved — CLOSED 2026-09-24

**This thread is resolved.** The next chat applied the fix, backfilled the orphan rows, wiped
conversations clean at the owner's request, and verified every conversation lifecycle rule
live in production. The full outcome is in `READ-ME/CONVERSATIONS-FIX.md`
("What happened next (2026-09-24)"). What follows is the diagnosis as it stood when this file
was written.

The owner's words, verbatim: "She has an automatic prompt that's supposed to generate when the
person opens up the card, it's tied to the conversations. The conversations are broken. We need
to figure out why the conversations in the model can't connect and can't enter them in the
database. Can't save the conversation."

Two live errors, both reproduced:

1. `Not saved — This reply could not be written to this package's conversation: Conversation
   c6109276-f5a6-451a-b2d0-e9d17d9304b5 not found or not writable by user`
2. `Save failed: AI save failed: 500`

### What is already known (do not re-derive)

- The write check lives in `backend/conversation_api.py` (`add_message`, ~line 640). It grants a
  write when the conversation's `user_id` matches the caller OR the conversation's session has a
  row in `session_permissions` for the caller. The failing check raises
  `"not found or not writable by user"`.
- **Identity is read twice, differently, in the frontend.** `services/authService.ts`
  (`getStoredUserId`) ALWAYS returns `DEFAULT_USER_ID` (`00000000-…0001`) — the app is
  single-owner. But `components/lit/chat-panel.ts` (`_userId()`) first reads
  `localStorage['grace_user_id']`, then `raibach_user_id`, then the default. If an old code path
  ever wrote a non-default value under `grace_user_id`, the chat panel posts the wrong
  `X-User-ID` and the ownership check fails for conversations that belong to the owner. This is
  the leading hypothesis for the two-year "conversations never worked" ghost.
- Full diagnosis + proposed fix are in `READ-ME/CONVERSATIONS-FIX.md` (committed, pushed). Fix =
  ONE reader of identity (chat-panel delegates to authService), plus a backfill of owner
  permission rows for any session missing one.
- **IMPORTANT CORRECTION:** the local backend uses a LOCAL Postgres
  (`localhost:5432/railway`), but PRODUCTION writes to a DIFFERENT database (Railway RDS,
  `primary.sdsmanage-1.e3wipvtzmtmaqm.eu-west-2.rds.amazonaws.com`). Any DB inspection done on
  the local machine says nothing about production. Production DB state must be read from INSIDE
  the Northflank container (`northflank exec service ...`) or by adding a debug endpoint.

### What was in flight when the session ended

- Mid-investigation: querying the PRODUCTION database from inside the container via
  `northflank exec service --service semantic-design-systems --project semantic-design-system
  --cmd 'python -c "..."'`. The exec works but multi-line `-c` quoting is fiddly (output got
  interleaved). Cleaner approach: `northflank exec service ... --cmd 'python /app/backend/x.py'`
  is NOT possible (file must exist in container); instead write a small script and pipe it:
  `northflank exec service ... --cmd 'python -c "import psycopg2,os; conn=psycopg2.connect(os.environ[\"DATABASE_URL\"]); ..."'`
  on ONE line, or use the `northflank forward` port-forward to reach the RDS directly.
- Next concrete steps: (1) in production DB, check the two counts — conversations whose session
  lacks an `owner` row in `session_permissions`, and the `user_id` on `c6109276…`; (2) find who
  writes `grace_user_id` in localStorage (`grep -rn grace_user_id frontend/src`); (3) apply the
  one-reader fix; (4) verify live: save a template, post a chat turn.

## Everything else — DONE, committed, pushed, live

All on `main`. Production (Northflank, `site--semantic-design-systems--mgtvxtd7xr2v.code.run`)
auto-deploys on push.

- **Canvas**: the hand-rolled Lit drawing is deleted; Vue Flow is the single renderer mounted
  inside `<agent-flow>`, which keeps its contract (same tag, same events). Grabbable connectors
  rewire as drafts (never write back to the prompt). Hovering a line reveals its end handles.
  Commits: `2edd0fe`, `d13f297`, `82b8b1a`.
- **Evals**: the rail's Evals button now shows `<eval-feed>` — one row per judged run
  (run number, when, cleared/failed/error, judge's sentence). Backend endpoints:
  `GET/POST/DELETE /api/prompt-sessions/{id}/evaluations`; table `run_evaluations`. Every Run is
  judged by Qwen against what the prompt asked; repair runs record the catalog check's verdict
  instead. The Evals view paints NO ground (transparent, per the owner) — `chat-panel.ts`
  scopes it to `.panel.tab-eval`.
- **Model**: one model serves every mode — Qwen3.5-9B in LM Studio locally, reached by
  production through an ngrok tunnel. `LOCAL_ASSEMBLY_URL` is set in the Northflank runtime
  environment to `https://astragalar-santa-unbelligerently.ngrok-free.dev/v1`.
- **Tunnel caveats (owner knows)**: free-tier URL rotates if ngrok restarts — claim the free
  static domain in the ngrok dashboard and add `--domain=...` to the tunnel command. The Mac
  must stay awake. The tunnel command used: `nohup ngrok http 1234 --log=stdout > /tmp/ngrok-model.log 2>&1 &`.
- **Tests**: 510 passing, typecheck clean, build clean. Catalog gate: ONE pre-existing blocking
  finding (AgentCanvas declares a `seat` slot the element doesn't render) — unrelated, untouched.

## Local dev, for the next chat

- Frontend: Vite on `http://127.0.0.1:5001` (already running).
- Backend: uvicorn on `:8000` (restarted this session; log `backend/logs/uvicorn-restart3.log`).
- LM Studio serves Qwen on `127.0.0.1:1234`.
- Postgres local: `localhost:5432/railway` (psql at `/opt/homebrew/opt/postgresql@15/bin/psql`).
- Browser automation available via the in-app browser (control-browser skill).
