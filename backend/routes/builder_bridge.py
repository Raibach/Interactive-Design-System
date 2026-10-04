"""
THE BUILDER BRIDGE — the Product room's tool projects, carried to the console as cards.

WHAT THIS IS (owner, 2026-10-04): *"let's try to figure out how to incorporate those
projects, but feed them in into our database as a package … they will go on the console …
this is just a different type of card. It's a different category of card. It's a product
team card."*

THE ONE RULE THIS FILE KEEPS: the tool's database stays where it is. A builder project's
files, history and versions live in the engine (`local-vcaas/data/`); the package row here
is a REFERENCE — the project's id, its preview URL, its run count — plus the facts the
console card draws (title, description, category). Nothing is copied, so nothing can drift.

ONE WRITER, ONE ACT. The sync reads the engine's own project list (never invents a project)
and, for each one, keeps exactly one package row in step:

    a project with no package   → one is BORN here (the same `create_session` every
                                  package uses, carrying room_domain 'product' and the
                                  `builder_*` metadata keys as its birth facts)
    a project whose facts moved → the row is updated to match
    a project that is GONE      → its package row is REMOVED (delete means delete — the
                                  owner's words; `delete_session(permanent=True)`, whose
                                  dependents cascade)

ENGINE DOWN IS NOT AN ERROR HERE. The sync is best-effort by design: the console still
renders every card row that already exists, and the next assembly tries again.
"""

import json
import os
import threading

import httpx
from fastapi import APIRouter, Header

import services as state
from deps import get_user_id_from_header

router = APIRouter(prefix="/api/builder", tags=["builder"])

# ⚠️ ONE SYNC AT A TIME, PER PROCESS — A REAL RACE, MEASURED 2026-10-04. The console's
# assemble endpoint assembles on every arrival and the frontend retries, so several
# `render-console` requests can run at once; each one's sync read "no package for this
# project yet" BEFORE any of them had committed, and all of them created one. Five
# concurrent assemblies left fifteen rows for three projects. The backend runs one
# process, so a process-level lock is the whole fix: the second caller now finds the
# first caller's rows. (A DB-level partial unique index on the metadata key would also
# hold across processes, but that is a schema fact this bridge does not get to add to
# another system's table.)
_SYNC_LOCK = threading.Lock()

# The tool's engine — same machine, its own port (see ai-app-builder-open/local-vcaas/README.md).
ENGINE_URL = os.getenv("BUILDER_ENGINE_URL", "http://localhost:4000").rstrip("/")
# A sync that cannot answer in this long is skipped; the console must never wait on it.
SYNC_TIMEOUT_SECONDS = 2.5

# ── THE PRODUCT TEAM'S CATEGORY (owner, 2026-10-04: *"Add some new category … it's a card
# for product teams, and it's gonna be something that they share with design and with
# development and to be reviewed"*). The console's card colors come from the `categories`
# table joined by name — this row is what makes a product card wear its own color, with no
# change to the card element itself. NAMED "Product Team" the same day, from the owner
# looking at the cards: *"the cards have a name at the top … it should say product team"* —
# the card's top line reads this name (the grid's `header-label`), so the category's name
# and the label are ONE fact, not two.
CATEGORY_NAME = "Product Team"
CATEGORY_COLOR = "#1C2F4E"
CATEGORY_TITLE_COLOR = "#D3DF44"
CATEGORY_TEXT_COLOR = "#FFFFFF"

# ── THE PLACEHOLDER DESCRIPTION (owner, 2026-10-04: *"we need some kind of default
# description because these cards are blank if there's nothing in them … a placeholder
# description until it's replaced by the user's prompting"*, and later, pointing at the
# legacy test card's own copy: *"yes, I want to use this description"*). The SHAPE is that
# card's — a declarative sentence saying what the package is and what it exists for — with
# its specifics replaced, because its exact words name the retired drafting canvas and the
# test fixture itself. It is WRITTEN INTO THE ROW — the card stays a faithful read of its
# row (the assembler never invents card text), and the engine replaces it with the
# project's own description the moment the first prompt lands (see `runAgent`: the first
# prompt BECOMES the description).
PLACEHOLDER_DESCRIPTION = (
    "A package for the product team's sandbox: it exists so an idea can be prompted, "
    "built and reviewed end to end. Its description follows the first prompt."
)

