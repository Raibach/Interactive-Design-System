"""Auto-extracted route module from main.py — zero behavior change."""
import json
import os
from datetime import datetime
from typing import Any

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

import services as state
from deps import (
    DEMO_MODE,
    REASONING_TRACE_PATH,
    a2ui_catalog_surfaces,
    a2ui_registry_for,
)
from grace_gui import (
    evaluate_source,
    query_llm,
    retrieve_memory_context,
    search_news,
    summarize_pdfs,
)

router = APIRouter()


# ── WHAT THE SYSTEM SPENT (2026-10-03) ──────────────────────────────────────────────────────────
# The Governance room's feed. The per-call ledger lives in `usage_metrics`
# (`metric_type='llm_call'`, one row per model call — written by `record_pending_usage`, its
# numbers from the provider's own usage block, its user composed in by the middleware in
# main.py). This reads it newest-first with today's totals.
#
# TOKENS ARE MEASURED; COST IS AN ESTIMATE and is present only when the deployment states its
# prices (`DEEPSEEK_PRICE_IN_PER_M` / `DEEPSEEK_PRICE_OUT_PER_M`) — an absent cost is reported
# as absent, never zeroed and never guessed. `priced_calls` says how many of today's calls the
# cost covers, so a partial sum can never masquerade as the whole bill.
#
# THE PATH IS UNDER /api/governance/ ON PURPOSE: the demo's GET denylist already refuses that
# prefix, so spend data stays off the public demo with no new policy entry to write.
@router.get("/api/governance/usage")
async def governance_usage(limit: int = 50):
    """The per-call ledger (newest first) and today's totals. A read of the record, nothing else."""
    if state.prompt_sessions_api is None:
        raise HTTPException(status_code=503, detail="Database not available")
    limit = max(1, min(int(limit), 500))
    try:
        with state.prompt_sessions_api.get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT user_id, created_at, metadata
                FROM usage_metrics
                WHERE metric_type = 'llm_call'
                ORDER BY created_at DESC
                LIMIT %s
                """,
                (limit,),
            )
            rows = cursor.fetchall()
            cursor.execute(
                """
                SELECT
                    COUNT(*)                                                     AS calls,
                    COALESCE(SUM((metadata->>'prompt_tokens')::bigint), 0)       AS prompt_tokens,
                    COALESCE(SUM((metadata->>'completion_tokens')::bigint), 0)   AS completion_tokens,
                    COALESCE(SUM((metadata->>'total_tokens')::bigint), 0)        AS total_tokens,
                    SUM((metadata->>'est_cost_usd')::numeric)                    AS est_cost_usd,
                    COUNT(*) FILTER (WHERE metadata->>'est_cost_usd' IS NOT NULL) AS priced_calls
                FROM usage_metrics
                WHERE metric_type = 'llm_call' AND created_at >= date_trunc('day', now())
                """,
            )
            today = cursor.fetchone() or {}
            cursor.execute(
                """
                SELECT metadata->>'model' AS model, COUNT(*) AS calls,
                       COALESCE(SUM((metadata->>'total_tokens')::bigint), 0) AS total_tokens
                FROM usage_metrics
                WHERE metric_type = 'llm_call' AND created_at >= date_trunc('day', now())
                GROUP BY 1 ORDER BY 2 DESC
                """,
            )
            by_model = cursor.fetchall()
            cursor.execute(
                """
                SELECT user_id, COUNT(*) AS calls,
                       COALESCE(SUM((metadata->>'total_tokens')::bigint), 0) AS total_tokens
                FROM usage_metrics
                WHERE metric_type = 'llm_call' AND created_at >= date_trunc('day', now())
                GROUP BY 1 ORDER BY 3 DESC
                """
            )
            by_user = cursor.fetchall()
    except Exception as read_error:
        raise HTTPException(status_code=503, detail=f"the usage ledger could not be read: {read_error}")

    def _call_row(row: dict[str, Any]) -> dict[str, Any]:
        meta = row.get("metadata") or {}
        return {
            "user_id": str(row.get("user_id") or ""),
            "at": row["created_at"].isoformat() if row.get("created_at") else "",
            **meta,
        }

    return {
        "calls": [_call_row(r) for r in rows],
        "today": {
            "calls": int(today.get("calls") or 0),
            "prompt_tokens": int(today.get("prompt_tokens") or 0),
            "completion_tokens": int(today.get("completion_tokens") or 0),
            "total_tokens": int(today.get("total_tokens") or 0),
            "est_cost_usd": (
                float(today["est_cost_usd"]) if today.get("est_cost_usd") is not None else None
            ),
            "priced_calls": int(today.get("priced_calls") or 0),
        },
        "today_by_model": [
            {
                "model": b.get("model"),
                "calls": int(b.get("calls") or 0),
                "total_tokens": int(b.get("total_tokens") or 0),
            }
            for b in by_model
        ],
        # THE OWNER'S SHAPE: *"a list of activity, listed at the level of USER… sorted by their
        # package activity"* — so the day is also grouped by user, busiest first.
        "today_by_user": [
            {
                "user_id": str(u.get("user_id") or ""),
                "calls": int(u.get("calls") or 0),
                "total_tokens": int(u.get("total_tokens") or 0),
            }
            for u in by_user
        ],
        "cost_note": (
            "costs are estimated from DeepSeek's published rates (peak/off-peak on the UTC clock; "
            "a measured cache split is used when the provider reported one, and every input token "
            "is billed at the cache-miss price otherwise)"
        ),
    }


# Models for request/response
class NewsQuery(BaseModel):
    query: str
    reasoning: bool = False
    include_memory: bool = True


class MemoryQuery(BaseModel):
    query: str
    reasoning: bool = True


class SourceEvalRequest(BaseModel):
    url: str
    title: str | None = None
    content: str | None = None

@router.get("/api/config")
async def api_config():
    """The public boot config the shell reads once — which build this is, and where its tools live.

    `demo_mode` is how the browser knows to hide destructive affordances
    (frontend/src/shared/appConfig.ts). It is COSMETIC: the server-side lock is
    demo_policy.py, and a client that lies about this value changes nothing but
    its own buttons. `false` on local runs, where the full system is the point.

    `development_tool_url` / `builder_tool_url` (2026-10-04) are the rooms' tool
    addresses, runtime config instead of hardcoded localhost: the deployed demo sets
    them to the hosted tool services (wireframe-lab/HOST-THE-TOOLS.md), a local run
    leaves them unset and the shell keeps `http://localhost:8090` / `:3223`. The rooms
    treat an empty value as "not connected" and say so plainly — which is also the
    honest state on a demo whose tool service is missing.
    """
    return {
        "demo_mode": DEMO_MODE,
        "development_tool_url": os.getenv("DEVELOPMENT_TOOL_URL", "").rstrip("/"),
        "builder_tool_url": os.getenv("BUILDER_TOOL_URL", "").rstrip("/"),
    }


@router.get("/api/health")
async def api_health():
    """Health check — reports honest status. If critical services are down, status reflects it."""
    health_data = {
        "status": "ok",
        "timestamp": datetime.now().isoformat(),
        "checks": {}
    }
    critical_failures = []

    # ── Database check ──
    db_ok = state.prompt_sessions_api is not None
    health_data["checks"]["database"] = "connected" if db_ok else "DISCONNECTED"
    if not db_ok:
        critical_failures.append("database")

    # ── Milvus check (REST first, pymilvus fallback) ──
    milvus_ok = False
    milvus_error = None
    try:
        from milvus_rest import MilvusREST
        rest = MilvusREST()
        milvus_ok = rest.connected()
    except Exception as e:
        milvus_error = f"REST: {str(e)[:80]}"
    
    if not milvus_ok:
        try:
            from memory_embedder import get_embedder
            from milvus_client import get_milvus_client
            milvus_client = get_milvus_client()
            # The CALL is the point, not the binding: this is what loads the embedding model,
            # and the handle was never read. Dropping the assignment keeps the load.
            get_embedder()
            if milvus_client and milvus_client.client:
                milvus_ok = True
        except Exception as e:
            if milvus_error:
                milvus_error += f"; pymilvus: {str(e)[:80]}"
            else:
                milvus_error = f"pymilvus: {str(e)[:80]}"
    
    if milvus_error and not milvus_ok:
        health_data["checks"]["milvus"] = milvus_error

    health_data["checks"]["milvus"] = "connected" if milvus_ok else "DISCONNECTED"
    if not milvus_ok:
        critical_failures.append("milvus")

    # ── Assembly AI check (Qwen9B — the ONE model query_llm uses, for every mode) ──
    # 2026-09-09: replaced the Z.ai GLM-4.7 check. 2026-09-24: replaced the DeepSeek
    # check — the runtime's provider is now the local Qwen9B on LM Studio, so a DeepSeek
    # status would say nothing about real assembly health and would degrade the whole
    # surface report for a model the app no longer reaches.
    #
    # THE GATE IS GONE WITH IT. It used to skip the ping when DEEPSEEK_API_KEY was unset,
    # because a keyless provider could not answer. The local model is keyless by nature, so
    # that gate would have reported "DISCONNECTED" for a perfectly healthy server — and this
    # check is now the only signal that the model behind the tunnel is up.
    llm_ok = False
    llm_error = None
    try:
        from model_server_manager import test_model_connection
        result = test_model_connection("deepseek")
        llm_ok = result.get("status") == "success"
        if not llm_ok:
            llm_error = result.get("message", "unknown error")
    except Exception as e:
        llm_error = str(e)[:80]
    health_data["checks"]["assembly_llm"] = "connected" if llm_ok else "DISCONNECTED"
    if llm_error and not llm_ok:
        health_data["checks"]["assembly_llm_detail"] = llm_error
    if not llm_ok:
        critical_failures.append("assembly_llm")

    # ── Figma: DISABLED ──
    # Was pinging api.figma.com/v1/me on EVERY /api/health call — a live
    # network round-trip on every page load. Figma is not needed for A2UI
    # surface assembly (removed from render-composer on 2026-08-04).
    # Reporting it as "disabled" so the health endpoint stays fast.
    health_data["checks"]["figma"] = "disabled"

    # ── Overall status ──
    if critical_failures:
        health_data["status"] = "degraded"
        health_data["degraded_services"] = critical_failures
        # Also send to Sentry so we know
        try:
            import sentry_sdk
            sentry_sdk.capture_message(
                f"Health check degraded: {', '.join(critical_failures)}",
                level="warning"
            )
        except Exception:
            pass

    return health_data



# ── Catalog health — the report the console chat shows on load ─────────────
#
# The checker that used to write these reports (frontend/scripts/catalog-check.mjs)
# was removed with the rest of the governance tooling, so this directory is no
# longer produced by anything. FAIL LOUD is kept as-is: a missing report is a 503,
# never an empty list — "no findings" and "the checker never ran" must not look the
# same to the person relying on this.

_CATALOG_AUDIT_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "catalog-audit")
)
DEFAULT_CATALOG = "prompt-composer"

# ── WHAT TO DO WHEN THERE IS NO REPORT, IN WORDS THAT ARE TRUE ────────────────────────────────
# This said "The catalog checker was removed from this project; no report is produced." — and that
# was FALSE. `frontend/scripts/catalog-check.mjs` is present, runs, and produces a 44KB report; the
# checker was never removed (owner, 2026-10-01: an error on the live site, "Whether anything uses a
# component could not be read (HTTP 503)"). Two real reasons produce this 503 and neither is a
# removed checker:
#
#   * THE CHECKER COVERS ONE PIPELINE. Its `CATALOG_NAME` is `prompt-composer`, so the other three
#     pipelines the shell offers (`design-artifacts`, `ecommerce`, `primitives`) have never had a
#     report. Measured 2026-10-01: 200 for prompt-composer, 503 for the other three, locally, where
#     the report file exists.
#   * THE REPORT IS NOT IN A DEPLOYED IMAGE unless the build makes it. It lives in
#     `frontend/catalog-audit/`, which is gitignored, so it is absent from a clone's build context —
#     production answered 503 for EVERY pipeline while the same call answered 200 on a developer's
#     disk. The Dockerfile now generates it in the build stage and copies it in.
#
# A remedy that names the wrong cause sends a reader to look for a deletion that never happened —
# which is the failure this repository keeps finding, arriving this time in an error message.
_AUDIT_REMEDY = (
    "No report has been produced for this pipeline. Reports are produced by `npm run catalog:check` "
    "(`frontend/scripts/catalog-check.mjs`), whose CATALOG_NAME names the ONE pipeline it audits — "
    "measured 2026-10-01 that is `prompt-composer`, so the others have never had one. In a deployed "
    "image the report is generated during the build; locally it appears after the checker is run."
)


def _read_catalog_audit(catalog: str) -> dict:
    """Read one pipeline's audit report. 503 when no report is present."""
    path = os.path.join(_CATALOG_AUDIT_DIR, f"{catalog}.json")
    if not os.path.exists(path):
        raise HTTPException(
            status_code=503,
            detail={
                "error": "CATALOG_AUDIT_UNAVAILABLE",
                "message": f"No audit report for pipeline '{catalog}'. This is NOT a clean result.",
                "remedy": _AUDIT_REMEDY,
                "expected_at": path,
            },
        )
    try:
        with open(path) as _f:
            return json.load(_f)
    except Exception as _e:
        raise HTTPException(
            status_code=503,
            detail={
                "error": "CATALOG_AUDIT_UNREADABLE",
                "message": f"{type(_e).__name__}: {_e}",
                "remedy": _AUDIT_REMEDY,
                "expected_at": path,
            },
        )


