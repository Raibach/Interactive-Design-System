"""Shared dependencies: config constants, A2UI catalog, and helper functions.
Extracted from main.py during modularization — zero behavior change."""
import json
import os
import sys
from typing import Any

from fastapi import HTTPException

# ── Role-based access stubs ────────────────────────────────────────────
# NOTE: Role-based access gated via user_is_admin() stub (dev mode allows all)
ADMIN_ROLES = os.getenv("ADMIN_USER_IDS", "").split(",") if os.getenv("ADMIN_USER_IDS") else []
DEFAULT_USER_ID = os.getenv("DEFAULT_USER_ID", "00000000-0000-0000-0000-000000000001")

# Path to the reasoning trace JSON log consumed by /api/reasoning/trace
REASONING_TRACE_PATH = os.getenv(
    "REASONING_TRACE_PATH",
    os.path.join(os.path.dirname(__file__), "logs", "reasoning_trace.json"),
)

# ── A2UI v0.9.1 Trusted Component Catalogs — ONE PER SURFACE ───────────
# Zero-trust: every updateComponents payload emitted by this server is
# validated against the catalog BEFORE reaching the client. A component
# that is not in the catalog is a server bug and fails loud (503).
#
# ONE CATALOGUE PER SURFACE, since 2026-09-30. The Composer and the Design
# experience are two experiences in one shell, and a component valid in one is
# not automatically valid in the other — so the gate is chosen BY THE SURFACE
# the payload is for, and either catalogue can gain or lose a name without
# touching the other's gate. The owner: *"they have to be entered in both
# places… they have to be entered in composer, and then they have to be
# re-entered into the design."*
#
# THE COMPOSER'S STAYS THE DEFAULT, so every pre-existing call site keeps the
# gate it always had: `validate_a2ui_components(components)` behaves exactly as
# before, and a caller that wants another surface's gate NAMES that surface.
# The two files carry the same 56 names today, and that is not redundancy to be
# tidied away — it is the point of the second place. They are expected to
# diverge as Design gets its own components.
_A2UI_CATALOGS_DIR = os.path.join(
    os.path.dirname(__file__), "..", "frontend", "src", "components", "A2UI", "catalogs",
)

# The surfaces that have a catalogue, by the name the surface is known by.
A2UI_CATALOG_SURFACES = ("prompt-composer", "design-artifacts")
DEFAULT_A2UI_SURFACE = "prompt-composer"

a2ui_catalogs: dict[str, dict[str, Any]] = {}


def _load_a2ui_catalog(surface: str) -> dict[str, Any]:
    """One catalogue, loaded from its file. A missing file is fatal, not a warning.

    The gate cannot be optional: a server that validates against nothing passes
    everything, which is how an unreadable catalogue becomes a silently
    permissive one.
    """
    path = os.path.join(_A2UI_CATALOGS_DIR, surface, "catalog.json")
    try:
        with open(path) as catalog_file:
            catalog = json.load(catalog_file)
    except Exception as catalog_error:
        print(
            f"❌ CRITICAL: A2UI component catalog failed to load from {path}: {catalog_error}",
            file=sys.stderr,
        )
        sys.exit(1)
    print(
        f"✅ A2UI Catalog [{surface}] loaded — "
        f"{len(catalog.get('components', {}))} trusted components"
    )
    return catalog


for _surface in A2UI_CATALOG_SURFACES:
    a2ui_catalogs[_surface] = _load_a2ui_catalog(_surface)

# The default catalogue, under the two names the rest of the server already
# reads. Unchanged values — this is the Composer's, exactly as before.
a2ui_catalog: dict[str, Any] = a2ui_catalogs[DEFAULT_A2UI_SURFACE]
A2UI_CATALOG_ID = (
    a2ui_catalog.get("catalogId")
    or "https://raibach.net/a2ui/catalogs/prompt-composer/v0_9_1/catalog.json"
)


def a2ui_catalog_for(surface: str | None = None) -> dict[str, Any]:
    """The catalogue a surface validates against.

    An unknown surface FALLS BACK rather than raising: the surface is named by
    an intent string that arrived over HTTP, and a 503 about an unknown
    CATALOGUE would be indistinguishable to a client from a 503 about an
    unknown COMPONENT — two different repairs behind one status code. The
    fallback is the Composer's, which is the gate that was always there.
    """
    return a2ui_catalogs.get(surface or DEFAULT_A2UI_SURFACE, a2ui_catalog)


def a2ui_catalog_id(surface: str | None = None) -> str:
    """The `catalogId` a surface's createSurface declares — read from ITS catalogue.

    A surface that drew its frame from one catalogue and announced another would
    be lying about where its names come from, and the client resolves names
    against its own tables (`tag-registry.ts`), so the announcement is how the
    two halves are kept honest.
    """
    return a2ui_catalog_for(surface).get("catalogId", A2UI_CATALOG_ID)


def validate_a2ui_components(
    components: list[dict[str, Any]], surface: str | None = None
) -> None:
    """
    Zero-trust validation of an updateComponents payload against the catalog.

    Implements the spec's prompt → generate → validate loop contract
    (READ-ME/IMPLEMENTATION_CONFORMANCE.md §1 — Standard validation error format):
    any component whose type is not registered in the trusted catalog is rejected
    with VALIDATION_FAILED.
    Raises HTTPException(503) — never passes invalid UI to the client.

    `surface` selects WHICH catalogue gates this payload (A2UI_CATALOG_SURFACES
    above). Omitted or unknown, it is the Composer's.
    """
    catalog = a2ui_catalog_for(surface)
    catalog_name = catalog.get("title") or surface or DEFAULT_A2UI_SURFACE
    allowed = set(catalog.get("components", {}).keys())
    for index, comp in enumerate(components):
        if not comp.get("id"):
            detail = {
                "error": {
                    "code": "VALIDATION_FAILED",
                    "surfaceId": "main",
                    "path": f"/components/{index}/id",
                    "message": "Component is missing the required 'id' field",
                }
            }
            print(f"❌ [A2UI VALIDATION FAILED] {detail}", file=sys.stderr)
            raise HTTPException(status_code=503, detail=detail)
        name = comp.get("component")
        if name not in allowed:
            detail = {
                "error": {
                    "code": "VALIDATION_FAILED",
                    "surfaceId": "main",
                    "path": f"/components/{index}/component",
                    "message": (
                        f"Component '{name}' is not in the trusted catalog ({catalog_name}). "
                        f"If it belongs to this surface, add it there — the catalog is the gate, "
                        f"so a name that is not in it is a server bug and not a client problem."
                    ),
                }
            }
            print(f"❌ [A2UI VALIDATION FAILED] {detail}", file=sys.stderr)
            raise HTTPException(status_code=503, detail=detail)

def user_is_admin(user_id: str) -> bool:
    """Stub: check if user has admin privileges. Replace with DB lookup."""
    if not ADMIN_ROLES:
        return True  # No roles configured — allow all (dev mode)
    return user_id in ADMIN_ROLES


def get_user_id_from_header(x_user_id: str | None = None) -> str:
    """Get user ID from header or use default placeholder"""
    # NOTE: Auth uses X-User-ID header; falls back to DEFAULT_USER_ID env var
    if x_user_id:
        return x_user_id
    # For now, use a default user ID (will be replaced with real auth)
    return os.getenv("DEFAULT_USER_ID", "00000000-0000-0000-0000-000000000001")
