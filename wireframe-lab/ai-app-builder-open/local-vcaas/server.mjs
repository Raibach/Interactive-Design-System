/**
 * THE LOCAL ENGINE for ai-app-builder-open.
 *
 * The vendored builder has no engine of its own: every action goes to Totalum's
 * hosted VCaaS API behind one account key. This server speaks the same VCaaS
 * surface the UI already calls, but the agent is your own DeepSeek key and the
 * generated app is served from this machine. No account, no credits.
 *
 * Point the app at it with (in the app's .env.local):
 *   VCAAS_BASE_URL=http://localhost:4000/api/v1/vcaas
 *   TOTALUM_VCAAS_API_KEY=local-engine
 *
 * Endpoints implemented (the subset the UI drives; everything else answers with
 * an honest refusal rather than a fake success):
 *   projects (list/create/launch/get/patch/delete), agent (status/start/stop/
 *   full-conversation/server), files (tree/content GET+PUT), versions (+recover),
 *   rebuild, deployments status, logs, secrets, project-groups, plus empty/absent
 *   stubs for github/figma/database/domain/webhooks.
 *
 * Previews are served two ways, both to the same project files:
 *   http://<projectId>.localhost:4000/   (a real origin per project — the URL the
 *                                         UI is given, and the one the visual
 *                                         editor's same-origin proxy resolves)
 *   http://localhost:4000/preview/<id>/  (fallback path form)
 *
 * HOSTED (2026-10-04 — wireframe-lab/HOST-THE-TOOLS.md): the same engine runs as its
 * own service behind the Product room on the demo. With PUBLIC_BASE_URL set, every
 * preview URL the UI is handed becomes `<PUBLIC_BASE_URL>/preview/<id>/` (one host,
 * the path form), and the two endpoints that spend DeepSeek tokens carry the demo's
 * own rate-limit pattern — a per-visitor bucket and a global money backstop (see
 * THE RUN BUDGET below). Nothing else changes: the same files, the same API, and a
 * local run (PUBLIC_BASE_URL unset) behaves exactly as it always has.
 */
import { createServer } from "node:http";
import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync, rmSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(HERE, "data");
const PROJECTS_DIR = join(DATA_DIR, "projects");
const APPS_DIR = join(DATA_DIR, "apps");
/**
 * THE ENGINE'S OWN STATIC BITS (2026-10-04) — currently just the empty-state texture the
 * owner chose (*"I wanna add this background … just make this the background"*): the
 * wireframe-lab lattice, tiled behind the splash of a project with no work yet. Served by
 * the engine because the splash lives on the preview's own origin.
 */
const ASSETS_DIR = join(HERE, "assets");
const ASSET_MIME = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp",
  ".svg": "image/svg+xml", ".css": "text/css", ".woff2": "font/woff2",
};

// ── env: local-vcaas/.env wins, then the process environment ────────────────
function loadEnvFile() {
  const file = join(HERE, ".env");
  const out = {};
  if (!existsSync(file)) return out;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}
const FILE_ENV = loadEnvFile();
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || FILE_ENV.DEEPSEEK_API_KEY || "";
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || FILE_ENV.DEEPSEEK_MODEL || "deepseek-flash";
const DEEPSEEK_BASE = (process.env.DEEPSEEK_BASE_URL || FILE_ENV.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1").replace(/\/$/, "");
const PORT = Number(process.env.PORT || FILE_ENV.PORT || 4000);
const PREVIEW_HOST_SUFFIX = "localhost";
/**
 * WHERE THIS ENGINE'S PAGES LIVE IN PUBLIC (2026-10-04 — wireframe-lab/HOST-THE-TOOLS.md).
 * Locally, every preview gets a real origin of its own (`<id>.localhost:4000`). A HOSTED
 * service gets ONE hostname, so the hosted copy serves the same previews under the path
 * form this engine has always had (`/preview/<id>/`, see the header) and every URL the UI
 * is handed must say so: with PUBLIC_BASE_URL set (the service's public origin, no trailing
 * slash — e.g. https://engine--builder-engine--xxxx.code.run) the preview URLs, the source
 * ZIP link and the production host all point there. UNSET is the local behaviour, byte for
 * byte — the Mac keeps `<id>.localhost`.
 */
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "");
/** A run that has not answered in this long is failed, not waited on. */
const RUN_TIMEOUT_MS = 10 * 60 * 1000;

mkdirSync(PROJECTS_DIR, { recursive: true });
mkdirSync(APPS_DIR, { recursive: true });
mkdirSync(ASSETS_DIR, { recursive: true });

// ── storage: one JSON document per project ──────────────────────────────────
const projectPath = (id) => join(PROJECTS_DIR, `${id}.json`);
const running = new Map(); // id → { aborted: boolean }

function readProject(id) {
  const file = projectPath(id);
  if (!existsSync(file)) return null;
  try { return JSON.parse(readFileSync(file, "utf8")); } catch { return null; }
}
function writeProject(project) {
  writeFileSync(projectPath(project.projectId), JSON.stringify(project, null, 2));
  // Mirror the generated app to disk so it can be inspected with a normal editor.
  const appDir = join(APPS_DIR, project.projectId);
  rmSync(appDir, { recursive: true, force: true });
  for (const [path, content] of Object.entries(project.currentFiles || {})) {
    const full = join(appDir, path);
    if (!full.startsWith(appDir)) continue; // never escape the project folder
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
}
function listProjects() {
  return readdirSync(PROJECTS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => readProject(f.replace(/\.json$/, "")))
    .filter(Boolean);
}

// ── ids: the VCaaS slug rules, mirrored ─────────────────────────────────────
const SLUG_RE = /^[a-z]([a-z0-9]|-(?!-))*(?<!-)$/;
function slugProblem(id) {
  if (!id) return "empty";
  if (id.length < 4 || id.length > 35) return "length";
  if (!SLUG_RE.test(id)) return "format";
  if (id.includes("-dev-")) return "reserved";
  return null;
}
function uniqueId(wanted) {
  const base = (wanted || "app").toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  let id = base;
  if (id.length < 4) id = `app-${id}`.slice(0, 35);
  if (slugProblem(id)) id = `app-${Date.now().toString(36).slice(-4)}`;
  while (readProject(id)) id = `${id.slice(0, 30)}-${Math.random().toString(36).slice(2, 5)}`;
  return id;
}

// ── http helpers ────────────────────────────────────────────────────────────
function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}
const ok = (res, data) => json(res, 200, { errors: null, data });
const fail = (res, errorCode, errorMessage, status = 400) =>
  json(res, status, { errors: { errorCode, errorMessage }, data: null });

