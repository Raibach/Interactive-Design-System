"""Demo-mode policy gate — the server-side lock for the public demo.

WHY THIS FILE EXISTS
────────────────────
The demo's login was an illusion the browser performed: `PinGate.tsx` holds the
pin in the bundle and stores the owner's user id, so every visitor arrived as
the owner. Nothing on the server said no. That is fine for a local prototype and
wrong for a public URL — the same endpoints that let the owner work let a
stranger permanently delete packages, overwrite source through `/api/repair/apply`,
install catalogues through `/api/catalog/ingest`, and spend the DeepSeek key.

So the demo is enforced HERE, where a curl cannot argue with it. The browser pass
(`frontend/src/shared/demoMode.ts`) only hides affordances; THIS is the lock.

HOW IT DECIDES
──────────────
Every `/api/` request, in this order:

  1. RATE LIMIT — before everything, because `GET /api/health` is a *paid*
     DeepSeek ping (routes/misc.py) and a pass-list checked first would leave the
     one endpoint that costs money unthrottled. The global bucket is the money
     backstop; the per-key bucket is fairness between visitors.
  2. PASS-LIST — the few endpoints that need no policy: login, health, the
     shell's own config, and `/api/auth/me`.
  3. POLICY — GETs pass except a denylist of infrastructure/source/oracle reads;
     every mutating verb (POST/PUT/PATCH/DELETE) is DENIED unless it is on the
     allowlist. Deny-by-default: a route added tomorrow is locked to the demo
     until someone writes it into the allowlist on purpose.

THE ALLOWLIST NAMES ROUTES BY THEIR OWN TEMPLATES
─────────────────────────────────────────────────
The entries below are the exact path strings FastAPI registers (check them
against `app.routes` with `check_demo_policy.py`, which fails loudly on drift).
Prefix matching was considered and rejected: `path.startswith("/api/prompt-sessions/")`
reads as "the demo may use its own packages" and actually permits
`DELETE /api/prompt-sessions/{id}` and `POST …/transfer` — the exact class of
thing this gate exists to stop.

`scope["route"]` IS None HERE, WHICH IS WHY THIS MATCHES ON SHAPE
────────────────────────────────────────────────────────────────
`@app.middleware("http")` registers a `BaseHTTPMiddleware`, and its dispatch runs
_before_ the router has matched: the router sets `scope["route"]` downstream,
during `call_next`. A middleware that read it would see None and deny everything.
The templates are therefore compiled to path-shape regexes (`{param}` → `[^/]+`)
at import and matched against `request.url.path`.

WHAT THIS FILE DELIBERATELY DOES NOT DO
───────────────────────────────────────
It does not verify identity — `deps.get_user_id_from_header` pins every demo
request to `DEMO_USER_ID`, headers ignored. It does not rate-limit outbound tool
calls the model makes inside `/api/teacher/query`; the endpoint's own bucket
bounds those. And all demo visitors share one identity and one sandbox by
design: they see each other's edits until `seed_demo_data.py --reset` runs.
"""
import os
import re
import time

from fastapi import Request
from fastapi.responses import JSONResponse

from deps import DEMO_MODE


# ── THE RATE LIMITS ────────────────────────────────────────────────────────
# Specs are "tokens/seconds" and live in the environment so the owner can tune
# the demo without a deploy. Defaults: one visitor gets 20 LLM-backed requests
# per 10 minutes; ALL visitors together get 300 per hour (the money backstop);
# other mutations 120 per hour per visitor.
def _limit(spec: str, default: tuple[int, float]) -> tuple[int, float]:
    """Parse 'N/seconds' into (capacity, refill tokens per second). Warn and fall back."""
    try:
        tokens_text, seconds_text = spec.split("/")
        capacity = int(tokens_text)
        window = float(seconds_text)
        if capacity < 1 or window <= 0:
            raise ValueError("capacity and window must be positive")
        return capacity, capacity / window
    except Exception:
        print(
            f"⚠️  [demo] rate-limit spec {spec!r} is not 'N/seconds' — using {default[0]}/{default[1]}",
        )
        return default


_LLM_PER_KEY = _limit(os.getenv("DEMO_RATE_LLM_PER_KEY", "20/600"), (20, 20 / 600))
_LLM_GLOBAL = _limit(os.getenv("DEMO_RATE_LLM_GLOBAL", "300/3600"), (300, 300 / 3600))
_MUTATION_PER_KEY = _limit(os.getenv("DEMO_RATE_MUTATION_PER_KEY", "120/3600"), (120, 120 / 3600))

# Buckets: {(key, bucket): (tokens, last_update)}. In-process, single replica —
# a restart refills, which is fine for a demo (the DeepSeek spend cap is the
# backstop that survives restarts).
_BUCKETS: dict[tuple[str, str], tuple[float, float]] = {}


