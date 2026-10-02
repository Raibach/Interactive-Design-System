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

# ── Demo mode (2026-10-02) ─────────────────────────────────────────────
# The DEPLOYED demo service sets DEMO_MODE=1: this module pins every request to
# DEMO_USER_ID, demo_policy.py locks the surface, and seed_demo_data.py owns the
# sandbox rows. Local runs never set it and behave exactly as before.
DEMO_MODE = os.getenv("DEMO_MODE", "0") == "1"
DEMO_USER_ID = os.getenv("DEMO_USER_ID", "00000000-0000-0000-0000-000000000002")

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

# The surfaces that have a catalogue, by the name the surface is known by — READ FROM THE
# DIRECTORY, not from a list typed here. See the note on the loader below for why.
DEFAULT_A2UI_SURFACE = "prompt-composer"

# ── THE CATALOGUES ARE RESOLVED AT ASK-TIME, NOT AT BOOT ────────────────────────────────────────
#
# WHAT THIS WAS, AND WHY IT CHANGED (2026-10-02). The map was built ONCE at import, over a
# hardcoded tuple of two surface names. That made it a STARTUP SNAPSHOT, and it had two costs,
# both measured: a partition created while the server runs — the whole point of the design-system
# ingest — was invisible until a restart; and two partitions that have existed all along
# (`ecommerce`, `primitives`) were invisible even then, because nobody had typed their names into
# the tuple. A directory that holds a `catalog.json` IS a catalogue now. Nothing is named twice.
#
# WHAT DID NOT CHANGE, deliberately: the DEFAULT stays the Composer's and is still loaded at BOOT —
# fatal if unreadable, because a server that validates against nothing passes everything; an
# unknown SURFACE still falls back to the default (the reason is on `a2ui_catalog_for` below); and
# a catalogue that cannot be read RAISES where it is used, with the file named, so a partition
# broken at runtime fails the request that asked for it instead of taking the server down with it.
_CATALOG_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}
_REGISTRY_CACHE: dict[str, tuple[float, dict[str, str]]] = {}


def a2ui_registry_for(system: str) -> dict[str, str]:
    """A DESIGN SYSTEM'S TAG MAP — the data half of the resolver, one per partition.

    `registry.json` sits beside `catalog.json` and maps a component NAME to a custom-element TAG.
    It is DATA on purpose: a `registry.ts` written while the server runs is a file the browser can
    never import — the bundle was built long before — so the mapping is FETCHED and consulted at
    runtime, never compiled (wireframe-lab/ADD-A-DESIGN-SYSTEM.md §6).

    A partition with no `registry.json` maps NOTHING, and that is a real answer rather than an
    error: it means no component of this system has an implementation yet, and the drafting canvas
    draws each name it cannot resolve as the refusal its tile already carries. A file that EXISTS
    and cannot be read RAISES, with the path named — a broken map must never read as "no components".
    """
    path = os.path.join(_A2UI_CATALOGS_DIR, system, "registry.json")
    try:
        mtime = os.path.getmtime(path)
    except OSError:
        return {}
    cached = _REGISTRY_CACHE.get(system)
    if cached and cached[0] == mtime:
        return cached[1]
    try:
        with open(path) as registry_file:
            data = json.load(registry_file)
    except Exception as registry_error:
        raise ValueError(
            f"registry '{system}' failed to load from {path}: {registry_error}"
        ) from registry_error
    mapping = data.get("components") if isinstance(data, dict) else None
    if not isinstance(mapping, dict):
        raise ValueError(
            f"registry '{system}' at {path} has no 'components' object "
            "(the shape is {\"components\": {\"Name\": \"tag-name\", ...}})"
        )
    _REGISTRY_CACHE[system] = (mtime, mapping)
    return mapping


def _catalog_path(surface: str) -> str:
    return os.path.join(_A2UI_CATALOGS_DIR, surface, "catalog.json")


def a2ui_catalog_surfaces() -> list[str]:
    """The partitions that exist RIGHT NOW — each is a directory holding a `catalog.json`.

    A directory scan, so a partition created a second ago is a partition. Sorted, so the answer is
    deterministic and a listing of it reads the same twice.
    """
    try:
        entries = os.listdir(_A2UI_CATALOGS_DIR)
    except OSError as list_error:
        raise RuntimeError(
            f"the catalogues directory cannot be read ({_A2UI_CATALOGS_DIR}): {list_error}"
        ) from list_error
    return sorted(name for name in entries if os.path.isfile(_catalog_path(name)))


def _load_a2ui_catalog(surface: str) -> dict[str, Any]:
    """One catalogue, re-read when its file changes. RAISES on failure — it does not exit.

    The mtime is the cache key: a person editing a catalogue, or an ingest writing one, is seen on
    the next ask; an unchanged file is read once. An empty catalogue RAISES for the same reason the
    prompt vocabulary is loud on one — a gate that holds no names passes everything, silently.
    """
    path = _catalog_path(surface)
    try:
        mtime = os.path.getmtime(path)
    except OSError as missing:
        raise FileNotFoundError(
            f"no catalogue for '{surface}' at {path}: {missing}"
        ) from missing
    cached = _CATALOG_CACHE.get(surface)
    if cached and cached[0] == mtime:
        return cached[1]
    try:
        with open(path) as catalog_file:
            catalog = json.load(catalog_file)
    except Exception as catalog_error:
        raise ValueError(
            f"catalogue '{surface}' failed to load from {path}: {catalog_error}"
        ) from catalog_error
    if not catalog.get("components"):
        raise ValueError(f"catalogue '{surface}' at {path} declares no components")
    _CATALOG_CACHE[surface] = (mtime, catalog)
    return catalog


