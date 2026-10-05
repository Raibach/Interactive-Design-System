# The local engine — running this builder with no Totalum account

Upstream, this app is a shell: every action proxies to Totalum's hosted VCaaS API behind
one paid account key. `server.mjs` here speaks the same API surface the UI already calls,
but the agent is a **direct DeepSeek key** and the generated apps are served from this
machine. No account, no credits.

## Run it

```bash
npm run dev:local        # engine (4000) + builder (3223), one command, Ctrl-C stops both
```

Then open http://localhost:3223 — sign in nothing, the dashboard is the door.

## Configuration — `local-vcaas/.env`

```
DEEPSEEK_API_KEY=sk-...        # the only credential
DEEPSEEK_MODEL=deepseek-flash     # deepseek-v4-pro is the heavier tier if a mode wants it
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
PORT=4000
```

The app points at the engine with two variables in the app's `.env.local`:

```
VCAAS_BASE_URL=http://localhost:4000/api/v1/vcaas
TOTALUM_VCAAS_API_KEY=local-engine   # never sent anywhere; makes the app's setup banner go away
```

## What works, honestly

| Area | Status |
|---|---|
| Prompt → build (full-file rewrite per run) | works — DeepSeek writes the whole project each run |
| Live preview | works — `http://<projectId>.localhost:4000/` (and `/preview/<id>/`) |
| Code panel (tree, view, edit) + rebuild | works |
| Source download (ZIP) | works — real ZIP, stored uncompressed |
| Versions, restore, **diffs** | works — line diffs between run snapshots |
| Run logs | works — the Logs panel shows each run's files/seconds/tokens |
| Export / import a project (transfer code) | works — base64 JSON carrying files, history, versions |
| Attachments / uploads | refused — the panel says so |
| Publish/Deploy, Database, GitHub, Figma, custom domains, webhooks | refused — these are Totalum's hosted services; no local substitute exists |

Generated projects are **multi-file static sites** (HTML/CSS/JS, several pages allowed)
— not Next.js apps with their own database. That is the honest shape of what one local
model can build and serve here.

## Layout

```
local-vcaas/
  server.mjs   # the engine: VCaaS-shaped API + DeepSeek agent + previews + ZIP/diff
  start.mjs    # `npm run dev:local` — both processes, one door
  .env         # the DeepSeek key and model (gitignored)
  data/        # the tool's own database: one JSON per project + mirrored app files
```