function readBody(req) {
  return new Promise((resolveBody) => {
    let raw = "";
    req.on("data", (c) => { raw += c; });
    req.on("end", () => { try { resolveBody(raw ? JSON.parse(raw) : {}); } catch { resolveBody({}); } });
  });
}
const nowIso = () => new Date().toISOString();

// ── THE RUN BUDGET (2026-10-04 — HOST-THE-TOOLS; the owner's decision: demo visitors may
// run the builder, capped) ─────────────────────────────────────────────────────────────────
// Hosted on the demo, the two endpoints that spend DeepSeek tokens (`projects/launch` with a
// prompt, `agent/start`) carry the demo's own rate-limit pattern — backend/demo_policy.py is
// the model: in-process token buckets, "N/seconds" specs from the environment, a PER-VISITOR
// bucket for fairness and a GLOBAL bucket as the money backstop. Everything else — files,
// previews, lists, versions — is free and unlimited: reading never costs a token.
//
// WHO THE VISITOR IS: the browser talks to the BUILDER, the builder's server-side proxy talks
// to this engine — so the socket address here is always the builder. The builder forwards the
// visitor's own address as `x-visitor-ip` (see its catch-all proxy); a caller that skips the
// builder and hits this engine directly gets its own socket address as its bucket key. A
// spoofer can dodge the FAIRNESS bucket and never the global one — the same honest limitation
// demo_policy.py documents for X-Forwarded-For.
//
// A restart refills the buckets, which is fine: the global bucket bounds the bill between
// restarts, and DeepSeek's account-side limits are the backstop behind that.
function parseLimit(spec, fallback) {
  try {
    const [tokensText, secondsText] = String(spec).split("/");
    const capacity = Number(tokensText);
    const window = Number(secondsText);
    if (!Number.isFinite(capacity) || !Number.isFinite(window) || capacity < 1 || window <= 0) throw new Error("bad spec");
    return [capacity, capacity / window];
  } catch {
    console.warn(`[local-vcaas] rate-limit spec ${JSON.stringify(spec)} is not "N/seconds" — using ${fallback[0]}/${fallback[1]}`);
    return fallback;
  }
}
// One visitor may start this many builds per window; ALL visitors together this many — the
// backstop that bounds the bill. Both environment-tunable, mirroring DEMO_RATE_*.
const RATE_RUNS_PER_VISITOR = parseLimit(process.env.BUILDER_RATE_RUNS_PER_VISITOR || "4/3600", [4, 4 / 3600]);
const RATE_RUNS_GLOBAL = parseLimit(process.env.BUILDER_RATE_RUNS_GLOBAL || "60/3600", [60, 60 / 3600]);
const RATE_BUCKETS = new Map(); // key → { tokens, last }

function consumeBucket(key, capacity, refillPerSecond) {
  const now = Date.now() / 1000;
  const bucket = RATE_BUCKETS.get(key) || { tokens: capacity, last: now };
  bucket.tokens = Math.min(capacity, bucket.tokens + (now - bucket.last) * refillPerSecond);
  bucket.last = now;
  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    RATE_BUCKETS.set(key, bucket);
    return true;
  }
  RATE_BUCKETS.set(key, bucket);
  return false;
}

function visitorKeyOf(req) {
  const forwarded = String(req.headers["x-visitor-ip"] || "").split(",")[0].trim();
  if (forwarded) return forwarded;
  return req.socket?.remoteAddress || "unknown";
}

/** Take one run from both buckets. Allowed ⇒ both consumed; refused ⇒ which one said no. */
function takeRunBudget(req) {
  // HOSTED ONLY, AND THAT IS THE POINT: with no PUBLIC_BASE_URL this engine IS the owner's
  // machine, where "4 runs an hour" would throttle the person the tool exists for. The budget
  // is a fact about the DEMO — so it lives exactly where the demo's address does.
  if (!PUBLIC_BASE_URL) return { allowed: true };
  if (!consumeBucket(`visitor:${visitorKeyOf(req)}`, RATE_RUNS_PER_VISITOR[0], RATE_RUNS_PER_VISITOR[1])) {
    return { allowed: false, message: "The demo's building limit was reached for this visitor — try again a little later." };
  }
  if (!consumeBucket("global", RATE_RUNS_GLOBAL[0], RATE_RUNS_GLOBAL[1])) {
    return { allowed: false, message: "The demo's building limit was reached for now — try again a little later." };
  }
  return { allowed: true };
}

// ── project views ───────────────────────────────────────────────────────────
function previewUrlFor(project) {
  // ONE HOSTNAME, THE PATH FORM — HERE AND HOSTED (2026-10-06). This used to hand the local
  // run the per-project origin (`<id>.localhost:4000`), "the origin the UI has always been
  // given". MEASURED LIVE in the VS Code browser preview: that form's frame navigation is
  // fetched, gets HTTP 200, and is then ABORTED by the browser (net::ERR_ABORTED) — the
  // stage stays blank and spins forever — while the same server's path form on plain
  // localhost loads (controls in the same browser, same minute). The hosted engines already
  // hand out the path form (PUBLIC_BASE_URL, one host); this makes the local run the same.
  // The per-project subdomain ROUTE below stays served unchanged — only the URL the UI is
  // handed changed.
  return `${PUBLIC_BASE_URL || `http://localhost:${PORT}`}/preview/${project.projectId}/`;
}
function detailOf(project) {
  return {
    projectId: project.projectId,
    ...(project.label ? { label: project.label } : {}),
    ...(project.groupId ? { groupId: project.groupId } : {}),
    description: project.description || "",
    plan: "pro",
    agentProcessStatus: project.agentProcessStatus || "idle",
    agentServerStatus: "Active",
    createdAt: project.createdAt,
    published: publishedOf(project),
    /**
     * HAS ANYONE DONE ANYTHING HERE? — the room's exit guard asks (2026-10-04): a blank
     * project (born from a click, never prompted, no files) is discarded in silence; a
     * project with work gets the question. A user message counts as work — someone said
     * something to it, even if the build failed.
     */
    hasWork:
      Object.keys(project.currentFiles || {}).length > 0 ||
      (project.versions || []).length > 0 ||
      (project.conversation || []).some((m) => m.author === "user"),
    deployment: null,
    versionRecovery: null,
    importInProgress: null,
    secrets: project.secrets || [],
    customDomain: null,
    temporalDevelopmentProjectUrl: previewUrlFor(project),
    cachedDevelopmentUrl: null,
    developmentUrlFieldToUse: "temporalDevelopmentProjectUrl",
    productionProjectUrl: PUBLIC_BASE_URL
      ? `${new URL(PUBLIC_BASE_URL).host}/preview/${project.projectId}/`
      : `localhost:${PORT}/preview/${project.projectId}/`,
    previewImageUrl: null,
    totalCreditsSpent: 0,
  };
}
function summaryOf(project) {
  return {
    projectId: project.projectId,
    description: project.description || "",
    ...(project.label ? { label: project.label } : {}),
    ...(project.groupId ? { groupId: project.groupId } : {}),
    plan: "pro",
    createdAt: project.createdAt,
    lastModifiedAt: project.lastModifiedAt || project.createdAt,
    previewImageUrl: null,
    /** ⭐ THE BRIDGE READS THESE AS FACTS, never reconstructs them (routes/builder_bridge.py). */
    previewUrl: previewUrlFor(project),
    runs: (project.versions || []).length,
    /**
     * PUBLISHED TO THE CONSOLE (2026-10-04) — see `publishedOf`'s note for what ABSENT means.
     */
    published: publishedOf(project),
  };
}