# ── THE DEFAULT NAME FOR A NEW IDEA (owner, 2026-10-04: *"product-idea-m1r — instead say
# 'My new product idea'"*). The id stays a generated slug (it is the address); this is the
# LABEL the person reads, in the header, the splash and on the console card, until they
# rename it. One constant, so the Product tab's door and the builder's own "New project"
# agree on the words.
DEFAULT_PROJECT_LABEL = "My new product idea"


def _engine_projects() -> list[dict]:
    """The tool's own project list — read from the engine, never invented."""
    response = httpx.get(
        f"{ENGINE_URL}/api/v1/vcaas/projects",
        params={"limit": 100},
        timeout=SYNC_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    data = response.json().get("data")
    return data if isinstance(data, list) else []


def _ensure_category(cursor) -> None:
    """The category row, idempotently — the FK-free join the card's colors need."""
    cursor.execute(
        """
        INSERT INTO categories (name, color, title_color, text_color)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (name) DO NOTHING
        """,
        (CATEGORY_NAME, CATEGORY_COLOR, CATEGORY_TITLE_COLOR, CATEGORY_TEXT_COLOR),
    )


def sync_builder_packages(user_id: str) -> dict:
    """Serialize every sync through the process lock — see `_SYNC_LOCK` for the race it holds off."""
    with _SYNC_LOCK:
        return _sync_builder_packages_locked(user_id)


def _sync_builder_packages_locked(user_id: str) -> dict:
    """Bring the console's product cards in step with the tool's project list.

    Returns a small report (`created` / `updated` / `removed` / `projects`) for logs and
    for the `/api/builder/sync` caller. Never raises for an unreachable engine — callers
    treat a skipped sync as a normal event, not a failure.
    """
    api = state.prompt_sessions_api
    if not api:
        return {"ok": False, "error": "database unavailable", "created": 0, "updated": 0, "removed": 0}

    try:
        projects = _engine_projects()
    except Exception as engine_error:  # noqa: BLE001 — a stopped engine is a normal state
        print(f"[builder] engine unreachable at {ENGINE_URL} — sync skipped ({engine_error})")
        return {"ok": False, "error": "engine unreachable", "created": 0, "updated": 0, "removed": 0}

    # ── phase 1: the rows that exist, and the category they must wear ──────────────
    with api.get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SET app.current_user_id = %s", (user_id,))
        _ensure_category(cursor)
        cursor.execute(
            """
            SELECT id, metadata->>'builder_project_id' AS project_id,
                   title, description, is_archived
            FROM prompt_sessions
            WHERE user_id = %s AND metadata ? 'builder_project_id'
            """,
            (user_id,),
        )
        existing = {str(row["project_id"]): row for row in cursor.fetchall()}
        conn.commit()

    created = updated = removed = 0
    seen: set[str] = set()

    # ── phase 2: one project at a time, one connection at a time ───────────────────
    for project in projects:
        project_id = str(project.get("projectId") or "").strip()
        if not project_id:
            continue
        # THE COMMIT RULE (owner, 2026-10-04): a card exists only for a PUBLISHED project —
        # Publish is the builder's commit (the room's exit guard asks the same question), and
        # an unpublished project is the sandbox's business alone. Skipping it here also means
        # phase 3 reaps any row it once had (absent from `seen`), which is the discard path.
        if project.get("published") is False:
            continue
        seen.add(project_id)

        title = (project.get("label") or project_id).strip()
        # An unprompted project's description is empty — the placeholder keeps the card from
        # reading like a broken one, and the engine swaps in the real text after prompt #1.
        description = (project.get("description") or "").strip() or PLACEHOLDER_DESCRIPTION
        preview_url = str(project.get("previewUrl") or "")
        runs = int(project.get("runs") or 0)

        row = existing.get(project_id)
        if row is None:
            # A PROJECT WITH NO PACKAGE IS BORN IN THE TOOL'S OWN IMAGE — the same
            # create_session every package uses, with room_domain written by this act.
            session = api.create_session(
                user_id=user_id,
                title=title,
                description=description,
                room_domain="product",
                builder_project_id=project_id,
                builder_preview_url=preview_url,
                builder_runs=runs,
            )
            with api.get_db() as conn:
                cursor = conn.cursor()
                cursor.execute("SET app.current_user_id = %s", (user_id,))
                cursor.execute(
                    "UPDATE prompt_sessions SET category = %s, current_version = %s WHERE id = %s",
                    (CATEGORY_NAME, max(1, runs), session["id"]),
                )
                conn.commit()
            created += 1
            continue

        metadata = {
            "room_domain": "product",
            "builder_project_id": project_id,
            "builder_preview_url": preview_url,
            "builder_runs": str(runs),
        }
        moved = (
            row["title"] != title
            or row["description"] != description
            or bool(row["is_archived"])
        )
        with api.get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SET app.current_user_id = %s", (user_id,))
            cursor.execute(
                """
                UPDATE prompt_sessions
                SET title = %s, description = %s, category = %s,
                    current_version = %s, is_archived = FALSE,
                    metadata = COALESCE(metadata, '{}'::jsonb) || %s::jsonb,
                    updated_at = NOW()
                WHERE id = %s AND user_id = %s
                """,
                (
                    title, description, CATEGORY_NAME, max(1, runs),
                    json.dumps(metadata), row["id"], user_id,
                ),
            )
            conn.commit()
        if moved:
            updated += 1

    # ── phase 3: a project that no longer exists removes its card ─────────────────
    for project_id, row in existing.items():
        if project_id in seen:
            continue
        if api.delete_session(str(row["id"]), user_id, permanent=True):
            removed += 1

    report = {
        "ok": True,
        "created": created,
        "updated": updated,
        "removed": removed,
        "projects": len(seen),
        "engine": ENGINE_URL,
    }
    if created or updated or removed:
        print(f"[builder] sync: {report}")
    return report


# ────────────────────────────────────────────────────────────────────────────────
#  THE TWO ROUTES — health (the room's banner reads it) and sync (a manual door).
# ────────────────────────────────────────────────────────────────────────────────


@router.get("/health")
def builder_health() -> dict:
    """Is the tool's engine up? The Product room shows a plain banner when it is not."""
    try:
        response = httpx.get(f"{ENGINE_URL}/health", timeout=1.5)
        payload = response.json() if response.status_code == 200 else None
        return {"ok": response.status_code == 200, "engine": ENGINE_URL, "detail": payload}
    except Exception as error:  # noqa: BLE001 — "down" is the answer
        return {"ok": False, "engine": ENGINE_URL, "error": str(error)}


@router.post("/sync")
def builder_sync(x_user_id: str | None = Header(None, alias="X-User-ID")) -> dict:
    """Bring the product cards in step on demand (the console also syncs on assembly)."""
    user_id = get_user_id_from_header(x_user_id)
    return sync_builder_packages(user_id)


@router.post("/new")
def builder_new_project() -> dict:
    """A NEW PROJECT, BORN ON THE PRODUCT TAB'S CLICK (owner, 2026-10-04): *"when I click
    product just create a new project … this is the same function as composer."* And the
    same evening's rule about where the room may land: *"basically we never want to see the
    applications dashboard ever."*

    THE ENGINE IS THE WRITER — this only carries the request; the project exists the moment
    the engine answers, and the console's next assembly turns it into a card (`sync` above).
    The base ID is fixed (`product-idea`): the engine deduplicates it into `product-idea-xxxx`,
    so a row of ideas reads as a row, not as noise. AND THE DEFAULT NAME IS HUMAN (owner,
    2026-10-04: *"product-idea-m1r — instead say 'My new product idea'"*): the label rides the
    same call, so the header, the splash and the console card read "My new product idea" until
    the person renames it (the Rename field, or the platform's own label PATCH).
    """
    try:
        response = httpx.post(
            f"{ENGINE_URL}/api/v1/vcaas/projects",
            json={"projectId": "product-idea", "label": DEFAULT_PROJECT_LABEL},
            timeout=SYNC_TIMEOUT_SECONDS,
        )
        payload = response.json()
        data = payload.get("data") or {}
        project_id = data.get("projectId")
        if response.status_code == 200 and project_id:
            return {"ok": True, "project_id": project_id, "engine": ENGINE_URL}
        return {
            "ok": False,
            "error": ((payload.get("errors") or {}).get("errorMessage")) or "the engine refused",
        }
    except Exception as error:  # noqa: BLE001 — "down" is the answer, and the room says so
        print(f"[builder] engine unreachable at {ENGINE_URL} — could not create a project ({error})")
        return {"ok": False, "error": "engine unreachable"}


def delete_builder_project(project_id: str) -> dict:
    """Delete a project IN THE TOOL — the console card's delete cascades here.

    THE LAW THIS SERVES (owner, 2026-10-04: *"I deleted product team cards from the console
    … they came back"*): a builder-backed card and its project are ONE thing wearing two
    doors. Deleting the card without the project is what made the card come back — the next
    sync finds a living project with no row and faithfully puts the card back. So the card's
    delete removes the project FIRST, and a project it cannot remove keeps its card (the
    refusal is named at the route, never silent).
    """
    try:
        response = httpx.delete(
            f"{ENGINE_URL}/api/v1/vcaas/projects/{project_id}",
            timeout=SYNC_TIMEOUT_SECONDS,
        )
        payload = response.json()
        if response.status_code == 200 and not payload.get("errors"):
            return {"ok": True}
        return {
            "ok": False,
            "error": ((payload.get("errors") or {}).get("errorMessage")) or f"HTTP {response.status_code}",
        }
    except Exception as error:  # noqa: BLE001 — "down" is the answer
        print(f"[builder] engine unreachable at {ENGINE_URL} — could not delete project {project_id} ({error})")
        return {"ok": False, "error": "engine unreachable"}


# ────────────────────────────────────────────────────────────────────────────────
#  PUBLISHING, AND THE ROOM'S EXIT GUARD (owner, 2026-10-04: *"you should probably ask the
#  user if they try to exit … without saving their project if they want to save it or not …
#  it's called publish at the top, that would publish it to the [console]"* — and, asked
#  what "don't save" should do: DISCARD it.)
# ────────────────────────────────────────────────────────────────────────────────


@router.get("/state")
def builder_project_state(project_id: str) -> dict:
    """What the room's exit guard needs about one project: is it published, and has anyone
    done anything here (a blank project is discarded in silence; work gets the question)."""
    try:
        response = httpx.get(
            f"{ENGINE_URL}/api/v1/vcaas/projects/{project_id}", timeout=SYNC_TIMEOUT_SECONDS
        )
        payload = response.json()
        data = payload.get("data") or {}
        if response.status_code == 200 and data:
            return {
                "ok": True,
                "project_id": project_id,
                # ABSENT IS PUBLISHED — the engine's own rule (`publishedOf`): projects born
                # before publishing existed keep their cards.
                "published": data.get("published") is not False,
                "has_work": bool(data.get("hasWork")),
            }
        return {
            "ok": False,
            "error": ((payload.get("errors") or {}).get("errorMessage")) or "unknown project",
        }
    except Exception as error:  # noqa: BLE001 — "down" is the answer
        return {"ok": False, "error": f"engine unreachable: {error}"}


@router.post("/publish")
def builder_publish(
    payload: dict,
    x_user_id: str | None = Header(None, alias="X-User-ID"),
) -> dict:
    """PUBLISH AN IDEA TO THE CONSOLE — flag it in the engine, then sync so its card exists
    NOW rather than at the next console assembly. This is the room's exit guard's "yes"."""
    project_id = str((payload or {}).get("project_id") or "").strip()
    if not project_id:
        return {"ok": False, "error": "project_id is required"}
    try:
        response = httpx.post(
            f"{ENGINE_URL}/api/v1/vcaas/projects/{project_id}/publish",
            timeout=SYNC_TIMEOUT_SECONDS,
        )
        engine_payload = response.json()
        if response.status_code != 200 or engine_payload.get("errors"):
            return {
                "ok": False,
                "error": ((engine_payload.get("errors") or {}).get("errorMessage")) or f"HTTP {response.status_code}",
            }
    except Exception as error:  # noqa: BLE001 — "down" is the answer
        print(f"[builder] engine unreachable at {ENGINE_URL} — could not publish {project_id} ({error})")
        return {"ok": False, "error": "engine unreachable"}
    sync = sync_builder_packages(get_user_id_from_header(x_user_id))
    return {"ok": True, "project_id": project_id, "card": sync}


@router.post("/discard")
def builder_discard(payload: dict) -> dict:
    """DISCARD AN IDEA — the exit guard's "no" (the owner chose DISCARD for "don't save").
    It is the same act as deleting the card's project (`delete_builder_project`): the idea
    was never a package, so there is no row to remove — the project is the whole thing."""
    project_id = str((payload or {}).get("project_id") or "").strip()
    if not project_id:
        return {"ok": False, "error": "project_id is required"}
    return delete_builder_project(project_id)