def _consume(key: str, bucket: str, capacity: float, refill_per_second: float) -> bool:
    """A token bucket. Consumes on first use — a full bucket is spent by 20 requests, not 21."""
    now = time.time()
    bucket_key = (key, bucket)
    tokens, last = _BUCKETS.get(bucket_key, (capacity, now))
    tokens = min(capacity, tokens + (now - last) * refill_per_second)
    if tokens >= 1:
        _BUCKETS[bucket_key] = (tokens - 1, now)
        return True
    _BUCKETS[bucket_key] = (tokens, now)
    return False


def _prune_buckets() -> None:
    """Drop buckets idle long enough to be full anyway. Keeps per-IP memory bounded."""
    if len(_BUCKETS) < 4096:
        return
    cutoff = time.time() - 3600
    for bucket_key, (_, last) in list(_BUCKETS.items()):
        if last < cutoff:
            del _BUCKETS[bucket_key]


def _client_key(request: Request) -> str:
    """Who to bill the bucket to. The ingress's own header first, then the first
    hop of X-Forwarded-For, then the socket. XFF is client-writable, so a spoofer
    can *dodge the fairness limit* — they cannot dodge the global bucket, which
    is the one protecting the wallet."""
    real_ip = (request.headers.get("X-Real-IP") or "").strip()
    if real_ip:
        return real_ip
    forwarded = request.headers.get("X-Forwarded-For") or ""
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# ── THE PASS-LIST ──────────────────────────────────────────────────────────
# (method, exact path). These need no policy: health is the paid ping (throttled
# above), config is how the shell learns it is the demo, login/me are the session.
PASS_LIST = {
    ("GET", "/api/health"),
    ("GET", "/api/config"),
    ("POST", "/api/auth/login"),
    ("GET", "/api/auth/me"),
}

# ── THE GET DENYLIST ───────────────────────────────────────────────────────
# Reads that are infrastructure, source, credentials-adjacent, or cross-user
# oracles. Prefix matching is safe HERE and only here: a denylist that matches
# more denies more, which fails closed. (`/api/milvus/*` is the important one —
# it dumps vector collections unscoped by user, which would hand a visitor the
# owner's prompt content and the package UUIDs that several unpredicated child
# endpoints accept.)
GET_DENYLIST_PREFIXES = (
    "/api/auth/users",
    "/api/admin/",
    "/api/milvus/",
    "/api/files/",
    "/api/repair/read",
    "/api/reasoning/trace",
    # `/api/debug/` has NO route behind it today — CommandCenter.tsx still asks for
    # /api/debug/command-center and gets a 404. The deny is kept anyway: the day a
    # debug route lands, the demo must not inherit it, and a GET would otherwise
    # pass by default. check_demo_policy.py reports it as a note, not drift.
    "/api/debug/",
    "/api/figma/",
    "/api/governance/",
)

# ── THE FEW READS THE DENY ABOVE KEEPS ─────────────────────────────────────
# 2026-10-02, measured on the live demo: the design rail reads /api/figma/activity
# to say what was last approved and drew "The record of what was approved could
# not be read (HTTP 403)" where the trail belongs — a refusal that reads as a
# breakage. These three are kept because none of them dials api.figma.com, none
# writes a file, and none carries another user's content: `activity` is the
# design-element trail (rows this database holds, read-only), `catalog` is the
# LOCAL catalogue state (a file read), and `config` is connection booleans plus
# the default file key — a key that already sits in this repository's own
# component descriptions. Everything else under /api/figma/ (the endpoints that
# call Figma, write source, or report cross-session usage) stays denied, and
# mutations are unaffected: activity/purge is a POST and the allowlist refuses it
# as before.
GET_DENY_EXCEPTIONS = (
    "/api/figma/activity",
    "/api/figma/catalog",
    "/api/figma/config",
)

# ── THE MUTATION ALLOWLIST ─────────────────────────────────────────────────
# The demo's own sandbox, and nothing else: create/edit its own packages, save
# and restore their versions, chat, and assemble surfaces. Every entry is an
# exact route template — see the module docstring for why not prefixes.
ALLOWED_MUTATIONS = (
    # The chat turn (and the AI's bounded tool use inside it) and assembly.
    ("POST", "/api/teacher/query"),
    ("POST", "/api/ai/assemble-surface"),
    ("POST", "/api/ai/save-surface"),
    ("POST", "/api/ai/confirm-exit"),
    ("POST", "/api/ai/read-tool"),
    # Own packages: create, edit, save a version, restore a version.
    ("POST", "/api/prompt-sessions"),
    ("PUT", "/api/prompt-sessions/{session_id}"),
    ("POST", "/api/prompt-sessions/{session_id}/versions"),
    ("POST", "/api/prompt-sessions/{session_id}/versions/{version_number}/restore"),
    # Own conversations: the chat panel's normal writes as you talk.
    ("POST", "/api/conversations"),
    ("PUT", "/api/conversations/{conversation_id}"),
    ("PUT", "/api/conversations/{conversation_id}/draft"),
    ("PUT", "/api/conversations/{conversation_id}/surface-state"),
    ("POST", "/api/conversations/{conversation_id}/messages"),
    ("POST", "/api/conversation/confirm-tag"),
    ("POST", "/api/conversation/track-tag-suggestion"),
    # Own projects: the shell creates a default project when the user has none
    # (WritingAreaIndex's createProject path) and can rename it. 2026-10-02, from
    # the live demo's Sentry: POST /api/projects answered 403 on every first load
    # because the demo user had no project row, and the console logged the
    # refusal as an error. Deny of DELETE stays — a project never goes away.
    ("POST", "/api/projects"),
    ("PUT", "/api/projects/{project_id}"),
    # The Product room's bridge (2026-10-04 — wireframe-lab/HOST-THE-TOOLS.md): the
    # builder's engine is HOSTED now, and the owner's decision is that demo visitors
    # may run the builder — so the room's normal moves go through the bridge like
    # they do locally: birth a project (`new`), sync the console cards (`sync`),
    # publish/discard from the exit guard. THE MONEY IS BOUNDED INSIDE THE TOOL
    # (the hosted engine's own per-visitor and global buckets — the pattern this
    # file set), and these four are ordinary mutations here, so the per-visitor
    # mutation bucket covers them too. `/api/builder/health` and `/api/builder/state`
    # are GETs and pass by default.
    ("POST", "/api/builder/new"),
    ("POST", "/api/builder/sync"),
    ("POST", "/api/builder/publish"),
    ("POST", "/api/builder/discard"),
)