@router.get("/api/catalog/audit")
async def api_catalog_audit():
    """The default pipeline's catalog health. 503 when no report is present."""
    return _read_catalog_audit(DEFAULT_CATALOG)


@router.get("/api/catalog/{system}/registry")
async def api_catalog_registry(system: str):
    """A partition's TAG MAP — the data half of the component resolver.

    The app FETCHES this, it is never bundled: a `registry.ts` written while the server runs could
    never be imported by a bundle built long before (wireframe-lab/ADD-A-DESIGN-SYSTEM.md §6). The
    drafting canvas consults it, last, for names the app's own tables do not know.

    An unknown SYSTEM is a 404 NAMING it — a typo must not read as "this system has no components",
    because those are different repairs. A known system with no `registry.json` answers an empty
    map, which is the truth: nothing from this system has an implementation yet.
    """
    if system not in a2ui_catalog_surfaces():
        raise HTTPException(
            status_code=404,
            detail=f"no catalogue partition named '{system}'",
        )
    return {"system": system, "components": a2ui_registry_for(system)}


@router.get("/api/catalog/audit/{catalog}")
async def api_catalog_audit_named(catalog: str):
    """A named pipeline's catalog health (e.g. /api/catalog/audit/ecommerce)."""
    return _read_catalog_audit(catalog)



