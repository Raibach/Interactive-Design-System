# ruff: noqa: E402 — THIS FILE'S IMPORTS ARE STAGED ON PURPOSE, and the check cannot see why.
#
# `load_dotenv()` has to run BEFORE anything reads the environment, and several of the modules
# imported below read it at import time: `sentry_sdk.init()` two lines down takes its DSN from
# `os.getenv("SENTRY_DSN")`, and `grace_gui` and the routers under it resolve configuration the
# same way. That forces a shape the linter reads as a mistake — an import placed after a call —
# when the order IS the correctness. Moving these imports to the top would read the environment
# before it is loaded and quietly hand the application empty values.
#
# Declared for the whole file rather than line by line because all eleven are the same fact, and
# eleven repetitions of the same reason is how a reason stops being read. The cost is real and is
# accepted knowingly: a FUTURE import in this file that lands in the wrong place for an unrelated
# reason will not be reported either. This file is the application's entry point and its bootstrap
# order is the whole point of it.
import os
import sys

from dotenv import load_dotenv

load_dotenv()

import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration

sentry_sdk.init(
    dsn=os.getenv("SENTRY_DSN", ""),
    environment=os.getenv("ENVIRONMENT", "production"),
    traces_sample_rate=0.3,
    enable_tracing=True,
    integrations=[
        StarletteIntegration(transaction_style="url"),
        FastApiIntegration(transaction_style="url"),
    ],
)

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from grace_gui import (
    load_logs_to_vectorstore,
)

app = FastAPI(title="Grace AI API", description="Backend API for Grace AI assistant")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5001",  # Local backend + UI (serves frontend/dist)
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    load_logs_to_vectorstore()

    import os as _os
    database_url = _os.getenv("DATABASE_URL")
    if not database_url:
        print("⚠️  DATABASE_URL not found — Database APIs disabled", file=sys.stderr)
        return
    import services
    services.init_services(database_url)

    # Model startup verification — the ONE model query_llm() runs, for every mode.
    from model_server_manager import ensure_grace_server
    ensure_grace_server("deepseek")

    # ── THE DAILY INSPECTION (governance, 2026-09-18) ─────────────────────────
    # One bounded local-model call a day, reported into the console's own conversation and
    # the trace. It is a timer, not a resident worker: the model is loaded on demand with an
    # idle TTL, and a machine without the local server records NOT RUN rather than reaching
    # for another model. Cancelled on shutdown.
    import asyncio as _asyncio

    from governance_inspector import daily_loop
    app.state.inspection_task = _asyncio.create_task(daily_loop())


@app.on_event("shutdown")
async def shutdown_event():
    task = getattr(app.state, "inspection_task", None)
    if task and not task.done():
        task.cancel()
        try:
            import asyncio as _asyncio
            await _asyncio.wait_for(_asyncio.shield(task), timeout=5)
        except Exception:  # noqa: BLE001 — shutdown must not hang on the inspector
            pass


# ── Route modules (extracted during modularization) ─────────────────
from routes import (
    agent_rpc,
    ai,
    auth,
    conversations,
    figma,
    figma_intake,
    files,
    governance,
    memory,
    milvus,
    misc,
    projects,
    prompt_sessions,
    teacher,
)

for _m in (misc, conversations, projects, teacher, memory,
           prompt_sessions, ai, figma, milvus, agent_rpc, files, auth, governance,
           figma_intake):
    app.include_router(_m.router)


# ── THE DEMO GATE (registered unconditionally, on purpose) ─────────────────
#
# WHEN: only when DEMO_MODE=1 — the deployed demo service. Local runs are
# unaffected (the gate's first line is a passthrough).
#
# WHERE, and why HERE: this must not live inside the `if os.path.isdir(frontend_dist)`
# block below — a build without a frontend dist would then ship with no gate at all.
# Registered after the router loop and BEFORE the two frontend middlewares, so the
# stack runs: spa_fallback → cache headers → this gate → CORS → routes. That order is
# deliberate: a 403/429 from the gate travels back out through the cache middleware
# (which stamps no-cache on it), the SPA fallback only ever touches 404s, and no
# request the gate refuses reaches a route handler.
from demo_policy import demo_policy_dispatch

app.middleware("http")(demo_policy_dispatch)


# ── Serve production frontend (SPA) ────────────────────────────────────
frontend_dist = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.isdir(frontend_dist):
    # ── THE SHELL IS NEVER CACHED; THE HASHED ASSETS ARE CACHED FOREVER ──────────────
    #
    # This said "DEV PHASE: hard no-cache everywhere — index, hashed assets, API,
    # manifest", and it was wrong in both directions:
    #
    #   * A deploy must take effect on the next load. The shell (index.html) names the
    #     build's own asset files, so it is the one document that must always be
    #     re-read; `no-store` keeps it honest, and a browser that reloads gets the new
    #     build with no hard refresh and no cache-buster.
    #   * `no-store` ON THE HASHED ASSETS makes every visit re-download the whole
    #     application. Vite puts a content hash in every build output's name, so those
    #     files are immutable BY CONSTRUCTION: a new build writes NEW names and the
    #     shell points at them. Caching them for a year is not a risk, it is the
    #     reason the hash exists.
    #
    # MEASURED (2026-10-01, production): index.html and index-*.js both carried
    # `no-cache, no-store, must-revalidate`, so a returning tab re-fetched ~1MB every
    # load — and the owner, reading a tab that had been open across a deploy, saw the
    # previous build and reported the work as not shipped.
    #
    # `/assets/*` is the public directory's own files plus the build's outputs, and both
    # are content-addressed (measured: figma-3cbad9fb…svg, index-Cfy58q23.js). Anything
    # that is NOT under /assets keeps the revalidate-every-time policy.
    @app.middleware("http")
    async def frontend_cache_headers(request: Request, call_next):
        response = await call_next(request)
        if request.url.path.startswith("/assets/") and response.status_code == 200:
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        else:
            response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"
        return response

    # Serve static assets (JS, CSS, images)
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="assets")

    # Serve index.html for root and SPA fallback via a catch-all that runs AFTER all API routes.
    # Using a middleware approach: if a non-API GET request would 404, serve index.html instead.
    @app.middleware("http")
    async def spa_fallback(request: Request, call_next):
        response = await call_next(request)
        path = request.url.path
        if response.status_code == 404 and request.method == "GET" and not path.startswith("/api/"):
            index_path = os.path.join(frontend_dist, "index.html")
            if os.path.isfile(index_path):
                return FileResponse(
                    index_path,
                    headers={"Cache-Control": "no-cache, no-store, must-revalidate"}
                )
        return response


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
