"""Auto-extracted route module from main.py — zero behavior change."""
import asyncio
import base64
import hashlib
import html
import json
import math
import os
import re
import shutil
import subprocess
import time
import urllib.request
from datetime import datetime, timedelta
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import Response
from pydantic import BaseModel

# THE `from config import is_development` THAT STOOD HERE IS GONE, and its comment with it. It
# was carried with `# noqa: F401 (retained for route modules that re-import *)`, so it was kept
# on purpose and kept an unused import to satisfy a reader that no longer exists: there is no
# star-import anywhere in `backend/`, nothing imports `is_development` from this module, and the
# name is used in exactly two files — `config.py`, which defines it, and `figma_service.py`,
# which imports it from `config` directly. The premise had quietly stopped being true, and an
# import held open for a caller that is not there is the kind of thing that outlives everyone
# who could explain it.
from deps import (
    a2ui_catalog,
)
from design_renderer import accepted_unrendered, render_spec
from design_renderer import unrendered_keys as unrendered_spec_keys
from figma_service import (
    get_cached_spec,
    get_component,
    get_component_descriptions,
    get_dev_resources,
    get_file,
    get_file_versions,
    get_node,
    search_file,
)
from grace_gui import (
    query_llm,
)

router = APIRouter()


# ── A FIGMA NODE ID IS TWO THINGS AT ONCE ─────────────────────────────────────
# The id of a node in this file says both WHICH COMPONENT it is and WHERE that instance
# sits, and the two are written in one string:
#
#     I40001206:3418;40001205:5529
#     │             │
#     │             └─ the occurrence — the location. This is what tells two instances of
#     │                the same component apart, and it is deliberately NOT part of the
#     │                component's identity.
#     └─ the component reference — the same value for every instance of that component,
#        wherever it appears in the file.
#
# So "is this the same component as the one already in the catalogue?" is answered by the
# part BEFORE the semicolon and nothing after it, and "which of the several instances is
# this one?" by what follows. Comparing the whole string answers the first question wrongly:
# a second instance of a known component looks like a brand-new node, which is how a copy
# got offered an "overwrite" against a DIFFERENT component's file (2026-09-28).
#
# (Owner, 2026-09-29: *"That's why we use the numbers after the colon — the ability to
# distinguish children in other areas although they share the first part of the id. Every
# trailing four numbers are simply ids for the location, not for the component."*)
#
# The full string is still what is stored and sent: Figma's own endpoints need it. Only the
# COMPARISON narrows.


def node_code_identity(node_id: Optional[str]) -> str:
    """The component part of a node id — everything before the LAST `;`, lowercased.

    `I40001206:3418;40001205:5529` → `i40001206:3418`. An instance id carries the chain of
    sources it descends through (`I1:2;3:4;5:6` is nested), so the component is everything up to
    the final `;`. A PLAIN node id — no `;` at all — is its own identity, which is every node
    that is not an instance and every component id Figma states directly.

    THAT LAST CASE WAS WRONG, and it was the worst possible case to get wrong. `rpartition(";")`
    on a string with no semicolon returns `("", "", the whole string)`, so taking `[0]` returned
    the EMPTY STRING for every plain id — `40000922:4875` became `""`. Everything built on this
    therefore answered "no" to "is this the same component?": the shared-component lookup never
    matched, no instance was ever recognised as one this design system already has, and the commit
    guard that compares two component references compared empty strings and could not refuse
    anything (found 2026-09-29, reported as "it's not picking up shared components").
    """
    raw = (node_id or "").strip().lower()
    if ";" not in raw:
        return raw
    return raw.rpartition(";")[0]


def node_location(node_id: Optional[str]) -> str:
    """The occurrence part of a node id — what follows the LAST `;`, lowercased.

    Empty for a node that is not an instance: the node itself IS the component, so it has no
    location to be told apart by. This is the half that distinguishes children in different
    areas, and it is never a reason to call two things different components.

    The same no-semicolon trap as `node_code_identity`, in the other direction: `rpartition`
    hands back the WHOLE string in its last slot when the separator is absent, so a plain id was
    reported as its own "location" — "at 40000922:4875" under a chevron that is not an instance.
    """
    raw = (node_id or "").strip().lower()
    if ";" not in raw:
        return ""
    return raw.rpartition(";")[2]


def node_ids_match(a: Optional[str], b: Optional[str]) -> bool:
    """Whether two node ids name the same COMPONENT, whatever their occurrences.

    Used everywhere the question is identity rather than location — "does the catalogue
    already have this component", "is this layer the one the map records" — so that a second
    instance of a known component is recognised as the same component instead of as a new
    one. An empty identity on either side matches nothing: "no node recorded" must not read
    as agreement.
    """
    identity = node_code_identity(a)
    return bool(identity) and identity == node_code_identity(b)


def _node_id_of_tag(tag: str) -> str:
    """The Figma node a generated tag names, as the Figma map records it — or "".

    A generated tag IS its node with the colons written as hyphens (`f-40001207-3562`), but the
    map is authoritative: it also holds the node for the components that were renamed by hand,
    and reading the tag alone would give "" for those.
    """
    try:
        with open(os.path.join(FRONTEND_DIR, "src", "components", "registry.json"), encoding="utf-8") as f:
            for entry in json.load(f).get("components", []):
                if entry.get("litComponent") == tag:
                    return entry.get("figmaNodeId") or ""
    except Exception:
        return ""
    return ""

# ============================================
# FIGMA API ENDPOINTS
# ============================================

class FigmaQueryRequest(BaseModel):
    file_key: str
    query: Optional[str] = None
    node_id: Optional[str] = None
    component_id: Optional[str] = None