/**
 * ⭐ IS THIS PROJECT PUBLISHED TO THE CONSOLE? (owner, 2026-10-04: the exit guard's design —
 * *"publish … that would publish it to the [console]"*, and unpublishing on exit discards.)
 *
 * ABSENT IS A REAL ANSWER, and it is PUBLISHED: every project born before publishing existed
 * (the night's earlier ideas, including the owner's own four cards) keeps its card. A project
 * created from here on carries `published: false` explicitly and becomes a card only when
 * someone presses Publish — one writer for the fact, and no migration needed.
 */
function publishedOf(project) {
  return project.published !== false;
}

// ── the agent: DeepSeek writes the app ──────────────────────────────────────
const AGENT_SYSTEM = `You are the build engine inside a local app builder. Each project is a STATIC website: plain HTML, CSS and JavaScript, several pages allowed. There is no build step, no framework, no server code.

You will receive the project's CURRENT FILES and the CONVERSATION so far, then the person's newest message.

Answer with ONE JSON object and nothing else:
{"say": "<one or two short sentences to show in the chat>", "files": [{"path": "index.html", "content": "<the full file>"}, ...]}

Rules:
- ALWAYS return the COMPLETE next state of every file you keep. Never return a diff, a patch, or a fragment.
- index.html must exist at the project root. Link styles.css and app.js with relative paths ("./styles.css").
- No external network assets: no CDN scripts, no web fonts, no remote images. Inline what you need; draw images with CSS or inline SVG.
- The app must work when served as static files from a plain file server: relative links only, no absolute "/" paths except for links back to index.html ("index.html" or "./").
- Keep it clean and readable: sensible structure, comments only where they carry meaning.
- If the person asks to start over or clear: return {"say": "...", "files": [{"path": "index.html", "content": "<a minimal honest placeholder page>"}]}.`;

function buildAgentInput(project, prompt) {
  const files = Object.entries(project.currentFiles || {}).map(([path, content]) => ({ path, content }));
  const recent = (project.conversation || []).slice(-12)
    .filter((m) => m.messageType === "regular")
    .map((m) => `${m.author}: ${m.message}`);
  return JSON.stringify({
    current_files: files,
    conversation: recent,
    new_message: prompt,
  }, null, 0);
}

function appendMessage(project, message) {
  project.conversation = project.conversation || [];
  project.conversation.push({ createdAt: nowIso(), ...message });
  project.lastModifiedAt = nowIso();
}