# Endpoints that reach the hosted model (or load the local embedder to ping it).
LLM_PATHS = {
    "/api/teacher/query",
    "/api/ai/assemble-surface",
    "/api/ai/save-surface",
    "/api/ai/confirm-exit",
    "/api/health",
}

# GET plus its automatic HEAD companion; anything else is a mutating verb.
_MUTATING_METHODS = ("POST", "PUT", "PATCH", "DELETE")
_SEGMENT_PARAM = re.compile(r"^\{[^}]+\}$")
_PATH_PARAM = re.compile(r"^\{[^}]+:path\}$")


def _template_to_pattern(template: str) -> re.Pattern[str]:
    """`/api/prompt-sessions/{session_id}/versions` → `^/api/prompt-sessions/[^/]+/versions$`."""
    segments = []
    for segment in template.split("/"):
        if _PATH_PARAM.match(segment):
            segments.append(".+")
        elif _SEGMENT_PARAM.match(segment):
            segments.append("[^/]+")
        else:
            segments.append(re.escape(segment))
    return re.compile("^" + "/".join(segments) + "$")


_ALLOWED_COMPILED = tuple(
    (method, _template_to_pattern(template)) for method, template in ALLOWED_MUTATIONS
)

_DENIED_GET = (
    "This is the demo instance — this resource is not readable here, and nothing was changed. "
    "Reading source, infrastructure, and cross-user data is disabled in the demo."
)
_DENIED_MUTATION = (
    "This is the demo instance — {method} {path} is disabled here, and nothing was changed. "
    "The demo creates and edits its own sandbox packages; deleting, publishing, and system "
    "changes run only in the full system."
)
_THROTTLED = (
    "The demo's rate limit was reached{scope} — try again shortly. LLM-backed actions are "
    "capped so the demo stays up for everyone."
)


def _forbidden(detail: str) -> JSONResponse:
    return JSONResponse(status_code=403, content={"detail": detail})


def _throttled(scope: str) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={"detail": _THROTTLED.format(scope=scope)},
        headers={"Retry-After": "60"},
    )


async def demo_policy_dispatch(request: Request, call_next):
    """The middleware body. Registered unconditionally in main.py — see there for why."""
    if not DEMO_MODE or not request.url.path.startswith("/api"):
        return await call_next(request)

    path = request.url.path
    method = request.method
    # HEAD is GET's automatic companion on Starlette's GET routes; it must follow
    # GET's policy, not the mutation deny-by-default.
    policy_method = "GET" if method == "HEAD" else method

    # ── 1. THE MONEY, FIRST ────────────────────────────────────────────────
    if path in LLM_PATHS:
        _prune_buckets()
        if not _consume(_client_key(request), "llm", *_LLM_PER_KEY):
            return _throttled(" for this visitor")
        if not _consume("global", "llm_global", *_LLM_GLOBAL):
            return _throttled(" for this deployment")
    elif method in _MUTATING_METHODS:
        _prune_buckets()
        if not _consume(_client_key(request), "mutations", *_MUTATION_PER_KEY):
            return _throttled(" for this visitor")

    # ── 2. THE DOORS THAT NEED NO POLICY ───────────────────────────────────
    if (policy_method, path) in PASS_LIST:
        return await call_next(request)

    # ── 3. THE POLICY ──────────────────────────────────────────────────────
    if policy_method == "GET":
        if path.startswith(GET_DENYLIST_PREFIXES) and not path.startswith(GET_DENY_EXCEPTIONS):
            return _forbidden(_DENIED_GET)
        return await call_next(request)

    for allowed_method, pattern in _ALLOWED_COMPILED:
        if policy_method == allowed_method and pattern.match(path):
            return await call_next(request)

    return _forbidden(_DENIED_MUTATION.format(method=method, path=path))