@router.post("/api/news/search")
async def api_search_news(query: NewsQuery):
    memory = retrieve_memory_context(query.query) if query.include_memory else ""
    result = search_news(query.query, query.reasoning, memory)
    return {"result": result}


# The upload cap, and why it exists: this endpoint used to write each upload to
# `/tmp/<client-supplied filename>` — a client could name a file `../../…` and
# choose where the server wrote it — and nothing capped the size. Now the name is
# the server's (tempfile) and the bytes are counted AS THEY STREAM: past the cap
# the request is refused with 413 and the partial files are deleted. The cap is
# total across all files in one request, not per file.
_PDF_UPLOAD_CAP_BYTES = 10 * 1024 * 1024
_PDF_UPLOAD_CHUNK_BYTES = 64 * 1024


@router.post("/api/pdf/summarize")
async def api_summarize_pdfs(
    files: list[UploadFile] = File(...), reasoning: bool = False
):
    import tempfile
    from types import SimpleNamespace

    temp_files: list[str] = []
    total_bytes = 0
    try:
        for file in files:
            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as handle:
                temp_files.append(handle.name)
                while chunk := await file.read(_PDF_UPLOAD_CHUNK_BYTES):
                    total_bytes += len(chunk)
                    if total_bytes > _PDF_UPLOAD_CAP_BYTES:
                        raise HTTPException(
                            status_code=413,
                            detail=(
                                "Upload refused: the request exceeds the "
                                f"{_PDF_UPLOAD_CAP_BYTES // (1024 * 1024)} MB cap."
                            ),
                        )
                    handle.write(chunk)

        wrapped_files = [SimpleNamespace(name=path) for path in temp_files]
        result = summarize_pdfs(wrapped_files, reasoning)
        return {"result": result}
    finally:
        # Clean up temp files — on the success path AND when the cap refused the
        # request mid-stream, so a refused upload leaves nothing behind.
        for path in temp_files:
            try:
                os.remove(path)
            except Exception:
                pass


@router.post("/api/memory/recall")
async def api_memory_recall(query: MemoryQuery):
    memory_context = retrieve_memory_context(query.query)
    result = query_llm("", query.query, query.reasoning, "reflexion", memory_context)
    return {"result": result}


@router.get("/api/reasoning/trace")
async def api_reasoning_trace():
    try:
        if not os.path.exists(REASONING_TRACE_PATH):
            return {"latest": None, "all": []}
        with open(REASONING_TRACE_PATH) as f:
            data = json.load(f)
        latest = data[-1] if data else None
        return {"latest": latest, "all": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/source/evaluate")
async def api_source_evaluate(req: SourceEvalRequest):
    try:
        result = evaluate_source(req.url, req.title or "", req.content)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class TrainPayload(BaseModel):
    data: Any


@router.post("/api/train")
async def api_train(payload: TrainPayload):
    try:
        os.makedirs("logs", exist_ok=True)
        with open("logs/training_data.jsonl", "a") as f:
            f.write(json.dumps(payload.data) + "\n")
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