async function callDeepSeek(project, prompt, signal) {
  const res = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${DEEPSEEK_API_KEY}` },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [
        { role: "system", content: AGENT_SYSTEM },
        { role: "user", content: buildAgentInput(project, prompt) },
      ],
      response_format: { type: "json_object" },
      temperature: 0.4,
      // 32k, NOT 16k (2026-10-06): deepseek-flash's reasoning and answer SHARE this budget,
      // and reasoning alone measured up to 16,000 tokens on single calls — so the cap was hit
      // with an EMPTY answer (finish_reason=length) and larger prompts died on it (measured
      // live today: "The model did not return JSON — an empty response came back"). 32,000 is
      // the value that carried the owner's own ask through in the diagnostic run (11,619
      // used, 35.6s, 3 files); the API accepts up to 65,536. Still one model, no retry.
      max_tokens: 32000,
    }),
    signal: AbortSignal.any([signal, AbortSignal.timeout(RUN_TIMEOUT_MS)]),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`DeepSeek ${res.status}: ${body.slice(0, 300)}`);
  }
  const payload = await res.json();
  const content = payload?.choices?.[0]?.message?.content || "";
  let parsed;
  try { parsed = JSON.parse(content); } catch {
    // A HARD FAIL, SAID IN FULL (owner, 2026-10-06: "one model, if it fails I want an error
    // message on a loud hard fail — no fallback"). The reason rides the error: an empty
    // response, a truncation, or prose that is not JSON are different failures, and the
    // thread's error line must name which one it was. There is deliberately no retry and
    // no second model.
    const finish = payload?.choices?.[0]?.finish_reason || "unknown";
    const detail = content
      ? `${content.length} chars came back that do not parse (finish_reason=${finish})`
      : `an empty response came back (finish_reason=${finish})`;
    throw new Error(`The model did not return JSON — ${detail}.`);
  }
  const files = Array.isArray(parsed.files) ? parsed.files : [];
  const clean = {};
  for (const f of files) {
    if (!f || typeof f.path !== "string" || typeof f.content !== "string") continue;
    const path = f.path.replace(/^\.?\//, "");
    if (path.includes("..") || path.startsWith("/")) continue;
    clean[path] = f.content.slice(0, 400_000);
  }
  /**
   * ═══ A REPLY THAT CARRIES NO FILES IS AN ANSWER, NOT A FAILED BUILD (2026-10-06) ═══
   *
   * ⚠️ NOBODY PRIMES THE MODEL FOR THIS ONE (owner, 2026-10-06: *"Take this stuff out —
   * we don't want to tell the model anything like that … every model is trained to
   * answer a question"*). Asked something conversational, the model answers in words;
   * on a project with no files yet there is nothing for those words to change, so the
   * reply comes back as { say, files: [] } — and the old unconditional
   * `if (!clean["index.html"]) throw` turned every such reply into
   * "Run failed: The model returned no index.html." (the owner typed "How are you
   * today?" and got exactly that, 2026-10-06).
   *
   * So the rule is split by what the model actually did:
   *   · files returned  ⇒ it is a build, and a build WITHOUT a root index.html is
   *     malformed — still a loud hard fail, no guessing;
   *   · NO files        ⇒ it is a conversation turn — the `say` IS the answer.
   * One model, no retry, no fallback.
   */
  const isConversation = Object.keys(clean).length === 0;
  if (!isConversation && !clean["index.html"]) throw new Error("The model returned no index.html.");
  const usage = payload?.usage ? `${payload.usage.completion_tokens} tokens` : "usage unknown";
  return { say: typeof parsed.say === "string" ? parsed.say : "Done.", files: clean, usage, isConversation };
}

async function runAgent(projectId, prompt) {
  const project = readProject(projectId);
  if (!project) return;
  const run = { aborted: false };
  running.set(projectId, run);

  project.agentProcessStatus = "init";
  project.runStartedAt = nowIso();
  /**
   * THE FIRST PROMPT BECOMES THE DESCRIPTION (owner, 2026-10-04: *"I'm assuming it picks up
   * the first part of the prompt"*). It is the truth about the project — the console card's
   * description is this field, and the bridge reads it. Only the FIRST prompt: a project
   * that already says what it is keeps saying it. (Until this existed, a project born from
   * the Product tab and prompted in the workspace had no description, ever.)
   */
  if (!(project.description || "").trim()) {
    project.description = prompt.trim().slice(0, 240);
  }
  appendMessage(project, { author: "user", message: prompt, messageType: "regular" });
  appendMessage(project, { author: "agent", message: "Starting a new run\u2026", messageType: "starting" });
  appendMessage(project, { author: "agent", message: "Writing the app\u2026", messageType: "building" });
  writeProject(project);

  const controller = new AbortController();
  run.abort = () => controller.abort();
  const startedAtMs = Date.now();

  try {
    const result = await callDeepSeek(project, prompt, controller.signal);
    const fresh = readProject(projectId); // re-read: stop/edit may have touched it
    if (!fresh) return;
    const seconds = Math.max(1, Math.round((Date.now() - startedAtMs) / 1000));
    if (run.aborted) {
      appendMessage(fresh, { author: "agent", message: "Stopped.", messageType: "error" });
    } else {
      /**
       * ⚠️ A CONVERSATION TURN CREATES NO VERSION AND TOUCHES NO FILES — there is
       * nothing to snapshot; only a build writes a version and replaces the files.
       * Both outcomes still write the same completion pair (the spoken line, then
       * "Finished in Ns.") so every turn in the chat wears the identical shape —
       * see `isConversation` in `callDeepSeek`.
       */
      let versionId = null;
      if (!result.isConversation) {
        versionId = `v${(fresh.versions || []).length + 1}-${Date.now().toString(36)}`;
        fresh.versions = fresh.versions || [];
        fresh.versions.push({
          _id: versionId, name: `Run ${fresh.versions.length + 1}`, prompt,
          createdAt: nowIso(), commitSha: versionId, commitMessage: result.say,
          /**
           * ⚠️ THE SNAPSHOT IS THE STATE THIS VERSION *IS* — the run's own output — not the
           * state it replaced. It used to hold the PREVIOUS files, which made a version's
           * diff show the run before it and made "restore v1" restore an empty project.
           */
          files: result.files,
        });
        fresh.currentFiles = result.files;
      }
      appendMessage(fresh, { author: "agent", message: result.say, messageType: "building" });
      appendMessage(fresh, {
        author: "agent",
        message: `Finished in ${seconds}s.`,
        messageType: "finished",
        ...(versionId ? { versionId } : {}),
      });
      fresh.logs = fresh.logs || [];
      fresh.logs.push(
        result.isConversation
          ? `[${nowIso()}] conversation reply "${prompt.slice(0, 80)}" in ${seconds}s (${result.usage})`
          : `[${nowIso()}] run "${prompt.slice(0, 80)}" \u2192 ${Object.keys(result.files).length} file(s) in ${seconds}s (${result.usage})`
      );
      if (fresh.logs.length > 200) fresh.logs = fresh.logs.slice(-200);
      console.log(
        result.isConversation
          ? `[agent] ${projectId}: conversation reply in ${seconds}s (${result.usage})`
          : `[agent] ${projectId}: ${Object.keys(result.files).length} file(s) in ${seconds}s (${result.usage})`
      );
    }
    fresh.agentProcessStatus = "done";
    delete fresh.runStartedAt;
    /**
     * ⚠️ THIS WRITE IS THE RUN'S ONLY HOME. It used to be followed by a
     * read-from-disk-and-write-back that reverted every project to its pre-run
     * state (the run's completion survived only in memory) — the UI then polled
     * `init` for ever on a run that had actually finished. Never re-read here.
     */
    writeProject(fresh);
  } catch (error) {
    const fresh = readProject(projectId);
    if (fresh) {
      const message = run.aborted ? "Stopped." : `Run failed: ${error instanceof Error ? error.message : String(error)}`;
      appendMessage(fresh, { author: "agent", message, messageType: "error" });
      fresh.agentProcessStatus = "done";
      delete fresh.runStartedAt;
      writeProject(fresh);
    }
    console.error(`[agent] ${projectId}:`, error);
  } finally {
    running.delete(projectId);
  }
}

// ── API routes ──────────────────────────────────────────────────────────────
async function handleApi(req, res, path, query, body) {
  const seg = path.split("/").filter(Boolean);
  // Every route below lives under /api/v1/vcaas
  if (seg[0] !== "api" || seg[1] !== "v1" || seg[2] !== "vcaas") return fail(res, "VALIDATION", "Unknown path.", 404);
  const rest = seg.slice(3);

  // ── projects (collection) ──────────────────────────────────────────────
  if (rest[0] === "projects" && rest.length === 1) {
    if (req.method === "GET") {
      const all = listProjects().sort((a, b) => (b.lastModifiedAt || "").localeCompare(a.lastModifiedAt || ""));
      const search = (query.get("search") || "").toLowerCase();
      const filtered = search
        ? all.filter((p) => `${p.projectId} ${p.label || ""} ${p.description || ""}`.toLowerCase().includes(search))
        : all;
      const skip = Number(query.get("skip") || 0);
      const limit = Math.min(Number(query.get("limit") || 100), 100);
      return ok(res, filtered.slice(skip, skip + limit).map(summaryOf));
    }
    if (req.method === "POST") {
      const wanted = uniqueId(body.projectId || body.label || "app");
      const project = {
        projectId: wanted, label: body.label || null, groupId: body.groupId || null,
        description: body.description || "", createdAt: nowIso(), lastModifiedAt: nowIso(),
        agentProcessStatus: "idle", conversation: [], versions: [], currentFiles: {}, secrets: [],
        // NOT PUBLISHED UNTIL PUBLISHED (2026-10-04) — see `publishedOf`: a project born
        // from here on becomes a console card only when someone presses Publish.
        published: false,
      };
      writeProject(project);
      return ok(res, detailOf(project));
    }
  }

  // ── launch: create + start building, one call ──────────────────────────
  if (rest[0] === "projects" && rest[1] === "launch" && req.method === "POST") {
    // THE BUDGET FIRST (see THE RUN BUDGET above): a launch that will be refused must not
    // leave a project behind — the refusal is the whole answer.
    const prompt = (body.prompt || "").trim();
    if (prompt) {
      const budget = takeRunBudget(req);
      if (!budget.allowed) return fail(res, "RATE_LIMITED", budget.message, 429);
    }
    const wanted = uniqueId(body.projectId || body.label || "app");
    const project = {
      projectId: wanted, label: body.label || null, groupId: body.groupId || null,
      description: body.description || "", createdAt: nowIso(), lastModifiedAt: nowIso(),
      agentProcessStatus: "idle", conversation: [], versions: [], currentFiles: {}, secrets: [],
        // NOT PUBLISHED UNTIL PUBLISHED (2026-10-04) — see `publishedOf`: a project born
        // from here on becomes a console card only when someone presses Publish.
        published: false,
    };
    writeProject(project);
    if (prompt) void runAgent(wanted, prompt);
    return ok(res, {
      projectId: wanted,
      ...(body.projectId && body.projectId !== wanted ? { requestedProjectId: body.projectId } : {}),
      agent: { started: Boolean(prompt), status: prompt ? "init" : "idle" },
      warnings: [],
    });
  }

  // ── project groups ──────────────────────────────────────────────────────
  if (rest[0] === "project-groups") {
    if (req.method === "GET") return ok(res, []);
    if (req.method === "POST") return ok(res, { groupId: `g-${Date.now().toString(36)}`, name: body.name || "Group", description: body.description || "", createdAt: nowIso(), updatedAt: nowIso(), projectCount: 0 });
    if (req.method === "PATCH") return ok(res, { groupId: rest[1], ...body, updatedAt: nowIso() });
    if (req.method === "DELETE") return ok(res, { deleted: true, releasedProjects: 0 });
  }

  // ── webhooks / git-diff / figma validate ───────────────────────────────
  if (rest[0] === "webhooks") {
    if (req.method === "GET") return ok(res, { webhooks: [] });
    return ok(res, { deleted: true });
  }
  if (rest[0] === "git-diff") return ok(res, { diff: "" });
  if (rest[0] === "figma" && rest[1] === "validate") return ok(res, { valid: false });

  // ── /projects/{id}/... ─────────────────────────────────────────────────
  if (rest[0] !== "projects" || !rest[1]) return fail(res, "VALIDATION", "Unknown path.", 404);
  const projectId = decodeURIComponent(rest[1]);
  const sub = rest.slice(2);
  const project = readProject(projectId);
  if (!project) return fail(res, "PROJECT_NOT_FOUND", `No project "${projectId}".`, 404);

  // ── source-code: the download desk (the zip itself is served off /source-code/archive) ──
  if (sub[0] === "source-code" && req.method === "GET") {
    const lastVersion = (project.versions || []).slice(-1)[0];
    return ok(res, {
      filesCount: Object.keys(project.currentFiles || {}).length,
      lastCommitSha: lastVersion?._id || "",
      downloadUrl: `${PUBLIC_BASE_URL || `http://localhost:${PORT}`}/source-code/archive/${encodeURIComponent(projectId)}`,
    });
  }

  // ── publish: THE COMMIT (2026-10-04) — the console's card exists only for a published
  // project (routes/builder_bridge.py's sync reads `published`), and this is the one writer
  // of that fact. The builder's Publish control calls it; so does the room's exit guard.
  if (sub[0] === "publish" && req.method === "POST") {
    project.published = true;
    project.lastModifiedAt = nowIso();
    writeProject(project);
    return ok(res, { projectId, published: true });
  }

  // ── export / import: the whole project as one JSON code (the transfer dialogs' pair) ──
  if (sub[0] === "export" && req.method === "POST") {
    const payload = {
      version: 1,
      exportedAt: nowIso(),
      engine: "local-vcaas",
      projectId,
      label: project.label || null,
      description: project.description || "",
      files: project.currentFiles || {},
      conversation: project.conversation || [],
      versions: (project.versions || []).map((v) => ({ ...v, files: v.files || {} })),
    };
    return ok(res, {
      importCode: Buffer.from(JSON.stringify(payload), "utf8").toString("base64"),
      includeRecords: Boolean(body.includeRecords),
      message: "Local engine: the code carries the project's files, prompt history and versions.",
    });
  }
  if (sub[0] === "import" && req.method === "POST") {
    let payload;
    try {
      payload = JSON.parse(Buffer.from(String(body.importCode || ""), "base64").toString("utf8"));
    } catch {
      return fail(res, "VALIDATION", "That import code is not readable.");
    }
    if (!payload || typeof payload !== "object" || !payload.files || typeof payload.files !== "object") {
      return fail(res, "VALIDATION", "That import code carries no project files.");
    }
    project.currentFiles = payload.files;
    if (Array.isArray(payload.conversation) && payload.conversation.length) project.conversation = payload.conversation;
    if (Array.isArray(payload.versions) && payload.versions.length) project.versions = payload.versions;
    if (!project.description && payload.description) project.description = payload.description;
    appendMessage(project, { author: "agent", message: "Imported from a transfer code.", messageType: "finished" });
    project.lastModifiedAt = nowIso();
    writeProject(project);
    return ok(res, { projectId, status: "importing", message: "Imported locally \u2014 nothing was queued." });
  }

  // detail / patch / delete
  if (sub.length === 0) {
    if (req.method === "GET") return ok(res, detailOf(project));
    if (req.method === "PATCH" || req.method === "PUT") {
      /**
       * PER-KEY, AND `null` CLEARS — the platform's own contract (vcaas.ts `projects.patch`):
       * "`{ label: 'Acme' }` cannot blank the description". A null label means back to the
       * id; `projectId` itself is never writable — it is the address.
       */
      if ("label" in body) project.label = body.label === null ? null : String(body.label);
      if ("description" in body) project.description = body.description === null ? "" : String(body.description);
      if ("groupId" in body) project.groupId = body.groupId;
      project.lastModifiedAt = nowIso();
      writeProject(project);
      return ok(res, detailOf(project));
    }
    if (req.method === "DELETE") {
      rmSync(projectPath(projectId), { force: true });
      rmSync(join(APPS_DIR, projectId), { recursive: true, force: true });
      return ok(res, { deleted: true });
    }
  }

  // ── agent ──────────────────────────────────────────────────────────────
  if (sub[0] === "agent") {
    if (sub[1] === "status" && req.method === "GET") {
      const isRunning = project.agentProcessStatus === "init";
      return ok(res, {
        projectId,
        status: isRunning ? "init" : (project.conversation?.length ? "done" : "idle"),
        startedAt: project.runStartedAt || null,
        realtimeConversation: project.conversation || [],
        creditsSpent: 0,
        expectedMinutes: isRunning ? 1 : null,
        expectedFinishAt: isRunning ? new Date(Date.now() + 60_000).toISOString() : null,
      });
    }
    if (sub[1] === "full-conversation" && req.method === "GET") {
      const all = project.conversation || [];
      const limit = Number(query.get("limit") || 0);
      const offsetFromEnd = Number(query.get("offsetFromEnd") || 0);
      if (!limit) return ok(res, { conversation: all });
      const end = Math.max(0, all.length - offsetFromEnd);
      const start = Math.max(0, end - limit);
      return ok(res, { conversation: all.slice(start, end), totalCount: all.length, hasMore: start > 0 });
    }
    if (sub[1] === "start" && req.method === "POST") {
      if (project.agentProcessStatus === "init") return fail(res, "VALIDATION", "A run is already in progress.");
      const prompt = (body.prompt || "").trim();
      if (!prompt) return fail(res, "VALIDATION", "A prompt is required.");
      // THE BUDGET (see THE RUN BUDGET above): this is one of the two endpoints that spend
      // DeepSeek tokens, so it is one of the two that are billed.
      const budget = takeRunBudget(req);
      if (!budget.allowed) return fail(res, "RATE_LIMITED", budget.message, 429);
      void runAgent(projectId, prompt);
      return ok(res, { started: true });
    }
    if (sub[1] === "stop" && req.method === "POST") {
      const run = running.get(projectId);
      if (run?.abort) run.abort();
      return ok(res, { stopped: true });
    }
    if (sub[1] === "server" && sub[2] === "start-or-restart") return ok(res, { status: "Active" });
    return fail(res, "VALIDATION", `Unknown agent endpoint ${sub.join("/")}.`, 404);
  }

  // ── files ──────────────────────────────────────────────────────────────
  if (sub[0] === "files") {
    const files = project.currentFiles || {};
    if (sub[1] === "tree" && req.method === "GET") {
      const entries = Object.entries(files)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([path, content]) => ({
          path, name: path.split("/").pop(), type: "file",
          size: Buffer.byteLength(content, "utf8"), depth: path.split("/").length - 1,
        }));
      return ok(res, { entries, totalEntries: entries.length, offset: 0, limit: entries.length, hasMore: false, commitSha: null, filesCount: entries.length });
    }
    if (sub[1] === "content" && req.method === "GET") {
      const path = query.get("path") || "";
      if (!(path in files)) return fail(res, "VALIDATION", `No file "${path}".`, 404);
      return ok(res, { path, name: path.split("/").pop(), size: Buffer.byteLength(files[path], "utf8"), encoding: "utf8", content: files[path], commitSha: null });
    }
    if (sub[1] === "content" && req.method === "PUT") {
      const path = String(body.path || "").replace(/^\.?\//, "");
      if (!path || path.includes("..")) return fail(res, "VALIDATION", "Invalid path.");
      const content = body.encoding === "base64" ? Buffer.from(body.content || "", "base64").toString("utf8") : String(body.content || "");
      const created = !(path in files);
      project.currentFiles[path] = content;
      project.lastModifiedAt = nowIso();
      writeProject(project);
      return ok(res, { path, bytesWritten: Buffer.byteLength(content, "utf8"), created, rebuildRequired: true });
    }
    if (sub[1] === "upload") return fail(res, "VALIDATION", "Attachments are not supported by the local engine.");
    return fail(res, "VALIDATION", `Unknown files endpoint ${sub.join("/")}.`, 404);
  }

  // ── versions ───────────────────────────────────────────────────────────
  if (sub[0] === "versions") {
    if (req.method === "GET") {
      const versions = (project.versions || []).map(({ files, ...rest }) => rest).reverse();
      return ok(res, { versions, totalCount: versions.length });
    }
    if (req.method === "POST" && sub[2] === "recover") {
      const version = (project.versions || []).find((v) => v._id === sub[1]);
      if (!version) return fail(res, "VALIDATION", "Unknown version.", 404);
      project.currentFiles = version.files;
      appendMessage(project, { author: "agent", message: `Restored "${version.name}".`, messageType: "finished" });
      writeProject(project);
      return ok(res, { recovered: true });
    }
  }
  if (sub[0] === "version-diff") {
    const commitSha = query.get("commitSha") || "";
    const versions = project.versions || [];
    const index = versions.findIndex((v) => v._id === commitSha || v.commitSha === commitSha);
    if (index === -1) {
      return ok(res, { commitSha, diff: "(this version's snapshot is not held \u2014 the local engine keeps the files of every run; very old versions may predate it)" });
    }
    const before = index > 0 ? versions[index - 1].files || {} : {};
    const after = versions[index].files || {};
    return ok(res, { commitSha, diff: diffSnapshots(before, after) });
  }

  // ── rebuild / logs / deployments ───────────────────────────────────────
  if (sub[0] === "rebuild") {
    if (req.method === "POST") return ok(res, { status: "success", startedAt: nowIso() });
    return ok(res, { status: "success" });
  }
  if (sub[0] === "backend") {
    const files = Object.keys(project.currentFiles || {});
    const runs = (project.logs || []).join("\n");
    return ok(res, { logs: `[local engine] ${projectId}\nserving ${files.length} file(s):\n${files.map((f) => `  ${f}`).join("\n")}\nNo server process: this project is static HTML.\n\nRuns:\n${runs || "(none yet)"}` });
  }
  if (sub[0] === "deployments") {
    if (req.method === "GET") return ok(res, { status: null, createdAt: null });
    return fail(res, "VALIDATION", "Publishing is not available in local mode \u2014 nothing leaves this machine.");
  }
  if (sub[0] === "logs") return ok(res, { logs: "" });

  // ── secrets ────────────────────────────────────────────────────────────
  if (sub[0] === "secrets") {
    if (req.method === "POST") {
      project.secrets = project.secrets || [];
      const secret = { _id: `s-${Date.now().toString(36)}`, secretName: body.secretName || "SECRET", environment: body.environment || "development" };
      project.secrets.push(secret);
      writeProject(project);
      return ok(res, secret);
    }
    if (req.method === "DELETE") {
      project.secrets = (project.secrets || []).filter((s) => s._id !== sub[1]);
      writeProject(project);
      return ok(res, { deleted: true });
    }
  }

  // ── github / figma / domain / database: honest refusals or empty answers ─
  if (sub[0] === "github") {
    if (sub[1] === "status" && req.method === "GET") return ok(res, { connected: false, tokenValid: false, tokenExpired: false });
    if (sub[1] === "pull-status") return ok(res, { status: null });
    if (sub[1] === "env") return ok(res, { envDev: "", envProd: "" });
    return fail(res, "VALIDATION", "GitHub sync is not available in local mode.");
  }
  if (sub[0] === "figma") {
    if (sub[1] === "status") return ok(res, { connected: false });
    return fail(res, "VALIDATION", "Figma is not connected in local mode.");
  }
  if (sub[0] === "domain") return fail(res, "VALIDATION", "Custom domains are not available in local mode.");
  if (sub[0] === "database") {
    if (sub[1] === "tables-structure") return ok(res, { tables: [] });
    if (sub[1] === "query") return ok(res, { results: [] });
    return fail(res, "VALIDATION", "The local engine has no database.");
  }

  return fail(res, "VALIDATION", `Unknown endpoint ${sub.join("/")}.`, 404);
}

// ── preview serving: http://<id>.localhost:4000/ and /preview/<id>/… ───────
const MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif",
  ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8", ".md": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
};

/**
 * THE EMPTY PROJECT'S SPLASH (owner, 2026-10-04: a tab click births a project with no files,
 * and the preview answered a plain-text 404 — *"is there some kind of splash page there for
 * a new project?"*). This is that page, and it is served INSTEAD of the 404 only while the
 * project holds NOTHING: an empty stage is a real state, so it says so in the project's own
 * name rather than showing an error. The moment the first build lands, files exist and the
 * real page serves — this never stands in for content that simply lacks an index.
 * Styled by the engine alone (no framework reaches a static preview); the app's styling
 * pass reaches it whenever the owner wants, like everything else here.
 */
function emptyProjectPage(project) {
  /**
   * THE NAME PEOPLE READ, NOT THE ADDRESS (owner, 2026-10-04: *"product-idea-m1r — instead
   * say 'My new product idea'"*). The id is the hostname (generated per click, suffix and
   * all); the LABEL is the name, and the splash shows it when it exists.
   */
  const safeId = String(project.label || project.projectId).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${safeId} \u2014 nothing built yet</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; color: #374151;
         background: #ffffff url('/assets/wireframe-lab-bkg.jpg') repeat;
         font: 15px/1.6 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
  .card { max-width: 460px; padding: 50px; text-align: center; background: #ffffff;
         border: 1px solid rgba(15, 23, 42, 0.07); border-radius: 18px;
         box-shadow: 0 18px 50px rgba(15, 23, 42, 0.12); }
  /* THE STAGE'S LOGO IS THE OWNER'S (2026-10-06): the R from the nav, not the builder's sparkle
     glyph (owner: *"I want it switched with my logo, which is in the top left corner of the
     side in the R"*). The image is self-contained — its own dark ground with the white R — so
     it holds in both themes and needs no theme-dependent background of its own. */
  .glyph { width: 44px; height: 44px; margin: 0 auto 18px; border-radius: 12px; display: block; object-fit: cover; }
  h1 { margin: 0 0 8px; font-size: 17px; font-weight: 600; color: #111827; word-break: break-all; }
  p { margin: 0; color: #6B7280; font-size: 13.5px; }
  .hint { margin-top: 18px; font-size: 12.5px; color: #9CA3AF; }
  @media (prefers-color-scheme: dark) {
    body { background: #2b2635 url('/assets/canvas-development-lab-bkg.jpg') repeat; } h1 { color: #ffffff; }
    .card { background: #1b1b1f; border-color: #2c2c31; box-shadow: 0 18px 50px rgba(0, 0, 0, 0.5); }
  }
</style>
</head>
<body>
  <div class="card">
    <img class="glyph" src="/assets/raibach-logo.jpg" alt="" aria-hidden="true" />
    <h1>${safeId}</h1>
    <p>Nothing is built here yet. Describe the page you want in the chat, and it will appear on this stage.</p>
    <p class="hint">This stands in for the preview until the first build lands \u2014 it is not a file in the project.</p>
  </div>
</body>
</html>`;
}