# THE DEFAULT, AT BOOT, FATAL IF UNREADABLE — the one catalogue the server may not start without.
try:
    a2ui_catalog: dict[str, Any] = _load_a2ui_catalog(DEFAULT_A2UI_SURFACE)
except Exception as boot_error:  # noqa: BLE001 — the reason is printed, then the server stops
    print(f"❌ CRITICAL: {boot_error}", file=sys.stderr)
    sys.exit(1)
print(
    f"✅ A2UI Catalog [{DEFAULT_A2UI_SURFACE}] loaded — "
    f"{len(a2ui_catalog.get('components', {}))} trusted components"
)
print(f"🔎 A2UI partitions on disk: {', '.join(a2ui_catalog_surfaces())}")
A2UI_CATALOG_ID = (
    a2ui_catalog.get("catalogId")
    or "https://raibach.net/a2ui/catalogs/prompt-composer/v0_9_1/catalog.json"
)


def a2ui_catalog_for(surface: str | None = None, system: str | None = None) -> dict[str, Any]:
    """The catalogue that gates a payload: the PACKAGE's chosen system, else the surface's.

    `system` is the per-package design-system fact (`design_system_of` below) — the partition a
    person chose for this package. IT IS LOUD: a chosen system whose partition does not exist
    raises, naming the system and the directory, because a package that asked for one design system
    and was silently assembled against the Composer's vocabulary is the kind of quiet substitution
    this repository hunts.

    An unknown surface FALLS BACK rather than raising: the surface is named by
    an intent string that arrived over HTTP, and a 503 about an unknown
    CATALOGUE would be indistinguishable to a client from a 503 about an
    unknown COMPONENT — two different repairs behind one status code. The
    fallback is the Composer's, which is the gate that was always there.
    """
    if system:
        if system not in a2ui_catalog_surfaces():
            raise ValueError(
                f"this package chose the design system '{system}', and there is no catalogue for "
                f"it under {_A2UI_CATALOGS_DIR} — a package cannot be assembled against a "
                "vocabulary that does not exist"
            )
        return _load_a2ui_catalog(system)
    if surface and surface in a2ui_catalog_surfaces():
        return _load_a2ui_catalog(surface)
    return a2ui_catalog


def design_system_of(session: dict[str, Any] | None) -> str | None:
    """A PACKAGE'S CHOSEN DESIGN SYSTEM — the fact the picker writes and the assembler reads.

    It lives in the session's own `metadata` (jsonb; no migration): the key is `design_system`,
    written when a person chooses one for the package. ABSENT IS A REAL ANSWER — it means this
    package never chose, and the surface's own catalogue gates it, exactly as before the fact
    existed. Nothing here invents a default: the caller that needs a system asks for one.
    """
    if not session:
        return None
    metadata = session.get("metadata") or {}
    if not isinstance(metadata, dict):
        return None
    value = metadata.get("design_system")
    return str(value) if value else None


def a2ui_catalog_id(surface: str | None = None, system: str | None = None) -> str:
    """The `catalogId` a surface's createSurface declares — read from ITS catalogue.

    A surface that drew its frame from one catalogue and announced another would be
    lying about where its names come from, and the client resolves names against
    its own tables (`tag-registry.ts`), so the announcement is how the
    two halves are kept honest.
    """
    return a2ui_catalog_for(surface, system).get("catalogId", A2UI_CATALOG_ID)


def validate_a2ui_components(
    components: list[dict[str, Any]], surface: str | None = None, system: str | None = None
) -> None:
    """
    Zero-trust validation of an updateComponents payload against the catalog.

    Implements the spec's prompt → generate → validate loop contract
    (READ-ME/IMPLEMENTATION_CONFORMANCE.md §1 — Standard validation error format):
    any component whose type is not registered in the trusted catalog is rejected
    with VALIDATION_FAILED.
    Raises HTTPException(503) — never passes invalid UI to the client.

    `surface` selects WHICH catalogue gates this payload (the partitions on disk,
    by name). Omitted or unknown, it is the Composer's. `system` is the PACKAGE's
    chosen design system and WINS when given — a draft assembled for a package that
    chose one must be gated by that partition, not by the surface's.
    """
    catalog = a2ui_catalog_for(surface, system)
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
    """Get user ID from header or use default placeholder.

    ── THE DEMO PINS IDENTITY HERE ────────────────────────────────────────────
    When DEMO_MODE=1, every request resolves to DEMO_USER_ID and X-User-ID is
    IGNORED — not validated, ignored. The deployed demo is one shared sandbox
    identity; trusting a client-supplied id would let any visitor send the
    owner's UUID and walk past `demo_policy`. This is also the one place that
    repairs /api/teacher/query: it calls this function with no argument
    (teacher.py), so without the pin every demo chat turn would be written as
    the owner. Local runs leave DEMO_MODE unset and take the paths below.
    """
    if DEMO_MODE:
        return DEMO_USER_ID
    if x_user_id:
        return x_user_id
    # For now, use a default user ID (will be replaced with real auth)
    return DEFAULT_USER_ID