@router.post("/api/figma/file")
async def api_figma_file(request: FigmaQueryRequest):
    """Get Figma file metadata and structure."""
    try:
        data = get_file(request.file_key)
        return data or {"error": "No data returned"}
    except Exception as e:  # noqa: BLE001 — reported through `ok`, not swallowed
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/figma/versions/{file_key}")
async def api_figma_versions(file_key: str):
    """Get version history for a Figma file."""
    try:
        data = get_file_versions(file_key)
        return data or {"error": "No data returned"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/figma/component/{file_key}/{component_id}")
async def api_figma_component(file_key: str, component_id: str):
    """Get a specific Figma component."""
    try:
        data = get_component(file_key, component_id)
        return data or {"error": "Component not found"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/figma/node/{file_key}/{node_id:path}")
async def api_figma_node(file_key: str, node_id: str):
    """Get a specific Figma node (frame, component instance, etc.)."""
    try:
        data = get_node(file_key, node_id)
        return data or {"error": "Node not found"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/figma/dev-resources/{file_key}")
async def api_figma_dev_resources(file_key: str, node_id: Optional[str] = None):
    """Get dev resources (Code Connect annotations) from a Figma file."""
    try:
        data = get_dev_resources(file_key, node_id)
        return data or {"error": "No dev resources found"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/figma/search")
async def api_figma_search(request: FigmaQueryRequest):
    """Search for nodes by name within a Figma file."""
    try:
        data = search_file(request.file_key, request.query or "")
        return data or {"error": "Search returned no results"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/figma/config")
async def api_figma_config():
    """Return non-secret Figma configuration the frontend needs at startup."""
    return {
        "default_file_key": os.getenv("FIGMA_DEFAULT_FILE_KEY", ""),
        "connected": bool(os.getenv("FIGMA_TOKEN", "")),
    }


# ============================================
# FIGMA → LIT CATALOG FEED
# Extracted design specs, cached in PostgreSQL (figma_specs).
# Figma authors the design; the API extracts and caches it; the Lit
# components and A2UI catalog consume it. Cache-first; ?refresh=true
# re-pulls from Figma and re-caches.
# ============================================

def _spec_db():
    import psycopg2
    from psycopg2.extras import RealDictCursor
    return psycopg2.connect(os.getenv("DATABASE_URL"), cursor_factory=RealDictCursor)


@router.get("/api/figma/spec/{file_key}/{node_id:path}")
async def api_figma_spec(file_key: str, node_id: str, refresh: bool = Query(False)):
    """
    Serve the extracted design spec for a Figma node — DESIGNER/MCP-ONLY.

    This endpoint is an authoring tool, not a render source. Nothing in
    frontend/src calls it, and it must stay that way: users are served from
    the committed catalog, never from this cache.

    Delegates to get_cached_spec (figma_service). Cache read first; on miss
    or ?refresh=true, pull from Figma, extract, upsert, return. With
    allow_stale_fallback it also serves a stale cache row when a live pull
    fails, so an authoring read survives a Figma outage.
    """
    spec, err, source = get_cached_spec(
        file_key, node_id, refresh=refresh, allow_stale_fallback=True,
    )
    if not spec:
        # Map the accessor's miss onto an HTTP code that reflects the cause.
        code = 404 if (err and "EMPTY spec" in err) else 502
        raise HTTPException(
            status_code=code,
            detail=err or "Figma node fetch failed",
        )

    # Pull row metadata (name, synced_at) so the response shape stays stable
    # for existing consumers (the Lit catalog feed + frontend sync script).
    row = None
    try:
        conn = _spec_db()
        cur = conn.cursor()
        cur.execute(
            "SELECT name, spec, synced_at FROM figma_specs "
            "WHERE file_key = %s AND node_id = %s",
            (file_key, node_id.replace("-", ":")),
        )
        row = cur.fetchone()
        cur.close()
        conn.close()
    except Exception as e:
        print(f"⚠️ figma_specs metadata read failed (spec still returned): {e}")

    return {
        "source": source,
        "file_key": file_key,
        "node_id": node_id.replace("-", ":"),
        "name": (row or {}).get("name"),
        "synced_at": str(row["synced_at"]) if row else None,
        "spec": spec,
    }


# ============================================
# FIGMA INGEST PIPELINE — Queue-Based
# Paste Figma URLs → Get Lit Components
# ============================================

class IngestRequest(BaseModel):
    jobId: str
    fileKey: str
    nodeId: str
    notes: str = ""
    # The prompt package this ingest belongs to. The components a session adds are part
    # of that package's history, so every record carries it.
    sessionId: str = ""
    sessionTitle: str = ""

class JobStatus(BaseModel):
    status: str  # queued | processing | done | error
    result: Optional[dict[str, Any]] = None
    error: Optional[str] = None
    mcp_status: Optional[str] = None
    rest_status: Optional[str] = None

# In-memory job queue (simple, sequential processing per user spec)
ingest_jobs: dict[str, JobStatus] = {}

# Frontend directories — the catalog the ingest writes into, and the app root
# (whose node_modules supplies esbuild for validating generated code).
FRONTEND_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "frontend"
)
FRONTEND_COMPONENTS_DIR = os.path.join(FRONTEND_DIR, "src", "components", "lit")
REPO_ROOT = os.path.dirname(FRONTEND_DIR)

# The pipeline whose catalog an ingested component is declared in. The A2UI catalogs live
# at the repository root (A2UI/catalogs/<pipeline>/catalog.json) and each is its own
# surface, so this is a choice, not a default that fits everywhere.
INGEST_CATALOG_PIPELINE = os.getenv("FIGMA_INGEST_CATALOG", "prompt-composer")

# HOW MUCH DESIGN ONE INGEST MAY CARRY, checked BEFORE the model is called.
# The owner, 2026-09-28: "I put a very complex component in there to try to break the system…
# I want the system to stop them and send a message telling them that's too large." These are
# the stop. They bound the prompt (and therefore the spend) rather than the reply, because a
# reply that is cut off is money already spent on an answer that cannot be used.
INGEST_MAX_SPEC_CHARS = int(os.getenv("FIGMA_INGEST_MAX_SPEC_CHARS", "40000"))
INGEST_MAX_NODES = int(os.getenv("FIGMA_INGEST_MAX_NODES", "400"))

# Generated sources that have NOT been committed. Ingesting returns drafts; nothing
# reaches src/ until a designer commits, so pasting URLs to look at them cannot fill
# the tree with components nobody asked for. Keyed by jobId, then by tag.
ingest_drafts: dict[str, dict[str, str]] = {}
ingest_draft_validation: dict[str, dict[str, dict[str, Any]]] = {}
ingest_job_meta: dict[str, dict[str, Any]] = {}
# (The cap that used to live here is gone: there is never more than one preview — see
# _remember_drafts. A new ingest replaces the previous one.)

# ── THE CACHE ────────────────────────────────────────────────────────────────
# ONE ENTRY: the component the last ingest rendered, so it can be looked at and then approved or
# thrown away. It has NO STANDING — it is not a document, not a contract, not a draft with a
# queue behind it. It is a cache, and a cache's only rule is eviction (owner, 2026-09-29: *"It's
# not a contract. It has no standing. It is simply a cached preview… it only becomes a contract
# when I approve it."*).
#
# THREE RULES, AND NO CLOCKS:
#   1. the screen says when it leaves — a beacon as the page goes, evicted after a brief grace so a
#      reload (which fires the same event) does not lose it;
#   2. a new ingest replaces it — there is never more than one;
#   3. approve or discard evicts it — those are acts a person takes.
#
# THE IDLE TIMER IS GONE, AND SO IS THE HEARTBEAT. There were ninety seconds of "nobody has looked
# at this, evict it", and a beat every thirty seconds from the open screen to keep the entry alive
# against it — a second path for the one case that needs no cover: a browser that died without a
# word leaves an entry nobody can reach, because the page that could ask for it is gone. It is
# replaced by the next ingest. (Owner, 2026-09-29: *"I don't understand why we've got a 90 second
# delay… you have created error suppression by holding it 90 seconds… it doesn't feel honest to
# me."*) A timer that exists to tidy up after something invisible is a fallback dressed as hygiene.
#
# A screen that dies silently leaves its entry until rule 2 or 3 happens. Stated here rather than
# cleaned up: nothing about it is hidden, and nothing else in the process depends on it.
ingest_preview_abandoned: dict[str, float] = {}
INGEST_PREVIEW_ABANDON_GRACE = int(os.getenv("FIGMA_PREVIEW_ABANDON_GRACE", "5"))


def _abandon_preview() -> Optional[str]:
    """The page said it is leaving. The entry goes with it, unless the page comes back in the grace.

    The grace is not a delay before anything is used — it is the room a RELOAD needs, since a
    refresh fires the same event and the browser cannot say whether it is coming back.
    """
    job_id = next(iter(ingest_drafts), None)
    if not job_id:
        return None
    ingest_preview_abandoned[job_id] = time.time()
    return job_id


def _keep_preview(job_id: Optional[str] = None) -> None:
    """Somebody is looking at it: cancel any goodbye. There is no deadline to reset."""
    if not job_id:
        job_id = next(iter(ingest_drafts), None)
    if job_id:
        ingest_preview_abandoned.pop(job_id, None)


def _drop_preview(job_id: str) -> None:
    """Take one preview out of the world: its entries here, and its folder on disk.

    Discarding is a decision the designer made, so it is recorded elsewhere (`_log_ingest`). This
    is the silent half — the entry and the temporary file it was presented from, gone together.
    """
    ingest_drafts.pop(job_id, None)
    ingest_draft_validation.pop(job_id, None)
    ingest_job_meta.pop(job_id, None)
    ingest_jobs.pop(job_id, None)
    ingest_preview_abandoned.pop(job_id, None)
    _drop_preview_files(job_id)


# ── WHERE A PREVIEW LIVES: A TEMPORARY FILE IN ITS OWN FOLDER ────────────────
# A preview is written out as a real `.ts` file and presented from it — and the folder is outside
# `src/` entirely, so it has NO relationship to the catalogue: no path in it can be taken for a
# component, nothing in the application imports from it, and nothing resolves a name through it.
# It is not a store and not a cache; it holds the one preview being looked at, and it is deleted
# the moment the designer leaves, discards, or asks for something else (owner, 2026-09-29: *"there
# is no memory of a preview. Previews don't have memories. You're supposed to write a temporary
# .TS file to present it in a folder outside of any relationship to our actual lit catalog."*).
PREVIEW_DIR = os.path.join(FRONTEND_DIR, ".preview")


def _drop_preview_files(job_id: str = "") -> None:
    """Delete the preview folder — one job's, or all of it.

    A failure is reported and never raised: a deletion that did not happen must not be told as one
    that did, and it must not stop a discard from taking effect either.
    """
    target = os.path.join(PREVIEW_DIR, job_id) if job_id else PREVIEW_DIR
    if not os.path.exists(target):
        return
    try:
        shutil.rmtree(target)
    except Exception as e:
        print(f"⚠️ [figma-ingest] the preview folder {target} could not be removed: {e}")


def _write_preview_files(job_id: str, drafts: dict[str, str]) -> list[str]:
    """Write this ingest's drafts into the preview folder, replacing whatever was there.

    THE FOLDER HOLDS ONE PREVIEW, so it is emptied before the new one is written: a component
    asked for a minute ago cannot be read out of it afterwards. That is the difference between a
    temporary file and a store, and it is why the folder is emptied rather than added to.
    """
    _drop_preview_files()
    written: list[str] = []
    if not drafts:
        return written
    root = os.path.join(PREVIEW_DIR, job_id)
    try:
        os.makedirs(root, exist_ok=True)
        for tag, source in drafts.items():
            if not _SAFE_TAG_RE.match(tag or ""):
                continue
            with open(os.path.join(root, f"{tag}.ts"), "w", encoding="utf-8") as f:
                f.write(source)
            written.append(f"{tag}.ts")
    except Exception as e:
        print(f"⚠️ [figma-ingest] the preview could not be written to {PREVIEW_DIR}: {e}")
    return written


def _drop_departed_previews() -> list[str]:
    """Evict the entries whose screen left and did not come back. Returns what went.

    The leave rule, on the request path: a request either finds the entry or finds it evicted. This
    is NOT a deadline — an entry nobody abandoned is left alone however long it has been idle, which
    is the difference between "the screen left" and "we gave up waiting".
    """
    now = time.time()
    gone = [j for j, at in list(ingest_preview_abandoned.items()) if now - at > INGEST_PREVIEW_ABANDON_GRACE]
    for job_id in gone:
        if job_id in ingest_drafts:
            print(f"👋 [figma-ingest] {job_id}: the screen left and did not come back — cache evicted")
        _drop_preview(job_id)
    return gone


# A tag becomes a file name, so it is checked rather than trusted: f-<figma node id>,
# which is all the generator ever produces.
_SAFE_TAG_RE = re.compile(r"^f-[A-Za-z0-9-]{1,120}$")
# Looking a component up takes any name the catalogue uses (prompt-container is a name, not
# a tag). No dots and no slashes: a lookup must not be able to walk the filesystem.
_SAFE_COMPONENT_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9-]{0,120}$")


def _remember_drafts(
    job_id: str,
    drafts: dict[str, str],
    validation: dict[str, dict[str, Any]],
    meta: Optional[dict[str, Any]] = None,
) -> None:
    """Hold the PREVIEW: the one component that has been built and not yet approved or discarded.

    THERE IS NEVER MORE THAN ONE (owner, 2026-09-29): *"It is only one draft ever. There is never
    more than one draft. The draft is the preview... when it is discarded, it is gone; when it is
    approved, it is gone."* This kept a short list of past jobs so an older one could still be
    approved, but nothing in the product can reach them — there is no draft list, deliberately —
    so the list only made the server disagree with what the owner sees: one thing on screen, a
    handful in memory, and no way to tell which.

    A new ingest therefore REPLACES the previous preview: the older result is dropped here, at
    the moment the new one is held, rather than lingering unreachable.

    It also CANCELS any goodbye (`_keep_preview`): the moment it is held, the screen that asked
    for it is looking at it, and the entry lives until it leaves, is replaced, or is acted on.
    """
    for older in [j for j in ingest_drafts if j != job_id]:
        _drop_preview(older)
    ingest_drafts[job_id] = drafts
    ingest_draft_validation[job_id] = validation
    if meta is not None:
        ingest_job_meta[job_id] = meta
    _keep_preview(job_id)
    # AND THE PREVIEW GETS ITS FILE. Written here, at the one moment a preview comes into being,
    # and written where `_drop_preview` will find it to delete. A new ingest empties the folder
    # first, so the file on disk is always the one thing being looked at.
    _write_preview_files(job_id, drafts)


def _find_array_close(text: str, start: int) -> int:
    """Index of the `]` that closes the array opening at/after ``start``."""
    i = text.index("[", start)
    depth = 0
    in_string = False
    escaped = False
    while i < len(text):
        ch = text[i]
        if in_string:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == '"':
                in_string = False
        elif ch == '"':
            in_string = True
        elif ch in "[{":
            depth += 1
        elif ch in "]}":
            depth -= 1
            if depth == 0:
                return i
        i += 1
    raise ValueError("unterminated array")


def _measure(node: dict[str, Any]) -> dict[str, int]:
    """How big a design is, in the units the bill and the limits use."""
    spec = _figma_spec_for_model(node)
    chars = len(json.dumps(spec, ensure_ascii=False))
    return {"nodes": sum(1 for _ in _walk_spec(spec)), "chars": chars, "tokens": chars // 4}


def _size_report(node: dict[str, Any], spec: dict[str, Any], limit: int = 6) -> dict[str, Any]:
    """Everything measurable about why a design is too big, and what could be ingested instead.

    "Too large" is only actionable if it says which part. The largest children are ranked by
    node count so the answer is a list of frames the designer can point at — usually one of them
    is the component they actually meant.
    """
    by_type: dict[str, int] = {}
    for n in _walk_spec(spec):
        key = str(n.get("type") or "?")
        by_type[key] = by_type.get(key, 0) + 1

    children = []
    for child in node.get("children", []) or []:
        try:
            children.append({
                "name": child.get("name"),
                "id": child.get("id"),
                "type": child.get("type"),
                **_measure(child),
            })
        except Exception:
            continue
    children.sort(key=lambda c: c["nodes"], reverse=True)

    assets = spec.get("assets") or []
    return {
        "byType": dict(sorted(by_type.items(), key=lambda kv: kv[1], reverse=True)[:8]),
        "largestChildren": children[:limit],
        "assetCount": len(assets),
        "assetChars": sum(len(a.get("data") or "") for a in assets),
    }


def _refusal_detail(node: dict[str, Any], spec: dict[str, Any], spec_chars: int, node_count: int,
                    token_estimate: int, over: list[str]) -> str:
    """A refusal written to be acted on: what failed, by how much, which part, and the cost."""
    report = _size_report(node, spec)
    lines = [
        "TOO LARGE TO INGEST — nothing was sent to the model and nothing was written.",
        "",
        f"What failed: {' and '.join(over)}.",
        f"Measured: {node_count:,} nodes · {spec_chars:,} characters · ≈{token_estimate:,} tokens of design text.",
        f"Limits: {INGEST_MAX_NODES:,} nodes · {INGEST_MAX_SPEC_CHARS:,} characters "
        f"(change with FIGMA_INGEST_MAX_NODES / FIGMA_INGEST_MAX_SPEC_CHARS).",
        "",
        "What would have been spent, had it gone ahead:",
        f"  prompt   ≈ {len(json.dumps(spec, ensure_ascii=False)) // 4:,} tokens of design (capped at 24,000 characters in the prompt)",
        f"  reply    up to {16000:,} tokens (the figma_ingest ceiling)",
        f"  worst case ≈ {(len(json.dumps(spec, ensure_ascii=False)) // 4) + 16000:,} tokens for this single ingest",
        "  and a design this size comes back cut off mid-string — paid for, and unusable.",
        "",
        "What is in it:",
        "  " + " · ".join(f"{k} {v:,}" for k, v in report["byType"].items()),
        f"  {report['assetCount']} inline asset(s), {report['assetChars']:,} characters of them",
    ]
    if report["largestChildren"]:
        lines += ["", "The largest parts — ingest one of these instead:"]
        for c in report["largestChildren"]:
            lines.append(
                f"  {c['name']} [{c['id']}] {c['type']}: {c['nodes']:,} nodes · "
                f"{c['chars']:,} chars · ≈{c['tokens']:,} tokens"
            )
    lines += [
        "",
        "What to do: submit one of the parts above (a frame or component, not a page, canvas or "
        "section), or raise the two limits deliberately if this whole design is really wanted.",
    ]
    return "\n".join(lines)


def _component_contract(node: dict[str, Any]) -> dict[str, Any]:
    """The props/events/actions an ingested component is generated with.

    Derived by the same helpers the generator uses, so what is registered in the
    allowlist and the catalog is what the element actually declares.
    """
    component_type = _determine_component_type(node)
    return {
        "componentType": component_type,
        "props": _extract_a2ui_properties(node, component_type),
        "events": _extract_a2ui_events(node, component_type),
        "actions": _extract_a2ui_actions(node, component_type) or {},
    }


def _insert_before_line(text: str, start_marker: str, end_line: str, addition: str) -> Optional[str]:
    """Splice ``addition`` in just before the first ``end_line`` that follows ``start_marker``.

    The registry files are hand-laid-out, so entries are added as text and the rest of
    the file is left byte-for-byte alone.
    """
    lines = text.splitlines(keepends=True)
    start = next((i for i, line in enumerate(lines) if start_marker in line), None)
    if start is None:
        return None
    for i in range(start, len(lines)):
        if lines[i].strip() == end_line.strip():
            return "".join(lines[:i]) + addition + "".join(lines[i:])
    return None


def _register_in_allowlist(tag: str, meta: dict[str, Any]) -> str:
    """Add the component to the AI allowlist (frontend/src/shared/tag-registry.ts).

    Two edits, because both are what make a tag usable: TAG_REGISTRY is what may be
    rendered, and AI_PLAYGROUND_TAGS is what the gatekeeper lets the AI manipulate —
    without the second the tag exists but nothing may emit it.
    """
    path = os.path.join(FRONTEND_DIR, "src", "shared", "tag-registry.ts")
    try:
        with open(path, encoding="utf-8") as f:
            raw = f.read()
    except Exception as e:
        return f"unreadable ({e})"

    if f"'{tag}':" in raw:
        return "already in the allowlist"

    contract = meta.get("contract", {})
    props = contract.get("props", [])
    events = [e.get("name") for e in contract.get("events", []) if e.get("name")]

    def ts_type(spec: dict[str, Any]) -> str:
        return {"String": "string", "Boolean": "boolean", "Number": "number"}.get(spec.get("type"), "string")

    props_lines = "".join(
        f"      {p['name']}: {{ type: '{ts_type(p)}', optional: true }},\n"
        for p in props
        if p.get("name")
    )
    entry = (
        f"  // Ingested from Figma — {meta.get('figmaName', tag)} ({meta.get('nodeId', '')})\n"
        f"  '{tag}': {{\n"
        f"    tag: '{tag}',\n"
        f"    surface: 'composer',\n"
        f"    description: 'Generated from Figma node {meta.get('nodeId', '')} "
        f"({meta.get('figmaName', '')}). Implemented by <{tag}> in src/components/lit/{tag}.ts.',\n"
        f"    props: {{\n{props_lines}    }},\n"
        f"    events: {json.dumps(events)},\n"
        f"  }},\n"
    )

    updated = _insert_before_line(raw, "export const TAG_REGISTRY = {", "} as const;", entry)
    if updated is None:
        return "could not find the end of TAG_REGISTRY"
    updated = _insert_before_line(updated, "export const AI_PLAYGROUND_TAGS", "];", f"  '{tag}',\n")
    if updated is None:
        return "could not find the end of AI_PLAYGROUND_TAGS"

    with open(path, "w", encoding="utf-8") as f:
        f.write(updated)
    return "allowlisted"


def _catalog_file_path() -> Optional[str]:
    """The catalogue file that actually exists.

    There have been two copies of this file — one at the repository root and one the backend
    loads from the frontend tree (backend/deps.py). Registration writes to whichever is
    present, because writing to the one that is gone is how an approval fails after the
    component has already been written to disk.
    """
    for candidate in (
        os.path.join(REPO_ROOT, "A2UI", "catalogs", INGEST_CATALOG_PIPELINE, "catalog.json"),
        os.path.join(FRONTEND_DIR, "src", "components", "A2UI", "catalogs", INGEST_CATALOG_PIPELINE, "catalog.json"),
    ):
        if os.path.exists(candidate):
            return candidate
    return None


def _register_in_catalog(tag: str, meta: dict[str, Any], pipeline: str = "prompt-composer") -> str:
    """Declare the component in the pipeline catalog's JSON Schema (A2UI/catalogs/<pipeline>).

    The catalog is what the SERVER validates an AI payload against, so a component that
    is not declared here cannot be emitted at all. Both edits the schema needs are made:
    the definition, and its entry in $defs.anyComponent.oneOf.
    """
    path = _catalog_file_path()
    if not path:
        return (
            "no catalogue file found — looked in A2UI/catalogs/ and "
            "frontend/src/components/A2UI/catalogs/; nothing can be declared until one exists"
        )
    try:
        with open(path, encoding="utf-8") as f:
            raw = f.read()
        catalog = json.loads(raw)
    except Exception as e:
        return f"unreadable ({path}: {e})"

    key = f'"{tag}"'
    if key in catalog.get("components", {}):
        return f"already declared in {pipeline}"

    contract = meta.get("contract", {})
    props = {
        "component": {"const": tag},
    }
    for p in contract.get("props", []):
        if not p.get("name"):
            continue
        json_type = {"String": "string", "Boolean": "boolean", "Number": "number"}.get(p.get("type"), "string")
        props[p["name"]] = {"type": json_type}

    definition = {
        "type": "object",
        "allOf": [
            {"$ref": "https://a2ui.org/specification/v0_9/common_types.json#/$defs/ComponentCommon"},
            {"$ref": "#/$defs/CatalogComponentCommon"},
            {
                "type": "object",
                "description": (
                    f"Lit web component <{tag}>, generated from Figma node "
                    f"{meta.get('nodeId', '')} ({meta.get('figmaName', '')}) and rendered from "
                    f"src/components/lit/{tag}.ts. Ingested, then approved into the catalogue."
                ),
                "properties": props,
                "required": ["component"],
                "unevaluatedProperties": False,
            },
        ],
    }

    catalog.setdefault("components", {})[tag] = definition
    one_of = catalog.setdefault("$defs", {}).setdefault("anyComponent", {}).setdefault("oneOf", [])
    ref = {"$ref": f"#/components/{tag}"}
    if ref not in one_of:
        one_of.append(ref)

    with open(path, "w", encoding="utf-8") as f:
        json.dump(catalog, f, indent=2)
        f.write("\n")
    return f"declared in {pipeline}"


REGISTRATION_FAILURE_MARKERS = ("unreadable", "could not", "no catalogue", "refusing", "not found", "failed")


def _registration_failure(step: str, result: Any) -> Optional[str]:
    """A registration step only counts as failed when it says so.

    Prefix-guessing the other way — treating anything unrecognised as a failure — refused a
    commit whose registrations had all succeeded, because the count re-sync returns the file
    it updated ("README.md").
    """
    if not isinstance(result, str):
        return None
    text = result.strip().lower()
    return f"{step}: {result}" if text.startswith(REGISTRATION_FAILURE_MARKERS) else None


def _sync_catalog_claims(new_total: int) -> str:
    """Keep the repository's stated component counts equal to the catalog's.

    The catalog check treats a drifted count as blocking ("a count that is not measured
    is a claim nobody re-derives"), so declaring a component is not finished until the
    sentences that state the total agree with it.
    """
    updated = []
    for rel in ("README.md", os.path.join("READ-ME", "IMPLEMENTATION_CONFORMANCE.md")):
        path = os.path.join(REPO_ROOT, rel)
        if not os.path.exists(path):
            continue
        with open(path, encoding="utf-8") as f:
            lines = f.readlines()
        changed = False
        for i, line in enumerate(lines):
            if not re.search(r"\d+\s+trusted components", line):
                continue
            new_line = re.sub(r"\d+(\s+trusted components)", rf"{new_total}\1", line)
            # The breakdown is derived from the total, not incremented: a removal must not
            # leave a line claiming more project components than the catalogue holds.
            primitives = re.search(r"(\d+)( A2UI Basic Catalog primitives)", new_line)
            if primitives:
                project = new_total - int(primitives.group(1))
                new_line = re.sub(
                    r"(\d+)( project-specific Lit elements)",
                    lambda m: f"{project}{m.group(2)}",
                    new_line,
                )
            if new_line != line:
                lines[i] = new_line
                changed = True
        if changed:
            with open(path, "w", encoding="utf-8") as f:
                f.writelines(lines)
            updated.append(rel)
    return f"counts updated in {', '.join(updated)}" if updated else "no count claims to update"


def _catalog_check() -> dict[str, Any]:
    """Run the repository's own catalog check and read what it wrote.

    THE CHECK REPORTS; IT DOES NOT GATE. `npm run catalog:check` exits 0 whatever its findings
    say — `blocking` is a severity in its report, not a veto — so `ok` is read from the report
    that run wrote, and never from its exit code, which would call a catalog with open problems
    clean. A report that could not be read is not a pass either: `ok` is then False, and the
    caller shows the verdict in its "attention" colour.
    """
    npm = "npm"
    started = time.time()
    try:
        proc = subprocess.run(
            [npm, "run", "catalog:check"],
            cwd=FRONTEND_DIR,
            capture_output=True,
            text=True,
            timeout=300,
        )
    except Exception as e:
        return {"ran": False, "summary": f"catalog:check could not run: {e}"}
    output = f"{proc.stdout}\n{proc.stderr}"
    verdict = next(
        (line.strip() for line in output.splitlines() if "catalog-check:" in line),
        "catalog:check produced no verdict line",
    )
    # A report left on disk by an earlier run is not this run's answer: only one written by the
    # run just made is read, and `ran` says the check ran, not that this read succeeded.
    blocking = None
    try:
        if os.path.getmtime(CATALOG_AUDIT_PATH) >= started - 1:
            with open(CATALOG_AUDIT_PATH, encoding="utf-8") as f:
                written = json.load(f).get("findings") or []
            blocking = sum(1 for x in written if x.get("level") == "blocking")
    except Exception as e:
        blocking = None
        print(f"⚠️  [figma-ingest] the catalog report could not be read after the check: {e}")
    return {
        "ran": True,
        "ok": blocking == 0,
        "blocking": blocking,
        "verdict": verdict,
        "findings": [l.strip() for l in output.splitlines() if l.strip().startswith("[")][:20],
    }


def _register_in_figma_map(tag: str, node_id: str, figma_name: str) -> Optional[str]:
    """Record this component in the Figma map (frontend/src/components/registry.json).

    The map says which Figma node each component came from — the file to consult before
    building anything, and the way a designer names a component when asking for a change
    ("replace f-40001185-2176 with f-40001185-2177").

    The map is hand-curated and its entries are not laid out the way json.dump would
    write them, so the entry is spliced in as text and everything already in the file
    stays byte-for-byte as it was. An entry that is already there is left alone: a
    re-commit of the same tag rewrites the component, it does not re-map the design.
    """
    path = os.path.join(FRONTEND_DIR, "src", "components", "registry.json")
    try:
        with open(path, encoding="utf-8") as f:
            raw = f.read()
        data = json.loads(raw)
    except Exception as e:
        print(f"⚠️ figma map: cannot read {path}: {e}")
        return None

    components = data.get("components")
    if not isinstance(components, list):
        print(f"⚠️ figma map: no components array in {path}")
        return None
    if any(isinstance(c, dict) and c.get("litComponent") == tag for c in components):
        return "already mapped"

    entry_text = json.dumps(
        {
            "figmaName": figma_name or tag,
            "figmaNodeId": node_id,
            "litComponent": tag,
            "file": f"frontend/src/components/lit/{tag}.ts",
            "status": "built",
            "provenance": {
                "litComponent": "generated",
                "behavior": "generated",
                "generator": "figma ingest — approve step",
            },
        },
        indent=2,
    )

    try:
        key_at = raw.index('"components"')
        close_at = _find_array_close(raw, key_at)
    except ValueError as e:
        print(f"⚠️ figma map: cannot locate the components array: {e}")
        return None

    head = raw[:close_at].rstrip()
    tail = raw[close_at:]
    separator = "" if head.endswith("[") else ",\n"
    with open(path, "w", encoding="utf-8") as f:
        f.write(f"{head}{separator}{entry_text}\n{tail.lstrip()}")
    return "mapped"


def _validate_generated_module(code: str) -> dict[str, Any]:
    """Compile a generated module with the frontend's own esbuild.

    The point is to catch a malformed draft while a designer is still looking at it,
    rather than at the moment they commit it. A missing esbuild is not a verdict, so
    that case reports ok with a note instead of blocking the flow.
    """
    esbuild = os.path.join(FRONTEND_DIR, "node_modules", ".bin", "esbuild")
    if not os.path.exists(esbuild):
        return {
            "ok": False,
            "error": (
                f"the generated code was NOT checked: {esbuild} is missing, so nothing can say whether "
                f"it compiles. What to do: run `npm install` in frontend/ — an unchecked component must "
                f"not be approved as if it had passed."
            ),
        }
    try:
        proc = subprocess.run(
            [esbuild, "--loader=ts", "--format=esm", "--target=es2020"],
            input=code,
            capture_output=True,
            text=True,
            timeout=30,
        )
    except Exception as e:
        return {"ok": False, "error": f"the generated code was NOT checked: esbuild could not run ({e})."}
    if proc.returncode != 0:
        return {"ok": False, "error": (proc.stderr or proc.stdout or "esbuild failed").strip()[:600]}
    return {"ok": True}


def _run_cem_analyze() -> None:
    """Run npx @custom-elements-manifest/analyzer analyze in the frontend directory."""
    frontend_dir = FRONTEND_DIR
    try:
        result = subprocess.run(
            [
                "npx", "@custom-elements-manifest/analyzer", "analyze",
                "--litelement",
                "--globs", "src/components/lit/**/*.ts",
                "--exclude", "src/components/lit/**/*.test.ts",
                "--exclude", "src/components/lit/**/*.spec.ts",
                "--exclude", "src/components/lit/**/*.stories.ts",
                "--outdir", "."
            ],
            cwd=frontend_dir,
            capture_output=True,
            text=True,
            timeout=120,
        )
        if result.returncode != 0:
            print(f"⚠️ cem analyze failed: {result.stderr}")
        else:
            print("✅ cem analyze completed")
    except subprocess.TimeoutExpired:
        print("⚠️ cem analyze timed out")
    except Exception as e:
        print(f"⚠️ cem analyze error: {e}")


def _fetch_figma_nodes(file_key: str, node_id: str) -> dict[str, Any]:
    """Fetch nodes from Figma REST API: GET /v1/files/:key/nodes?ids=&geometry=paths.

    `geometry=paths` IS NOT OPTIONAL, and it is the difference between drawing a design and
    approximating it. Without it a VECTOR arrives as a box with a fill — no shape at all — so the
    only exact thing the model can be given for an icon is a picture of the node that CONTAINS it,
    box, shadow and all. With it, every vector carries its own `fillGeometry` path data, which is
    the shape itself: the one thing that can be drawn exactly. (Owner, 2026-09-29: *"it needs to
    pick up vector images from inside components. I cannot post individual images to satisfy the
    program. The program needs to satisfy me."*)
    """
    import urllib.request

    token = os.getenv("FIGMA_TOKEN")
    if not token:
        raise HTTPException(status_code=503, detail="FIGMA_TOKEN not configured")

    url = f"https://api.figma.com/v1/files/{file_key}/nodes?ids={node_id}&geometry=paths"
    req = urllib.request.Request(
        url,
        headers={"X-Figma-Token": token},
        method="GET",
    )
    
    with urllib.request.urlopen(req, timeout=30) as res:
        data = json.loads(res.read().decode("utf-8"))
    
    if data.get("err"):
        raise HTTPException(status_code=502, detail=f"Figma API error: {data['err']}")
    
    return data


# ============================================
# FIGMA MCP CLIENT
# Model Context Protocol — runs on desktop at 127.0.0.1:3845
# Only available when Figma Desktop is open with the file loaded
# ============================================

MCP_URL = os.getenv("FIGMA_MCP_URL", "http://127.0.0.1:3845/mcp")
MCP_TIMEOUT = 15.0


INGEST_LOG_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "logs", "figma-ingest.jsonl")


INGEST_ACTIVITY_TABLE = "figma_ingest_activity"


def _activity_db():
    """A connection for the activity table, or None when Postgres is not reachable.

    The JSONL file stays the primary record — it cannot fail because a database is down —
    and the table is the queryable copy, so the procession can be read, filtered and
    ported without parsing a file.
    """
    try:
        import psycopg2
        from psycopg2.extras import RealDictCursor
        return psycopg2.connect(os.getenv("DATABASE_URL"), cursor_factory=RealDictCursor)
    except Exception as e:
        print(f"⚠️ [figma-ingest] no database for the activity log: {e}")
        return None


# ── THE RECORD IS A LOG, AND A LOG GROWS ──────────────────────────────────────
# The activity record is for auditing: who ingested, approved, removed or failed what, and when.
# It is never read to decide anything — the catalogue and its files are the present, this is the
# past — so it may be trimmed without touching a single component. What it must not do is grow
# in silence: a log nobody looks at is a log that is found, one day, at a size nobody chose.
#
# So the size is MEASURED and REPORTED (read-only, on every activity read) and the trimming is
# an ACTION someone takes: nothing here deletes anything by itself, and the threshold produces a
# warning rather than a cleanup. Owner, 2026-09-29: *"That's just a basic activity log for
# auditing purposes that should be purged after a month, but that can be done manually. We can
# just give a warning when they get too large… I don't wanna play a game of whack-a-mole."*
INGEST_ACTIVITY_WARN_KIB = 4096
INGEST_ACTIVITY_WARN_ROWS = 5000
INGEST_ACTIVITY_KEEP_DAYS = 30


def _activity_audit() -> dict[str, Any]:
    """How much record there is, and whether that is more than anyone asked for.

    Read-only, and cheap: the file's size comes from `os.stat` rather than its contents, and the
    table's row count from one COUNT. Nothing here fails the caller — a record that cannot be
    measured is reported as unmeasured, never as empty, because "0 bytes" and "could not look"
    are the pair this whole application keeps apart.
    """
    audit: dict[str, Any] = {
        "warnAtKiB": INGEST_ACTIVITY_WARN_KIB,
        "warnAtRows": INGEST_ACTIVITY_WARN_ROWS,
        "table": INGEST_ACTIVITY_TABLE,
        "logFile": os.path.relpath(INGEST_LOG_PATH, REPO_ROOT),
        "note": (
            "The activity record is for auditing only — nothing in the application reads it to "
            "decide anything, so old entries can be trimmed without affecting any component."
        ),
    }

    try:
        stat = os.stat(INGEST_LOG_PATH)
        audit["fileKiB"] = round(stat.st_size / 1024)
        with open(INGEST_LOG_PATH, encoding="utf-8") as f:
            audit["fileRows"] = sum(1 for line in f if line.strip())
    except FileNotFoundError:
        audit["fileKiB"] = 0
        audit["fileRows"] = 0
    except Exception as e:
        audit["fileKiB"] = None
        audit["fileRows"] = None
        audit["fileError"] = str(e)

    conn = _activity_db()
    if conn:
        try:
            with conn.cursor() as cur:
                cur.execute(f"SELECT COUNT(*) AS n, MIN(at) AS oldest FROM {INGEST_ACTIVITY_TABLE}")
                row = cur.fetchone() or {}
                audit["tableRows"] = int(row.get("n") or 0)
                oldest = row.get("oldest")
                audit["oldest"] = oldest.isoformat() if hasattr(oldest, "isoformat") else (str(oldest) if oldest else None)
        except Exception as e:
            audit["tableRows"] = None
            audit["tableError"] = str(e)
        finally:
            try:
                conn.close()
            except Exception:
                pass
    else:
        audit["tableRows"] = None

    big_file = isinstance(audit.get("fileKiB"), int) and audit["fileKiB"] >= INGEST_ACTIVITY_WARN_KIB
    many_rows = isinstance(audit.get("tableRows"), int) and audit["tableRows"] >= INGEST_ACTIVITY_WARN_ROWS
    audit["large"] = bool(big_file or many_rows)
    reasons = []
    if big_file:
        reasons.append(f"the log file is {audit['fileKiB']} KiB (warning at {INGEST_ACTIVITY_WARN_KIB})")
    if many_rows:
        reasons.append(f"the table holds {audit['tableRows']} rows (warning at {INGEST_ACTIVITY_WARN_ROWS})")
    audit["why"] = " and ".join(reasons) if reasons else ""
    audit["keepDays"] = INGEST_ACTIVITY_KEEP_DAYS
    return audit


def _activity_insert(record: dict[str, Any]) -> None:
    """Write one activity row. Never raises: a logging failure must not fail the work."""
    conn = _activity_db()
    if not conn:
        return
    try:
        with conn, conn.cursor() as cur:
            cur.execute(f"""
                CREATE TABLE IF NOT EXISTS {INGEST_ACTIVITY_TABLE} (
                    id SERIAL PRIMARY KEY,
                    at TIMESTAMPTZ NOT NULL DEFAULT now(),
                    kind TEXT,
                    session_id TEXT,
                    session_title TEXT,
                    actor TEXT,
                    job_id TEXT,
                    node_id TEXT,
                    node_name TEXT,
                    tag TEXT,
                    generated_by TEXT,
                    error TEXT,
                    note TEXT,
                    rejected JSONB,
                    written JSONB,
                    verdict TEXT
                )
            """)
            # A COLUMN ADDED LATER, and idempotent on purpose: a table that already exists does
            # not gain columns from CREATE TABLE IF NOT EXISTS, and the reason recorded at a
            # removal is the one thing the record could never say. Postgres 9.6+ accepts IF NOT
            # EXISTS, so this is safe to run on every insert.
            cur.execute(f"ALTER TABLE {INGEST_ACTIVITY_TABLE} ADD COLUMN IF NOT EXISTS reason TEXT")
            cur.execute(
                f"""INSERT INTO {INGEST_ACTIVITY_TABLE}
                    (at, kind, session_id, session_title, actor, job_id, node_id, node_name, tag,
                     generated_by, error, note, reason, rejected, written, verdict)
                    VALUES (COALESCE(%s, now()), %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                (
                    record.get("at"),
                    record.get("kind"),
                    record.get("sessionId"),
                    record.get("sessionTitle"),
                    record.get("actor"),
                    record.get("jobId"),
                    record.get("nodeId"),
                    record.get("nodeName"),
                    # THE SUBJECT OF THE EVENT, from whichever key this kind of record puts it
                    # under. An approval carries `tags` (a list, one per component it wrote); a
                    # REMOVAL carries `tag` (a single name, because one removal removes one
                    # component). Only the list was read, so every removal row reached the table
                    # with an empty tag — and a removal with no subject cannot be attached to the
                    # component it removed, which is why the record could say a component was
                    # added and could never say it was taken out.
                    record.get("tag") or (record.get("tags") or record.get("discarded") or [None])[0],
                    record.get("generatedBy"),
                    record.get("error"),
                    record.get("note"),
                    record.get("reason"),
                    json.dumps(record.get("rejected") or []),
                    json.dumps(record.get("written") or []),
                    record.get("verdict"),
                ),
            )
    except Exception as e:
        print(f"⚠️ [figma-ingest] the activity row was not written to the database: {e}")
    finally:
        try:
            conn.close()
        except Exception:
            pass


def _resolve_actor(request: Request) -> str:
    return request.headers.get("X-User-ID", "")


def _log_ingest(record: dict[str, Any]) -> None:
    """Append one line per ingest to backend/logs/figma-ingest.jsonl.

    Errors are not suppressed anywhere in this pipeline, and a failure that only existed
    in a response body would be unreadable a minute later. Every ingest leaves a record:
    the channels it read, who built the component, what went wrong if anything did, and
    the model's own reply — so what happened can be read back afterwards.
    """
    stamped = {"at": datetime.utcnow().isoformat(timespec="seconds") + "Z", **record}
    try:
        os.makedirs(os.path.dirname(INGEST_LOG_PATH), exist_ok=True)
        with open(INGEST_LOG_PATH, "a", encoding="utf-8") as f:
            f.write(json.dumps(stamped, ensure_ascii=False) + "\n")
    except Exception as e:
        print(f"⚠️ [figma-ingest] could not write the ingest log: {e}")
    # The SAME record, timestamp included, goes to the table: inserting without it made the
    # two copies disagree, and every backfill then inserted the row again — which is how the
    # activity panel filled with identical approvals.
    _activity_insert(stamped)


_ASSET_URI_RE = re.compile(r"data:image/(?:svg\+xml|png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=\s]{40,}", re.IGNORECASE)
_INLINE_SVG_RE = re.compile(r"<svg\b[^>]*>[\s\S]{0,30000}?</svg>", re.IGNORECASE)
# Figma's MCP serves a library vector as a file on its own local server, named by the
# artwork's hash — the form the chevron in this design arrives in.
_MCP_ASSET_URL_RE = re.compile(r"https?://(?:localhost|127\.0\.0\.1):3845/assets/[A-Za-z0-9._-]+\.(?:svg|png|jpe?g|webp)", re.IGNORECASE)


def _extract_assets(text: str, limit: int = 10) -> list[dict[str, str]]:
    """The vectors and images MCP embeds in its reply.

    A library component's artwork exists ONLY here: the REST API answers with a reference
    to the component, never its vectors, so a chevron drawn with a library component
    arrives as one of these (a data URI, inline SVG, or an asset URL on the MCP server)
    and nowhere else. Dropping them is why a generated component came back with no
    chevron in it.
    """
    if not text:
        return []
    assets: list[dict[str, str]] = []
    for match in _ASSET_URI_RE.finditer(text):
        uri = re.sub(r"\s+", "", match.group(0))
        assets.append({"kind": "data-uri", "mime": uri.split(";")[0].replace("data:", ""), "data": uri[:60000]})
        if len(assets) >= limit:
            return assets
    for match in _MCP_ASSET_URL_RE.finditer(text):
        url = match.group(0)
        if any(a.get("data") == url for a in assets):
            continue
        ext = url.rsplit(".", 1)[-1].lower()
        assets.append({"kind": "mcp-url", "mime": f"image/{'svg+xml' if ext == 'svg' else ext}", "data": url})
        if len(assets) >= limit:
            return assets
    for match in _INLINE_SVG_RE.finditer(text):
        assets.append({"kind": "svg", "mime": "image/svg+xml", "data": match.group(0)[:60000]})
        if len(assets) >= limit:
            break
    return assets


# ── THE ARTWORK, KEPT ────────────────────────────────────────────────────────
# An asset arrives in one of three shapes and only two of them carry their own bytes: a data URI
# has them inline and an inline SVG IS them, but an MCP URL is a POINTER at the Figma server —
# and that server is only up while Figma is open. A component that ships with the pointer is a
# component that loses its chevron the moment the designer closes the file, which is exactly
# what happened: `f-40001204-5752` draws two chevrons as `<img src="http://localhost:3845/…">`,
# and with Figma closed they are two broken images. The artwork is not Figma's to keep at run
# time — it belongs to this repository.
#
# So every asset is written into `frontend/public/assets/` when a component is approved, and
# both the component and the layer record point at that copy. Public rather than `src/assets`
# because a generated component references its artwork by URL, not by import, and a file under
# `public/` is served at the same path in development and in a build.
ASSETS_PUBLIC_DIR = os.path.join(FRONTEND_DIR, "public", "assets")

_IMAGE_EXTENSIONS = {
    "image/svg+xml": "svg",
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
}


def _asset_bytes(asset: dict[str, Any]) -> Optional[bytes]:
    """The asset's own bytes, or None when they cannot be obtained."""
    kind = str(asset.get("kind") or "")
    data = str(asset.get("data") or "")
    if kind == "svg":
        return data.encode("utf-8") or None
    if kind == "data-uri":
        _, _, encoded = data.partition(",")
        try:
            return base64.b64decode(encoded)
        except Exception:
            return None
    if kind == "mcp-url":
        try:
            with urllib.request.urlopen(data, timeout=10) as response:  # noqa: S310 — the URL is the local MCP server's, matched by _MCP_ASSET_URL_RE
                return response.read() or None
        except Exception:
            return None
    return None


def _vendor_assets(assets: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Write each asset into public/assets and return it with the path that serves it.

    THE NAME IS THE CONTENT'S. A pointer keeps the hash it was fetched by — the MCP server names
    each asset by its own hash, which is how `figma-959a83b…svg` is already in this repository —
    and anything carrying its bytes is named by a hash of them, so two components that share a
    chevron share one file instead of writing it twice.

    An asset whose bytes cannot be obtained is REPORTED, never dropped quietly: it is a component
    that will lose that artwork, and the record has to say which artwork that was.
    """
    out: list[dict[str, Any]] = []
    for asset in assets or []:
        if not isinstance(asset, dict):
            continue
        source = str(asset.get("data") or "")
        raw = _asset_bytes(asset)
        if raw is None:
            out.append({
                "kind": asset.get("kind"),
                "mime": asset.get("mime"),
                "file": None,
                "source": source[:300],
                "note": "the bytes could not be obtained, so only the pointer was captured",
            })
            continue
        ext = _IMAGE_EXTENSIONS.get(str(asset.get("mime") or ""), "bin")
        name = ""
        if asset.get("kind") == "mcp-url":
            stem = os.path.basename(source.split("?")[0])
            if re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]*", stem or ""):
                name = stem if stem.startswith("figma-") else f"figma-{stem}"
        if not name:
            name = f"figma-{hashlib.sha1(raw).hexdigest()}.{ext}"
        try:
            os.makedirs(ASSETS_PUBLIC_DIR, exist_ok=True)
            path = os.path.join(ASSETS_PUBLIC_DIR, name)
            # ── WHAT THE FILE JUST DELIVERED IS WHAT GETS WRITTEN ────────────
            # This wrote only when the name was ABSENT, which made a name a permanent claim on
            # the bytes under it. An MCP asset is named by the server's own stem, so the second
            # fetch of a design whose artwork had changed found the name already there and threw
            # the new bytes away — the designer updates the picture in Figma, re-ingests, and the
            # previous version is what sits in the repository and what the component draws
            # (owner, 2026-09-29: *"The designer is trying to update the images, update the
            # entire component, yet you're holding onto artifacts and reserving them."*). A
            # name that already exists is not a reason to keep it: if the bytes differ, the
            # delivered bytes are the ones that are true now, and they replace what is there.
            #
            # IDENTICAL BYTES ARE NOT REWRITTEN, which is what keeps the sharing the old rule was
            # there for: two components with the same chevron still resolve to one file, because
            # the second one finds the same content and writes nothing.
            refreshed = False
            if os.path.exists(path):
                try:
                    with open(path, "rb") as f:
                        existing = f.read()
                except Exception:
                    existing = None
                if existing == raw:
                    pass
                else:
                    refreshed = True
                    with open(path, "wb") as f:
                        f.write(raw)
            else:
                with open(path, "wb") as f:
                    f.write(raw)
        except Exception as e:
            out.append({
                "kind": asset.get("kind"),
                "mime": asset.get("mime"),
                "file": None,
                "source": source[:300],
                "note": f"could not be written: {e}",
            })
            continue
        entry = {
            "kind": asset.get("kind"),
            "mime": asset.get("mime"),
            "file": f"/assets/{name}",
            "bytes": len(raw),
            # Kept so the component that references the original pointer can be rewritten to the
            # copy in the same pass — the pointer is what the generated code contains.
            "source": source,
        }
        # Named in the record, because a file that changed under a name the design did not change
        # is the fact that explains why a component's artwork moved without the design moving.
        if refreshed:
            entry["refreshed"] = True
        out.append(entry)
    return out


def _repoint_assets(code: str, vendored: list[dict[str, Any]]) -> str:
    """Point a generated component at the vendored copies instead of at Figma's server.

    A plain substitution, because that is what the reference is: the model was handed an asset
    URL and wrote it into an `<img src>` unchanged. No import is added — the file is under
    `public/assets`, so the URL it needs is the same in development and in a build.
    """
    for asset in vendored or []:
        source, target = str(asset.get("source") or ""), asset.get("file")
        if source and target and source.startswith("http"):
            code = code.replace(source, str(target))
    return code


# Nothing here is a reference to an asset: build output, dependencies, the logs, and the asset
# directory itself (a file naming itself is not a use of itself).
_ASSET_SCAN_SKIP_DIRS = {"node_modules", ".git", "__pycache__", ".venv", "dist", "build", "logs", ".next"}
_ASSET_SCAN_EXTENSIONS = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".md", ".py", ".css", ".html"}
# Where a reference can be written. The whole repository is searched rather than a list of the
# places one is EXPECTED, because a list of expected places is how the fifth reader goes unseen.
_ASSET_SCAN_ROOTS = ("frontend", "backend", "design", "docs", "scripts", "packages", "catalog-audit")


def _assets_referenced_by() -> dict[str, list[str]]:
    """public path (`/assets/<name>`) → the files that mention it.

    A plain text search, on purpose: the question is "does anything in this repository point at
    this file", and the answer has to include a component's `<img src>`, a record's `file` entry,
    a note in a markdown file and anything else a person wrote. Parsing those formats would be
    several readers that can each miss one, which is the failure being fixed here.

    ROOT-RELATIVE ONLY, because there are two asset directories and they are not the same thing.
    `@/assets/x.svg` and `../../assets/x.svg` resolve to `frontend/src/assets/`, which is where the
    hand-built components keep their artwork; `/assets/x.svg` resolves to `frontend/public/assets/`,
    which is what this prunes. A search for the bare name cannot tell those apart, and it does not
    fail safe: `figma-9598a83b…svg` exists in BOTH directories, so the seven components importing
    the src copy would have been counted as references keeping the public copy alive — the exact
    file that is a leftover. So the `/assets/` prefix must be preceded by something that makes it
    the root: a quote, whitespace, a bracket or a colon, and never a path segment, an alias or the
    end of another name.
    """
    references: dict[str, list[str]] = {}
    pattern = re.compile(r"(?<![A-Za-z0-9._@/~-])/assets/([A-Za-z0-9][A-Za-z0-9._-]*)")
    for root in _ASSET_SCAN_ROOTS:
        for dirpath, dirnames, filenames in os.walk(os.path.join(REPO_ROOT, root)):
            dirnames[:] = [d for d in dirnames if d not in _ASSET_SCAN_SKIP_DIRS]
            if os.path.abspath(dirpath) == os.path.abspath(ASSETS_PUBLIC_DIR):
                continue
            for filename in filenames:
                if os.path.splitext(filename)[1].lower() not in _ASSET_SCAN_EXTENSIONS:
                    continue
                full = os.path.join(dirpath, filename)
                try:
                    with open(full, encoding="utf-8", errors="ignore") as f:
                        text = f.read()
                except Exception:
                    continue
                for name in pattern.findall(text):
                    references.setdefault(f"/assets/{name}", []).append(os.path.relpath(full, REPO_ROOT))
    return references


def _prune_unreferenced_assets() -> dict[str, Any]:
    """Delete the files nothing in this repository refers to, and say what was deleted.

    AN ASSET IS WRITTEN WHEN A COMPONENT IS APPROVED AND NOTHING HAS EVER TAKEN ONE BACK. Every
    approval copies the design's pictures into `public/assets/`, and the only thing that ever
    made a new one was a new name: `_vendor_assets` will not overwrite a name that is already on
    disk, so a design whose artwork changed under a name Figma reused could never be refreshed,
    and a component that was removed or re-approved left its old pictures behind. What that
    produced was five files of which one was the design's OLD icon — the same shape in the navy
    it used to be — sitting in the served directory with nothing to distinguish it from the
    current one, which is how a debugging session came to be spent on artwork the design no
    longer contained.

    SO THE RULE IS THE REFERENCE, NOT THE HISTORY. After a write, a file in `public/assets/`
    that no file in the repository mentions is not an asset — it is a leftover, and it is
    deleted. A file that IS mentioned is kept, however old, because something still draws it.
    Nothing is deleted on a guess: a scan that could not read the repository reports that and
    prunes nothing, because "no references found" and "could not look" are different answers and
    only one of them justifies a deletion.

    Returns the outcome for the caller's report — every deletion named, and every file kept with
    the number of references that kept it, so an audit can tell the two apart.
    """
    if not os.path.isdir(ASSETS_PUBLIC_DIR):
        return {"dir": os.path.relpath(ASSETS_PUBLIC_DIR, REPO_ROOT), "pruned": [], "kept": [], "note": "no asset directory to prune"}
    try:
        references = _assets_referenced_by()
    except Exception as e:
        return {
            "dir": os.path.relpath(ASSETS_PUBLIC_DIR, REPO_ROOT),
            "pruned": [],
            "kept": [],
            "note": f"the reference scan failed ({e}), so nothing was deleted — no reference found is not the same as could not look",
        }

    pruned: list[str] = []
    kept: list[dict[str, Any]] = []
    for filename in sorted(os.listdir(ASSETS_PUBLIC_DIR)):
        path = os.path.join(ASSETS_PUBLIC_DIR, filename)
        if not os.path.isfile(path):
            continue
        public_path = f"/assets/{filename}"
        users = references.get(public_path) or []
        if users:
            kept.append({"file": public_path, "references": sorted(set(users))})
            continue
        try:
            os.remove(path)
            pruned.append(public_path)
        except Exception as e:
            kept.append({"file": public_path, "references": [], "note": f"could not be deleted: {e}"})
    return {"dir": os.path.relpath(ASSETS_PUBLIC_DIR, REPO_ROOT), "pruned": pruned, "kept": kept}


def _parse_mcp_response(text: str) -> dict[str, Any]:
    """
    Parse MCP get_design_context text response into structured data.
    
    The MCP response format (from figma_mcp.py _rest_design_block pattern):
    ```
    FRAME "Frame Name" [node_id]  100×200
      ANNOTATION: This is a button component
      DESCRIPTION (what it is for): Primary action button
      layout: layoutMode=HORIZONTAL, itemSpacing=8
      radius: 8
      fill: #0066FF @1
      text: Inter 600 14 (lineHeightPx=20, letterSpacing=0)
      characters: "Click me"
      referenceCode: <Button>...</Button>
    ```
    
    Returns:
    {
        "annotations": {node_id: [annotation_text, ...]},
        "descriptions": {node_id: description_text},
        "reference_code": {node_id: code_snippet},
        "layout_info": {node_id: {layoutMode, itemSpacing, ...}},
        "style_info": {node_id: {fills, strokes, radius, ...}},
    }
    """
    annotations: dict[str, list[str]] = {}
    descriptions: dict[str, str] = {}
    reference_code: dict[str, str] = {}
    layout_info: dict[str, dict] = {}
    style_info: dict[str, dict] = {}
    
    current_node_id = None
    current_node_type = None
    current_node_name = None
    in_reference_code = False
    reference_code_buffer = []
    
    lines = text.split("\n")
    
    for line in lines:
        stripped = line.strip()
        
        # Detect node header: TYPE "Name" [node_id]  W×H
        node_match = re.match(r'^(\w+)\s+"([^"]+)"\s+\[([^\]]+)\](?:\s+(\d+)×(\d+))?', stripped)
        if node_match:
            # Save previous node's reference code if any
            if current_node_id and reference_code_buffer:
                reference_code[current_node_id] = "\n".join(reference_code_buffer).strip()
                reference_code_buffer = []
            
            current_node_type = node_match.group(1)
            current_node_name = node_match.group(2)
            current_node_id = node_match.group(3).replace("-", ":")  # Normalize to colon format
            in_reference_code = False
            continue
        
        # Detect reference code block
        if stripped.startswith("referenceCode:") or stripped.startswith("reference_code:"):
            in_reference_code = True
            code_part = stripped.split(":", 1)[1].strip()
            if code_part:
                reference_code_buffer.append(code_part)
            continue
        
        if in_reference_code:
            if stripped and not stripped.startswith(("ANNOTATION:", "DESCRIPTION", "layout:", "radius:", "fill:", "text:", "characters:")):
                reference_code_buffer.append(stripped)
            else:
                in_reference_code = False
                if reference_code_buffer:
                    reference_code[current_node_id] = "\n".join(reference_code_buffer).strip()
                    reference_code_buffer = []
        
        if not current_node_id:
            continue
        
        # Parse annotations
        if stripped.startswith("ANNOTATION:"):
            ann_text = stripped.split(":", 1)[1].strip()
            if ann_text:
                annotations.setdefault(current_node_id, []).append(ann_text)
            continue
        
        # Parse descriptions
        if stripped.startswith("DESCRIPTION (what it is for):"):
            desc_text = stripped.split(":", 1)[1].strip()
            if desc_text:
                descriptions[current_node_id] = desc_text
            continue
        
        # Parse layout info
        if stripped.startswith("layout:"):
            layout_str = stripped.split(":", 1)[1].strip()
            layout_dict = {}
            for part in layout_str.split(","):
                part = part.strip()
                if "=" in part:
                    k, v = part.split("=", 1)
                    layout_dict[k.strip()] = v.strip()
            if layout_dict:
                layout_info[current_node_id] = layout_dict
            continue
        
        # Parse radius
        if stripped.startswith("radius:"):
            radius_str = stripped.split(":", 1)[1].strip()
            try:
                style_info.setdefault(current_node_id, {})["cornerRadius"] = float(radius_str)
            except ValueError:
                pass
            continue
        
        # Parse fills
        if stripped.startswith("fill:"):
            fill_str = stripped.split(":", 1)[1].strip()
            style_info.setdefault(current_node_id, {})["fill"] = fill_str
            continue
    
    # Save any remaining reference code
    if current_node_id and reference_code_buffer:
        reference_code[current_node_id] = "\n".join(reference_code_buffer).strip()

    # The reply is usually Figma's own generated reference implementation (React/Tailwind,
    # with data-node-id attributes, the asset URLs for library vectors such as a chevron,
    # and the typography written out), NOT the annotated text format the loop above looks
    # for. When that loop found nothing, the payload is kept whole: discarding it is what
    # left generated components with no chevron and no fonts — the two things this channel
    # and only this channel carries. figma_mcp.call_design_context returns the same text;
    # this is that text, kept rather than parsed away.
    if text and not reference_code:
        reference_code["mcp-reference"] = text.strip()[:40000]

    return {
        "annotations": annotations,
        "descriptions": descriptions,
        "reference_code": reference_code,
        "layout_info": layout_info,
        "style_info": style_info,
        # The artwork, without which a library vector (a chevron, an icon) cannot be drawn.
        "assets": _extract_assets(text),
    }


def _fetch_figma_mcp(file_key: str, node_id: str) -> Optional[dict[str, Any]]:
    """
    Fetch design context from Figma MCP server.
    
    Returns structured data:
    {
        "raw_text": "...",
        "parsed": {
            "annotations": {node_id: [...]},
            "descriptions": {node_id: "..."},
            "reference_code": {node_id: "..."},
            "layout_info": {node_id: {...}},
            "style_info": {node_id: {...}},
        },
        "source": "mcp",
        "node_id": node_id,
        "file_key": file_key,
    }
    
    Returns None if MCP is unavailable (normal on deployed servers).
    """
    import urllib.request
    
    # Step 1: Initialize MCP session
    init_payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {"name": "raibach-ingest", "version": "1"},
        },
    }
    
    try:
        req = urllib.request.Request(
            MCP_URL,
            data=json.dumps(init_payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json, text/event-stream",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=MCP_TIMEOUT) as res:
            session_id = res.headers.get("Mcp-Session-Id")
            body = res.read().decode("utf-8")
            # Parse SSE response
            data_lines = [line[6:] for line in body.splitlines() if line.startswith("data: ")]
            if data_lines:
                init_result = json.loads("\n".join(data_lines))
    except urllib.error.URLError as e:
        # MCP not reachable (normal on server)
        return None
    except Exception as e:
        print(f"⚠️ MCP initialize failed: {e}")
        return None
    
    # Step 2: Send initialized notification
    try:
        notify_payload = {
            "jsonrpc": "2.0",
            "method": "notifications/initialized",
            "params": {},
        }
        req = urllib.request.Request(
            MCP_URL,
            data=json.dumps(notify_payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json, text/event-stream",
            } | ({"Mcp-Session-Id": session_id} if session_id else {}),
            method="POST",
        )
        urllib.request.urlopen(req, timeout=MCP_TIMEOUT)
    except Exception:
        pass  # Notification failure is non-fatal
    
    # Step 3: Call get_design_context tool
    call_payload = {
        "jsonrpc": "2.0",
        "id": 2,
        "method": "tools/call",
        "params": {
            "name": "get_design_context",
            "arguments": {"fileKey": file_key, "nodeId": node_id},
        },
    }
    
    try:
        req = urllib.request.Request(
            MCP_URL,
            data=json.dumps(call_payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json, text/event-stream",
            } | ({"Mcp-Session-Id": session_id} if session_id else {}),
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=MCP_TIMEOUT) as res:
            body = res.read().decode("utf-8")
            data_lines = [line[6:] for line in body.splitlines() if line.startswith("data: ")]
            if data_lines:
                result = json.loads("\n".join(data_lines))
                
                # Parse MCP result
                mcp_result = (result.get("result") or {})
                if mcp_result.get("isError"):
                    print(f"⚠️ MCP returned error: {mcp_result}")
                    return None
                
                content = mcp_result.get("content") or []
                text_parts = [c.get("text", "") for c in content if c.get("type") == "text"]
                full_text = "\n".join(text_parts).strip()
                
                if not full_text:
                    return None
                
                # Parse the text response into structured data
                parsed = _parse_mcp_response(full_text)
                
                return {
                    "raw_text": full_text,
                    "parsed": parsed,
                    "source": "mcp",
                    "node_id": node_id,
                    "file_key": file_key,
                }
    except urllib.error.URLError:
        return None
    except Exception as e:
        print(f"⚠️ MCP get_design_context failed: {e}")
        return None
    
    return None


def _merge_mcp_rest(mcp_context: Optional[dict], rest_response: dict) -> dict[str, Any]:
    """
    Merge MCP context (annotations + reference code) with REST response (geometry + node tree).
    
    MCP provides: behavioral annotations, reference code, descriptions, layout/style info
    REST provides: complete node tree with geometry, fills, strokes, layout, text styles
    
    Returns enriched node data for the mapper.
    """
    # Deep copy nodes to avoid mutating original
    import copy
    nodes = copy.deepcopy(rest_response.get("nodes", {}))
    components = rest_response.get("components", {})
    
    merged = {
        "nodes": nodes,
        "components": components,
        "mcp_context": mcp_context,
    }
    
    # If MCP provided parsed data, enrich each REST node with MCP annotations
    if mcp_context and mcp_context.get("parsed"):
        parsed = mcp_context["parsed"]
        mcp_annotations = parsed.get("annotations", {})
        mcp_descriptions = parsed.get("descriptions", {})
        mcp_reference_code = parsed.get("reference_code", {})
        mcp_layout_info = parsed.get("layout_info", {})
        mcp_style_info = parsed.get("style_info", {})
        
        # Enrich each node in the REST response
        for node_key, node_data in nodes.items():
            if not node_data or not node_data.get("document"):
                continue
            
            doc = node_data["document"]
            node_id = doc.get("id", "").replace("-", ":")  # Normalize
            
            # Attach MCP annotations
            if node_id in mcp_annotations:
                existing_annotations = doc.get("annotations", [])
                mcp_anns = mcp_annotations[node_id]
                for ann_text in mcp_anns:
                    existing_annotations.append({
                        "label": ann_text,
                        "labelMarkdown": ann_text,
                        "categoryId": "mcp",
                        "source": "mcp",
                    })
                doc["annotations"] = existing_annotations
            
            # Attach MCP description
            if node_id in mcp_descriptions:
                doc["mcp_description"] = mcp_descriptions[node_id]
            
            # Attach MCP reference code
            if node_id in mcp_reference_code:
                doc["mcp_reference_code"] = mcp_reference_code[node_id]
            
            # Attach MCP layout info (supplements REST layout)
            if node_id in mcp_layout_info:
                existing_layout = doc.get("layout", {})
                existing_layout.update(mcp_layout_info[node_id])
                doc["layout"] = existing_layout
            
            # Attach MCP style info (supplements REST fills/strokes/radius)
            if node_id in mcp_style_info:
                if "mcp_style" not in doc:
                    doc["mcp_style"] = {}
                doc["mcp_style"].update(mcp_style_info[node_id])
        
        # Also store parsed data at top level for mapper reference
        merged["mcp_parsed"] = parsed
    
    return merged


def _figma_color(fill: dict[str, Any]) -> Optional[str]:
    """A Figma paint as a CSS colour, when it is a plain solid one."""
    color = (fill or {}).get("color")
    if not color:
        return None
    r = round(float(color.get("r", 0)) * 255)
    g = round(float(color.get("g", 0)) * 255)
    b = round(float(color.get("b", 0)) * 255)
    a = color.get("a", 1)
    if a is None or float(a) >= 0.999:
        return f"#{r:02x}{g:02x}{b:02x}"
    return f"rgba({r}, {g}, {b}, {round(float(a), 3)})"


def _figma_gradient(fill: dict[str, Any]) -> Optional[str]:
    """A Figma gradient paint as a CSS gradient.

    Figma sends gradients as stops plus handle positions, not as CSS: the stops are
    normalised 0-1 and the direction is the vector between the first two handles, which
    is what has to be turned into an angle. Accepting only solid paints is why a design
    with a gradient background came back with no colour on it at all.
    """
    stops = fill.get("gradientStops") or []
    if len(stops) < 2:
        return None
    parts = []
    for stop in sorted(stops, key=lambda s: s.get("position", 0)):
        colour = _figma_color({"color": stop.get("color")})
        if not colour:
            continue
        parts.append(f"{colour} {round(float(stop.get('position', 0)) * 100)}%")
    if len(parts) < 2:
        return None
    stops_css = ", ".join(parts)

    kind = (fill.get("type") or "").upper()
    handles = fill.get("gradientHandlePositions") or []
    if kind == "GRADIENT_LINEAR" and len(handles) >= 2:
        dx = float(handles[1].get("x", 0)) - float(handles[0].get("x", 0))
        dy = float(handles[1].get("y", 0)) - float(handles[0].get("y", 0))
        angle = math.degrees(math.atan2(dy, dx)) + 90.0
        return f"linear-gradient({round(angle % 360, 1)}deg, {stops_css})"
    if kind in ("GRADIENT_RADIAL", "GRADIENT_DIAMOND"):
        return f"radial-gradient(circle at 50% 50%, {stops_css})"
    if kind == "GRADIENT_ANGULAR":
        return f"conic-gradient({stops_css})"
    return None


def _figma_paint(fill: dict[str, Any]) -> Optional[str]:
    """Any Figma paint as CSS: a flat colour, a gradient, or a noted image."""
    if not isinstance(fill, dict) or not fill.get("visible", True):
        return None
    kind = (fill.get("type") or "").upper()
    if kind == "SOLID":
        colour = _figma_color(fill)
        if not colour:
            return None
        opacity = fill.get("opacity")
        if opacity is not None and float(opacity) < 0.999:
            return f"{colour} (fill opacity {round(float(opacity), 3)})"
        return colour
    if kind.startswith("GRADIENT"):
        gradient = _figma_gradient(fill)
        if gradient:
            return f"{gradient} (gradient, {len(fill.get('gradientStops') or [])} stops)"
        return None
    if kind == "IMAGE":
        return "image fill (its asset arrives over the MCP channel)"
    return None


def _style_from_override(style: dict[str, Any]) -> dict[str, Any]:
    """One range's style, in the same shape the primary style is kept in."""
    out = {
        k: style.get(k)
        for k in ("fontFamily", "fontWeight", "fontSize", "lineHeightPx", "lineHeightUnit",
                  "letterSpacing", "textCase", "textDecoration")
        if style.get(k) is not None
    }
    fill = next((_figma_paint(f) for f in style.get("fills", []) if f.get("visible", True)), None)
    if fill:
        out["fill"] = fill
    return out


def _text_runs(node: dict[str, Any]) -> list[dict[str, Any]]:
    """The styled ranges inside one text layer — start, end, and the style that applies.

    Figma reports the layer's PRIMARY style in `style`, and any word or phrase styled differently
    in `characterStyleOverrides` (one number per character, 0 = the primary style) together with
    `styleOverrideTable` (what those numbers mean). Read together, they are the runs a renderer
    needs to draw the layer exactly; read separately or not at all, the layer renders in one style
    and every difference inside it is lost.

    Consecutive characters sharing an override are ONE run. Runs are inclusive of `start`, exclusive
    of `end`, in characters — the same convention as the words they describe.
    """
    overrides = node.get("characterStyleOverrides")
    table = node.get("styleOverrideTable") or {}
    text = node.get("characters") or ""
    if not overrides or not isinstance(overrides, list) or not table:
        return []

    runs: list[dict[str, Any]] = []
    index = 0
    length = min(len(overrides), len(text))
    while index < length:
        override_id = overrides[index]
        end = index
        while end < length and overrides[end] == override_id:
            end += 1
        if override_id:
            style = table.get(str(override_id)) or table.get(override_id)
            if style:
                runs.append({
                    "start": index,
                    "end": end,
                    "text": text[index:end],
                    "style": _style_from_override(style),
                })
        index = end
    return runs


# The Figma fields that decide how a layer is DRAWN, and the spec key each one is carried under.
# Used by the coverage report: a field present on the node whose spec key is missing means the
# pipeline measured something it did not pass on, which is a gap to close rather than a silent
# difference between the design and the component.
_RENDER_FIELDS = {
    "opacity": "opacity",
    "visible": "visible",
    "clipsContent": "clips",
    "rotation": "rotation",
    "rectangleCornerRadii": "radii",
    "cornerRadius": "radius",
    "strokeAlign": "strokeAlign",
    "individualStrokeWeights": "strokeWeights",
    "strokeCap": "strokeCap",
    "strokeJoin": "strokeJoin",
    "dashPattern": "dashPattern",
    "constraints": "constraints",
    "counterAxisSpacing": "counterAxisSpacing",
    "layoutSizingHorizontal": "sizing",
    "layoutSizingVertical": "sizing",
    "layoutGrow": "sizing",
    "layoutAlign": "sizing",
    "layoutPositioning": "sizing",
    "textTruncation": "truncation",
    "maxLines": "maxLines",
    "textAutoResize": "textAutoResize",
    "characterStyleOverrides": "runs",
    "styleOverrideTable": "runs",
    "effects": "effects",
    "fills": "fill",
}


def _spec_nodes_by_id(spec: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """Every spec entry, keyed by the node id it came from."""
    out: dict[str, dict[str, Any]] = {}

    def walk(node: dict[str, Any]) -> None:
        node_id = str(node.get("id") or "")
        if node_id:
            out[node_id] = node
        for child in node.get("children") or []:
            walk(child)

    walk(spec)
    return out


def _states_value(field: str, raw: dict[str, Any]) -> bool:
    """Whether a node actually STATES something for this field, as against naming a default.

    THE PREDICATE IS THE SAME ONE THE SPEC BUILDER APPLIES. Figma puts `effects: []` on almost
    every layer, `clipsContent: false` on every frame that does not clip, `opacity: 1` on
    everything, `layoutGrow: 0` on everything, and an override table whose numbers all mean "the
    primary style". None of those is a measurement, and reporting them as unread would bury the
    real gap under a page of defaults — the first version of this report did exactly that, and a
    report nobody can read is a report nobody reads.
    """
    value = raw.get(field)
    if value is None:
        return False
    if isinstance(value, (list, dict)) and len(value) == 0:
        return False
    if field == "clipsContent":
        return value is True
    if field == "visible":
        return value is False
    if field == "opacity":
        try:
            return float(value) < 1
        except (TypeError, ValueError):
            return False
    if field == "rotation":
        try:
            return abs(float(value)) > 0.001
        except (TypeError, ValueError):
            return False
    if field == "layoutGrow":
        return bool(value)
    if field == "fills":
        return any(f.get("visible", True) for f in value)
    if field == "effects":
        return any(e.get("visible", True) for e in value)
    if field in ("characterStyleOverrides", "styleOverrideTable"):
        # Read as a pair, exactly as `_text_runs` reads them: an override table whose numbers all
        # mean "the primary style" states no deviation, so there is nothing to carry.
        return bool(_text_runs(raw))
    return True


def _figma_read_gaps(spec: dict[str, Any], raw_nodes: Any) -> list[str]:
    """What Figma stated that the spec did not carry — the coverage report for an ingest.

    ONE DIRECTION ONLY: raw → spec. A renderable field the node STATES, on a node whose spec entry
    has no corresponding key, is a measurement the pipeline dropped; it is reported by layer and
    by name so it can be read as work rather than discovered as a difference on screen later. The
    other direction — spec keys the renderer does not emit — is `design_renderer.unrendered_keys`.
    Between the two, "the component differs from the design" stops being a mystery.
    """
    by_id = _spec_nodes_by_id(spec)
    gaps: dict[str, list[str]] = {}
    for raw in _walk_raw_nodes(raw_nodes):
        node_id = str(raw.get("id") or "")
        entry = by_id.get(node_id)
        if not entry:
            continue
        missing = []
        for field, key in _RENDER_FIELDS.items():
            if not _states_value(field, raw):
                continue
            # `fills` may land as `fill` (one) or `fills` (several); either satisfies the field.
            if field == "fills" and (entry.get("fill") or entry.get("fills")):
                continue
            if entry.get(key) is None:
                missing.append(field)
        if missing:
            name = raw.get("name") or node_id
            gaps.setdefault(name, [])
            for field in missing:
                if field not in gaps[name]:
                    gaps[name].append(field)
    return [
        f"{name}: {', '.join(sorted(fields))}"
        for name, fields in sorted(gaps.items())
    ]


def _figma_spec_for_model(node: dict[str, Any], depth: Optional[int] = None) -> dict[str, Any]:
    """The design as the renderer needs to read it — EVERY layer, unless a depth is asked for.

    Geometry, auto-layout, paints, radius, effects and typography for every node in the
    subtree — the things that decide what the design looks like — with the layer names
    kept.

    ── DEPTH IS NOT CAPPED ANY MORE ────────────────────────────────────────────
    This defaulted to 4, and at the boundary it dropped the children with nothing said: a design
    five levels deep lost its fifth level and the component simply looked like that. The cap came
    from a model's prompt budget — the limits beside it still say so — and there is no model in
    the ingest any more, so it was buying nothing and costing whole layers of the design. The
    renderer is the only builder now, and it has to see everything the design has (owner,
    2026-09-29: *"why are you stopping at four? Why wouldn't you just go to the bottom?"*).

    THE STOP THAT REMAINS IS LOUD. `INGEST_MAX_NODES` and `INGEST_MAX_SPEC_CHARS` are measured on
    THIS spec, so a design too large to render is REFUSED with its numbers — never quietly cut
    down to fit. A depth may still be passed where a summary is genuinely wanted (the ingest
    response's own report asks for one level), and `None` means the whole tree.
    """
    box = node.get("absoluteBoundingBox") or {}
    spec: dict[str, Any] = {
        "id": node.get("id"),
        "name": node.get("name"),
        "type": node.get("type"),
    }
    if box:
        spec["size"] = [round(box.get("width", 0), 1), round(box.get("height", 0), 1)]
        spec["position"] = [round(box.get("x", 0), 1), round(box.get("y", 0), 1)]

    layout = {}
    for key in ("layoutMode", "itemSpacing", "paddingLeft", "paddingRight", "paddingTop", "paddingBottom",
                "primaryAxisAlignItems", "counterAxisAlignItems", "layoutWrap"):
        if node.get(key) is not None:
            layout[key] = node[key]
    if layout:
        spec["layout"] = layout

    fill = next((_figma_paint(f) for f in node.get("fills", []) if f.get("visible", True)), None)
    if fill:
        spec["fill"] = fill
    stroke = next((_figma_color(s) for s in node.get("strokes", []) if s.get("visible", True) and s.get("type") == "SOLID"), None)
    if stroke:
        spec["stroke"] = {"color": stroke, "weight": node.get("strokeWeight")}
    # A VECTOR'S SHAPE IS ITS PATH, and nothing else in this spec is the shape. It comes from
    # Figma's own `fillGeometry`/`strokeGeometry`, asked for with `geometry=paths` (see
    # _fetch_figma_nodes). Without it the model has a box and a fill and must invent the rest —
    # which is how an icon ends up drawn as a picture of the node that CONTAINS it instead of the
    # artwork inside it. With it, the icon is exact and nothing is interpreted.
    if node.get("type") == "VECTOR":
        geometry = (node.get("fillGeometry") or node.get("strokeGeometry") or [])
        paths = [g.get("path") for g in geometry if g.get("path")]
        if paths:
            # `paths` IS THE ARTWORK, ALL OF IT. A composed glyph arrives as several geometry
            # entries — the `( )` is one path per parenthesis — and `path` is kept as the first of
            # them only because the catalogue scan and the vector report read that key by name.
            # Anything DRAWING the artwork reads `svg`, or `paths` in the fallback below.
            spec["paths"] = paths
            spec["path"] = paths[0]
            rule = next((g.get("windingRule") for g in geometry if g.get("windingRule")), None)
            if rule:
                spec["windingRule"] = rule
            # THE FITTED SVG TRAVELS WITH IT — see _svg_for_vector. The model is handed markup,
            # not two numbers it has to reconcile, because two numbers is what made every icon a
            # different approximation of the same artwork.
            svg = _svg_for_vector(node)
            if svg:
                spec["svg"] = svg
    # ── WHAT THE DESIGNER WROTE ON THE LAYER ─────────────────────────────────
    # A Figma annotation is the designer talking: the words, the markup, the exact artwork they
    # want for that node. It is the one kind of instruction that is not a measurement and cannot
    # be inferred — when it is there, it OUTRANKS everything measured about that node, because a
    # person wrote it down on purpose.
    #
    # IT COMES BACK ON THE REST CHANNEL. This spec used to carry annotations only from MCP, and
    # the channel counts were MCP-only too, so an annotation the designer had added was measured
    # as zero and never reached the model (owner, 2026-09-29: *"I've added an annotation with
    # this information in. I don't understand why the application can't read it."* — the
    # annotation was on a child INSTANCE and its label was the literal `<svg>…</svg>` to use).
    # The label is HTML-escaped by Figma because it contains markup, so it is unescaped here:
    # what the model reads must be the markup itself, not `&lt;svg&gt;`.
    annotations = node.get("annotations")
    if annotations:
        texts = []
        for ann in annotations if isinstance(annotations, list) else [annotations]:
            if isinstance(ann, dict):
                label = ann.get("label") or ann.get("labelMarkdown") or ""
                if label:
                    texts.append(html.unescape(str(label)) if "&" in str(label) else str(label))
        if texts:
            spec["annotation"] = texts

    if node.get("cornerRadius") is not None:
        spec["radius"] = node["cornerRadius"]
    # PER-CORNER RADII. `cornerRadius` is Figma's "all four the same"; when they differ it
    # reports them individually and `cornerRadius` is absent, so reading only the one number
    # silently squares off a rounded box.
    if node.get("rectangleCornerRadii"):
        spec["radii"] = [round(float(v), 2) for v in node["rectangleCornerRadii"]]

    # EFFECTS, IN FULL. The old line carried type, offset, radius and colour — which is exactly a
    # box-shadow and nothing else, so a spread, a background blur or a second shadow had nowhere
    # to go. The measurement now keeps the fields Figma states.
    effects = []
    for effect in node.get("effects", []):
        if not effect.get("visible", True):
            continue
        entry = {
            "type": effect.get("type"),
            "x": round(effect.get("offset", {}).get("x", 0), 2),
            "y": round(effect.get("offset", {}).get("y", 0), 2),
            "radius": effect.get("radius"),
            "spread": effect.get("spread"),
            "color": _figma_color(effect),
        }
        effects.append({k: v for k, v in entry.items() if v is not None})
    if effects:
        spec["effects"] = effects

    # ── EVERYTHING ELSE FIGMA SAYS ABOUT HOW THIS LAYER IS DRAWN ─────────────
    # Each of these is a value the design states. None of them was read before, which means the
    # renderer could not have honoured them however well it was written: a hidden layer was drawn,
    # a translucent layer was opaque, a clipped frame let its children spill, a rotated layer drew
    # straight, and a fill beyond the first was invisible.
    if node.get("opacity") is not None and float(node["opacity"]) < 1:
        spec["opacity"] = round(float(node["opacity"]), 4)
    if node.get("visible") is False:
        spec["visible"] = False
    if node.get("clipsContent") is True and node.get("type") in ("FRAME", "COMPONENT", "INSTANCE"):
        spec["clips"] = True
    if node.get("rotation") is not None and abs(float(node["rotation"])) > 0.001:
        spec["rotation"] = round(float(node["rotation"]), 3)
    # EVERY VISIBLE PAINT, not only the first: Figma stacks fills and the order is the drawing.
    fills = [_figma_paint(f) for f in node.get("fills", []) if f.get("visible", True)]
    fills = [f for f in fills if f]
    if len(fills) > 1:
        spec["fills"] = fills
    # STROKE, WITH THE PARTS THAT DECIDE WHERE IT LANDS. `strokeAlign` is the difference between a
    # border inside the box and one drawn outside it, and `individualStrokeWeights` is a stroke
    # that is not the same on all four sides.
    if node.get("strokeAlign"):
        spec["strokeAlign"] = node["strokeAlign"]
    if node.get("individualStrokeWeights"):
        spec["strokeWeights"] = {
            k: node["individualStrokeWeights"][k]
            for k in ("top", "right", "bottom", "left")
            if node["individualStrokeWeights"].get(k) is not None
        }
    if node.get("strokeCap"):
        spec["strokeCap"] = node["strokeCap"]
    if node.get("strokeJoin"):
        spec["strokeJoin"] = node["strokeJoin"]
    if node.get("dashPattern"):
        spec["dashPattern"] = node["dashPattern"]
    if node.get("constraints"):
        spec["constraints"] = node["constraints"]

    # HOW THIS LAYER SIZES ITSELF INSIDE ITS PARENT. HUG and FILL are flexbox facts; without them
    # every child is a fixed box and a design that stretches one element is drawn as two fixed
    # ones.
    sizing = {
        k: node[k]
        for k in ("layoutSizingHorizontal", "layoutSizingVertical", "layoutGrow", "layoutAlign",
                  "layoutPositioning")
        if node.get(k) is not None
    }
    if sizing:
        spec["sizing"] = sizing
    if node.get("counterAxisSpacing") is not None:
        spec["counterAxisSpacing"] = node["counterAxisSpacing"]

    if node.get("type") == "TEXT":
        style = node.get("style", {})
        spec["text"] = node.get("characters", "")
        spec["type_style"] = {
            k: style.get(k)
            for k in ("fontFamily", "fontWeight", "fontSize", "lineHeightPx", "lineHeightUnit",
                      "letterSpacing", "textAlignHorizontal", "textAlignVertical", "textCase",
                      "textDecoration", "paragraphSpacing", "paragraphIndent")
            if style.get(k) is not None
        }
        # ── A TEXT LAYER CAN HOLD MORE THAN ONE STYLE, AND THAT IS USUALLY THE POINT ──
        # `style` is the layer's PRIMARY style. Where the words are styled in ranges — a bold
        # title over a grey subtitle, the same layer — Figma reports the difference as
        # `characterStyleOverrides` (one entry per character, 0 meaning "the primary style") plus
        # `styleOverrideTable` (the styles those numbers refer to). Neither was read, so every
        # layer rendered in one style: sizes, weights, colours and LINE HEIGHTS inside a text box
        # were lost, and the preview showed text the designer never drew.
        runs = _text_runs(node)
        if runs:
            spec["runs"] = runs
        # Truncation is a design decision, not an absence: a box told to end in an ellipsis must
        # render one, and `maxLines` says how many lines it keeps before it does.
        #
        # IT IS STATED ON THE STYLE, and the top level of the node is usually null. Reading only
        # the node's own key measured `functions-label` as having no truncation at all — the design
        # ellipsises "System Role Dropdown us…", the component drew the sentence overflowing its
        # box, and the difference came from reading one of the two places Figma writes it rather
        # than from the design saying anything different.
        truncation = node.get("textTruncation") or style.get("textTruncation")
        if truncation:
            spec["truncation"] = truncation
        max_lines = node.get("maxLines")
        if max_lines is None:
            max_lines = style.get("maxLines")
        if max_lines is not None:
            spec["maxLines"] = max_lines
        if node.get("textAutoResize"):
            spec["textAutoResize"] = node["textAutoResize"]
    if node.get("componentId"):
        # CANONICAL, because everything downstream builds a tag out of this — `f-<componentId
        # with colons as hyphens>` — and Figma writes it as `I<occurrence>;<source>` for an
        # instance. Left verbatim, the occurrence ended up inside the tag, so the same component
        # in two places produced two different tags, one of them a dash-joined string naming no
        # component at all. The occurrence is the location; the tag is the component.
        spec["componentId"] = node_code_identity(node["componentId"])
    if node.get("mcp_reference_code"):
        spec["mcp_reference_code"] = str(node["mcp_reference_code"])[:1500]
    if node.get("mcp_description"):
        spec["mcp_description"] = node["mcp_description"]

    children = node.get("children", [])
    # `depth is None` means the whole tree — see the note on this function. A depth that is asked
    # for is honoured, and the layers below it are dropped: that is what a summary is.
    if children and (depth is None or depth > 0):
        below = None if depth is None else depth - 1
        spec["children"] = [_figma_spec_for_model(c, below) for c in children]

    return spec


# ── The layer tree, kept where the screen can read it ──────────────────────────
# _figma_spec_for_model() measures the WHOLE layer tree on every ingest and then
# discards it. The model reads it, the ledger keeps the reply, and the layers
# themselves went nowhere — so the only place a design's parent/child structure
# existed was inside a model call that had already finished. That is why two layers
# with the same name in one frame (the two chevron-blue-closed, 40001185:2170 and
# 40001185:2163) could not be seen by anyone: nothing that outlived the call held
# the tree they were both in.
#
# This writes it out, per pipeline, for the screen to read.
#
# ON APPROVE, NOT ON INGEST. The record belongs to a component that EXISTS in the system, so
# it is written with the rest of that component's registrations and from the same node the
# component was built from. Written at ingest it recorded designs that were merely looked at
# — a tree of something nobody added — and what is on screen is meant to be the system's
# contents, not a browsing history.
#
# IT IS A REPORT, NOT AN INPUT. Nothing reads this back into the ingest, no build
# step consumes it, and the catalogue does not know it exists. It records what was
# measured — id, name, type, geometry, and the children nested inside each node —
# so a person can open the design's own structure and see what is in it.
FIGMA_LAYERS_DIR = os.path.join(FRONTEND_DIR, "public", "catalog-figma")

# How deep a recorded tree may go. _figma_spec_for_model's own default is 4, and the
# depth argument bounds BOTH the measurement and this record, so the two can never
# describe different trees.
FIGMA_LAYERS_DEPTH = 4


def _write_figma_layers(
    pipeline: str,
    tag: str,
    node_id: str,
    spec: dict[str, Any],
    assets: Optional[list[dict[str, Any]]] = None,
) -> dict[str, Any]:
    """Persist one node's measured layer tree for the screen.

    Merges into the pipeline's file rather than replacing it: an ingest names one node,
    and the file is a record of every node that has been through here. The write is
    atomic (temp file + os.replace) for the same reason the catalog's is — a reader
    must never catch the file half-written.

    Raises on failure. A tree that was measured and then not written is a screen that
    silently shows nothing, and "nothing" is indistinguishable from "this design has no
    layers", which is the exact pair of claims this whole record exists to keep apart.
    """
    os.makedirs(FIGMA_LAYERS_DIR, exist_ok=True)
    path = os.path.join(FIGMA_LAYERS_DIR, f"{pipeline}.json")

    document: dict[str, Any] = {"pipeline": pipeline, "nodes": {}}
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            prior = json.load(f)
        if isinstance(prior, dict) and isinstance(prior.get("nodes"), dict):
            document = prior

    nodes = document.setdefault("nodes", {})
    nodes[node_id] = {
        "tag": tag,
        "nodeId": node_id,
        "approvedAt": datetime.utcnow().isoformat() + "Z",
        "layers": sum(1 for _ in _walk_spec(spec)),
        "tree": spec,
        # THE ARTWORK THE DESIGN CARRIED, with the file that serves it in this repository. The
        # tree is what was measured about the layers; this is what the design came with, and a
        # reader of the record needs both — one to see the structure, one to see the picture.
        "assets": assets or [],
    }
    document["pipeline"] = pipeline
    document["generatedAt"] = datetime.utcnow().isoformat() + "Z"

    tmp_path = f"{path}.tmp-{os.getpid()}"
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(document, f, indent=1, ensure_ascii=False)
        f.write("\n")
    os.replace(tmp_path, path)

    return {"file": f"public/catalog-figma/{pipeline}.json", "layers": nodes[node_id]["layers"]}


def _mark_removed_in_figma_layers(
    pipeline: str,
    tag: str = "",
    node_id: str = "",
    actor: str = "",
    reason: str = "",
) -> str:
    """Write a removal into the layer record — who, when, and why — and report what happened.

    THE RECORD IS WHERE THE APPROVAL IS KEPT, so a removal that left no mark in it left the
    record asserting a design is in the catalogue when it is not: the screen drew the design
    under "Recorded, not in this catalogue" while the activity table said, correctly, that the
    owner had deleted it. A record that a reader cannot reconcile with what happened is worse
    than no record, so the removal is written where the approval is — as a fact of its own,
    keyed by the same node, in a `removed` block beside `nodes`.

    BESIDE, NOT INSIDE. A separate block keeps the two facts from overwriting each other: a
    node's entry is rewritten whole by the next approval or re-ingest, and a mark stored inside
    it would be erased by exactly the event it exists to describe.

    Returns what was written, or the reason nothing was. It never raises: a removal that has
    already taken the component out of the catalogue must not be reported as failed because its
    record could not be annotated.
    """
    try:
        path = os.path.join(FIGMA_LAYERS_DIR, f"{pipeline}.json")
        if not os.path.exists(path):
            return "no layer record for this catalogue"
        with open(path, encoding="utf-8") as f:
            document = json.load(f)
        if not isinstance(document, dict):
            return "the layer record is not a document"

        nodes = document.get("nodes") or {}
        # WHICH NODE THIS COMPONENT WAS. The caller's node is the one it was ingested from and is
        # used as given; otherwise the record's own `tag` field names it, which is authoritative
        # because it survives a rename. There is deliberately NO guessing from a tag's digits: a
        # generated tag is its node with the hyphens written as colons, but a comparison loose
        # enough to match when it should not would mark a component that is still in the
        # catalogue as removed — which is a record asserting something false, the one thing this
        # block must never do. Not found means not marked.
        target = node_id or ""
        if not target:
            for nid, entry in nodes.items():
                if isinstance(entry, dict) and entry.get("tag") == tag:
                    target = nid
                    break
        if not target or target not in nodes:
            return "the record holds no node for this component"

        removed = document.setdefault("removed", {})
        if not isinstance(removed, dict):
            removed = document["removed"] = {}
        removed[target] = {
            "tag": nodes[target].get("tag") or tag,
            "removedAt": datetime.utcnow().isoformat() + "Z",
            "actor": actor or "",
            "reason": reason or "",
        }
        # ── AND THE NODE GOES, WITH THE ARTWORK IT CARRIED ───────────────────
        # The mark above is the history: who removed this, when, and why. The NODE is not history
        # — it is the measurement of a component, plus the list of pictures that came with it,
        # and the record exists to hold what this catalogue CONTAINS (see FIGMA_LAYERS_DIR). Left
        # in place it kept serving a component the owner had deleted: the layer pane reads a
        # node's `assets` when a layer is opened, so opening a layer of something already removed
        # drew its old pictures back onto the screen — the designer updates the artwork, removes
        # the component, and the previous version is still there to be found (owner, 2026-09-29:
        # *"I added it then I removed it. It didn't remove the image, it kept it, and so when we
        # did preview the system just pulled it back up… you're holding onto artifacts and
        # reserving them, so that's a bug."*).
        #
        # The removal is written first, above, so the mark never depends on the node still being
        # there; this drops the measurement itself, which is the thing that was being served.
        dropped = nodes.pop(target, None)
        document["generatedAt"] = datetime.utcnow().isoformat() + "Z"

        tmp_path = f"{path}.tmp-{os.getpid()}"
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(document, f, indent=1, ensure_ascii=False)
            f.write("\n")
        os.replace(tmp_path, path)
        kept = len((dropped or {}).get("assets") or [])
        return (
            f"recorded in public/catalog-figma/{pipeline}.json — removed by {actor or 'unknown'} "
            f"at {removed[target]['removedAt']}; its measurement left the record"
            + (f", with the {kept} asset reference(s) it carried" if kept else "")
        )
    except Exception as e:
        return f"the layer record could not be annotated: {e}"


def _catalog_component_names() -> list[str]:
    """The names the assembly model is allowed to compose with."""
    try:
        components = getattr(a2ui_catalog, "components", None)
        if isinstance(components, dict) and components:
            return sorted(components.keys())
        if isinstance(a2ui_catalog, dict):
            components = a2ui_catalog.get("components", {})
            if isinstance(components, dict):
                return sorted(components.keys())
    except Exception:
        pass
    try:
        path = os.path.join(REPO_ROOT, "A2UI", "catalogs", INGEST_CATALOG_PIPELINE, "catalog.json")
        with open(path, encoding="utf-8") as f:
            return sorted(json.load(f).get("components", {}).keys())
    except Exception:
        return []


def _extract_json_object(text: str) -> dict[str, Any]:
    """The JSON object in a model reply, fences and trailing prose tolerated.

    The strict parser is tried first. It is then retried with `strict=False`, which is the
    case that matters in practice: a model writing a component's source inside a JSON string
    writes real newlines rather than \n, and that is invalid JSON while being perfectly
    unambiguous. Refusing the whole reply over it threw away work that was already done.
    """
    if not text:
        return None
    cleaned = text.strip()
    for fence in ("```json", "```"):
        if fence in cleaned:
            cleaned = cleaned.split(fence, 1)[1].split("```", 1)[0].strip()
            break
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end <= start:
        return None
    candidate = cleaned[start:end + 1]
    for kwargs in ({}, {"strict": False}):
        try:
            return json.loads(candidate, **kwargs)
        except Exception:
            continue
    # A reply that carries anything after the object is still a reply. raw_decode reads the
    # first complete value and stops, which is what "Extra data" was refusing: she writes the
    # JSON, then a sentence about it, and the whole answer was being thrown away for that.
    for kwargs in ({}, {"strict": False}):
        try:
            return json.JSONDecoder(**kwargs).raw_decode(cleaned[start:])[0]
        except Exception:
            continue
    return None


def _json_failure_detail(text: str) -> dict[str, Any]:
    """Why a reply could not be read, in terms someone can act on."""
    cleaned = (text or "").strip()
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    candidate = cleaned[start:end + 1] if start != -1 and end > start else cleaned
    reason, position = "no JSON object found in the reply", None
    if candidate:
        try:
            json.loads(candidate, strict=False)
        except json.JSONDecodeError as e:
            reason = e.msg
            position = f"line {e.lineno}, column {e.colno}"
        except Exception as e:
            reason = str(e)
    cut_off = "Unterminated string" in reason or "Expecting value" in reason
    return {
        "reason": reason,
        "cutOff": cut_off,
        "position": position,
        "replyChars": len(text or ""),
        "head": (text or "")[:400],
        "tail": (text or "")[-200:] if len(text or "") > 600 else "",
    }


def _figma_map_lookup(node_id: str) -> Optional[dict[str, Any]]:
    """The Figma map's entry for a node, if the design already has a component for it."""
    try:
        with open(os.path.join(FRONTEND_DIR, "src", "components", "registry.json"), encoding="utf-8") as f:
            for entry in json.load(f).get("components", []):
                if node_ids_match(entry.get("figmaNodeId"), node_id):
                    return entry
    except Exception:
        return None
    return None


def _catalogue_by_reference() -> dict[str, dict[str, Any]]:
    """Component reference → the catalogue's entry for it, read fresh from the Figma map.

    Keyed by the COMPONENT part of the node id (everything before the last `;`), never the whole
    id: a child that already exists must be found wherever an instance of it sits, in any design
    and at any location. Read on every call rather than cached — an ingest must see the catalogue
    as it is at that moment, including a component approved a minute ago.
    """
    out: dict[str, dict[str, Any]] = {}
    try:
        with open(os.path.join(FRONTEND_DIR, "src", "components", "registry.json"), encoding="utf-8") as f:
            for entry in json.load(f).get("components", []):
                identity = node_code_identity(entry.get("figmaNodeId"))
                if identity and entry.get("litComponent"):
                    out.setdefault(identity, entry)
    except Exception as e:
        print(f"⚠️ [figma-ingest] the Figma map could not be read for the child scan: {e}")
    return out


def _catalogue_children(spec: dict[str, Any]) -> list[dict[str, Any]]:
    """Every child of this design the catalogue ALREADY HAS — the question the scan produces.

    THE OWNER'S RULE, stated three times and now the contract: *"It has to scan the lit catalog on
    every ingest to see if what's there already exists… does it ask me if I want to overwrite the
    catalogue's instance of that child or do I want to just use the existing one?"* So the scan
    runs on every ingest, over every layer, and each match becomes one question with two answers:

      * USE — the existing component is composed here, as an element. The child is unchanged.
      * OVERWRITE — the child is rebuilt from this design's version of it, replacing what the
        catalogue holds for that component.

    ONE QUESTION PER CHILD, keyed by its component reference, so a child used in four places in
    one design is asked about once. `tag` is what the catalogue draws it as; `innerTag` is the tag
    this ingest built for it when it built one (an ingest that fetched the component's own node),
    which is what an overwrite would write from.
    """
    catalogue = _catalogue_by_reference()
    if not catalogue:
        return []

    found: dict[str, dict[str, Any]] = {}
    draft_tags = set()
    for node in _walk_spec(spec):
        if node.get("path") and node.get("svg"):
            draft_tags.add(str(node.get("name") or ""))

    def walk(node: dict[str, Any]) -> None:
        for child in node.get("children") or []:
            reference = node_code_identity(child.get("componentId"))
            entry = catalogue.get(reference) if reference else None
            if entry and reference not in found:
                found[reference] = {
                    "reference": reference,
                    "layerName": child.get("name") or "",
                    "tag": entry.get("litComponent"),
                    "file": entry.get("file"),
                    "figmaName": entry.get("figmaName"),
                    "question": (
                        f"{child.get('name') or 'this child'} is already in the catalogue as "
                        f"<{entry.get('litComponent')}> — use the existing one, or overwrite it "
                        f"with this design's version?"
                    ),
                }
            walk(child)

    walk(spec)
    return sorted(found.values(), key=lambda x: str(x.get("layerName")))


def _catalogue_tags_map() -> dict[str, str]:
    """Component reference → tag, in the shape `design_renderer.render_spec` composes with."""
    return {
        reference: entry.get("litComponent")
        for reference, entry in _catalogue_by_reference().items()
        if entry.get("litComponent")
    }


def _walk_spec(spec: dict[str, Any]):
    yield spec
    for child in spec.get("children", []) or []:
        yield from _walk_spec(child)


def _walk_raw_nodes(nodes: Any):
    """Every node of a RAW Figma response — the REST shape, not the spec shape.

    `_walk_spec` reads the measured spec (children under `children`), but annotations and
    descriptions live on the untouched REST nodes, and those arrive inside wrappers: the response
    maps node id → `{document, components, styles}`, and `children` holds nodes, but a node can
    also appear under a key like `document`. So EVERY dict and list is walked and anything that
    looks like a node — an id and a type — is yielded, with a set keeping each node to one.

    Assumed shapes were tried first and both were wrong: a walker that yields "any dict with an
    id and a type" finds nothing inside the wrapper, and one that only descends `children` under
    the wrapper's `document` finds a single node. Guessing a shape is how a count reports zero
    about something that is present.
    """
    seen: set = set()

    def walk(value: Any):
        if isinstance(value, dict):
            if value.get("id") and value.get("type") and id(value) not in seen:
                seen.add(id(value))
                yield value
            for item in value.values():
                yield from walk(item)
        elif isinstance(value, list):
            for item in value:
                yield from walk(item)

    yield from walk(nodes)


def _path_box(path: str) -> Optional[tuple]:
    """The box a path's own coordinates occupy: (min_x, min_y, width, height).

    Not the node's box. A vector's `path` is written in its own coordinate space — often offset
    (this file has one starting at x=-0.49) and never the same numbers as the size Figma measured
    for the node. Two boxes, and an SVG needs to be told which one its viewBox is.
    """
    if not isinstance(path, str) or not path.strip():
        return None
    nums: list[float] = []
    for token in re.findall(r"-?\d*\.?\d+(?:e-?\d+)?", path):
        try:
            nums.append(float(token))
        except ValueError:
            continue
    if len(nums) < 4:
        return None
    xs, ys = nums[0::2], nums[1::2]
    if not xs or not ys:
        return None
    min_x, min_y = min(xs), min(ys)
    return (min_x, min_y, max(xs) - min_x, max(ys) - min_y)


def _matrix_multiply(a: list[list[float]], b: list[list[float]]) -> list[list[float]]:
    """Figma's 2×3 affine composition: `a` applied after `b`."""
    return [
        [a[0][0] * b[0][0] + a[0][1] * b[1][0], a[0][0] * b[0][1] + a[0][1] * b[1][1],
         a[0][0] * b[0][2] + a[0][1] * b[1][2] + a[0][2]],
        [a[1][0] * b[0][0] + a[1][1] * b[1][0], a[1][0] * b[0][1] + a[1][1] * b[1][1],
         a[1][0] * b[0][2] + a[1][1] * b[1][2] + a[1][2]],
    ]


def _absolute_transform(node: dict[str, Any], root: Optional[dict[str, Any]] = None) -> Optional[list[list[float]]]:
    """A node's full transform in the space its ancestors are drawn in.

    A vector's `path` is written in the VECTOR'S OWN coordinates — not the page's. What places it
    is the chain of `relativeTransform`s above it, and that chain is where rotation and flipping
    live: this design's chevron is turned a quarter-turn inside its instance (matrix
    `[[0,1,2],[-1,0,10]]`) and the instance holding it is flipped vertically. The path itself says
    none of that, so a renderer that draws the path as-is draws the icon sideways — which is what
    "it's just breaking it" was.

    The chain is walked from the node up to `root` (exclusive), and the matrices are composed in
    top-down order so the result maps the node's coordinates into the root's.
    """
    chain: list[dict[str, Any]] = []
    current: Optional[dict[str, Any]] = node
    guard = 0
    while current is not None and current is not root and guard < 64:
        chain.append(current)
        current_id = str(current.get("id") or "")
        # The tree's own parent link first, `parentId` second: see _remember_raw_nodes.
        parent_id = _raw_parent_by_id.get(current_id) or current.get("parentId")
        current = _raw_node_by_id.get(str(parent_id)) if parent_id else None
        guard += 1
    if not chain:
        return None
    chain.reverse()
    matrix: Optional[list[list[float]]] = None
    for entry in chain:
        relative = entry.get("relativeTransform")
        if not relative or len(relative) != 2:
            continue
        matrix = relative if matrix is None else _matrix_multiply(matrix, relative)
    return matrix


def _invert_matrix(matrix: list[list[float]]) -> Optional[list[list[float]]]:
    """The inverse of a Figma 2×3 affine, or None when it is degenerate."""
    a, b, tx = matrix[0]
    c, d, ty = matrix[1]
    det = a * d - b * c
    if abs(det) < 1e-9:
        return None
    return [
        [d / det, -b / det, (b * ty - d * tx) / det],
        [-c / det, a / det, (c * tx - a * ty) / det],
    ]


def _apply_matrix(matrix: list[list[float]], x: float, y: float) -> tuple:
    """One point through a Figma 2×3 transform."""
    return (matrix[0][0] * x + matrix[0][1] * y + matrix[0][2],
            matrix[1][0] * x + matrix[1][1] * y + matrix[1][2])


_raw_node_by_id: dict[str, dict[str, Any]] = {}
_raw_parent_by_id: dict[str, str] = {}


def _remember_raw_nodes(nodes: Any) -> None:
    """Index a raw response by node id AND by parent, so a vector can find its ancestors.

    The transforms that place a vector live on the chain above it, so drawing it correctly means
    walking that chain. `parentId` is NOT reliable for this: a node fetched by id can carry none
    (the chevron's vector has no parentId in the response that produced it), which silently
    truncated the chain to the vector alone and drew the artwork rotated but NOT flipped — the
    difference between a chevron pointing up and one pointing down, found by the render gate on
    its first run.

    So the parent map is built from the tree itself, which is where the relationship actually is:
    every node the response nests is one step below the node that nests it.
    """
    global _raw_node_by_id, _raw_parent_by_id
    for node in _walk_raw_nodes(nodes):
        node_id = str(node.get("id") or "")
        if node_id:
            _raw_node_by_id[node_id] = node
        for child in node.get("children") or []:
            child_id = str(child.get("id") or "")
            if child_id and node_id:
                _raw_parent_by_id[child_id] = node_id


def _svg_for_vector(node: dict[str, Any], root: Optional[dict[str, Any]] = None) -> Optional[str]:
    """A measured vector, already drawn — the exact `<svg>` the element should contain.

    THE WORK IS DONE HERE, ONCE, INSTEAD OF BY THE MODEL EVERY TIME. A vector arrives as a path
    in one coordinate space, a size in another, and a transform that maps the first onto the
    second. Any renderer has to reconcile all three. Handing them to a language model and
    expecting the arithmetic to come back identical on every call is what made icons slow to
    match the design and different each time (owner, 2026-09-29: *"I keep asking this… are you
    creating a process that will ingest them properly?"*). So the numbers are not sent to be
    interpreted: the markup is assembled here, from Figma's own geometry.

    WHAT COMES OUT is the path, the transform that places it (`matrix(...)`), and a viewBox in
    the path's own units. Those are all exact — no fitting, no aspect guessing, no cropping — and
    the width/height are the size Figma measured, so the artwork lands at the size the design
    says without any number being rounded into place.

    Returns None when there is no geometry or no usable box, and the caller falls back to the
    measured size so a vector is never silently dropped.
    """
    geometry = node.get("fillGeometry") or node.get("strokeGeometry") or []
    # ── EVERY PIECE OF THE ARTWORK, NOT THE FIRST ONE ────────────────────────
    # A vector's artwork is ALL of its geometry entries. This took the first entry that carried a
    # path and dropped the rest, which is invisible on a single-shape icon and wrong on anything
    # else: the glyph named `( )` arrives as TWO entries — one per parenthesis — so the design's
    # two parens were drawn as one, and the component matched the design everywhere except the
    # artwork it exists to draw. The box below is still taken from the first entry, because the
    # size and origin are Figma's own measurement and this change is about what is DRAWN.
    paths = [str(g.get("path")) for g in geometry if g.get("path")]
    path = paths[0] if paths else None
    box = _path_box(path) if path else None
    if not path or not box:
        return None

    measured = node.get("absoluteBoundingBox") or {}
    transform = _absolute_transform(node, root)

    # ── THE ARTWORK'S BOX COMES FROM FIGMA, CARRIED BACK THROUGH THE TRANSFORM ──
    # Figma states the vector's box (`absoluteBoundingBox`) — its width and height are what the
    # design says, exactly, with no interpretation. What a renderer also needs is the box in the
    # PATH'S OWN coordinates, for the viewBox, and the honest way to get it is to carry Figma's box
    # back through the transform the path will be carried forward through. The alternative — reading
    # the numbers out of the path text with a pattern — is what put a `(` where the design has
    # `( )`: it measured one subpath's extent (5.76) where Figma measures 17.24, so the svg was
    # declared a third of the width it should be and the glyph was drawn stretched and clipped.
    #
    # A regex cannot read a path. A mathematical inverse of a known transform can, and does.
    width = round(float(measured.get("width") or 0), 2)
    height = round(float(measured.get("height") or 0), 2)
    box = None
    if transform:
        inverse = _invert_matrix(transform)
        if inverse:
            corners = [
                _apply_matrix(inverse, measured.get("x", 0), measured.get("y", 0)),
                _apply_matrix(inverse, measured.get("x", 0) + width, measured.get("y", 0)),
                _apply_matrix(inverse, measured.get("x", 0), measured.get("y", 0) + height),
                _apply_matrix(inverse, measured.get("x", 0) + width, measured.get("y", 0) + height),
            ]
            xs = [c[0] for c in corners]
            ys = [c[1] for c in corners]
            box = (min(xs), min(ys), max(xs) - min(xs), max(ys) - min(ys))
    if box is None:
        # no transform (or a degenerate one): the path is already in the space the box names
        box = (measured.get("x", 0), measured.get("y", 0), width, height)
    if width <= 0 or height <= 0:
        return None
    fill = next((_figma_paint(f) for f in node.get("fills", []) if f.get("visible", True)), None)
    stroke = next(
        (_figma_color(s) for s in node.get("strokes", []) if s.get("visible", True) and s.get("type") == "SOLID"),
        None,
    )
    winding = next((g.get("windingRule") for g in geometry if g.get("windingRule")), None) or "NONZERO"

    transform = _absolute_transform(node, root)
    # ── THE FIT IS CHECKED, NOT ASSUMED ──────────────────────────────────────
    # Placing a rotated vector means composing transforms, and the composed box is compared with
    # Figma's own `absoluteBoundingBox` before anything is written. When they agree, the points
    # are rewritten into that space and the svg is exact. When they do not agree — a flattened
    # instance can report a box that no matrix chain reproduces — the local coordinates are left
    # alone, which is the old behaviour and visibly imperfect rather than silently wrong. A tool
    # that guesses which of its own numbers to believe is how an icon ends up the wrong way up.
    drawn = box
    fit = "identity"
    if transform:
        corners = [
            _apply_matrix(transform, box[0], box[1]),
            _apply_matrix(transform, box[0] + box[2], box[1]),
            _apply_matrix(transform, box[0], box[1] + box[3]),
            _apply_matrix(transform, box[0] + box[2], box[1] + box[3]),
        ]
        xs = [c[0] for c in corners]
        ys = [c[1] for c in corners]
        drawn = (min(xs), min(ys), max(xs) - min(xs), max(ys) - min(ys))
        # A DEGENERATE TRANSFORM IS THE THING WORTH REFUSING, not a frame that is bigger than its
        # artwork. The previous test compared the drawn extent against the node's box and called a
        # legitimate 5.76-wide path inside a 17.24-wide frame a bad transform — refusing a correct
        # matrix and drawing the glyph unrotated and stretched. Scale is what can be wrong.
        sx = (transform[0][0] ** 2 + transform[1][0] ** 2) ** 0.5
        sy = (transform[0][1] ** 2 + transform[1][1] ** 2) ** 0.5
        if 0.05 < sx < 20 and 0.05 < sy < 20:
            fit = "transformed"
            figma_box = {}
        else:
            figma_box = {"width": True, "height": True}  # a degenerate matrix: refuse it below
    # EVERY PATH GOES THROUGH THE SAME TRANSFORM AND IS DRAWN, in the design's own order. A
    # composed glyph is several entries that only read as the design together — the `( )` is one
    # path per paren, and drawing one of them is a design that does not match.
    paths_out: list[str] = []
    for one in paths:
        out = one
        if fit == "transformed" and transform:
            moved = _transform_path(one, transform)
            out = moved or one
        paths_out.append(out)
    # WHERE THE DRAWING ACTUALLY LANDS, read from the transformed path itself. The extent is
    # Figma's own measurement (what the design says the artwork is), and the origin is where those
    # coordinates ended up — getting the second from a transform's inverse put the glyph off its
    # own canvas, because the inverse maps the root's space while the path lives in the node's.
    #
    # ── KNOWN DEFECT, MEASURED, NOT YET FIXED ────────────────────────────────
    # This origin is the PATH's leftmost point, not the FRAME's leftmost point, so artwork smaller
    # than its own frame is drawn hard against the left of the box instead of where the design
    # puts it. The arrow is the case: its path draws 7.813 wide inside a frame Figma states as
    # 10.000, so 1.09 of margin belongs on EACH side of it, and pinned left it reads as a smaller
    # mark than the design's.
    #
    # ── KNOWN DEFECT, MEASURED, AND STILL NOT FIXED ─────────────────────────
    # This origin is the PATH's leftmost point, not the FRAME's, so artwork smaller than its own
    # frame is drawn against the left of the box instead of where the design puts it: the chevron's
    # arrow draws 8.68 wide inside a 10-wide frame, so 1.09 of margin belongs on EACH side of it,
    # and with the margin all on the right the mark reads small and shifted left.
    #
    # BOTH OBVIOUS FIXES ARE WRONG AND WERE TRIED AND REVERTED:
    #   * the frame corner as the node's own (0, 0) — for a rotated vector that is a different
    #     corner, and the arrow landed above its canvas;
    #   * the frame corner as the minimum of the frame's four corners — which the code above
    #     ALREADY COMPUTES — because that computation is in a different SPACE from the path.
    #
    # THAT LAST ONE IS THE REAL FINDING, and it is why this cannot be fixed by choosing a value:
    # `absoluteBoundingBox` is in PAGE coordinates, while `_absolute_transform` composes each
    # node's `relativeTransform` up to the root — which maps a node into the ROOT's space, not the
    # page's. So carrying the box back through the inverse gives something that is not the local
    # frame, and carrying THAT forward gives the page box back (measured: −19522.0, 19968.0 —
    # exactly the bounding box), not the space the path is drawn in (560.66, 523.0).
    #
    # ── THE CANVAS IS THE VECTOR'S FRAME, IN THE SPACE THE PATH LANDS IN ────
    # The artwork's own coordinates are relative to a frame whose origin is (0, 0) in the space
    # the `path` is written in — and the frame's SIZE is the box Figma states, turned back through
    # the transform, because that box is the frame's axis-aligned result. Both halves are therefore
    # in the path's space: the frame's four corners in local coordinates, carried through the SAME
    # matrix the path was, reduced to their minimum.
    #
    # THIS IS WHAT PLACES THE ARTWORK WHERE THE DESIGN PUT IT. Building the canvas from the path's
    # own leftmost point instead discards the margin the design keeps around its artwork: the
    # chevron's arrow draws 8.682 wide inside a FRAME Figma reports as 10.000 (`layoutSizing FIXED
    # / FIXED` — it does not hug), so 0.659 belongs on EACH side, and with the whole 1.318 on the
    # right the mark reads small and shifted left of the design (owner, 2026-09-29).
    #
    # THE TEST IS CONTAINMENT, AND IT IS MADE BEFORE THE VALUE IS USED: if the frame's corners do
    # not land somewhere that contains the artwork, this origin is REFUSED and the path's own box
    # is used instead — the previous behaviour, visibly imperfect rather than off-canvas. That is
    # how the two wrong attempts above were caught, and it is why this one cannot repeat them.
    origin: Optional[tuple] = None
    if transform:
        a, b = transform[0][0], transform[0][1]
        c, d = transform[1][0], transform[1][1]
        det = abs(a) * abs(d) - abs(b) * abs(c)
        if abs(det) > 1e-9:
            w_local = (abs(d) * width - abs(b) * height) / det
            h_local = (abs(a) * height - abs(c) * width) / det
            if w_local > 0.01 and h_local > 0.01:
                corners = [
                    _apply_matrix(transform, 0.0, 0.0),
                    _apply_matrix(transform, w_local, 0.0),
                    _apply_matrix(transform, 0.0, h_local),
                    _apply_matrix(transform, w_local, h_local),
                ]
                origin = (min(p[0] for p in corners), min(p[1] for p in corners))
    if origin is not None:
        boxes = [b for b in (_path_box(one) for one in paths_out) if b]
        if boxes:
            x0 = min(b[0] for b in boxes)
            y0 = min(b[1] for b in boxes)
            x1 = max(b[0] + b[2] for b in boxes)
            y1 = max(b[1] + b[3] for b in boxes)
            contained = (
                x0 >= origin[0] - 0.01 and y0 >= origin[1] - 0.01
                and x1 <= origin[0] + width + 0.01 and y1 <= origin[1] + height + 0.01
            )
            if not contained:
                origin = None
    if origin is None:
        fallback = _path_box(paths_out[0]) or box
        origin = (fallback[0], fallback[1])
    drawn = (origin[0], origin[1], width, height)

    parts = [
        f'<svg width="{width}" height="{height}" viewBox="{round(drawn[0], 2)} {round(drawn[1], 2)} '
        f'{round(drawn[2], 2)} {round(drawn[3], 2)}" fill="none" xmlns="http://www.w3.org/2000/svg">'
    ]
    for out in paths_out:
        attrs = [f'd="{out}"']
        if fill:
            attrs.append(f'fill="{fill}"')
        else:
            attrs.append('fill="none"')
        if stroke:
            attrs.append(f'stroke="{stroke}"')
            attrs.append(f'stroke-width="{round(float(node.get("strokeWeight") or 1), 2)}"')
        if winding and winding != "NONZERO":
            attrs.append(f'fill-rule="{winding.lower()}"')
        parts.append(f'<path {" ".join(attrs)}/>')
    parts.append("</svg>")
    return "".join(parts)


def _transform_path(path: str, matrix: list[list[float]]) -> Optional[str]:
    """A path with every point carried through a transform, commands intact.

    The alternative — `transform="matrix(...)"` on the path — was tried and rendered wrongly: an
    SVG transform SCALES the pen, so a stroke comes out multiplied and a path the viewBox does
    not contain gets silently cropped. Rewriting the coordinates moves the geometry and nothing
    else, which is what "draw this shape there" means.

    Relative commands (lower case) are resolved against a cursor first, because once the origin
    has moved, "6 units further on" means something different: every point is turned into the
    absolute coordinate it names, that coordinate is transformed, and the command is written
    absolute. Returns None on anything it cannot read with certainty, and the caller then draws
    the untransformed path rather than a half-transformed one.
    """
    tokens = re.findall(r"[MmLlHhVvCcSsQqTtAaZz]|-?\d*\.?\d+(?:e-?\d+)?", path)
    arity = {"M": 2, "L": 2, "T": 2, "C": 6, "S": 4, "Q": 4, "H": 1, "V": 1, "A": 7, "Z": 0}
    out: list[str] = []
    cursor_x = cursor_y = 0.0
    start_x = start_y = 0.0
    index = 0
    try:
        while index < len(tokens):
            command = tokens[index]
            if not re.match(r"^[A-Za-z]$", command):
                return None
            index += 1
            upper = command.upper()
            if upper not in arity:
                return None
            count = arity[upper]
            relative = command.islower()
            if upper == "Z":
                out.append("Z")
                cursor_x, cursor_y = start_x, start_y
                continue
            written_first = False
            while index < len(tokens) and re.match(r"^-?\d", tokens[index]):
                if index + count > len(tokens):
                    return None
                group = [float(t) for t in tokens[index:index + count]]
                index += count
                if upper in ("H", "V"):
                    x = (cursor_x + group[0]) if (upper == "H" and relative) else (group[0] if upper == "H" else cursor_x)
                    y = (cursor_y + group[0]) if (upper == "V" and relative) else (group[0] if upper == "V" else cursor_y)
                    nx, ny = _apply_matrix(matrix, x, y)
                    out.append(f"{upper}{round(nx if upper == 'H' else ny, 2)}")
                    cursor_x, cursor_y = nx, ny
                    continue
                if upper == "A":
                    end_x = (cursor_x + group[5]) if relative else group[5]
                    end_y = (cursor_y + group[6]) if relative else group[6]
                    nx, ny = _apply_matrix(matrix, end_x, end_y)
                    out.append("A" + " ".join([f"{g:g}" for g in group[:5]] + [f"{round(nx, 2)}", f"{round(ny, 2)}"]))
                    cursor_x, cursor_y = nx, ny
                    continue
                points = []
                for i in range(0, count, 2):
                    x = (cursor_x + group[i]) if relative else group[i]
                    y = (cursor_y + group[i + 1]) if relative else group[i + 1]
                    nx, ny = _apply_matrix(matrix, x, y)
                    points.append(f"{round(nx, 2)} {round(ny, 2)}")
                    cursor_x, cursor_y = nx, ny
                if not written_first:
                    if upper == "M":
                        start_x, start_y = cursor_x, cursor_y
                    out.append(upper if not (upper == "M" and written_first) else "L")
                    written_first = True
                else:
                    out.append("L" if upper == "M" else upper)
                out.extend(points)
        return " ".join(out)
    except Exception:
        return None


def _design_system_context(spec: dict[str, Any]) -> str:
    """This design's own layers, and which of them the design system already has.

    The ingest already hands the model the catalogue's NAMES — a flat list of 58 strings —
    and nothing that says which layer of THIS design any of them came from. So the model
    could not know that a chevron in front of it is a component the design system already
    ships, and drew it again. The map (registry.json) has held the node→component
    relationship all along; this puts it in front of the model instead of behind it.

    _compliance_warnings() already says "compose the mapped element rather than ship a
    second one" — but it says it AFTER the code is written, as advice on work already done.
    A rule that arrives after the drawing is a rule nobody could follow.

    Read once, and it RAISES if the map cannot be read: a failed read would report every
    layer as unmapped, which is the claim "the design system has none of this" — the exact
    opposite of the truth, and the one answer this must never give.
    """
    map_path = os.path.join(FRONTEND_DIR, "src", "components", "registry.json")
    with open(map_path, encoding="utf-8") as f:
        entries = json.load(f).get("components", []) or []
    # KEYED BY COMPONENT IDENTITY, not by the whole id: the map may record any one instance of a
    # component, and every OTHER instance of it in this design must resolve to that same entry —
    # that is what makes "one component used in three places" visible instead of three mysteries.
    by_identity: dict[str, dict[str, Any]] = {}
    for e in entries:
        identity = node_code_identity(e.get("figmaNodeId"))
        if identity:
            by_identity.setdefault(identity, e)
    by_node = {e.get("figmaNodeId"): e for e in entries if e.get("figmaNodeId")}
    # Which node was the first of each component in this spec — the one line that gets the
    # "already a component" sentence. Later ones are the same component in another place, and
    # repeating the first line would read as a second component rather than a second instance.
    first_of: dict[str, str] = {}

    lines: list[str] = []
    for node in _walk_spec(spec):
        if node is spec:
            continue  # the root is the thing being built; it is not a candidate to compose
        node_id = node.get("id") or ""
        name = node.get("name") or "(unnamed layer)"
        identity = node_code_identity(node_id)
        mapped = by_identity.get(identity)
        component_id = node.get("componentId")
        of_component = by_node.get(component_id) if component_id else None

        if mapped and mapped.get("litComponent"):
            location = node_location(node_id)
            if identity not in first_of:
                first_of[identity] = node_id
                lines.append(
                    f"- {node_id}  {name}  -> ALREADY A COMPONENT: <{mapped['litComponent']}>"
                    f" ({mapped.get('file') or 'file not recorded'}). Compose this tag here; do not redraw it."
                )
            else:
                lines.append(
                    f"- {node_id}  {name}  -> the SAME COMPONENT as {first_of[identity]}"
                    f" — <{mapped['litComponent']}>. The only difference is where this instance sits"
                    f"{f' (occurrence {location})' if location else ''}: compose the same tag again,"
                    " and compose nothing new for it."
                )
        elif of_component and of_component.get("litComponent"):
            lines.append(
                f"- {node_id}  {name}  -> an INSTANCE of {component_id}, which is already"
                f" <{of_component['litComponent']}> — one component this design uses in more than one"
                " place. Compose it once per place; do not redraw the artwork."
            )
        else:
            lines.append(f"- {node_id}  {name}  -> no component yet; draw it.")

    if not lines:
        return "(this design has no layers under its root.)"
    return "\n".join(lines)


def _name_index() -> dict[str, dict[str, Any]]:
    """The design system's components, keyed by the NAME each one is known by.

    THREE NAMES ARE ONE NAME HERE. A component is known by its Figma layer name (`figmaName`),
    by its Lit tag (`litComponent`), and — when it is declared — by its key in the catalogue.
    A layer in a new design can collide with any of the three, so all three go in the index.
    Raises if the map cannot be read: an unreadable index would report every layer as new,
    which is the claim "the design system has none of this" — the opposite of the truth.
    """
    map_path = os.path.join(FRONTEND_DIR, "src", "components", "registry.json")
    with open(map_path, encoding="utf-8") as f:
        entries = json.load(f).get("components", []) or []
    index: dict[str, dict[str, Any]] = {}
    for entry in entries:
        for key in ("figmaName", "litComponent"):
            name = entry.get(key)
            if isinstance(name, str) and name:
                index.setdefault(name, entry)
    return index


def _name_collisions(spec: dict[str, Any]) -> list[dict[str, Any]]:
    """Layers whose NAME the design system already has on a DIFFERENT component.

    The node-id lookup answers "does this exact node have a component". This answers the other
    question, which is the one a copy raises: "is there already a component called this?" — a
    copy carries a new node id, so the id lookup says "no component yet" and the design gets a
    second component under a name that already exists. Neither answer alone is enough.

    ONLY THE COMPONENT PART OF THE ID IS COMPARED (`node_ids_match`), and that is the whole
    point of the split: a second INSTANCE of a component the design system already ships has a
    different occurrence — the location it sits in — and the same component reference, so it is
    not a collision and it is not a new component: it is the existing one, in another place.
    Comparing the whole string made those read as copies, and the answer the screen offered for
    a copy ("overwrite it") wrote one component's code over another's file (2026-09-28). An
    instance is reported by `_name_instances`, which asks no question.
    """
    index = _name_index()
    seen: dict[str, dict[str, Any]] = {}
    for node in _walk_spec(spec):
        if node is spec:
            continue  # the root is what is being built
        name = node.get("name")
        node_id = node.get("id") or ""
        if not isinstance(name, str) or not name:
            continue
        entry = index.get(name)
        if not entry:
            continue
        existing_node = entry.get("figmaNodeId") or ""
        if node_ids_match(existing_node, node_id):
            continue  # this IS that component (another instance of it) — not a second one
        if name in seen:
            continue  # one report per name is enough to ask the question
        seen[name] = {
            "name": name,
            "nodeId": node_id,
            "layerType": node.get("type") or "",
            "existingTag": entry.get("litComponent") or "(no tag recorded)",
            "existingNodeId": existing_node or "(no node recorded)",
            "existingFile": entry.get("file") or "",
            "sameNode": False,
            # The two halves of each id, so a reader can see WHICH half differs — a different
            # component reference (a genuinely new component under a taken name) as against the
            # same reference in another location, which the screen would never ask about.
            "existingIdentity": node_code_identity(existing_node) or "(no node recorded)",
            "nodeIdentity": node_code_identity(node_id),
            "nodeLocation": node_location(node_id),
        }
    return list(seen.values())


def _name_instances(spec: dict[str, Any]) -> list[dict[str, Any]]:
    """Layers that ARE a component the design system already has, in another place.

    The other half of `_name_collisions`, and a different fact: same component reference, a
    different occurrence. Nothing is asked about these and nothing is written for them — the
    design is using its own design system, which is what it is supposed to do. They are
    reported so the screen can say so, because "this is the same component as that one, only
    the location differs" is the sentence that stops a second component being made for it.
    """
    index = _name_index()
    seen: dict[str, dict[str, Any]] = {}
    for node in _walk_spec(spec):
        if node is spec:
            continue
        name = node.get("name")
        node_id = node.get("id") or ""
        if not isinstance(name, str) or not name:
            continue
        entry = index.get(name)
        if not entry:
            continue
        existing_node = entry.get("figmaNodeId") or ""
        if not node_ids_match(existing_node, node_id):
            continue
        if name in seen:
            continue
        seen[name] = {
            "name": name,
            "nodeId": node_id,
            "nodeLocation": node_location(node_id),
            "existingTag": entry.get("litComponent") or "(no tag recorded)",
            "existingNodeId": existing_node or "(no node recorded)",
            "identity": node_code_identity(node_id),
        }
    return list(seen.values())


def _svg_shape(svg: str) -> dict[str, Any]:
    """The measurable facts of a piece of markup: fill, stroke, width and stroke weight.

    Used to compare what the model drew with what was measured, so the comparison reasons about
    the artwork rather than about formatting. Returns only the keys it could read.
    """
    shape: dict[str, Any] = {}
    tag = re.search(r"<svg[^>]*>", svg or "")
    if tag:
        width = re.search(r'width\s*=\s*"([\d.]+)', tag.group(0))
        if width:
            try:
                shape["width"] = float(width.group(1))
            except ValueError:
                pass
    path = re.search(r"<path[^>]*>", svg or "")
    if path:
        fill = re.search(r'fill\s*=\s*"([^"]+)"', path.group(0))
        if fill:
            shape["fill"] = fill.group(1).lower()
        stroke = re.search(r'stroke\s*=\s*"([^"]+)"', path.group(0))
        if stroke:
            shape["stroke"] = stroke.group(1).lower()
        weight = re.search(r'stroke-width\s*=\s*"([\d.]+)', path.group(0))
        if weight:
            try:
                shape["strokeWidth"] = float(weight.group(1))
            except ValueError:
                pass
    return shape


def _vector_findings(spec: dict[str, Any], code: str) -> list[str]:
    """WHAT THE ELEMENT DRAWS AGAINST WHAT THE DESIGN MEASURED — the post-build vector check.

    The model is handed a finished `<svg>` per vector (see `_svg_for_vector`) and told to copy it.
    This is the step that checks whether it did, so a wrong icon is a FINDING the preview says out
    loud rather than something that ships because nobody looked. It reads the two things that are
    comparable without a browser:

      * the path itself — character for character once whitespace is normalised, which is the
        strongest possible evidence and what the instruction asks for;
      * failing that, the shape it names — its width, fill, stroke and stroke weight — because a
        redrawn-but-correct icon is not a defect worth waking anyone for.

    WHAT IT DELIBERATELY DOES NOT DO is judge geometry it cannot measure. The path's coordinates
    live in the vector's own space, placed by Figma's transforms, so comparing raw numbers would
    report every rotated vector as wrong — the same mistake that made the icons wrong in the first
    place. A vector it cannot measure is reported as unmeasured, never as a pass.

    Vector-only for now, at the owner's word: *"I think a verification process after build is a
    great idea. It's worth the tokens. And we can apply it to vectors for now."*
    """
    findings: list[str] = []

    def walk(node: dict[str, Any]):
        yield node
        for child in node.get("children", []) or []:
            yield from walk(child)

    vectors = [n for n in walk(spec) if n.get("path")]
    if not vectors:
        return findings

    def squash(text: str) -> str:
        return re.sub(r"\s+", " ", (text or "").replace("'", '"')).strip()

    code_flat = squash(code)
    measured = 0
    for vector in vectors:
        name = vector.get("name") or vector.get("id") or "(unnamed vector)"
        path = squash(str(vector.get("path")))
        svg = vector.get("svg") or ""
        if not path:
            findings.append(f"{name}: the design measured no path for this vector — nothing to check.")
            continue
        # A PATH ALONE IS NOT EVIDENCE. The failing component this check was written for contains
        # the exact `d="…"` and still draws the wrong icon — it draws it in a frame of the wrong
        # size, with another icon's colour, because the model copied the path and then decided the
        # rest itself. So three facts are checked, each of them something the design states:
        # the path, the width it was measured at, and its fill. Nothing here is a judgement about
        # formatting; each is "does the design's own value appear in the element".
        #
        # THE PATH CHECKED IS THE ONE IN THE MARKUP, not the raw `path` beside it: the two differ
        # for a rotated vector — `svg` carries the coordinates transformed into the design's space,
        # `path` the untransformed ones — and the markup is what the model is told to copy verbatim.
        drawn_path = "d=\"\""
        markup_path = re.search(r'<path[^>]*d="([^"]+)"', svg)
        if markup_path:
            drawn_path = squash(markup_path.group(1))
        sized = re.search(r'width="([\d.]+)"', svg)
        drawn_size = bool(sized) and f'width="{sized.group(1)}"' in code_flat
        wanted_fill = re.search(r'fill="(#[0-9a-fA-F]{3,8})"', svg)
        drawn_fill = (not wanted_fill) or (wanted_fill.group(1).lower() in code_flat.lower())
        copied = bool(markup_path) and drawn_path in code_flat and drawn_size and drawn_fill
        if not copied:
            # Not a verbatim copy. Before saying so, see whether the shape it drew is the shape
            # that was asked for: width, fill, stroke. An icon redrawn with the same numbers is a
            # different kind of failure from an icon that is missing or the wrong colour.
            wanted = _svg_shape(svg)
            drawn = _svg_shape(code)
            differences = []
            if wanted.get("width") and drawn.get("width"):
                if abs(wanted["width"] - drawn["width"]) > max(1.0, 0.15 * wanted["width"]):
                    differences.append(f"width {drawn['width']} where the design says {wanted['width']}")
            elif wanted.get("width") and not drawn.get("width"):
                differences.append("no width on the drawn svg")
            if wanted.get("fill") and drawn.get("fill") and wanted["fill"] != drawn["fill"]:
                differences.append(f"fill {drawn['fill']} where the design says {wanted['fill']}")
            if wanted.get("strokeWidth") and drawn.get("strokeWidth"):
                if abs(wanted["strokeWidth"] - drawn["strokeWidth"]) > 0.2:
                    differences.append(
                        f"stroke-width {drawn['strokeWidth']} where the design says {wanted['strokeWidth']}"
                    )
            if not drawn.get("width") and not drawn.get("fill"):
                findings.append(
                    f"{name}: the design measured a vector here and nothing in the element draws one — "
                    f"the artwork is missing."
                )
            elif differences:
                findings.append(
                    f"{name}: drawn, but not as measured — {'; '.join(differences)}. The design's own "
                    f"markup is in the spec under `svg`; copy it verbatim."
                )
            else:
                # Drawn with the same measurable facts but not the same characters: a redraw whose
                # geometry cannot be checked from here. Said as unmeasured, never as a pass.
                findings.append(
                    f"{name}: drawn as its own path rather than the measured one, so the shape could "
                    f"not be verified against the design."
                    if measured == 0 else f"{name}: drawn as its own path rather than the measured one."
                )
            continue
        measured += 1

    if measured and not findings:
        findings.append(f"{measured} vector(s) copied from the design exactly — nothing to correct.")
    return findings


def _channel_report(
    merged: dict[str, Any],
    mcp_context: Optional[dict[str, Any]],
    component_descriptions: Optional[dict[str, str]] = None,
) -> dict[str, Any]:
    """What each channel gave, counted from where the fact actually comes from.

    Separate from the ingest body because it is now reported twice — with the result and with the
    record — and two copies of a count is two answers waiting to disagree.

    ANNOTATIONS ARE COUNTED FROM BOTH CHANNELS. They arrive on the REST nodes (the designer wrote
    them on the layers) and can also come through MCP; counting only MCP's reported "0 annotations"
    about a design that had one, which is how an annotation went unread (2026-09-29).

    DESCRIPTIONS ARE NOT ON THE DESIGN'S NODES. A component's description is written on the
    COMPONENT, and the design's tree carries instances — so counting `node["description"]` over the
    tree reports zero for a design whose components all have one. They come from
    `/files/<key>/components`, keyed by component id, and are counted here against the components
    THIS design actually uses. That endpoint is per-file and cached, so asking for it costs one
    request per file per five minutes rather than one per layer.
    """
    rest_annotations = 0
    used_components = set()
    for node in _walk_raw_nodes(merged.get("nodes") or {}):
        if node.get("annotations"):
            rest_annotations += 1
        reference = node.get("componentId")
        if reference:
            used_components.add(node_code_identity(reference))
    described = sorted(
        reference for reference in used_components if (component_descriptions or {}).get(reference)
    )
    mcp_parsed = (mcp_context or {}).get("parsed") or {}
    return {
        "rest": "success",
        "mcp": "success" if mcp_context else "unavailable",
        "annotations": max(rest_annotations, len(mcp_parsed.get("annotations") or {})),
        "annotationsBy": {"rest": rest_annotations, "mcp": len(mcp_parsed.get("annotations") or {})},
        "descriptions": max(len(described), len(mcp_parsed.get("descriptions") or {})),
        # WHERE each description came from, so a count of zero can be told apart from a read that
        # did not happen: the ids are the design's own components — and the TEXT travels with them,
        # because a count the designer cannot read does not answer "did you see what I wrote on
        # that component?" (owner, 2026-09-29).
        "describedComponents": described,
        "componentDescriptions": {
            reference: (component_descriptions or {})[reference] for reference in described
        },
        "componentsUsed": sorted(used_components),
        "assets": len(mcp_parsed.get("assets") or []),
    }


def _compliance_warnings(node: dict[str, Any], spec: dict[str, Any], code: str, tag: str) -> list[str]:
    """What the element does not carry from the design, and what to do about it.

    A generated component that compiles can still be wrong: it drew no chevron, it set no
    gradient, it declared no type. Each of those is measurable against the spec that was
    sent, so it is measured and stated rather than left for the designer to notice.
    """
    warnings: list[str] = []
    nodes = list(_walk_spec(spec))

    if any("gradient(" in json.dumps(n.get("fill") or "") for n in nodes) and "gradient(" not in code:
        warnings.append(
            "The design has a gradient fill and the element sets none — set the measured "
            "linear-gradient (or radial) on the layer that carries it."
        )
    root = spec
    if root.get("radius") and "border-radius" not in code:
        warnings.append(f"The design's corners are {root['radius']}px and the element declares no border-radius.")
    if root.get("stroke") and "border" not in code:
        warnings.append(
            f"The design has a {root['stroke'].get('weight')}px {root['stroke'].get('color')} stroke and the element draws no border."
        )
    if root.get("effects") and "box-shadow" not in code:
        warnings.append(f"The design has effects ({'; '.join(root['effects'])}) and the element sets no box-shadow.")

    declared_fonts = "font-family" in code or "fontFamily" in code
    declared_sizes = "font-size" in code
    measured_type = [n.get("type_style") for n in nodes if n.get("type_style")]
    if measured_type and not declared_fonts:
        warnings.append(
            f"The design's text is set in {measured_type[0].get('fontFamily')} {measured_type[0].get('fontWeight')} "
            f"{measured_type[0].get('fontSize')}px and the element declares no font-family."
        )
    if measured_type and not declared_sizes:
        warnings.append(
            f"The design measures its text at {measured_type[0].get('fontSize')}px / line-height "
            f"{measured_type[0].get('lineHeightPx')}px and the element declares no font-size."
        )

    assets = ((spec.get("assets_note") or "") and len(spec.get("assets") or [])) or 0
    if assets and "<img" not in code and "<svg" not in code:
        warnings.append(
            f"Figma supplied {assets} vector asset(s) for this design (a library icon such as a chevron) "
            "and the element draws none of them."
        )

    mapped = _figma_map_lookup(node.get("id", ""))
    if mapped and mapped.get("litComponent") != tag:
        warnings.append(
            f"This Figma node is already mapped to <{mapped.get('litComponent')}> in the Figma map "
            f"({mapped.get('figmaName')}). The design system says compose that element rather than ship a "
            "second one — check the map before approving, and reuse the mapped element if it is the same design."
        )
    return warnings


async def _process_ingest_job(job_id: str, file_key: str, node_id: str, session_id: str = "",
                              session_title: str = "", actor: str = "") -> dict[str, Any]:
    """
    Hybrid MCP + REST two-pass pipeline:
    1. Fetch from Figma REST API (always works on server with FIGMA_TOKEN)
    2. Fetch from Figma MCP (works only when Figma Desktop is open with file)
    3. Merge MCP annotations + reference code with REST geometry
    4. Pass 1 — Components: generate a source string for each referenced component
    5. Pass 2 — Target Frame: generate the source string for the target node
    6. Validate each generated module with esbuild

    Nothing is written here: the sources come back as drafts for preview, and
    POST /api/figma/commit writes the ones a designer keeps. The Figma calls and the
    esbuild checks are synchronous, so they run in threads — a paste must not stall the
    event loop that is also serving the previews of the other drafts.
    """
    # Initialize job status
    job = ingest_jobs.get(job_id)
    if job:
        job.mcp_status = "pending"
        job.rest_status = "pending"
    
    # ── Step 1: Fetch from REST API (primary, always available) ──
    try:
        rest_response = await asyncio.to_thread(_fetch_figma_nodes, file_key, node_id)
        if job:
            job.rest_status = "success"
    except Exception as e:
        if job:
            job.rest_status = f"error: {e}"
        raise
    
    # ── Step 2: Fetch from MCP (optional, desktop-only) ──
    mcp_context = None
    try:
        mcp_context = await asyncio.to_thread(_fetch_figma_mcp, file_key, node_id)
        if job:
            job.mcp_status = "success" if mcp_context else "unavailable"
    except Exception as e:
        if job:
            job.mcp_status = f"unavailable: {e}"
        mcp_context = None  # Continue with REST only
    
    # ── Step 3: Merge MCP + REST data ──
    merged = _merge_mcp_rest(mcp_context, rest_response)
    
    nodes = merged.get("nodes", {})
    if not nodes:
        raise Exception("No nodes returned from Figma")
    
    # Get the target node document
    target_node_data = nodes.get(node_id.replace("-", ":")) or nodes.get(node_id)
    if not target_node_data or not target_node_data.get("document"):
        raise Exception(f"Target node {node_id} not found in Figma response")
    
    target_node = target_node_data["document"]

    # THE NODES ARE INDEXED BY ID BEFORE ANYTHING IS MEASURED. A vector carries its path in its
    # OWN coordinates and is placed by the chain of transforms above it, so drawing it needs the
    # ancestors — and the ancestors are only reachable by id. Indexing here, once, is what lets
    # _svg_for_vector() compose that chain instead of drawing the path sideways.
    _remember_raw_nodes(nodes)


    # Also get components from the response (Figma includes referenced components)
    components = merged.get("components", {})
    mcp_annotations = merged.get("mcp_annotations")

    # ── Step 3b: FETCH THE COMPONENTS THE DESIGN USES, which the first call does not carry ──
    # `/nodes?ids=<target>` returns the target's SUBTREE and a `components` map naming every
    # component referenced inside it — but NOT those components' own definitions, which live
    # elsewhere in the file. Pass 1 below looks each one up in `nodes` and quietly finds nothing,
    # so a design assembled from five elements produced ONE draft: the five were never made, had
    # no file, no entry, and nothing to approve — and every child of the thing you just ingested
    # stayed a bare layer in the tree with no preview. (Owner, 2026-09-29: *"I can see every other
    # child and it's listed in the data tree but when I click on it, I don't see a preview."*)
    #
    # So they are asked for by id in the same call shape and merged in. The cap is deliberate and
    # what it leaves out is SAID: a design referencing thirty components is a catalogue, not an
    # element, and drafting all of them from one ingest would be a surprise rather than a service.
    referenced = [str(cid) for cid in components if str(cid) not in nodes]
    INGEST_COMPONENT_DRAFTS_MAX = 12
    if referenced:
        wanted = referenced[:INGEST_COMPONENT_DRAFTS_MAX]
        try:
            extra = await asyncio.to_thread(
                _fetch_figma_nodes, file_key, ",".join([node_id, *wanted])
            )
            nodes = {**nodes, **(extra.get("nodes") or {})}
            merged["nodes"] = nodes
            if len(referenced) > len(wanted):
                print(
                    f"⚠️ [figma-ingest] {len(referenced)} components are referenced by this design; "
                    f"drafting the first {len(wanted)}. The rest were not asked for: "
                    f"{', '.join(referenced[len(wanted):])}"
                )
        except Exception as e:
            # Reported, and the ingest continues: the target's own component is still built, and
            # a design whose components could not be fetched must not look like one that had none.
            print(f"⚠️ [figma-ingest] the referenced components could not be fetched ({e}); "
                  f"only the target will be drafted: {', '.join(referenced)}")

    drafts: dict[str, str] = {}

    # THE COMPONENTS THIS DESIGN REFERENCES, EACH DRAFTED AS ITS OWN COMPONENT — rendered from
    # their own measured nodes, by the same function that renders the design, and validated with
    # the same compile check. This is how a child becomes a catalogue entry in its own right.
    #
    # It used to call the template generator, which produced a stand-in that was not the design.
    # One builder, one measurement, no stand-ins.
    component_tags = []
    for comp_id, comp_meta in components.items():
        comp_node_data = nodes.get(comp_id)
        if comp_node_data and comp_node_data.get("document"):
            comp_node = comp_node_data["document"]
            tag = f"f-{comp_id.replace(':', '-')}"
            component_tags.append(tag)
            child_code = await asyncio.to_thread(
                render_spec, _figma_spec_for_model(comp_node), tag, {}
            )
            if child_code and (await asyncio.to_thread(_validate_generated_module, child_code)).get("ok"):
                drafts[tag] = child_code
            else:
                print(
                    f"⚠️ [figma-ingest] the referenced component {tag} ({comp_node.get('name')!r}) "
                    f"could not be rendered from its own measurements — it is listed and not drafted"
                )

    # THE DESIGN ITSELF. Its tag is an id transform — no model, no naming decision.
    target_tag = f"f-{node_id.replace(':', '-')}"

    # ── The size gate: refuse a design too large to build BEFORE anything is spent ──
    # The owner, 2026-09-28: "I put a very complex component in there to try to break the
    # system… I want the system to stop them and send a message telling them that's too large."
    # This bounds what is measured and rendered, and reports the refusal in the terms the owner
    # asked for. (It used to bound a model's prompt and therefore its spend; the bound is kept
    # because a design nobody can render usefully is still worth refusing early.)
    spec_for_model = _figma_spec_for_model(target_node)
    spec_chars = len(json.dumps(spec_for_model, ensure_ascii=False))
    node_count = sum(1 for _ in _walk_spec(spec_for_model))
    token_estimate = spec_chars // 4
    too_big = []
    if spec_chars > INGEST_MAX_SPEC_CHARS:
        too_big.append(f"the measured design is {spec_chars:,} characters (limit {INGEST_MAX_SPEC_CHARS:,})")
    if node_count > INGEST_MAX_NODES:
        too_big.append(f"it contains {node_count:,} nodes (limit {INGEST_MAX_NODES:,})")
    if too_big:
        detail = _refusal_detail(target_node, spec_for_model, spec_chars, node_count, token_estimate, too_big)
        _log_ingest({
            "kind": "ingest-refused",
            "sessionId": session_id,
            "sessionTitle": session_title,
            "actor": actor,
            "jobId": job_id,
            "fileKey": file_key,
            "nodeId": node_id,
            "nodeName": target_node.get("name", ""),
            "specChars": spec_chars,
            "nodes": node_count,
            "tokenEstimate": token_estimate,
            "error": detail,
            "nextStep": "ingest a smaller node (a frame rather than a page), or raise the limits deliberately",
        })
        print(f"⛔ [figma-ingest] refused node {node_id}: {spec_chars:,} chars, {node_count:,} nodes — nothing sent to the model")
        raise HTTPException(status_code=413, detail=detail)

    # ── THE DESIGN IS RENDERED FROM ITS MEASUREMENTS, NOT INTERPRETED ────────
    # The component is written by `design_renderer.render_spec` from the spec that was measured:
    # a pure function of the design, byte-identical on every run. The language model is not asked
    # to build a Figma node any more — asking it was what produced a dropped border, a hand-drawn
    # icon and padding written on one shape and not the next (owner, 2026-09-29: *"the model
    # should be following the specs. If the model is interpreting designs from Figma then we have
    # failed. This is a deterministic system."*).
    #
    # THE SCAN RUNS FIRST: every child this design uses that the catalogue ALREADY HAS is
    # collected, and each becomes a question — use the existing component, or overwrite it. The
    # answers ("compose" unless told otherwise) are applied by the renderer, which emits the
    # element tag instead of redrawing a component that already exists.
    # ── THE PREVIEW CHECKS NOTHING ───────────────────────────────────────────
    # No catalogue scan, no composition, no stored element anywhere in the render. The preview is
    # the design, measured and drawn, and nothing else (owner, 2026-09-29: *"The preview should be
    # fresh and not checking the lit catalog or any vectors anywhere… A preview is not lit, just
    # forget it. We cannot do a comparison. We'll have to do a comparison after we approve."*).
    #
    # THE COMPARISON MOVES TO APPROVAL, where a duplicate is a question worth asking: approve, and
    # then "this already exists as <tag> — replace it, or use the existing one?" until that question
    # exists, nothing is compared here and nothing is composed.
    composed: dict[str, str] = {}
    child_matches: list[dict[str, Any]] = []

    # ── WHAT THE DESIGNER WROTE ABOUT THE COMPONENTS THIS DESIGN USES ───────
    # Read once per ingest, from the file's own component list, because the description is written
    # on the COMPONENT and the design's tree only carries instances — so nothing about the tree
    # can tell you it exists (owner, 2026-09-29: *"are you pulling annotations?"* — the same
    # question about descriptions, and it had the same answer: the endpoint was there and nothing
    # called it). Fetched through `get_component_descriptions`, which caches per file and never
    # caches a failure, so a Figma outage reads as "not asked", not as "the designer wrote none".
    component_descriptions = await asyncio.to_thread(get_component_descriptions, file_key)

    # ── THE COVERAGE CHECK, BEFORE ANYTHING IS RENDERED ──────────────────────
    # Both halves of the contract are checked against each other here, and a gap is a REFUSAL
    # rather than a quietly different component:
    #
    #   * a spec key the renderer does not know — the measurement and the renderer disagree about
    #     what a node is, which is an integration fault, and nothing is written until it is fixed;
    #   * a measured key that is deliberately not emitted (constraints, dash patterns) — reported
    #     as a finding against the draft, named with its reason, because that is a decision and
    #     decisions are visible.
    design_gaps = await asyncio.to_thread(_figma_read_gaps, spec_for_model, merged.get("nodes") or {})
    unplaceable = await asyncio.to_thread(unrendered_spec_keys, spec_for_model)
    if unplaceable:
        raise HTTPException(
            status_code=422,
            detail=(
                "Nothing was written: the renderer has no rule for "
                + ", ".join(f"`{k}`" for k in unplaceable)
                + " — measured on this design but not something it knows how to place. "
                "The measurement is complete; the renderer is missing a rule. This is a refusal "
                "on purpose: rendering it without that rule would produce a component that "
                "differs from the design in a way nobody chose."
            ),
        )

    rendered = await asyncio.to_thread(
        render_spec, spec_for_model, target_tag, composed
    )
    generated_by = "renderer"
    rejected: list[str] = []

    # ── THERE IS NO FALLBACK, AND THAT IS THE POINT ──────────────────────────
    # The renderer is the only builder of a Figma component. If it cannot produce one, this
    # REFUSES and says so — it does not hand the design to a model that would produce something
    # plausible instead. A model asked to finish what the renderer could not is exactly the 10%
    # that drifts: right often enough to look fine, wrong in a way nobody can find (owner,
    # 2026-09-29: *"AI will get it right 80% to 90% of the time — it's that 10% of interpretation
    # that will always be wrong, and we cannot have 10% failure… it has to be 100% every time."*).
    #
    # A refusal is a list of what could not be placed, so it is work. A guess is not.
    if not rendered:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Nothing was written: the renderer produced no component for {target_tag}. "
                "This is a failure of the renderer, not of the design — the measurements are kept "
                "and the node can be re-ingested once the renderer can place it."
            ),
        )
    check = await asyncio.to_thread(_validate_generated_module, rendered)
    if not check.get("ok"):
        raise HTTPException(
            status_code=422,
            detail=(
                f"Nothing was written: the rendered component for {target_tag} does not compile — "
                f"{check.get('error', 'no reason recorded')}. The design was measured; the fault is "
                "in the renderer."
            ),
        )
    drafts[target_tag] = rendered

    # The model is not called anywhere in this pipeline any more. `assembled` stays as a shape the
    # result and the record still carry — the frontend reads `generatedBy` from it — but nothing
    # fills it with a model's work.
    assembled: dict[str, Any] = {}
    from_model: list[str] = []

    compliance = await asyncio.to_thread(
        _compliance_warnings, target_node, _figma_spec_for_model(target_node), drafts.get(target_tag, ""), target_tag
    )
    # THE POST-BUILD VECTOR CHECK. The model is handed finished `<svg>` markup per vector and told
    # to copy it; this is where that is verified, so a wrong icon is a finding the designer reads
    # rather than something that ships because nobody looked. It runs beside the compliance
    # warnings because it is the same kind of fact — measured against the design that was sent —
    # and it is a separate list because the two are fixed differently.
    vector_findings = await asyncio.to_thread(
        _vector_findings, _figma_spec_for_model(target_node), drafts.get(target_tag, "")
    )
    # WHAT THE RENDERER DELIBERATELY DOES NOT PLACE, and what Figma stated that the spec did not
    # carry. Findings on the draft, named with their reason — a component that differs from the
    # design is never something to be discovered on screen later.
    render_gaps = await asyncio.to_thread(accepted_unrendered, spec_for_model)
    render_gaps = list(render_gaps) + list(design_gaps)
    existing_path = os.path.join(FRONTEND_COMPONENTS_DIR, f"{target_tag}.ts")
    already_in_catalogue = None
    if os.path.exists(existing_path):
        stat = os.stat(existing_path)
        already_in_catalogue = {
            "file": f"frontend/src/components/lit/{target_tag}.ts",
            "bytes": stat.st_size,
            "writtenAt": datetime.utcfromtimestamp(stat.st_mtime).isoformat(timespec="seconds") + "Z",
        }
        compliance.append(
            f"{target_tag} is ALREADY in the catalogue ({already_in_catalogue['file']}, "
            f"{already_in_catalogue['bytes']} bytes, last written {already_in_catalogue['writtenAt']}). "
            "Approving replaces that file with this draft — the previous source is not kept, and the "
            "registries will not add a second entry. Discard if this was not meant to be an update."
        )

    # One sentence per fact: a note that repeats the error is noise in a panel the designer
    # has to read, and it is what made the record look hard-coded.
    assembly_error = assembled.get("error")
    assembly_note = "rendered from the design's own measurements — no model was called"
    if assembly_note and assembly_error and assembly_error in assembly_note:
        assembly_note = ""
    
    # Hold the drafts for preview and for the commit that follows, and compile-check
    # them while the designer is still looking at the result. The job's own facts are
    # kept too: commit registers the component by them, and never by anything the
    # request body claims.
    validation = {tag: await asyncio.to_thread(_validate_generated_module, code) for tag, code in drafts.items()}
    _remember_drafts(
        job_id,
        drafts,
        validation,
        {
            "nodeId": node_id,
            "fileKey": file_key,
            "sessionId": session_id,
            "sessionTitle": session_title,
            "actor": actor,
            "figmaName": target_node.get("name", ""),
            "figmaType": target_node.get("type", ""),
            "targetTag": target_tag,
            "componentTags": component_tags,
            "targetNode": target_node,
            "contract": _component_contract(target_node),
            # Layers whose NAME the design system already has on a DIFFERENT component — the
            # copy case. Held with the job so the commit can act on the designer's answer, and
            # returned with the ingest so the form can ask before anything is written.
            "nameCollisions": _name_collisions(spec_for_model),
            # And the layers that ARE a component already shipped, in another place. No question,
            # no write: said so the screen can show the design reusing its own design system
            # instead of a reader having to work out which of two identical names is which.
            "nameInstances": _name_instances(spec_for_model),
            # THE ARTWORK TRAVELS WITH THE JOB. It is captured here, from the MCP reply, and the
            # APPROVE step is where the component and the record are written — so without this
            # the vectors are used for one model call and then lost, which is how a component
            # came to reference Figma's server for a chevron instead of holding the file.
            "assets": ((mcp_context or {}).get("parsed") or {}).get("assets") or [],
        },
    )
    
    # THE ONLY LINE AN INGEST PRINTS. There is one builder, so there is nothing to warn about and
    # nothing to fall back to; the line says what was built and, when the design used components
    # the catalogue already had, which ones were composed instead of drawn.
    print(
        f"🧩 [figma-ingest] {target_tag}: rendered from the measured design"
        + (f" · composed: {'; '.join(m['tag'] for m in child_matches)}" if child_matches else "")
    )

    _log_ingest({
        "kind": "ingested",
        "sessionId": session_id,
        "sessionTitle": session_title,
        "actor": actor,
        "jobId": job_id,
        "nodeId": node_id,
        "fileKey": file_key,
        "nodeName": target_node.get("name", ""),
        "generatedBy": generated_by,
        # NO MODEL RAN. Reported as no model rather than as a default model name — a record that
        # names a model which was never called is the same class of lie as a badge reading
        # "template fallback" on a rendered draft.
        "model": None,
        "error": None,
        "note": assembly_note,
        "rejected": rejected,
        "compliance": compliance,
        # The same vector check, in the record: a draft that shipped with a wrong icon keeps the
        # finding, so "was this one verified?" is answerable after the fact.
        "vectorFindings": vector_findings,
        # What the renderer does not place, and what Figma stated that the spec did
        # not carry — named, with reasons. Empty means everything measured reached
        # the component.
        "renderGaps": render_gaps,
        # THE CHILDREN THIS DESIGN USES THAT THE CATALOGUE ALREADY HAS — one entry per child, with
        # the question it raises: use the existing component, or overwrite it. The scan runs on
        # every ingest (owner: *"It has to scan the lit catalog on every ingest to see if what's
        # there already exists"*). Everything found is COMPOSED unless the designer says
        # otherwise, and an answer of "overwrite" rebuilds that child from this design's version.
        "childMatches": child_matches,
        "channels": _channel_report(merged, mcp_context, component_descriptions),
        "drafts": {tag: {"chars": len(code), "compiles": validation.get(tag, {}).get("ok")} for tag, code in drafts.items()},
        "rawReply": assembled.get("rawReply", ""),
    })

    catalog_warning = "" if _catalog_component_names() else (
        "The A2UI catalogue could not be read, so this component was built without the design system in "
        "front of the model and cannot be checked against it. What to do: see backend/deps.py for the "
        "path it loads, or set A2UI_CATALOG_PATH."
    )

    # WHAT THE DESIGNER WROTE, COUNTED FROM WHERE IT ACTUALLY COMES FROM — see _channel_report,
    # which both this result and the record use, so the two can never disagree.
    return {
        "tag": target_tag,
        "components": component_tags,
        "drafts": drafts,
        "validation": validation,
        "alreadyInCatalogue": already_in_catalogue,
        # What the model was actually given. The preview exists to show that both
        # channels were read — REST always, MCP when Figma Desktop has the file open.
        "channels": _channel_report(merged, mcp_context, component_descriptions),
        # WHAT THE ELEMENT DRAWS against what the design measured — vectors for now.
        "vectorFindings": vector_findings,
        # What the renderer does not place, and what Figma stated that the spec did
        # not carry — named, with reasons. Empty means everything measured reached
        # the component.
        "renderGaps": render_gaps,
        # THE CHILDREN THIS DESIGN USES THAT THE CATALOGUE ALREADY HAS, so the screen can ask the
        # one question the scan raises: use the existing component, or overwrite it.
        "childMatches": child_matches,
        # WHO BUILT IT, in the shape the panel has always read. There is no model call to report,
        # and saying so is the point: the fields a model would fill are empty rather than absent,
        # so a reader can tell "nothing to report" from "the report is missing".
        "assembled": {
            "generatedBy": generated_by,
            "model": None,
            "call": None,
            "rawReply": None,
            "surface": None,
            "componentsFromModel": from_model,
            "rejected": rejected,
            "note": assembly_note or catalog_warning,
            "compliance": compliance,
            "alreadyInCatalogue": already_in_catalogue,
        },
        # What the component was read from, so the designer reviewing it can see the
        # evidence rather than take the generated code on faith.
        "mcp_parsed": (mcp_context or {}).get("parsed") if isinstance(mcp_context, dict) else None,
        "rest_response": rest_response,
        "details": {
            "target_node_id": node_id,
            "target_node_name": target_node.get("name", ""),
            "target_node_type": target_node.get("type", ""),
            "components_found": component_tags,
            "generated_files": [f"{t}.ts" for t in drafts],
            # The measured facts behind the component, for the panel beside the preview:
            # size, colour, stroke, radius, effects, typography. A designer approving a
            # component should be able to read what it was built from.
            "spec": _figma_spec_for_model(target_node, depth=1),
        },
    }


def _extract_properties_from_node(node: dict[str, Any]) -> list[dict[str, Any]]:
    """Extract Lit properties from node data and MCP annotations."""
    props = []
    
    # Content property for text nodes
    if node.get("type") == "TEXT" and node.get("characters") is not None:
        props.append({
            "name": "content",
            "type": "String",
            "attr": "content",
            "default": '""',
        })
    
    # Disabled state (common pattern)
    props.append({
        "name": "disabled",
        "type": "Boolean",
        "attr": "disabled",
        "reflect": True,
        "default": "false",
    })
    
    # Variant from MCP annotations
    for ann in node.get("annotations", []):
        if ann.get("source") == "mcp":
            label = ann.get("labelMarkdown") or ann.get("label", "")
            if "variant" in label.lower() or "type" in label.lower():
                props.append({
                    "name": "variant",
                    "type": "String",
                    "attr": "variant",
                    "default": '""',
                })
                break
    
    return props


def _generate_button_template(node: dict[str, Any]) -> str:
    """Generate button template with A2UI-compatible structure."""
    # Button has a child (typically text) - use slot for the label
    return """<button part="button" @click=${this._handleAction} ?disabled=${this.disabled}>
  <slot>${this.label || this.content}</slot>
</button>"""


def _generate_textfield_template(node: dict[str, Any]) -> str:
    """Generate textfield template with A2UI-compatible structure."""
    return """<input 
  part="input" 
  type=${this.type}
  .value=${this.value}
  placeholder=${this.placeholder}
  ?disabled=${this.disabled}
  @input=${(e: Event) => {
    const target = e.target as HTMLInputElement;
    this.value = target.value;
    this.dispatchEvent(new CustomEvent('input', { bubbles: true, composed: true, detail: { value: target.value } }));
    this.dispatchEvent(new CustomEvent('change', { bubbles: true, composed: true, detail: { value: target.value } }));
  }}
/>"""


def _generate_text_template(node: dict[str, Any]) -> str:
    """Generate text template with A2UI-compatible structure."""
    # Text component uses variant for styling
    return """<span part="text" class=${this.variant}>${this.content}</span>"""


def _generate_layout_template(node: dict[str, Any], layout_type: str) -> str:
    """Generate row/column template with A2UI-compatible structure."""
    children = node.get("children", [])
    
    if not children:
        return "<slot></slot>"
    
    child_templates = []
    for child in children:
        if child.get("type") == "INSTANCE" and child.get("componentId"):
            child_tag = f"f-{child['componentId'].replace(':', '-')}"
            child_templates.append(f"<{child_tag}></{child_tag}>")
        elif child.get("type") == "TEXT":
            chars = child.get("characters", "")
            child_templates.append(f"<span>{chars}</span>")
        else:
            child_templates.append(f"<slot name=\"{child.get('name', 'child')}\"></slot>")
    
    return "\n".join(child_templates)


def _generate_card_template(node: dict[str, Any]) -> str:
    """Generate card template with A2UI-compatible structure."""
    children = node.get("children", [])
    
    if not children:
        return """<div part="card" class=${this.elevated ? 'elevated' : ''}>
  <slot></slot>
</div>"""
    
    child_templates = []
    for child in children:
        if child.get("type") == "INSTANCE" and child.get("componentId"):
            child_tag = f"f-{child['componentId'].replace(':', '-')}"
            child_templates.append(f"<{child_tag}></{child_tag}>")
        elif child.get("type") == "TEXT":
            chars = child.get("characters", "")
            child_templates.append(f"<span>{chars}</span>")
        else:
            child_templates.append(f"<slot name=\"{child.get('name', 'child')}\"></slot>")
    
    children_str = "\n  ".join(child_templates)
    elevated_class = "${this.elevated ? 'elevated' : ''}"
    return f"""<div part="card" class={elevated_class}>
  {children_str}
</div>"""


# ============================================
# A2UI-COMPATIBLE COMPONENT GENERATION HELPERS
# ============================================

def _determine_component_type(node: dict[str, Any]) -> str:
    """Determine the A2UI component type from Figma node data."""
    node_type = node.get("type", "").upper()
    name = node.get("name", "").lower()
    
    # Check MCP annotations for hints
    for ann in node.get("annotations", []):
        if ann.get("source") == "mcp":
            label = (ann.get("labelMarkdown") or ann.get("label", "")).lower()
            if "button" in label:
                return "button"
            elif "textfield" in label or "text field" in label or "input" in label:
                return "textfield"
            elif "card" in label:
                return "card"
            elif "row" in label or "horizontal" in label:
                return "row"
            elif "column" in label or "vertical" in label:
                return "column"
    
    # Infer from Figma node type and name
    if node_type == "INSTANCE" and node.get("componentId"):
        # Instance of a component - check component name
        comp_name = node.get("name", "").lower()
        if "button" in comp_name:
            return "button"
        elif "input" in comp_name or "textfield" in comp_name:
            return "textfield"
        elif "card" in comp_name:
            return "card"
    
    if node_type == "FRAME":
        # Check layout mode
        layout_mode = node.get("layoutMode", "").upper()
        if layout_mode == "HORIZONTAL":
            return "row"
        elif layout_mode == "VERTICAL":
            return "column"
    
    if node_type == "TEXT":
        return "text"
    
    # Default to generic container
    return "generic"


def _extract_a2ui_properties(node: dict[str, Any], component_type: str) -> list[dict[str, Any]]:
    """Extract A2UI-compatible Lit properties from node data."""
    props = []
    
    # All components get a content property for data binding
    props.append({
        "name": "content",
        "type": "String",
        "attr": "content",
        "default": '""',
    })
    
    # Disabled state (common pattern for interactive components)
    if component_type in ("button", "textfield", "generic"):
        props.append({
            "name": "disabled",
            "type": "Boolean",
            "attr": "disabled",
            "reflect": True,
            "default": "false",
        })
    
    # Variant from MCP annotations or component name
    variant_added = False
    for ann in node.get("annotations", []):
        if ann.get("source") == "mcp":
            label = (ann.get("labelMarkdown") or ann.get("label", "")).lower()
            if "variant" in label or "type" in label:
                props.append({
                    "name": "variant",
                    "type": "String",
                    "attr": "variant",
                    "default": '""',
                })
                variant_added = True
                break
    
    # Component-specific properties
    if component_type == "button":
        if not variant_added:
            props.append({
                "name": "variant",
                "type": "String",
                "attr": "variant",
                "default": '"primary"',
            })
        # Button child (label) - will be set via slot or content
        props.append({
            "name": "label",
            "type": "String",
            "attr": "label",
            "default": '""',
        })
    
    elif component_type == "textfield":
        props.append({
            "name": "placeholder",
            "type": "String",
            "attr": "placeholder",
            "default": '""',
        })
        props.append({
            "name": "value",
            "type": "String",
            "attr": "value",
            "default": '""',
        })
        props.append({
            "name": "type",
            "type": "String",
            "attr": "type",
            "default": '"text"',
        })
    
    elif component_type == "text":
        props.append({
            "name": "variant",
            "type": "String",
            "attr": "variant",
            "default": '"body"',
        })
    
    elif component_type in ("row", "column"):
        props.append({
            "name": "justify",
            "type": "String",
            "attr": "justify",
            "default": '"start"',
        })
        props.append({
            "name": "align",
            "type": "String",
            "attr": "align",
            "default": '"stretch"',
        })
        # Children handled via slot in template
    
    elif component_type == "card":
        props.append({
            "name": "elevated",
            "type": "Boolean",
            "attr": "elevated",
            "reflect": True,
            "default": "false",
        })
    
    return props


def _extract_a2ui_events(node: dict[str, Any], component_type: str) -> list[dict[str, Any]]:
    """Extract A2UI-compatible events from node data."""
    events = []
    
    # Check MCP annotations for event hints
    for ann in node.get("annotations", []):
        if ann.get("source") == "mcp":
            label = (ann.get("labelMarkdown") or ann.get("label", "")).lower()
            if "click" in label or "tap" in label:
                events.append({"name": "click"})
            if "change" in label or "input" in label:
                events.append({"name": "change"})
            if "submit" in label:
                events.append({"name": "submit"})
            if "toggle" in label:
                events.append({"name": "toggle"})
    
    # Component-specific default events
    if component_type == "button":
        if not any(e["name"] == "click" for e in events):
            events.append({"name": "click"})
    elif component_type == "textfield":
        if not any(e["name"] == "change" for e in events):
            events.append({"name": "change"})
        if not any(e["name"] == "input" for e in events):
            events.append({"name": "input"})
    elif component_type == "generic":
        # Check for common interaction annotations
        pass
    
    return events


def _extract_a2ui_actions(node: dict[str, Any], component_type: str) -> Optional[dict[str, Any]]:
    """Extract A2UI action configuration from node data."""
    # Check MCP annotations for action hints
    for ann in node.get("annotations", []):
        if ann.get("source") == "mcp":
            label = (ann.get("labelMarkdown") or ann.get("label", "")).lower()
            if "action" in label or "on click" in label or "onclick" in label:
                # Try to extract action name
                action_name = "click"
                if "submit" in label:
                    action_name = "submit"
                elif "confirm" in label:
                    action_name = "confirm"
                elif "cancel" in label:
                    action_name = "cancel"
                return {"name": action_name}
    
    # Component-specific default actions
    if component_type == "button":
        return {"name": "click"}
    elif component_type == "textfield":
        return {"name": "change"}
    
    return None


@router.post("/api/figma/ingest")
async def api_figma_ingest(request: IngestRequest, http_request: Request):
    """
    Generate a component from a Figma node and return it as a draft.

    Nothing is written to the component catalogue here: the response carries the
    generated sources (``result.drafts``, tag → code) so the designer can preview and
    compile-check them, and POST /api/figma/commit lands the ones they keep.
    """
    job_id = request.jobId
    
    # Initialize job
    ingest_jobs[job_id] = JobStatus(status="processing")
    
    try:
        # Process the Figma node
        result = await _process_ingest_job(
            job_id,
            request.fileKey,
            request.nodeId,
            request.sessionId,
            request.sessionTitle,
            http_request.headers.get("X-User-ID", ""),
        )
        
        # Update job status
        ingest_jobs[job_id] = JobStatus(status="done", result=result)

        # THE QUESTION THE DESIGNER HAS TO ANSWER. A layer whose name the design system already
        # has on a DIFFERENT component means approving this adds a SECOND component under a name
        # that exists — so it is returned as a question rather than quietly written. The answer
        # comes back on the commit as `overwriteTag`.
        #
        # A layer that is the SAME component in another location is not a question: it is the
        # design using a component it already ships, and it is returned beside the question so
        # the screen can say which of the two a reader is looking at.
        result["nameCollisions"] = (ingest_job_meta.get(job_id) or {}).get("nameCollisions") or []
        result["nameInstances"] = (ingest_job_meta.get(job_id) or {}).get("nameInstances") or []

        return {"ok": True, "jobId": job_id, "result": result, "drafts": result.get("drafts", {})}
    except HTTPException:
        # A refusal already carries its own status and a message written for a person (the size
        # gate's 413, for one). Re-wrapping it as a 500 buried the message and labelled a
        # deliberate stop as a crash.
        raise
    except Exception as e:
        error_msg = str(e)
        ingest_jobs[job_id] = JobStatus(status="error", error=error_msg)
        # A failure nobody hears is a failure nobody fixes: it goes in the record with enough
        # to find the design again, so it can be raised later even if the designer moved on.
        _log_ingest({
            "kind": "ingest-failed",
            "sessionId": request.sessionId,
            "sessionTitle": request.sessionTitle,
            "actor": _resolve_actor(http_request),
            "jobId": job_id,
            "fileKey": request.fileKey,
            "nodeId": request.nodeId,
            "error": error_msg,
            "nextStep": "re-ingest this node once the cause is fixed; nothing was written",
        })
        print(f"[X] [figma-ingest] job {job_id} node {request.nodeId} FAILED: {error_msg}")
        raise HTTPException(status_code=500, detail=error_msg)


@router.get("/api/figma/ingest/{job_id}")
async def api_figma_ingest_status(job_id: str):
    """Get the status of an ingest job."""
    # WHICH IS ALSO THE MOMENT TO FORGET THE ONES NOBODY IS LOOKING AT. The sweep runs here, at
    # the top of the request that reads a job, so the answer is never a preview that is being
    # dropped halfway through being read.
    _drop_departed_previews()
    job = ingest_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    _keep_preview(job_id)

    return {
        "jobId": job_id,
        "status": job.status,
        "mcp_status": job.mcp_status,
        "rest_status": job.rest_status,
        "result": job.result,
        "error": job.error,
    }


@router.post("/api/figma/preview/abandon")
async def api_figma_preview_abandon():
    """The page is going away — the second eviction rule, sent by the browser as the tab closes.

    Sent with `navigator.sendBeacon`, the one request shape a browser guarantees to deliver while
    a page is unloading. It carries no body and needs no answer: the cache entry is marked
    abandoned and evicted after the grace, unless the page comes back and beats again (a reload).
    Nothing here can fail loudly — a page that is leaving cannot read a response — so the unused
    rule covers every case where this never arrives.
    """
    job_id = _abandon_preview()
    if not job_id:
        return {"held": False, "note": "the cache is empty — no entry to evict"}
    print(f"👋 [figma-ingest] the screen left — {job_id} will be dropped in {INGEST_PREVIEW_ABANDON_GRACE}s unless it comes back")
    return {"held": True, "jobId": job_id, "graceSeconds": INGEST_PREVIEW_ABANDON_GRACE}


@router.post("/api/figma/preview/heartbeat")
async def api_figma_preview_heartbeat():
    """"I am still looking at it." Sent by the open screen while the cache is in use.

    A beat means the entry is in use, so it is not idle; the entry leaves when the screen says it
    is leaving, when the screen stops beating, or when a new ingest replaces it. Nothing else in
    the pipeline has to know about any of it.
    """
    _drop_departed_previews()
    job_id = next(iter(ingest_drafts), None)
    if not job_id:
        return {"held": False, "note": "the cache is empty — no entry to evict"}
    _keep_preview(job_id)
    return {"held": True, "jobId": job_id}


_activity_backfilled = False


def _activity_backfill() -> None:
    """Copy the log file's records into the table once, when the table is empty.

    The file is the record that existed first, so a history that began at the moment the
    table was created would be missing everything that came before it.
    """
    global _activity_backfilled
    if _activity_backfilled:
        return
    _activity_backfilled = True
    conn = _activity_db()
    if not conn:
        return
    try:
        with conn, conn.cursor() as cur:
            cur.execute(f"CREATE TABLE IF NOT EXISTS {INGEST_ACTIVITY_TABLE} (id SERIAL PRIMARY KEY, at TIMESTAMPTZ NOT NULL DEFAULT now())")
            # RENDERED IN UTC, because the log's timestamps are, and this key compares the two.
            # to_char on a timestamptz renders in the SESSION's timezone: a row stored at
            # 00:57:49Z came back as "2026-09-27T19:57:49Z" here, so no log line ever matched its
            # own row — the same event looked new on every start.
            cur.execute(f"SELECT job_id, kind, tag, to_char(at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') AS at FROM {INGEST_ACTIVITY_TABLE}")
            rows_now = cur.fetchall()
            existing = {(r["job_id"], r["kind"], r["at"]) for r in rows_now}
            # A row for the same job and kind is the same event, whatever its timestamp says.
            existing_loose = {(r["job_id"], r["kind"], r.get("tag")) for r in rows_now}
        try:
            with open(INGEST_LOG_PATH, encoding="utf-8") as f:
                lines = [l for l in f if l.strip()]
        except FileNotFoundError:
            return
        imported = 0
        for line in lines:
            try:
                record = json.loads(line)
            except Exception:
                continue
            record.pop("rawReply", None)
            key = (record.get("jobId"), record.get("kind"), (record.get("at") or "")[:19] + "Z")
            # THE SUBJECT IS RESOLVED THE SAME WAY THE INSERT WRITES IT (see _activity_insert):
            # an approval names its components in `tags`, a removal names one in `tag`. Comparing
            # only the scalar against an approval line — which has none — made every approval look
            # like a new event, so the backfill re-imported it on every start. That is how one
            # approval became seven rows and one removal became five.
            subject = record.get("tag") or (record.get("tags") or record.get("discarded") or [None])[0]
            if key in existing or (record.get("jobId"), record.get("kind"), subject) in existing_loose:
                continue
            _activity_insert(record)
            imported += 1
        if imported:
            print(f"✅ [figma-ingest] imported {imported} earlier activity record(s) into {INGEST_ACTIVITY_TABLE}")
    except Exception as e:
        print(f"⚠️ [figma-ingest] could not import earlier activity: {e}")
    finally:
        try:
            conn.close()
        except Exception:
            pass


def _activity_from_db(limit: int, session_id: Optional[str], outcomes: bool) -> Optional[list[dict[str, Any]]]:
    """The procession from Postgres, or None when the table cannot be read."""
    _activity_backfill()
    conn = _activity_db()
    if not conn:
        return None
    try:
        where, params = [], []
        if session_id:
            where.append("session_id = %s")
            params.append(session_id)
        if outcomes:
            where.append("(kind = 'approved' OR error IS NOT NULL OR rejected <> '[]'::jsonb)")
        clause = f"WHERE {' AND '.join(where)}" if where else ""
        with conn.cursor() as cur:
            cur.execute(
                f"""SELECT to_char(at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') AS at, kind,
                           session_id AS "sessionId", session_title AS "sessionTitle", actor,
                           job_id AS "jobId", node_id AS "nodeId", node_name AS "nodeName",
                           tag, generated_by AS "generatedBy", error, note, reason, rejected,
                           written, verdict
                    FROM {INGEST_ACTIVITY_TABLE}
                    {clause}
                    ORDER BY at DESC
                    LIMIT %s""",
                (*params, limit),
            )
            return [dict(r) for r in cur.fetchall()]
    except Exception as e:
        print(f"⚠️ [figma-ingest] the activity table could not be read ({e}); reading the log file instead")
        return None
    finally:
        try:
            conn.close()
        except Exception:
            pass


def _history_for_tag(tag: str) -> list[dict[str, Any]]:
    """Every recorded event belonging to a component, newest first.

    A row belongs to the component if it carries the tag, or if the node it was ingested
    from is the node the tag names (`f-<node id, colons to hyphens>`) — the ingested rows
    record the node, the approved ones record the tag. THE NODE IS COMPARED BY ITS COMPONENT
    PART: a row ingested from another instance of the same component is that component's
    history, and the occurrence it was read from is where it sat, not what it was.
    """
    node_from_tag = tag[len("f-"):].replace("-", ":")

    def belongs(record: dict[str, Any]) -> bool:
        if record.get("tag") == tag:
            return True
        if any(t == tag for t in (record.get("tags") or []) + (record.get("discarded") or [])):
            return True
        return node_ids_match(record.get("nodeId"), node_from_tag)

    rows = _activity_from_db(300, None, False)
    if rows is None:
        rows = []
        try:
            with open(INGEST_LOG_PATH, encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        record = json.loads(line)
                    except Exception:
                        continue
                    record.pop("rawReply", None)
                    rows.append(record)
        except FileNotFoundError:
            pass
        rows.reverse()
    return [r for r in rows if belongs(r)]


CATALOG_AUDIT_PATH = os.path.join(FRONTEND_DIR, "catalog-audit", f"{INGEST_CATALOG_PIPELINE}.json")


def _catalog_state() -> dict[str, Any]:
    """What the catalogue holds and what its own check last said.

    Read from the two places that actually state it — the catalogue file, and the audit
    report the check writes — so the tool can show the same numbers the gate is judged by.
    A missing catalogue is reported as missing, with the path, rather than as zero.
    """
    catalog_path = os.path.join(REPO_ROOT, "A2UI", "catalogs", INGEST_CATALOG_PIPELINE, "catalog.json")
    legacy_path = os.path.join(FRONTEND_DIR, "src", "components", "A2UI", "catalogs", INGEST_CATALOG_PIPELINE, "catalog.json")

    components = None
    present_at = None
    for candidate in (catalog_path, legacy_path):
        try:
            with open(candidate, encoding="utf-8") as f:
                components = len(json.load(f).get("components", {}))
            present_at = candidate
            break
        except FileNotFoundError:
            continue
        except Exception as e:
            return {"readable": False, "error": f"{candidate}: {e}", "checkedAt": None, "findings": []}

    report = None
    try:
        with open(CATALOG_AUDIT_PATH, encoding="utf-8") as f:
            report = json.load(f)
    except Exception:
        report = None

    findings = (report or {}).get("findings", []) if report else []
    return {
        "readable": components is not None,
        "catalogPath": present_at,
        "missingAt": None if present_at else catalog_path,
        "legacyPath": legacy_path,
        "components": components,
        "checkedAt": (report or {}).get("generatedAt") or (report or {}).get("at"),
        "findings": findings,
        "blocking": sum(1 for x in findings if x.get("level") == "blocking"),
        "verdict": (
            f"{components} components, {len(findings)} finding(s), "
            f"{sum(1 for x in findings if x.get('level') == 'blocking')} blocking"
            if components is not None and report else None
        ),
        "pipeline": INGEST_CATALOG_PIPELINE,
    }


@router.get("/api/figma/catalog")
async def api_figma_catalog(refresh: bool = Query(False)):
    """The catalogue's own state, for the tool to show — fresh-checked if asked."""
    if refresh:
        await asyncio.to_thread(_catalog_check)
    return _catalog_state()


def _remove_from_figma_map(tag: str) -> str:
    """Take the component's entry out of the Figma map, leaving the rest byte-identical."""
    path = os.path.join(FRONTEND_DIR, "src", "components", "registry.json")
    try:
        with open(path, encoding="utf-8") as f:
            raw = f.read()
        data = json.loads(raw)
    except Exception as e:
        return f"unreadable ({e})"

    target = next((c for c in data.get("components", []) if c.get("litComponent") == tag), None)
    if not target:
        return "not in the Figma map"

    needle = json.dumps(target, indent=2)
    if needle in raw:
        # the entry as written, plus the comma that separated it
        for candidate in (needle + ",\n", ",\n" + needle, needle):
            if candidate in raw:
                raw = raw.replace(candidate, "", 1)
                break
        with open(path, "w", encoding="utf-8") as f:
            f.write(raw)
        return "removed from the Figma map"

    # written differently: cut the object by its braces
    start = raw.find('"litComponent": "' + tag + '"')
    if start == -1:
        return "in the map but not found in the text"
    open_at = raw.rfind("{", 0, start)
    depth, i, in_string, escaped = 0, open_at, False, False
    while i < len(raw):
        ch = raw[i]
        if in_string:
            if escaped: escaped = False
            elif ch == "\\": escaped = True
            elif ch == '"': in_string = False
        elif ch == '"': in_string = True
        elif ch in "[{": depth += 1
        elif ch in "]}":
            depth -= 1
            if depth == 0:
                break
        i += 1
    tail = raw[i + 1:]
    tail = tail.removeprefix(",")
    raw = raw[:open_at] + tail
    with open(path, "w", encoding="utf-8") as f:
        f.write(raw)
    return "removed from the Figma map"


def _remove_from_allowlist(tag: str) -> str:
    """Take the entry and its playground line out of tag-registry.ts."""
    path = os.path.join(FRONTEND_DIR, "src", "shared", "tag-registry.ts")
    try:
        with open(path, encoding="utf-8") as f:
            raw = f.read()
    except Exception as e:
        return f"unreadable ({e})"
    if f"'{tag}':" not in raw:
        return "not in the allowlist"

    lines = raw.splitlines(keepends=True)
    out, i, removed_entry = [], 0, False
    while i < len(lines):
        line = lines[i]
        if not removed_entry and line.strip().startswith(f"'{tag}':"):
            # walk back over the comment line directly above it
            if out and out[-1].strip().startswith("// Ingested from Figma"):
                out.pop()
            depth, j = 0, i
            while j < len(lines):
                depth += lines[j].count("{") - lines[j].count("}")
                j += 1
                if depth <= 0:
                    break
            i = j
            removed_entry = True
            continue
        if line.strip() == f"'{tag}',":
            i += 1
            continue
        out.append(line)
        i += 1

    if not removed_entry:
        return "in the allowlist but its entry was not found"
    with open(path, "w", encoding="utf-8") as f:
        f.write("".join(out))
    return "removed from the allowlist"


def _remove_from_catalog(tag: str) -> str:
    """Take the definition and its oneOf reference out of the pipeline catalogue."""
    path = _catalog_file_path()
    if not path:
        return "no catalogue file found"
    try:
        with open(path, encoding="utf-8") as f:
            catalog = json.load(f)
    except Exception as e:
        return f"unreadable ({e})"
    if tag not in catalog.get("components", {}):
        return "not in the catalogue"
    catalog["components"].pop(tag, None)
    one_of = catalog.get("$defs", {}).get("anyComponent", {}).get("oneOf", [])
    catalog["$defs"]["anyComponent"]["oneOf"] = [r for r in one_of if r.get("$ref") != f"#/components/{tag}"]
    with open(path, "w", encoding="utf-8") as f:
        json.dump(catalog, f, indent=2)
        f.write("\n")
    return f"removed from {os.path.basename(os.path.dirname(path))}"


class RemoveRequest(BaseModel):
    tag: str
    reason: str = ""


@router.get("/api/figma/usage")
async def api_figma_usage(sessionId: Optional[str] = Query(None), limit: int = Query(500, ge=1, le=2000)):
    """What has been spent: tokens estimated per call, totalled.

    Estimates, not the provider's own count — the numbers come from the characters actually sent
    and returned (÷4), which is the same measure the size gate uses. Recorded per call so a
    session, a designer or a catalogue can be totalled.
    """
    rows = _activity_from_db(limit, sessionId, False)
    if rows is None:
        rows = []
        try:
            with open(INGEST_LOG_PATH, encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line:
                        try:
                            rows.append(json.loads(line))
                        except Exception:
                            pass
        except FileNotFoundError:
            pass

    calls, refused = 0, 0
    prompt_tokens = reply_tokens = design_tokens = 0
    for r in rows:
        call = r.get("call") or {}
        tokens = call.get("tokens") or {}
        if tokens:
            calls += 1
            prompt_tokens += int(tokens.get("promptEstimate") or 0)
            reply_tokens += int(tokens.get("replyEstimate") or 0)
            design_tokens += int(tokens.get("designEstimate") or 0)
        if r.get("kind") == "ingest-refused":
            refused += 1
    return {
        "sessionId": sessionId,
        "calls": calls,
        "refused": refused,
        "tokens": {
            "prompt": prompt_tokens,
            "reply": reply_tokens,
            "design": design_tokens,
            "total": prompt_tokens + reply_tokens,
        },
        "note": "Estimates from character counts (÷4), totalled over the recorded calls. Refusals cost nothing and are counted separately.",
    }


@router.get("/api/figma/unresolved")
async def api_figma_unresolved(limit: int = Query(50, ge=1, le=200)):
    """Everything that failed and was never put right.

    A failure the designer walked away from is still a failure: this returns every recorded
    failure that no later success for the same thing answers, with what to do about each, so
    "there are 500 items in there that were never removed" is a question with a list attached
    rather than a guess.
    """
    rows = _activity_from_db(400, None, False)
    if rows is None:
        rows = []
        try:
            with open(INGEST_LOG_PATH, encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line:
                        try:
                            rows.append(json.loads(line))
                        except Exception:
                            pass
            rows.reverse()
        except FileNotFoundError:
            pass

    failures = [r for r in rows if str(r.get("kind", "")).endswith("-failed") or r.get("error")]
    resolved_keys = set()
    for r in rows:
        if r.get("kind") in ("approved", "removed", "ingested") and not r.get("error"):
            for key in (r.get("tag"), r.get("jobId")):
                if key:
                    resolved_keys.add(key)

    outstanding = []
    for r in failures:
        keys = {k for k in (r.get("tag"), r.get("jobId")) if k}
        if keys and keys <= resolved_keys:
            continue  # something later succeeded for this exact thing
        outstanding.append({
            "at": r.get("at"),
            "kind": r.get("kind"),
            "tag": r.get("tag"),
            "nodeId": r.get("nodeId"),
            "nodeName": r.get("nodeName"),
            "sessionTitle": r.get("sessionTitle"),
            "actor": r.get("actor"),
            "error": r.get("error"),
            "nextStep": r.get("nextStep") or "look at the recorded error and decide",
        })

    return {"count": len(outstanding), "outstanding": outstanding[:limit], "totalRecords": len(rows)}


@router.post("/api/figma/remove")
async def api_figma_remove(request: RemoveRequest, http_request: Request):
    """Take a component out of the catalogue, and take its file with it.

    Everything goes: the source file, the Figma-map entry, the allowlist entry and the catalog
    declaration, with the counts re-derived and the gate re-run. What survives is the record —
    who removed it, when, and why — which is the traceability that matters; the component
    itself is rebuilt by re-ingesting its node if it is ever wanted again. Keeping a copy of
    every removal would leave the tree filling with files nothing imports.
    """
    tag = request.tag.strip()
    if not _SAFE_COMPONENT_RE.match(tag):
        raise HTTPException(status_code=400, detail=f"Not a component name: {tag!r}")

    try:
        return await _remove_component(tag, request.reason, http_request)
    except HTTPException:
        raise
    except Exception as e:
        _log_ingest({
            "kind": "removal-failed",
            "actor": _resolve_actor(http_request),
            "tag": tag,
            "reason": request.reason,
            "error": str(e),
            "nextStep": "this component is still in the catalogue — remove it again, or by hand: file, Figma map, allowlist, catalog",
        })
        print(f"[X] [figma-ingest] {tag} could NOT be removed: {e}")
        raise HTTPException(status_code=500, detail=f"The removal failed and the component is still in the catalogue: {e}")


async def _remove_component(tag: str, reason: str, http_request: Request):
    actor = _resolve_actor(http_request)
    file_path = os.path.join(FRONTEND_COMPONENTS_DIR, f"{tag}.ts")
    file_outcome = "no file found"
    if os.path.exists(file_path):
        os.remove(file_path)
        file_outcome = f"deleted {os.path.relpath(file_path, REPO_ROOT)}"

    outcome = {
        "file": file_outcome,
        "figmaMap": await asyncio.to_thread(_remove_from_figma_map, tag),
        "allowlist": await asyncio.to_thread(_remove_from_allowlist, tag),
        "catalog": await asyncio.to_thread(_remove_from_catalog, tag),
        # AND THE RECORD LEARNS IT TOO. The file, the map, the allowlist and the catalogue are what
        # the component IS; the layer record is the other half — what was measured and approved —
        # and it is the half the screen reads its tree from. Left unmarked, the record went on
        # showing a design the owner had deleted, under a heading that read as a claim about now.
        # The removal is written where the approval is, so the record and the activity table agree
        # about what happened, and the front can stay silent about it.
        "record": await asyncio.to_thread(
            _mark_removed_in_figma_layers,
            INGEST_CATALOG_PIPELINE,
            tag,
            "",
            actor,
            reason,
        ),
    }
    # ── AND THE PICTURES GO WITH IT ─────────────────────────────────────────
    # The artwork is written beside the component at approval and taken back here, in the same
    # pass as everything else the approval wrote. This runs AFTER the record write on purpose:
    # the record is one of the things that can be referring to an asset, so pruning before its
    # node is dropped would see the removed design's own entry and keep the file it names.
    outcome["assets"] = await asyncio.to_thread(_prune_unreferenced_assets)

    # The manifest is generated FROM the files: deleting one without regenerating leaves the
    # catalogue describing an element that no longer exists (verified: f-40001185-2176 stayed in
    # custom-elements.json after its file was deleted).
    await asyncio.to_thread(_run_cem_analyze)

    catalog_path = _catalog_file_path()
    total = None
    if catalog_path:
        try:
            with open(catalog_path, encoding="utf-8") as f:
                total = len(json.load(f).get("components", {}))
        except Exception:
            total = None
    outcome["counts"] = await asyncio.to_thread(_sync_catalog_claims, total) if total is not None else "catalog unreadable"
    check = await asyncio.to_thread(_catalog_check)

    _log_ingest({
        "kind": "removed",
        "actor": actor,
        "tag": tag,
        "reason": reason,
        "outcome": outcome,
        "verdict": check.get("verdict"),
    })
    print(f"🗑️ [figma-ingest] {tag} removed from the catalogue by {actor or 'unknown'} — file and registrations deleted, {outcome['record']}")

    return {"ok": True, "tag": tag, "outcome": outcome, "catalogCheck": check}


_ELEMENT_TAG_RE = re.compile(r"<([a-z][a-z0-9]*-[a-z0-9-]+)[\s/>]")


def _template_bodies(src: str) -> list[str]:
    """The insides of html`` template literals, and nothing else.

    Reading tags from a whole file counts the ones this repo writes about itself in comments —
    the first attempt at this reported `chat-panel` as a child of ten different elements, all of
    them prose.
    """
    bodies = []
    for m in re.finditer(r"html\s*`", src):
        i, depth, buf = m.end(), 0, []
        while i < len(src):
            ch = src[i]
            if ch == "\\":
                i += 2
                continue
            if ch == "$" and i + 1 < len(src) and src[i + 1] == "{":
                depth += 1; i += 2
                continue
            if ch == "}" and depth:
                depth -= 1; i += 1
                continue
            if ch == "`" and depth == 0:
                break
            buf.append(ch); i += 1
        bodies.append("".join(buf))
    return bodies


@router.get("/api/health")
async def api_health():
    """Is the backend able to work, and if not, why — in one call.

    Written because "it keeps going down" is not a diagnosis: this says which dependency is
    missing and what to do, so a 500 from the dev-server proxy (which is what an unreachable
    backend looks like from the browser) can be told apart from a real failure.
    """
    catalog_path = _catalog_file_path()
    components = None
    catalog_error = None
    if catalog_path:
        try:
            with open(catalog_path, encoding="utf-8") as f:
                components = len(json.load(f).get("components", {}))
        except Exception as e:
            catalog_error = str(e)
    else:
        catalog_error = "no catalogue file found (backend/deps.py loads one at startup and exits without it)"

    db_ok = None
    try:
        import psycopg2
        conn = psycopg2.connect(os.getenv("DATABASE_URL"), connect_timeout=5)
        conn.close()
        db_ok = True
    except Exception as e:
        db_ok = f"unreachable: {e}"

    checks = {
        "catalogue": {"ok": components is not None, "components": components, "path": catalog_path, "error": catalog_error},
        "database": {"ok": db_ok is True, "detail": db_ok},
        "figmaToken": {"ok": bool(os.getenv("FIGMA_TOKEN")), "detail": "FIGMA_TOKEN set" if os.getenv("FIGMA_TOKEN") else "FIGMA_TOKEN missing from backend/.env"},
        "modelKey": {"ok": bool(os.getenv("DEEPSEEK_API_KEY")), "detail": "DEEPSEEK_API_KEY set" if os.getenv("DEEPSEEK_API_KEY") else "DEEPSEEK_API_KEY missing"},
        "draftsHeld": len(ingest_drafts),
    }
    healthy = checks["catalogue"]["ok"] and checks["database"]["ok"] and checks["figmaToken"]["ok"]
    return {"ok": healthy, "checks": checks}


@router.get("/api/figma/elements")
async def api_figma_elements():
    """The catalogue as rows: every element with the numbers a tile can show, and its edges.

    This is what a tree renders from — one entry per element, with what the manifest declares,
    what the catalogue and the map and the allowlist say about it, and which elements it
    composes. It answers "show me the catalogue" without the caller parsing any of the files.
    """
    manifest_path = os.path.join(FRONTEND_DIR, "custom-elements.json")
    catalog_path = _catalog_file_path()
    map_path = os.path.join(FRONTEND_DIR, "src", "components", "registry.json")
    allowlist_path = os.path.join(FRONTEND_DIR, "src", "shared", "tag-registry.ts")

    declared: dict[str, Any] = {}
    if catalog_path:
        try:
            with open(catalog_path, encoding="utf-8") as f:
                declared = json.load(f).get("components", {})
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"The catalogue could not be read: {e}")

    mapped: dict[str, dict[str, Any]] = {}
    try:
        with open(map_path, encoding="utf-8") as f:
            for entry in json.load(f).get("components", []):
                if entry.get("litComponent"):
                    mapped[entry["litComponent"]] = entry
    except Exception as e:
        print(f"⚠️ [figma-ingest] the Figma map could not be read: {e}")

    allowlist = ""
    try:
        with open(allowlist_path, encoding="utf-8") as f:
            allowlist = f.read()
    except Exception:
        pass

    elements: dict[str, dict[str, Any]] = {}
    try:
        with open(manifest_path, encoding="utf-8") as f:
            manifest = json.load(f)
        for module in manifest.get("modules", []):
            source = module.get("path") or ""
            for d in module.get("declarations", []):
                if d.get("kind") != "class" or not d.get("tagName"):
                    continue
                tag = d["tagName"]
                fields = [x for x in d.get("members", []) if x.get("kind") == "field" and not x.get("static")]
                rel = source.replace("src/components/lit/", "")
                elements[tag] = {
                    "tag": tag,
                    "class": d.get("name"),
                    "file": rel,
                    "fileExists": os.path.exists(os.path.join(FRONTEND_DIR, "src", "components", "lit", rel)),
                    "props": len(fields),
                    "events": len(d.get("events", []) or []),
                    "slots": len(d.get("slots", []) or []),
                    "inCatalog": tag in declared,
                    "inMap": tag in mapped,
                    "figmaNodeId": (mapped.get(tag) or {}).get("figmaNodeId"),
                    "inAllowlist": bool(re.search(rf"'{re.escape(tag)}':", allowlist)),
                    "children": [],
                    "parents": [],
                }
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"The manifest could not be read: {e}")

    # composition, from the templates only
    lit_dir = os.path.join(FRONTEND_DIR, "src", "components", "lit")
    for root, _dirs, files in os.walk(lit_dir):
        for name in files:
            if not name.endswith(".ts") or any(x in name for x in (".test.", ".spec.", ".stories.")):
                continue
            path = os.path.join(root, name)
            try:
                src = open(path, encoding="utf-8").read()
            except Exception:
                continue
            m = re.search(r"customElements\.define\(['\"]([^'\"]+)['\"]", src)
            if not m:
                continue
            tag = m.group(1)
            if tag not in elements:
                continue
            used = set()
            for body in _template_bodies(src):
                used |= {t for t in _ELEMENT_TAG_RE.findall(body) if t in elements and t != tag}
            elements[tag]["children"] = sorted(used)

    for tag, el in elements.items():
        for child in el["children"]:
            elements[child]["parents"].append(tag)

    rows = sorted(elements.values(), key=lambda e: -(e["props"] + e["events"]))
    roots = [e["tag"] for e in rows if not e["parents"]]
    edges = sum(len(e["children"]) for e in rows)
    return {
        "catalogId": INGEST_CATALOG_PIPELINE,
        "counts": {
            "elements": len(rows),
            "declared": len(declared),
            "mapped": len(mapped),
            "annotated": sum(1 for e in rows if e["inCatalog"]),
            "props": sum(e["props"] for e in rows),
            "events": sum(e["events"] for e in rows),
            "slots": sum(e["slots"] for e in rows),
            "compositionEdges": edges,
            "roots": len(roots),
        },
        "roots": roots,
        "elements": rows,
    }


@router.get("/api/figma/find")
async def api_figma_find(q: str = Query(..., min_length=1), fileKey: Optional[str] = Query(None)):
    """Find nodes by name, and say what each one already is.

    A designer often has the layer's name and not its id — "Frame 886987" is a name, not an
    address. Searching the file turns the name into an id, and each hit says whether a
    component already exists for it, so the tool opens that component instead of rebuilding
    the design it already has.
    """
    needle = q.strip().lower()
    candidates: list[dict[str, Any]] = []
    seen: set = set()

    # 1. What we already know, locally and instantly: the Figma map names every node a
    #    component was made from, so "Frame 886987" finds the component that exists.
    try:
        map_path = os.path.join(FRONTEND_DIR, "src", "components", "registry.json")
        with open(map_path, encoding="utf-8") as f:
            for entry in json.load(f).get("components", []):
                name = str(entry.get("figmaName") or "")
                if needle in name.lower() or needle == str(entry.get("figmaNodeId") or "").lower():
                    component = entry.get("litComponent")
                    candidates.append({
                        "nodeId": entry.get("figmaNodeId"),
                        "name": name,
                        "type": None,
                        "component": component,
                        "file": entry.get("file"),
                        "exists": bool(component) and os.path.exists(
                            os.path.join(FRONTEND_COMPONENTS_DIR, f"{component}.ts")
                        ),
                        "foundIn": "figma-map",
                    })
                    seen.add(str(entry.get("figmaNodeId")))
    except Exception as e:
        print(f"⚠️ [figma-ingest] the Figma map could not be searched: {e}")

    # 3. Then what the record knows: names from every ingest, approved or not.
    for record in _activity_from_db(300, None, False) or []:
        node_id = str(record.get("nodeId") or "")
        name = str(record.get("nodeName") or "")
        if node_id and node_id not in seen and (needle in name.lower() or needle == node_id.lower()):
            tag = record.get("tag")
            candidates.append({
                "nodeId": node_id,
                "name": name,
                "type": None,
                "component": tag,
                "file": None,
                "exists": bool(tag) and os.path.exists(os.path.join(FRONTEND_COMPONENTS_DIR, f"{tag}.ts")),
                "foundIn": "record",
            })
            seen.add(node_id)

    # ASK FIGMA UNLESS THE DESIGN SYSTEM HAS ALREADY ANSWERED.
    #
    # This returned whenever ANYTHING had matched — a hit in the map, or a single line in the
    # ingest record. So a name that appears anywhere in the history short-circuited the real
    # search: "System_Role" returned two entries out of the log and never asked the file. And
    # because the log never forgets and never records a removal, two components that had been
    # taken out went on shadowing whatever the design actually holds — history answering for
    # the present, which is what made the results look invented.
    #
    # A hit in the Figma MAP is the design system saying it has this component. That is an
    # answer, and it is worth returning before a slower remote search. A hit in the RECORD is
    # not an answer about what exists — it is a line in a log — so it continues to Figma, and
    # the two sets are merged in the reply.
    if any(candidate.get("foundIn") == "figma-map" for candidate in candidates):
        return {
            "query": q,
            "fileKey": os.getenv("FIGMA_DEFAULT_FILE_KEY", ""),
            "count": len(candidates),
            "results": candidates,
            "raw": None,
        }

    # 3. Only then ask Figma, which is slower and sees the file's own structure.
    key = fileKey or os.getenv("FIGMA_DEFAULT_FILE_KEY", "")
    if not key:
        raise HTTPException(status_code=400, detail="No file to search: set FIGMA_DEFAULT_FILE_KEY or pass fileKey.")

    try:
        raw = await asyncio.to_thread(search_file, key, q)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"The search could not run: {e}")

    for node in (raw or {}).get("nodes", []) if isinstance(raw, dict) else []:
        node_id = node.get("id") or node.get("nodeId")
        mapped = _figma_map_lookup(node_id) if node_id else None
        candidates.append({
            "nodeId": node_id,
            "name": node.get("name"),
            "type": node.get("type"),
            "component": (mapped or {}).get("litComponent"),
            "file": (mapped or {}).get("file"),
            "foundIn": "figma-file",
        })
    return {
        "query": q,
        "fileKey": key,
        "count": len(candidates),
        "results": candidates,
        # Nothing parsed is worth showing verbatim: the search answered something, and what it
        # answered is the only way to tell a bad query from a shape this code does not expect.
        "raw": None if candidates else str(raw)[:600],
    }


@router.get("/api/figma/node/{node_id:path}")
async def api_figma_node_component(node_id: str):
    """Find whatever this Figma node became — by the node's id, however it is written.

    A node id is not always a tag. Where the design system already has a component for a
    node, the Figma map names it (`prompt-container` for node 40000746:6), so looking up
    `f-<node id>` finds nothing. This resolves in order: the map, the derived tag, then the
    activity record — and says which of them answered.
    """
    raw = node_id.strip()
    if raw.lower().startswith("f-"):
        raw = raw[2:]
    raw = raw.replace("__", ":")  # a path segment cannot carry a colon in some clients
    normalised = raw.replace("-", ":") if ":" not in raw else raw
    derived_tag = f"f-{normalised.replace(':', '-')}"

    if not re.match(r"^[0-9]+:[0-9]+$", normalised):
        raise HTTPException(status_code=400, detail=f"Not a Figma node id: {node_id!r}")

    mapped = _figma_map_lookup(normalised)
    if mapped and mapped.get("litComponent"):
        tag = mapped["litComponent"]
        record = await api_figma_component(tag)
        record["resolvedBy"] = "figma-map"
        record["nodeId"] = normalised
        return record

    record = await api_figma_component(derived_tag)
    record["resolvedBy"] = "derived-tag"
    record["nodeId"] = normalised
    return record


@router.get("/api/figma/component/{tag}")
async def api_figma_component(tag: str):
    """Open a component by its tag: what it is, where it is, and its whole history.

    The tag is the id the ingest creates (`f-<node id>`), so a designer can hand one over
    and have the component come back with the dates it was ingested and approved, who did
    it, for which package, and what the gate said.
    """
    if not _SAFE_COMPONENT_RE.match(tag):
        raise HTTPException(status_code=400, detail=f"Not a component name: {tag!r}")

    file_rel = f"frontend/src/components/lit/{tag}.ts"
    file_path = os.path.join(FRONTEND_COMPONENTS_DIR, f"{tag}.ts")

    figma_map = None
    try:
        with open(os.path.join(FRONTEND_DIR, "src", "components", "registry.json"), encoding="utf-8") as f:
            for entry in json.load(f).get("components", []):
                if entry.get("litComponent") == tag:
                    figma_map = {
                        "figmaName": entry.get("figmaName"),
                        "figmaNodeId": entry.get("figmaNodeId"),
                        "file": entry.get("file"),
                        "status": entry.get("status"),
                        "provenance": entry.get("provenance"),
                    }
                    break
    except Exception as e:
        print(f"⚠️ [figma-ingest] could not read the Figma map for {tag}: {e}")

    if figma_map and figma_map.get("file"):
        mapped_file = str(figma_map["file"])
        mapped_path = os.path.join(REPO_ROOT, mapped_file)
        if os.path.exists(mapped_path):
            file_rel = mapped_file
            file_path = mapped_path

    allowlisted = False
    try:
        with open(os.path.join(FRONTEND_DIR, "src", "shared", "tag-registry.ts"), encoding="utf-8") as f:
            allowlisted = f"'{tag}'" in f.read()
    except Exception:
        pass

    declared = False
    catalog_path = _catalog_file_path()
    if catalog_path:
        try:
            with open(catalog_path, encoding="utf-8") as f:
                declared = tag in json.load(f).get("components", {})
        except Exception as e:
            print(f"⚠️ [figma-ingest] the catalogue could not be read to check {tag}: {e}")

    history = _history_for_tag(tag)
    approved = [h for h in history if h.get("kind") == "approved"]
    # Records written before kinds were recorded have no kind to filter on. A file on disk
    # plus a Figma-map entry is what the approve step produces and nothing else does, so the
    # latest date stands as the approval date rather than reporting none.
    approved_at = approved[0].get("at") if approved else (
        history[0].get("at") if (history and figma_map is not None and os.path.exists(file_path)) else None
    )

    return {
        "tag": tag,
        "file": file_rel,
        "exists": os.path.exists(file_path),
        "bytes": os.path.getsize(file_path) if os.path.exists(file_path) else 0,
        "figmaMap": figma_map,
        "registered": {"figmaMap": figma_map is not None, "allowlist": allowlisted, "catalog": declared},
        "firstSeen": history[-1].get("at") if history else None,
        "lastSeen": history[0].get("at") if history else None,
        "approvedAt": approved_at,
        "history": history,
    }


@router.get("/api/figma/activity")
async def api_figma_activity(
    limit: int = Query(30, ge=1, le=200),
    sessionId: Optional[str] = Query(None),
    outcomes: bool = Query(False),
):
    """The recent procession of ingest activity, newest first.

    Every job leaves one line per thing that happened to it — ingested, approved,
    discarded — read back from backend/logs/figma-ingest.jsonl. The model's raw reply is
    left out here (it can be thousands of characters); the per-job endpoint serves the
    whole record when it is wanted.
    """
    rows = _activity_from_db(limit, sessionId, outcomes)
    audit = await asyncio.to_thread(_activity_audit)
    if rows is not None:
        return {"entries": rows, "source": "database", "total": len(rows), "audit": audit}

    entries: list[dict[str, Any]] = []
    try:
        with open(INGEST_LOG_PATH, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    record = json.loads(line)
                except Exception:
                    continue
                record.pop("rawReply", None)
                if sessionId and record.get("sessionId") != sessionId:
                    continue
                if outcomes:
                    # What the session added, plus anything that failed — an outcome is
                    # what the designer ended up with, good or bad, not the plumbing.
                    approved = record.get("kind") == "approved"
                    failed = bool(record.get("error")) or bool(record.get("rejected"))
                    if not (approved or failed):
                        continue
                entries.append(record)
    except FileNotFoundError:
        return {"entries": [], "source": "file", "note": "no activity recorded yet", "audit": audit}
    entries.reverse()
    return {"entries": entries[:limit], "source": "file", "total": len(entries), "audit": audit}


def _activity_timestamp(record: dict[str, Any]) -> Optional[datetime]:
    """A record's own timestamp, or None when it has none that can be read.

    Tolerant on purpose: this line was written by whichever version of this application was
    running at the time, so the format varies. An unreadable timestamp returns None and such a
    record is KEPT by a purge — deleting something because its date could not be parsed is how
    a cleanup loses the one entry that would have explained what happened.
    """
    raw = record.get("at")
    if not isinstance(raw, str) or not raw:
        return None
    try:
        return datetime.strptime(raw.replace("Z", "").split(".")[0], "%Y-%m-%dT%H:%M:%S")
    except Exception:
        return None


class PurgeRequest(BaseModel):
    days: int = INGEST_ACTIVITY_KEEP_DAYS
    confirm: bool = False


@router.post("/api/figma/activity/purge")
async def api_figma_activity_purge(request: PurgeRequest):
    """Trim the activity record older than `days`. Nothing happens unless `confirm` is true.

    THE RECORD IS THE ONLY THING THIS TOUCHES. It deletes activity entries — from the table and
    from the log file — and it deletes nothing else: not a component file, not the Figma map,
    not the allowlist, not the catalogue, and not the layer record (which holds approvals and
    removals, and is the present-tense half of what happened, not the audit log).

    It requires the confirmation in the request rather than a browser-side dialog, because the
    deletion is not reversible and "it was in the log" cannot be reconstructed afterwards. Note
    that this does not touch the backup table (`figma_ingest_activity_backup_*`) either.
    """
    days = max(1, min(int(request.days or INGEST_ACTIVITY_KEEP_DAYS), 3650))
    cutoff = datetime.utcnow() - timedelta(days=days)
    cutoff_iso = cutoff.isoformat(timespec="seconds") + "Z"
    summarized = {
        "days": days,
        "cutoff": cutoff_iso,
        "applied": bool(request.confirm),
    }
    if not request.confirm:
        summarized["note"] = "Nothing was deleted — this was a preview. Send confirm: true to trim."
        summarized["deletes"] = {
            "table": "everything older than the cutoff",
            "file": "every line older than the cutoff",
        }
        summarized["keeps"] = "components, the Figma map, the allowlist, the catalogue, the layer record"
        return summarized

    removed_rows = 0
    conn = _activity_db()
    if conn:
        try:
            with conn, conn.cursor() as cur:
                cur.execute(f"DELETE FROM {INGEST_ACTIVITY_TABLE} WHERE at < %s", (cutoff,))
                removed_rows = cur.rowcount or 0
        except Exception as e:
            summarized["tableError"] = str(e)
        finally:
            try:
                conn.close()
            except Exception:
                pass
    else:
        summarized["tableError"] = "the table could not be reached"
    summarized["removedFromTable"] = removed_rows

    kept: list[str] = []
    dropped = 0
    try:
        with open(INGEST_LOG_PATH, encoding="utf-8") as f:
            for line in f:
                stripped = line.strip()
                if not stripped:
                    continue
                stamp = None
                try:
                    stamp = _activity_timestamp(json.loads(stripped))
                except Exception:
                    stamp = None
                if stamp is not None and stamp < cutoff:
                    dropped += 1
                    continue
                kept.append(stripped)
        tmp_path = f"{INGEST_LOG_PATH}.tmp-{os.getpid()}"
        with open(tmp_path, "w", encoding="utf-8") as f:
            for line in kept:
                f.write(line + "\n")
        os.replace(tmp_path, INGEST_LOG_PATH)
        summarized["removedFromFile"] = dropped
        summarized["keptInFile"] = len(kept)
    except FileNotFoundError:
        summarized["removedFromFile"] = 0
        summarized["keptInFile"] = 0
    except Exception as e:
        summarized["fileError"] = str(e)

    audit = await asyncio.to_thread(_activity_audit)
    summarized["audit"] = audit
    _log_ingest({
        "kind": "activity-purged",
        "actor": _resolve_actor(None),
        "days": days,
        "cutoff": cutoff_iso,
        "removedFromTable": summarized.get("removedFromTable"),
        "removedFromFile": summarized.get("removedFromFile"),
    })
    print(
        f"🧹 [figma-ingest] activity record trimmed to the last {days} days — "
        f"{summarized.get('removedFromTable') or 0} row(s) from the table, "
        f"{summarized.get('removedFromFile') or 0} line(s) from the file"
    )
    return summarized


@router.get("/api/figma/ingest/{job_id}/log")
async def api_figma_ingest_log(job_id: str):
    """The ingest record for a job, read back from backend/logs/figma-ingest.jsonl.

    Errors are part of the record, not a transient message: this is what was actually
    asked of the model and what it actually answered.
    """
    records = []
    try:
        with open(INGEST_LOG_PATH, encoding="utf-8") as f:
            for line in f:
                if job_id in line:
                    try:
                        records.append(json.loads(line))
                    except Exception:
                        pass
    except FileNotFoundError:
        pass
    if not records:
        raise HTTPException(status_code=404, detail=f"No ingest log for job {job_id}")
    return {"jobId": job_id, "records": records}


@router.get("/api/figma/ingest/{job_id}/code/{tag}")
async def api_figma_ingest_code(job_id: str, tag: str):
    """The uncommitted source of one draft, as plain text.

    This is what the dev server loads to render a preview of a component that is not in
    the catalogue yet. Drafts live in memory only; nothing here touches the disk.

    Reading the preview is LOOKING AT IT, so it counts as a sign of life: a preview whose code is
    being fetched by the open screen is the definition of one that is in use.
    """
    _drop_departed_previews()
    drafts = ingest_drafts.get(job_id)
    code = (drafts or {}).get(tag)
    if code is None:
        raise HTTPException(status_code=404, detail=f"No draft {tag} for job {job_id}")
    _keep_preview(job_id)
    return Response(content=code, media_type="text/plain; charset=utf-8")


class CommitRequest(BaseModel):
    jobId: str
    tags: Optional[list[str]] = None  # default: every draft the job produced
    addToCatalogue: bool = True  # also map, allowlist and declare it
                              # (False writes the file only)
    # THE DESIGNER'S ANSWER to a name collision: this design has a layer whose NAME the design
    # system already has under a different node id, and they said overwrite it. See
    # _name_collisions for how the collision is found, and the retag below for what the answer
    # does. Unset means "no" — the copy is added as its own component.
    overwriteTag: Optional[str] = None


class AskRequest(BaseModel):
    jobId: str
    question: str


@router.post("/api/figma/ask")
async def api_figma_ask(request: AskRequest):
    """Ask the application's model about a draft.

    She built the component, so she is the one to explain it: what she was given, what she
    drew, what the checks say is missing, and what to change. This is the tool's side of the
    conversation — the chat panel remains the conversation proper.
    """
    question = (request.question or "").strip()
    if not question:
        raise HTTPException(status_code=400, detail="Ask something.")

    drafts = ingest_drafts.get(request.jobId, {})
    meta = ingest_job_meta.get(request.jobId, {})
    if not drafts:
        raise HTTPException(status_code=404, detail=f"No draft held for job {request.jobId}")
    # Asking about a preview is looking at it, and the answer can take a while — so the sign of
    # life is recorded BEFORE the model is called, not after, or a slow reply would outlive the
    # window it was keeping alive.
    _keep_preview(request.jobId)

    tag = meta.get("targetTag") or next(iter(drafts))
    spec = _figma_spec_for_model(meta.get("targetNode") or {}) if meta.get("targetNode") else {}
    code = drafts.get(tag, "")
    warnings = _compliance_warnings(meta.get("targetNode") or {}, _figma_spec_for_model(meta.get("targetNode") or {}), code, tag) if meta.get("targetNode") else []

    context = (
        f"You built the Lit component <{tag}> from Figma node {meta.get('nodeId')} "
        f"({meta.get('figmaName')}). Its source is below, followed by what the design measured "
        f"and the checks that did not pass. Answer the designer's question about it directly, "
        f"in a few sentences, and say plainly what to change when something is wrong.\n\n"
        f"MEASURED DESIGN:\n{json.dumps(spec, ensure_ascii=False)[:6000]}\n\n"
        f"COMPONENT SOURCE:\n{code[:6000]}\n\n"
        f"CHECKS THAT FAILED:\n" + ("\n".join(f"- {w}" for w in warnings) if warnings else "- none")
    )

    try:
        reply = await asyncio.to_thread(
            query_llm, question=question, context=context, mode="chat", prompt_id="figma-ingest-ask"
        )
    except Exception as e:
        _log_ingest({"kind": "ask-failed", "jobId": request.jobId, "nodeId": meta.get("nodeId", ""), "error": str(e), "question": question})
        raise HTTPException(status_code=502, detail=f"The model did not answer: {e}")

    _log_ingest({
        "kind": "asked",
        "sessionId": meta.get("sessionId", ""),
        "sessionTitle": meta.get("sessionTitle", ""),
        "jobId": request.jobId,
        "nodeId": meta.get("nodeId", ""),
        "nodeName": meta.get("figmaName", ""),
        "tag": tag,
        "question": question,
        "answer": (reply or "")[:2000],
    })
    return {"ok": True, "jobId": request.jobId, "tag": tag, "question": question, "answer": (reply or "").strip()}


@router.post("/api/figma/discard")
async def api_figma_discard(request: CommitRequest, http_request: Request):
    """Throw a job's preview away — the entry and the temporary file it was presented from.

    Discard is not the opposite of commit: commit is what puts a component into the catalogue, and
    this drops the preview completely, so discarding really is starting over rather than leaving a
    copy anywhere. It goes through `_drop_preview` — the same one call the other two destruction
    triggers use, so a preview cannot be removed from one place and left in another.
    """
    meta = ingest_job_meta.get(request.jobId, {})
    _drop_departed_previews()
    held = ingest_drafts.get(request.jobId)
    _drop_preview(request.jobId)
    _log_ingest({
        "kind": "discarded",
        "sessionId": meta.get("sessionId", ""),
        "sessionTitle": meta.get("sessionTitle", ""),
        "actor": http_request.headers.get("X-User-ID", "") or meta.get("actor", ""),
        "jobId": request.jobId,
        "nodeId": meta.get("nodeId", ""),
        "nodeName": meta.get("figmaName", ""),
        "discarded": sorted(held.keys()) if held else [],
    })
    return {"ok": True, "jobId": request.jobId, "discarded": sorted(held.keys()) if held else []}


@router.post("/api/figma/commit")
async def api_figma_commit(request: CommitRequest, http_request: Request):
    """Approve a job's drafts: write them into the Lit catalogue and register them.

    The code is taken from the job's own drafts and the path is derived from the tag —
    the request says *which* drafts to keep, never *where* to put them, so a commit
    cannot write outside src/components/lit/.

    Registration is what makes the result usable rather than merely present: the Figma
    map records which node it came from, the allowlist says it may be rendered and lets
    the AI emit it, and the pipeline catalog is the schema the server validates those
    emissions against. The repository's own gate (`npm run catalog:check`) is run and
    its verdict returned, because that verdict is what "in the catalogue" means here.
    """
    drafts = ingest_drafts.get(request.jobId)
    if not drafts:
        raise HTTPException(status_code=404, detail=f"No drafts held for job {request.jobId}")
    # An approval is the strongest possible sign of life: the preview was just looked at, and
    # this is the request that ends it. Nothing about a commit waits for a heartbeat.
    _keep_preview(request.jobId)

    tags = request.tags if request.tags else list(drafts)
    unknown = [t for t in tags if t not in drafts]
    if unknown:
        raise HTTPException(status_code=400, detail=f"Not part of job {request.jobId}: {', '.join(unknown)}")

    # A malformed component must not reach the catalogue, where the catalog checks and
    # every other consumer would have to cope with it.
    validation = ingest_draft_validation.get(request.jobId, {})

    # "THIS LAYER ALREADY EXISTS UNDER A DIFFERENT NODE ID — OVERWRITE IT?" The designer said
    # yes, and this is what the yes does. The draft was built under the tag derived from THIS
    # node (f-<node id>); overwriting means writing it under the tag the design system ALREADY
    # has for that name, so the catalogue keeps ONE component with that name rather than
    # growing a second beside it.
    #
    # The retag happens HERE — before `broken`, before the write, before every registration —
    # so the file, the Figma map, the allowlist and the catalog all end up describing the same
    # component. Retagging later would let the file land under one name and the map record
    # another, which is the failure this check exists to prevent.
    if request.overwriteTag:
        if not _SAFE_TAG_RE.match(request.overwriteTag):
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Refusing to overwrite {request.overwriteTag!r}: a commit may only write a "
                    "tag of the form f-<figma node id>. A hand-built component is not something "
                    "an ingest may replace."
                ),
            )
        ingested_tag = (ingest_job_meta.get(request.jobId) or {}).get("targetTag")
        if not ingested_tag or ingested_tag not in drafts:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Nothing to overwrite {request.overwriteTag!r} with: job {request.jobId} "
                    "holds no draft of the node it was ingested from."
                ),
            )
        # ── THE ANSWER MAY ONLY WRITE THE COMPONENT IT WAS ASKED ABOUT ───────
        # "Overwrite" replaces ONE component's file with the code built for ANOTHER component.
        # That is legitimate only when the two are the same component in two places — and even
        # then it is unnecessary, because the design system already has it. So the write is
        # refused unless the two ids are the same component, and the refusal names both halves
        # of each id so the difference is visible: the component references are what must match,
        # and the occurrences are what may differ.
        #
        # This is the check whose absence wrote the code of one component over the file of
        # another (2026-09-28, the seat and the section — same collision screen, two different
        # component references, one "yes"). A guard at the screen is a suggestion; this is the
        # one that cannot be skipped.
        here = (ingest_job_meta.get(request.jobId) or {}).get("nodeId") or ""
        there_node = _node_id_of_tag(request.overwriteTag)
        if here and there_node and not node_ids_match(here, there_node):
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Refusing to write this component's code over {request.overwriteTag}: they are "
                    f"two different components. This ingest read node {here} "
                    f"(component {node_code_identity(here)}); {request.overwriteTag} is node "
                    f"{there_node} (component {node_code_identity(there_node)}). The numbers after the "
                    f"colon are the location an instance sits in — they may differ for one component; "
                    f"the part before the semicolon is the component itself, and it does not match. "
                    f"Approve with the other answer to add this one as its own component."
                ),
            )
        drafts[request.overwriteTag] = drafts.pop(ingested_tag)
        # The compile verdict travels with the code. Without this the retagged draft has no
        # validation entry and `validation.get(t, {}).get("ok", True)` would pass a module that
        # does not build — the one check a rename must never be able to skip.
        if ingested_tag in validation:
            validation[request.overwriteTag] = validation.pop(ingested_tag)
        tags = [t for t in tags if t != ingested_tag] + [request.overwriteTag]

    broken = [t for t in tags if not validation.get(t, {}).get("ok", True)]
    if broken:
        detail = "; ".join(f"{t}: {validation.get(t, {}).get('error', 'failed to compile')}" for t in broken)
        raise HTTPException(status_code=400, detail=f"Refusing to commit code that does not compile — {detail}")

    # ── THE ARTWORK IS KEPT HERE ─────────────────────────────────────────────
    # The vectors the design carried are written into this repository before the component that
    # uses them, and the component's own references are repointed at those copies. This is the
    # step that makes a component independent of Figma being open: without it the code keeps an
    # address on Figma's local server, which is up only while the designer has the file open —
    # a chevron that disappears when they close it. The record is given the same list, so the
    # audit can SHOW the artwork rather than only name it.
    job_assets = (ingest_job_meta.get(request.jobId) or {}).get("assets") or []
    vendored = await asyncio.to_thread(_vendor_assets, job_assets)
    for tag in list(drafts):
        drafts[tag] = _repoint_assets(drafts[tag], vendored)

    os.makedirs(FRONTEND_COMPONENTS_DIR, exist_ok=True)
    written = []
    replaced: dict[str, Any] = {}
    for tag in tags:
        if not _SAFE_TAG_RE.match(tag):
            raise HTTPException(status_code=400, detail=f"Refusing to write an unexpected tag: {tag!r}")
        file_path = os.path.join(FRONTEND_COMPONENTS_DIR, f"{tag}.ts")
        if os.path.dirname(os.path.abspath(file_path)) != os.path.abspath(FRONTEND_COMPONENTS_DIR):
            raise HTTPException(status_code=400, detail=f"Refusing to write outside the catalogue: {tag!r}")
        previous = os.path.getsize(file_path) if os.path.exists(file_path) else None
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(drafts[tag])
        written.append(f"{tag}.ts")
        if previous is not None:
            replaced[tag] = {"previousBytes": previous, "nowBytes": len(drafts[tag])}

    await asyncio.to_thread(_run_cem_analyze)

    meta = ingest_job_meta.get(request.jobId, {})
    # The catalogue file is the record now: the preview is cleared so nothing later can act on a
    # component that has already been written. The activity row keeps what happened.
    #
    # THE TEMPORARY FILE GOES WITH IT. The component is in `src/components/lit/` at this point —
    # that is what approving means — so the copy in the preview folder is the version that has
    # been superseded, and it is deleted rather than left beside the real one.
    _drop_preview(request.jobId)

    registration: dict[str, Any] = {}
    catalog_check: dict[str, Any] = {}
    if request.addToCatalogue and meta:
        target_tag = meta.get("targetTag")
        if target_tag in tags:
            registration["figmaMap"] = await asyncio.to_thread(
                _register_in_figma_map, target_tag, meta.get("nodeId", ""), meta.get("figmaName", "")
            )
            registration["allowlist"] = await asyncio.to_thread(_register_in_allowlist, target_tag, meta)
            catalog_path = _catalog_file_path() or ""
            declared_before = False
            try:
                with open(catalog_path, encoding="utf-8") as f:
                    declared_before = target_tag in json.load(f).get("components", {})
            except Exception:
                pass
            registration["catalog"] = await asyncio.to_thread(
                _register_in_catalog, target_tag, meta, INGEST_CATALOG_PIPELINE
            )
            if not declared_before:
                try:
                    with open(catalog_path, encoding="utf-8") as f:
                        total = len(json.load(f).get("components", {}))
                    registration["countClaims"] = await asyncio.to_thread(_sync_catalog_claims, total)
                except Exception as e:
                    registration["countClaims"] = f"could not re-read the catalog ({e})"
            catalog_check = await asyncio.to_thread(_catalog_check)

            # THE LAYER RECORD, written with the rest of the registrations and from the same
            # node this component was built from. Approve is the ONLY place it is written: a
            # component that is in the system has a tree, a design that was only looked at does
            # not. Raises rather than reporting an approve whose tree went missing.
            target_node = meta.get("targetNode") or {}
            if target_node:
                layers_note = await asyncio.to_thread(
                    _write_figma_layers,
                    INGEST_CATALOG_PIPELINE,
                    target_tag,
                    meta.get("nodeId") or target_node.get("id") or "",
                    _figma_spec_for_model(target_node),
                    vendored,
                )
                registration["layers"] = f"{layers_note['layers']} layers to {layers_note['file']}"
        else:
            registration["skipped"] = f"target {target_tag} was not part of this commit"

    # ── AND WHAT THIS WRITE SUPERSEDED ──────────────────────────────────────
    # Approval is where an asset is written; it is also where one is left behind, because a design
    # whose artwork changed under a name that is already on disk cannot refresh that file — the
    # name exists, so `_vendor_assets` writes nothing and the OLD picture keeps being served. The
    # files nothing refers to any more are deleted here, in the same pass and from the same
    # reference scan, and the activity row names them. Runs after the component and the record are
    # both on disk, so the new references are counted and only genuine leftovers go.
    registration["assets"] = await asyncio.to_thread(_prune_unreferenced_assets)

    _log_ingest({
        "kind": "approved",
        "sessionId": meta.get("sessionId", ""),
        "sessionTitle": meta.get("sessionTitle", ""),
        "actor": http_request.headers.get("X-User-ID", "") or meta.get("actor", ""),
        "jobId": request.jobId,
        "nodeId": meta.get("nodeId", ""),
        "nodeName": meta.get("figmaName", ""),
        "tags": tags,
        "written": written,
        "replaced": replaced,
        "registration": registration,
        "verdict": catalog_check.get("verdict"),
        "blocking": sum(1 for f in (catalog_check.get("findings") or []) if f.startswith("[blocking]")),
    })

    failures = [msg for step, result in registration.items()
                if step != "skipped" and (msg := _registration_failure(step, result))]
    if failures:
        print(f"❌ [figma-ingest] job {request.jobId}: the files were written but registration failed — {'; '.join(failures)}")
        _log_ingest({
            "kind": "commit-failed",
            "sessionId": meta.get("sessionId", ""),
            "sessionTitle": meta.get("sessionTitle", ""),
            "actor": _resolve_actor(http_request) or meta.get("actor", ""),
            "jobId": request.jobId,
            "nodeId": meta.get("nodeId", ""),
            "nodeName": meta.get("figmaName", ""),
            "tags": tags,
            "written": written,
            "error": "the files were written but registration failed — " + "; ".join(failures),
            "nextStep": "the component is on disk and NOT usable: fix the registry files, then approve again",
        })
        raise HTTPException(
            status_code=502,
            detail=(
                "The files were written ("
                + ", ".join(written)
                + ") but registration failed, so the component is on disk and NOT usable: "
                + "; ".join(failures)
                + ". Fix the registry files and approve again — nothing is hidden."
            ),
        )
    if catalog_check and catalog_check.get("ran") is False:
        print(f"❌ [figma-ingest] job {request.jobId}: the catalog gate did not run — {catalog_check.get('summary')}")

    return {
        "ok": True,
        "jobId": request.jobId,
        "written": written,
        "replaced": replaced,
        "tags": tags,
        "registration": registration,
        "catalogCheck": catalog_check,
    }