function servePreview(res, projectId, subPath) {
  const project = readProject(projectId);
  if (!project) { res.writeHead(404, { "content-type": "text/plain" }); res.end("No such project."); return; }
  const files = project.currentFiles || {};
  let path = decodeURIComponent(subPath).replace(/^\/+/, "");
  if (!path) path = "index.html";
  if (path.endsWith("/")) path += "index.html";
  let content = files[path];
  if (content === undefined) content = files[`${path}/index.html`]; // directory → its index
  if (content === undefined) content = files[`${path}.html`]; // /about → about.html
  if (content === undefined && Object.keys(files).length === 0 && (path === "index.html" || path === "index")) {
    // THE EMPTY PROJECT — the splash, never the 404 (see `emptyProjectPage`).
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    res.end(emptyProjectPage(project));
    return;
  }
  if (content === undefined) {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end(`404 — ${path} is not in this project.\nFiles: ${Object.keys(files).join(", ")}`);
    return;
  }
  const ext = path.slice(path.lastIndexOf("."));
  res.writeHead(200, { "content-type": MIME[ext] || "application/octet-stream", "cache-control": "no-store" });
  res.end(content);
}

// ── the version diff: a real line diff between two file snapshots ───────────
function unifiedFor(aText, bText, path) {
  const a = (aText ?? "").split("\n");
  const b = (bText ?? "").split("\n");
  if (a.length * b.length > 4_000_000) {
    return `--- a/${path}\n+++ b/${path}\n@@ too large to diff line-by-line (${a.length} \u2192 ${b.length} lines) @@`;
  }
  const n = a.length, m = b.length;
  const dp = new Uint32Array((n + 1) * (m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i * (m + 1) + j] = a[i] === b[j]
        ? dp[(i + 1) * (m + 1) + j + 1] + 1
        : Math.max(dp[(i + 1) * (m + 1) + j], dp[i * (m + 1) + j + 1]);
    }
  }
  const out = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push(" " + a[i]); i++; j++; }
    else if (dp[(i + 1) * (m + 1) + j] >= dp[i * (m + 1) + j + 1]) { out.push("-" + a[i]); i++; }
    else { out.push("+" + b[j]); j++; }
  }
  while (i < n) out.push("-" + a[i++]);
  while (j < m) out.push("+" + b[j++]);
  return `--- a/${path}\n+++ b/${path}\n@@ -1,${n} +1,${m} @@\n${out.join("\n")}`;
}
function diffSnapshots(before, after) {
  const paths = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  const blocks = paths
    .filter((p) => before[p] !== after[p])
    .map((p) => unifiedFor(before[p], after[p], p));
  return blocks.length ? blocks.join("\n\n") : "(no file changed in this version)";
}

// ── the source archive: a STORE-method ZIP, written here (no dependencies) ──
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function zipStore(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const { path, data } of entries) {
    const name = Buffer.from(path, "utf8");
    const crc = crc32(data);
    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0x21, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    name.copy(local, 30);
    locals.push(local, data);

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0x21, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    name.copy(central, 46);
    centrals.push(central);
    offset += local.length + data.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...locals, cd, end]);
}

function serveSourceZip(res, projectId) {
  const project = readProject(projectId);
  if (!project) { res.writeHead(404, { "content-type": "text/plain" }); res.end("No such project."); return; }
  const entries = Object.entries(project.currentFiles || {})
    .map(([path, content]) => ({ path, data: Buffer.from(content, "utf8") }));
  const zip = zipStore(entries);
  res.writeHead(200, { "content-type": "application/zip", "content-length": String(zip.length), "cache-control": "no-store" });
  res.end(zip);
}

// ── server ──────────────────────────────────────────────────────────────────
const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const host = (req.headers.host || "").split(":")[0];

  if (url.pathname === "/health") return json(res, 200, { ok: true, engine: "local-vcaas", model: DEEPSEEK_MODEL, key: Boolean(DEEPSEEK_API_KEY) });

  // ── The asset desk: /assets/<file> — the engine's own static bits (the empty-state
  // texture today). The name is whitelisted by the route's regex (no slashes, no dots-dots),
  // so nothing can walk out of the folder.
  const assetMatch = url.pathname.match(/^\/assets\/([A-Za-z0-9._-]+)$/);
  if (assetMatch) {
    const assetPath = join(ASSETS_DIR, assetMatch[1]);
    if (!existsSync(assetPath)) {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("No such asset.");
      return;
    }
    const ext = assetMatch[1].slice(assetMatch[1].lastIndexOf("."));
    res.writeHead(200, { "content-type": ASSET_MIME[ext] || "application/octet-stream", "cache-control": "no-store" });
    res.end(readFileSync(assetPath));
    return;
  }

  // API
  if (url.pathname.startsWith("/api/")) {
    const body = req.method === "GET" || req.method === "HEAD" ? {} : await readBody(req);
    try { return await handleApi(req, res, url.pathname, url.searchParams, body); }
    catch (error) {
      console.error("[local-vcaas] API error:", error);
      return json(res, 500, { errors: { errorCode: "UNKNOWN", errorMessage: "Local engine error." }, data: null });
    }
  }

  // Source archive: /source-code/archive/<id>
  const zipMatch = url.pathname.match(/^\/source-code\/archive\/([^/]+)$/);
  if (zipMatch) return serveSourceZip(res, decodeURIComponent(zipMatch[1]));

  // Preview by path: /preview/<id>/…
  const m = url.pathname.match(/^\/preview\/([^/]+)(\/.*)?$/);
  if (m) {
    // THE MISSING SLASH REDIRECTS (2026-10-06): `/preview/<id>` (no trailing slash) is a
    // different base for relative URLs — `./styles.css` in a built index.html would resolve
    // to `/preview/styles.css` (one level up, 404) instead of inside the project. The stage
    // pane strips the trailing slash when it composes its frame URL (written for the old
    // subdomain form), so the engine canonicalizes: redirect to `/preview/<id>/` and every
    // relative link resolves inside the project.
    if (!m[2]) {
      res.writeHead(302, { location: `${url.pathname}/${url.search}` });
      res.end();
      return;
    }
    return servePreview(res, decodeURIComponent(m[1]), m[2] || "/");
  }

  // Preview by host: <id>.localhost:4000 (or <id>.localhost)
  if (host.endsWith(`.${PREVIEW_HOST_SUFFIX}`)) {
    const projectId = host.slice(0, -1 * (PREVIEW_HOST_SUFFIX.length + 1));
    return servePreview(res, projectId, url.pathname);
  }

  // THE BANNER SPEAKS FOR WHERE THIS COPY LIVES (2026-10-04): hosted, the old localhost text
  // would be a lie the first thing every visitor reads — it names the service's own origin.
  const banner = PUBLIC_BASE_URL
    ? `local-vcaas engine (hosted)\n\napi:     ${PUBLIC_BASE_URL}/api/v1/vcaas\npreviews: ${PUBLIC_BASE_URL}/preview/<projectId>/\nhealth:  ${PUBLIC_BASE_URL}/health\n`
    : `local-vcaas engine\n\napi:     http://localhost:${PORT}/api/v1/vcaas\npreviews: http://<projectId>.${PREVIEW_HOST_SUFFIX}:${PORT}/ or http://localhost:${PORT}/preview/<projectId>/\nhealth:  http://localhost:${PORT}/health\n`;
  res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
  res.end(banner);
});

server.listen(PORT, () => {
  console.log(`[local-vcaas] listening on http://localhost:${PORT}`);
  console.log(`[local-vcaas] model: ${DEEPSEEK_MODEL} (key ${DEEPSEEK_API_KEY ? "present" : "MISSING — set local-vcaas/.env"})`);
});
