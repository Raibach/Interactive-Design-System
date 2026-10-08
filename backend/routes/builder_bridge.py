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
import time

import httpx
from fastapi import APIRouter, Header, Request
from fastapi.responses import JSONResponse

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
        # ── THE COMMIT RULE, AMENDED 2026-10-06. The owner confirmed the package model: a
        #    project's package PERSISTS like a Composer package, and its conversations are the
        #    person's return visits — "five different edit processes over a month to one
        #    project … capture all of that history inside of that project." So an unpublished
        #    project is KEPT, not reaped: the row joins `seen` (phase 3 no longer deletes it)
        #    and wears the same mark every not-ready package wears — `draft`, which the
        #    console's card read already hides (`metadata->>'draft' IS NULL`) — plus a plain
        #    `builder_unpublished` flag so the state is legible. A card still exists only for
        #    a PUBLISHED project: publish is the builder's commit (the room's exit guard asks
        #    the same question), and discard — the project really gone from the engine —
        #    still reaps through phase 3.
        if project.get("published") is False:
            seen.add(project_id)
            unpublished_row = existing.get(project_id)
            if unpublished_row is None:
                # No row to stamp. A project born in the room no longer lands here — its row
                # is stamped HELD at birth (`builder_holding`, see `builder_room_open`); this
                # skip is for projects born through other doors (the tool's own), which
                # persist when someone keeps or publishes them.
                continue
            with api.get_db() as conn:
                cursor = conn.cursor()
                cursor.execute("SET app.current_user_id = %s", (user_id,))
                cursor.execute(
                    "UPDATE prompt_sessions "
                    "SET is_archived = FALSE, "
                    "    metadata = COALESCE(metadata, '{}'::jsonb) || %s::jsonb "
                    "WHERE id = %s AND user_id = %s",
                    (json.dumps({"draft": "true", "builder_unpublished": "true"}), unpublished_row["id"], user_id),
                )
                conn.commit()
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
        # PUBLISHED: THE CARD SHOWS — the holding and draft/unpublished marks come off with
        # the same write that keeps the card's fields in step (publishing is the commit).
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
                    metadata = (COALESCE(metadata, '{}'::jsonb) - 'draft' - 'builder_unpublished' - 'builder_holding') || %s::jsonb,
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


@router.post("/projects/{project_id}/keep")
def builder_project_keep(project_id: str, x_user_id: str | None = Header(None, alias="X-User-ID")) -> dict:
    """SAVE AS DRAFT — settle a held project into the person's packages (owner, 2026-10-06:
    *"You must save this before we can continue or offer them a saved draft option."*).

    THE HOLD ENDS HERE: `builder_holding` comes off the row and the same `draft` +
    `builder_unpublished` marks every not-ready package wears stay on — the console keeps
    hiding it (cards are for published work), while the package, its conversations and its
    return visits persist like every kept package. A project with no row yet (born before
    holding existed, or entered through another door) is given its row now, settled.
    Idempotent by construction: settling twice is settling once. The engine is read
    best-effort for the row's birth facts and is NOT required — saving must not fail because
    the tool is down.
    """
    user_id = get_user_id_from_header(x_user_id)
    api = state.prompt_sessions_api
    if not api:
        return {"ok": False, "error": "database unavailable"}

    label = DEFAULT_PROJECT_LABEL
    preview_url = ""
    runs = 0
    try:
        for project in _engine_projects():
            if str(project.get("projectId")) == project_id:
                label = (project.get("label") or "").strip() or label
                preview_url = str(project.get("previewUrl") or "")
                runs = int(project.get("runs") or 0)
                break
    except Exception as engine_error:  # noqa: BLE001 — the row does not need the engine
        print(f"[builder] keep: engine list not read ({engine_error})")

    with _ROOM_LOCK:  # the room ensure's own lock — the same row, the same shape of race
        with api.get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SET app.current_user_id = %s", (user_id,))
            cursor.execute(
                "SELECT id FROM prompt_sessions "
                "WHERE user_id = %s AND metadata->>'builder_project_id' = %s",
                (user_id, project_id),
            )
            row = cursor.fetchone()
            if row:
                cursor.execute(
                    "UPDATE prompt_sessions SET "
                    "metadata = COALESCE(metadata, '{}'::jsonb) - 'builder_holding', "
                    "updated_at = NOW() WHERE id = %s",
                    (str(row["id"]),),
                )
                conn.commit()
                return {"ok": True, "project_id": project_id, "session_id": str(row["id"]), "created": False}

        session = api.create_session(
            user_id=user_id,
            title=label,
            description=PLACEHOLDER_DESCRIPTION,
            room_domain="product",
            builder_project_id=project_id,
            builder_preview_url=preview_url,
            builder_runs=runs,
        )
        session_id = str(session["id"])
        with api.get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SET app.current_user_id = %s", (user_id,))
            _ensure_category(cursor)
            cursor.execute(
                "UPDATE prompt_sessions SET category = %s, current_version = %s, "
                "metadata = COALESCE(metadata, '{}'::jsonb) || "
                "'{\"draft\": \"true\", \"builder_unpublished\": \"true\"}'::jsonb "
                "WHERE id = %s",
                (CATEGORY_NAME, max(1, runs), session_id),
            )
            conn.commit()
    return {"ok": True, "project_id": project_id, "session_id": session_id, "created": True}


@router.post("/discard")
def builder_discard(
    payload: dict,
    x_user_id: str | None = Header(None, alias="X-User-ID"),
) -> dict:
    """DISCARD AN IDEA — the exit guard's "no" (the owner chose DISCARD for "don't save").

    It is the same act as deleting the card's project (`delete_builder_project`), AND the
    carrier row goes with it (2026-10-06 — measured live: the discard deleted the project
    but left the held row behind, so the next room entry RESUMED the deleted project and
    the tool drew its "Project not found" page; the owner: *"when you delete the project
    it should just load a blank project. It shouldn't be loading that page at all."*). The
    row existed to carry the conversation — with the idea discarded there is nothing left
    for it to carry. A project the engine cannot remove KEEPS its row, the same rule as
    every cleanup in this file: the next entry retries rather than losing the pointer.
    """
    project_id = str((payload or {}).get("project_id") or "").strip()
    if not project_id:
        return {"ok": False, "error": "project_id is required"}
    result = delete_builder_project(project_id)
    if not result.get("ok"):
        return result
    user_id = get_user_id_from_header(x_user_id)
    api = state.prompt_sessions_api
    if api:
        with _ROOM_LOCK:
            with api.get_db() as conn:
                cursor = conn.cursor()
                cursor.execute("SET app.current_user_id = %s", (user_id,))
                cursor.execute(
                    "SELECT id FROM prompt_sessions "
                    "WHERE user_id = %s AND metadata->>'builder_project_id' = %s",
                    (user_id, project_id),
                )
                rows = cursor.fetchall()
            for row in rows:
                api.delete_session(str(row["id"]), user_id, permanent=True)
    return result


# ── THE ROOM'S SEAT — THE CONVERSATION IS THE PROJECT'S (2026-10-06) ──────────────────────────
#
# THE ABSORPTION (owner, 2026-10-06: *"I want to absorb that chat into our chat … I don't want
# two different chat setting side-by-side"*). The Product room's <chat-panel> seat draws THE
# BUILDER PROJECT'S conversation and sends into the engine. The platform row + conversation are
# the room's CARRIER — identity for the seat's own guards — and never the transcript: the engine
# stays the record, the same ONE RULE as everything else in this file. A carrier may carry an
# un-published project; the sync reaps un-published rows the same as it always has (cards are for
# published work), and the next room entry re-ensures a carrier — nothing of substance can be
# lost with it, because nothing of substance lives in it.

# How long a seated turn waits for its build before answering with an honest failure. The
# engine's own runs land in seconds locally; the cap exists so a wedged run cannot hold the
# browser's request open forever.
RUN_WAIT_SECONDS = 150.0

# After the run's status flips off 'init', the engine may still be WRITING the final messages
# in the same tick — measured 2026-10-06: status 'done' and the builder's sentence both stamped
# 15:42:25.349, and a read that beat the write answered 'finished without a written reply' while
# the build had in fact finished. This grace window re-reads for the sentence before saying no.
SAY_GRACE_SECONDS = 12.0

# The engine's progress slips — written about itself, never a reply. Spelled out so the say can
# be told apart from them by its words alone: the say shares their `messageType` ('building'),
# so the type is not a discriminator.
_ENGINE_PROGRESS = (
    "Starting a new run…",
    "Writing the app…",
)


def _engine_say(status: dict, prompt: str) -> str | None:
    """The builder's sentence for THIS turn, or None while it has not been written yet.

    TWO MEASURED FACTS SHAPE THIS (2026-10-06, product-idea-nxu):

    1. The engine's model speaks as author `"agent"` — not `"assistant"` (the first seated
       run answered 'finished without a written reply' while this conversation held the
       sentence, because the read looked for the wrong author).
    2. The reply is scoped to THIS prompt: candidates are the messages AFTER the last user
       message equal to the prompt. That keeps a stale `done` status (read before the new
       run begins) from answering with the PREVIOUS run's sentence.
    """
    conversation = status.get("realtimeConversation") or []
    last_user_index = None
    for index, message in enumerate(conversation):
        if str(message.get("author")) == "user" and str(message.get("message") or "").strip() == prompt:
            last_user_index = index
    if last_user_index is None:
        return None
    for message in reversed(conversation[last_user_index + 1 :]):
        if str(message.get("author")) == "user":
            continue
        content = str(message.get("message") or "").strip()
        if not content or content in _ENGINE_PROGRESS:
            continue
        if str(message.get("messageType")) == "finished":
            continue  # "Finished in 29s." — the engine's log line, not the builder
        return content
    return None


# The default names a conversation wears until it is spoken in — ours at creation, the
# seat's own for a person's "new conversation" click ('New Chat', 'Untitled Prompt').
_DEFAULT_CONVERSATION_TITLES = (DEFAULT_PROJECT_LABEL, "New Chat", "Untitled Prompt", "")


def _label_default_conversation(user_id: str, conversation_id: str | None, prompt: str) -> None:
    """Give a default-named conversation its first prompt as a label — best-effort, PRODUCT-ONLY.

    Owner, 2026-10-06: *"they may have five different edit processes over a month to one
    project."* Each return visit is a conversation, and a list of "My new product idea" rows
    tells the person nothing. The first prompt says what the visit was about — the engine's own
    convention for descriptions, mirrored for the list the person actually reads. Only the
    DEFAULT is replaced; a title someone set is never touched. Scoped to conversations under a
    builder-backed package, so no other room's conversations can ever be relabeled here.
    """
    api = state.prompt_sessions_api
    if not api or not conversation_id:
        return
    excerpt = " ".join(str(prompt or "").split())[:60].strip()
    if not excerpt:
        return
    try:
        with api.get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SET app.current_user_id = %s", (user_id,))
            cursor.execute(
                """
                UPDATE conversations SET title = %s, updated_at = NOW()
                WHERE id = %s
                  AND COALESCE(BTRIM(title), '') IN %s
                  AND session_id IN (
                      SELECT id FROM prompt_sessions
                      WHERE user_id = %s AND metadata ? 'builder_project_id'
                  )
                """,
                (excerpt, conversation_id, _DEFAULT_CONVERSATION_TITLES, user_id),
            )
            conn.commit()
    except Exception as error:  # noqa: BLE001 — labeling is best-effort; the run is not
        print(f"[builder] conversation label skipped ({error})")


def resolve_builder_project_id(user_id: str, session_id: str | None, conversation_id: str | None) -> str | None:
    """The builder project a seat conversation belongs to, or None — never a guess."""
    api = state.prompt_sessions_api
    if not api:
        return None
    try:
        with api.get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SET app.current_user_id = %s", (user_id,))
            if session_id:
                cursor.execute(
                    "SELECT metadata->>'builder_project_id' AS pid FROM prompt_sessions WHERE id = %s AND user_id = %s",
                    (session_id, user_id),
                )
                row = cursor.fetchone()
                if row and row["pid"]:
                    return str(row["pid"])
            if conversation_id:
                cursor.execute(
                    "SELECT metadata->>'builder_project_id' AS pid FROM prompt_sessions WHERE conversation_id = %s AND user_id = %s",
                    (conversation_id, user_id),
                )
                row = cursor.fetchone()
                if row and row["pid"]:
                    return str(row["pid"])
    except Exception as error:  # noqa: BLE001 — "not a builder turn" is the answer
        print(f"[builder] room check failed ({error})")
    return None


def _engine_conversation(project_id: str):
    """The engine's live conversation + status, or None when the engine cannot answer."""
    try:
        payload = httpx.get(f"{ENGINE_URL}/api/v1/vcaas/projects/{project_id}/agent/status", timeout=5).json()
        return payload.get("data") or None
    except Exception:  # noqa: BLE001 — None is the answer, the caller says so
        return None


def builder_turn_reply(user_id, session_id, conversation_id, question):
    """A seated turn in a builder conversation IS a build.

    Returns the teacher-shaped reply (`{"conversation_id", "content"}` — or `"error"` when the
    run cannot land) or None when this conversation is not a builder's — the caller then falls
    through to Grace exactly as before. This is the one wire the seat sends on; the branch lives
    beside it in routes/teacher.py.
    """
    project_id = resolve_builder_project_id(user_id, session_id, conversation_id)
    if not project_id:
        return None
    prompt = str(question or "").strip()
    if not prompt:
        return {"conversation_id": conversation_id, "error": "The turn was empty — nothing was sent to the builder."}
    # THE RETURN VISIT NAMES ITSELF (owner, 2026-10-06: "five different edit processes over a
    # month to one project"). A conversation still wearing its default name takes the first
    # prompt as its label; a titled one is never touched. See the helper for the scoping.
    _label_default_conversation(user_id, conversation_id, prompt)
    try:
        response = httpx.post(
            f"{ENGINE_URL}/api/v1/vcaas/projects/{project_id}/agent/start",
            json={"prompt": prompt},
            timeout=8.0,
        )
        body = response.json()
        started = bool((body.get("data") or {}).get("started"))
        if not started:
            refusal = ((body.get("errors") or {}).get("errorMessage")) or "the engine refused the run"
            return {"conversation_id": conversation_id, "error": refusal}
    except Exception as error:  # noqa: BLE001 — down is an answer the person can read
        print(f"[builder] engine unreachable — seated run for {project_id} ({error})")
        return {"conversation_id": conversation_id, "error": "The builder engine is unreachable — the turn was not sent."}

    print(f"[builder] seated run: {project_id} · {prompt[:60]!r}")
    deadline = time.time() + RUN_WAIT_SECONDS
    say = None
    while time.time() < deadline:
        status = _engine_conversation(project_id)
        if status is not None and str(status.get("status")) != "init":
            say = _engine_say(status, prompt)
            if say is None:
                # The flip and the sentence share a tick (see SAY_GRACE_SECONDS): re-read
                # for the write instead of answering with a failure the engine never gave.
                grace_deadline = time.time() + SAY_GRACE_SECONDS
                while say is None and time.time() < grace_deadline:
                    time.sleep(0.6)
                    status = _engine_conversation(project_id)
                    if status is not None:
                        say = _engine_say(status, prompt)
            break
        time.sleep(1.2)
    if say is None:
        return {
            "conversation_id": conversation_id,
            "error": "The build did not finish, or finished without a written reply — open the builder to see why.",
        }
    return {"conversation_id": conversation_id, "content": say}


# ONE ENSURE AT A TIME, PER PROCESS — the same fix as _SYNC_LOCK, for the same shape of race.
# The room's entry effect runs TWICE in dev (React StrictMode double-mounts), and both calls
# read `conversation_id IS NULL` before either wrote — measured live 2026-10-06: one fresh
# project's carrier showed '2 Conversations', the second conversation empty. With the lock, the
# second caller waits and then finds the first caller's pointer.
_ROOM_LOCK = threading.Lock()


@router.post("/projects/{project_id}/room")
def builder_project_room(project_id: str, x_user_id: str | None = Header(None, alias="X-User-ID")) -> dict:
    """ENSURE THE ROOM'S CARRIER — the package row and conversation the seat's guards need.

    Returns the ids the ROOM binds (`session_id`, `conversation_id`) and the project's label.
    Creating one is idempotent: an existing row (published or not) is used as it stands, and
    the ensure is serialized (`_ROOM_LOCK`) so concurrent entries cannot each create one.
    """
    user_id = get_user_id_from_header(x_user_id)
    api = state.prompt_sessions_api
    if not api:
        return {"ok": False, "error": "database unavailable"}

    label = DEFAULT_PROJECT_LABEL
    engine_label: str | None = None
    preview_url = ""
    runs = 0
    published_flag: bool | None = None
    try:
        for project in _engine_projects():
            if str(project.get("projectId")) == project_id:
                engine_label = (project.get("label") or "").strip() or None
                if engine_label:
                    label = engine_label
                preview_url = str(project.get("previewUrl") or "")
                runs = int(project.get("runs") or 0)
                published_flag = project.get("published") is not False
                break
    except Exception as engine_error:  # noqa: BLE001 — the carrier does not need the engine
        print(f"[builder] room: engine list not read ({engine_error})")

    with _ROOM_LOCK:
        session_id = None
        conversation_id = None
        with api.get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SET app.current_user_id = %s", (user_id,))
            cursor.execute(
                "SELECT id, conversation_id, title FROM prompt_sessions "
                "WHERE user_id = %s AND metadata->>'builder_project_id' = %s",
                (user_id, project_id),
            )
            row = cursor.fetchone()
            if row:
                session_id = str(row["id"])
                conversation_id = str(row["conversation_id"]) if row["conversation_id"] else None
                # THE ENGINE'S LABEL IS THE NAME (2026-10-06 — the owner's confirmed package
                # model). The builder page's rename field writes the engine label; the rename
                # route below writes both; so the ROOM prefers the engine's label and keeps
                # the package title in step here — one name for the header, the card and the
                # tool. The package title remains the fallback when the engine cannot answer.
                if not engine_label and row["title"]:
                    label = str(row["title"])
                if engine_label and str(row["title"] or "") != engine_label:
                    cursor.execute(
                        "UPDATE prompt_sessions SET title = %s, updated_at = NOW() WHERE id = %s",
                        (engine_label, session_id),
                    )
                    conn.commit()

        if session_id is None:
            session = api.create_session(
                user_id=user_id,
                title=label,
                description=PLACEHOLDER_DESCRIPTION,
                room_domain="product",
                builder_project_id=project_id,
                builder_preview_url=preview_url,
                builder_runs=runs,
            )
            session_id = str(session["id"])
            with api.get_db() as conn:
                cursor = conn.cursor()
                cursor.execute("SET app.current_user_id = %s", (user_id,))
                _ensure_category(cursor)
                # A CARRIER BORN FOR AN UNPUBLISHED PROJECT WEARS THE HIDDEN MARKS AT BIRTH —
                # `draft` + `builder_unpublished`, the sync's own vocabulary (cards are for
                # published work; the Development room's birth set the pattern). Unknown (the
                # engine was down or the project absent from its list) wears them too: the
                # next sync strips them if the project turns out published — a hidden row
                # self-heals, a wrong card would not.
                stamp = (
                    {"draft": "true", "builder_unpublished": "true"}
                    if published_flag is not True
                    else {}
                )
                cursor.execute(
                    "UPDATE prompt_sessions SET category = %s, current_version = %s, "
                    "metadata = COALESCE(metadata, '{}'::jsonb) || %s::jsonb WHERE id = %s",
                    (CATEGORY_NAME, max(1, runs), json.dumps(stamp), session_id),
                )
                # create_session births the conversation too — read the row's own back (see
                # the full note in `builder_room_open`); the explicit create below fires only
                # for a row that somehow has none.
                cursor.execute(
                    "SELECT conversation_id FROM prompt_sessions WHERE id = %s", (session_id,)
                )
                fresh = cursor.fetchone()
                if fresh and fresh["conversation_id"]:
                    conversation_id = str(fresh["conversation_id"])
                conn.commit()

        if not conversation_id:
            if not state.conversation_api:
                return {"ok": False, "error": "database unavailable"}
            conversation_id = str(
                state.conversation_api.create_conversation(
                    user_id,
                    project_id=None,
                    title=label,
                    metadata=None,
                    session_id=session_id,
                )
            )
            with api.get_db() as conn:
                cursor = conn.cursor()
                cursor.execute("SET app.current_user_id = %s", (user_id,))
                cursor.execute(
                    "UPDATE prompt_sessions SET conversation_id = %s WHERE id = %s",
                    (conversation_id, session_id),
                )
                conn.commit()

    return {"ok": True, "session_id": session_id, "conversation_id": conversation_id, "label": label}


@router.post("/room")
def builder_room_open(x_user_id: str | None = Header(None, alias="X-User-ID")) -> dict:
    """OPEN THE PRODUCT ROOM — REOPEN THE HELD PROJECT, OR BIRTH A NEW ONE.

    Clicking Product is CREATING A NEW PROJECT/PACKAGE (owner, 2026-10-06: *"that's what
    you're doing when you click on … product tab … you're creating a new project. Which or a
    new package."*) — a fresh project is born here, and it is born HELD: its package row
    exists from the first moment (the room's chat needs a package and a conversation to have
    context under — *"it might be necessary for them to create a temporary draft package in
    order to have context"*), wearing the hidden marks, with `builder_holding` as the
    unsettled flag the exit guard resolves — *"it's going to be in a holding position until
    the user navigates away or they click publish"*: save-as-draft settles it in place,
    publish makes it a card, discard takes it away.

    The ONE case this does not birth: a HELD project with work already done in it — a reload,
    a restored tab, a browser that closed mid-experiment. That project is reopened (owner,
    2026-10-06: *"entering is coming back, not starting over"*). A held project with NO work
    is noise (an untouched room's reload) and is discarded in silence before the new one is
    born. Published packages are never resumed here — their door is the console card.

    Returns `{ok, session_id, conversation_id, project_id, label, resumed}`.
    """
    user_id = get_user_id_from_header(x_user_id)
    api = state.prompt_sessions_api
    if not api:
        return {"ok": False, "error": "database unavailable"}

    # THE HELD PROJECT, IF ANY — one at a time in every real flow, because every exit resolves
    # it (save-as-draft / publish / discard). Only `builder_holding` rows count for a click: a
    # settled package is never auto-reopened here, and published ones never are (their door is
    # the console card).
    with _ROOM_LOCK:
        with api.get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SET app.current_user_id = %s", (user_id,))
            cursor.execute(
                """
                SELECT s.id, s.title, s.conversation_id,
                       s.metadata->>'builder_project_id' AS project_id
                FROM prompt_sessions s
                WHERE s.user_id = %s
                  AND s.metadata->>'builder_project_id' IS NOT NULL
                  AND s.metadata->>'builder_holding' = 'true'
                ORDER BY s.created_at DESC, s.updated_at DESC
                LIMIT 1
                """,
                (user_id,),
            )
            row = cursor.fetchone()

    if row and row["project_id"]:
        project_id = str(row["project_id"])
        # DOES THE HELD PROJECT HAVE WORK? The engine's own fact (`hasWork`: files, versions,
        # or any spoken message — its own comment: *"even if the build failed"*). On doubt —
        # engine down, project absent from its list — treat it as WORK: reopening is the
        # direction that never destroys anything, and the exit guard asks again when the
        # engine can answer.
        held_has_work = True
        project_gone = False
        try:
            response = httpx.get(
                f"{ENGINE_URL}/api/v1/vcaas/projects/{project_id}", timeout=SYNC_TIMEOUT_SECONDS
            )
            payload = response.json()
            data = payload.get("data") or {}
            if response.status_code == 200 and data:
                held_has_work = bool(data.get("hasWork"))
            else:
                # THE ENGINE ANSWERED — AND THE PROJECT IS NOT THERE (2026-10-06, the
                # owner's discard: a held row outlived its project, the next entry
                # "resumed" it, and the tool drew "Project not found" instead of a blank
                # room). NOT doubt: the engine spoke, and it said the project is gone —
                # the row is a stale carrier to settle below, and the birth that follows
                # makes the fresh blank project the owner asked for.
                held_has_work = False
                project_gone = True
        except Exception as engine_error:  # noqa: BLE001 — resume on doubt
            print(f"[builder] room: engine not read — a held project stays held ({engine_error})")

        if held_has_work:
            # COMING BACK (owner, 2026-10-06: *"entering is coming back, not starting over"*).
            with _ROOM_LOCK:
                session_id = str(row["id"])
                label = str(row["title"] or DEFAULT_PROJECT_LABEL)
                conversation_id = str(row["conversation_id"]) if row["conversation_id"] else None
                if not conversation_id:
                    if not state.conversation_api:
                        return {"ok": False, "error": "database unavailable"}
                    conversation_id = str(
                        state.conversation_api.create_conversation(
                            user_id,
                            project_id=None,
                            title=label,
                            metadata=None,
                            session_id=session_id,
                        )
                    )
                    with api.get_db() as conn:
                        cursor = conn.cursor()
                        cursor.execute("SET app.current_user_id = %s", (user_id,))
                        cursor.execute(
                            "UPDATE prompt_sessions SET conversation_id = %s WHERE id = %s",
                            (conversation_id, session_id),
                        )
                        conn.commit()
                return {
                    "ok": True,
                    "session_id": session_id,
                    "conversation_id": conversation_id,
                    "project_id": project_id,
                    "label": label,
                    "resumed": True,
                }

        # A HELD PROJECT WITH NOTHING IN IT IS NOISE — the untouched room's own reload. The
        # person never did anything here (*"nothing's happened yet"*), so it is discarded in
        # silence, exactly as the exit guard does for a blank project, and the click births
        # the new one below. The project goes FIRST (this file's one law); a project the
        # engine cannot remove keeps its row and is retried at the next entry.
        if project_gone:
            # ALREADY GONE — NOTHING TO DELETE IN THE ENGINE. Settle the stale row in
            # silence and fall through to the birth (see `project_gone` above).
            api.delete_session(str(row["id"]), user_id, permanent=True)
        else:
            cleanup = delete_builder_project(project_id)
            if cleanup.get("ok"):
                api.delete_session(str(row["id"]), user_id, permanent=True)
            else:
                print(
                    f"[builder] room: blank held project {project_id} not discarded "
                    f"({cleanup.get('error')}) — its row stays for the next try"
                )

    # NO PROJECT YET — birth the first one, in the tool's own image (the same act as the tab's
    # first click ever was). The engine is the writer; a stopped engine is the room's banner.
    born = builder_new_project()
    if not born.get("ok") or not born.get("project_id"):
        return {"ok": False, "error": born.get("error") or "the engine refused"}
    project_id = str(born["project_id"])

    with _ROOM_LOCK:
        session = api.create_session(
            user_id=user_id,
            title=DEFAULT_PROJECT_LABEL,
            description=PLACEHOLDER_DESCRIPTION,
            room_domain="product",
            builder_project_id=project_id,
        )
        session_id = str(session["id"])
        with api.get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SET app.current_user_id = %s", (user_id,))
            _ensure_category(cursor)
            # THE PROJECT IS BORN HELD — the row exists from its first moment (the room's
            # chat needs a package and a conversation to have context under; THE HOLDING
            # POSITION, owner, 2026-10-06), wearing the hidden marks every not-ready package
            # wears, plus `builder_holding` — the unsettled flag the exit guard resolves with
            # save-as-draft / publish / discard.
            cursor.execute(
                "UPDATE prompt_sessions SET category = %s, "
                "metadata = COALESCE(metadata, '{}'::jsonb) || "
                "'{\"draft\": \"true\", \"builder_unpublished\": \"true\", \"builder_holding\": \"true\"}'::jsonb "
                "WHERE id = %s",
                (CATEGORY_NAME, session_id),
            )
            # create_session BIRTHS THE CONVERSATION TOO — its DB function inserts the session
            # AND its conversation in one act (measured 2026-10-06, after two conversations
            # 10ms apart appeared under one session; `create_prompt_session`'s source was
            # read — session INSERT, then conversations INSERT on the session FK). The room's
            # own explicit create here used to fire on top of the built-in one, orphaning it;
            # that was latent while this path rarely ran, and the holding model made birth
            # the every-click path. Read the row's own conversation back and create one
            # explicitly ONLY when it has none.
            cursor.execute(
                "SELECT conversation_id FROM prompt_sessions WHERE id = %s", (session_id,)
            )
            fresh = cursor.fetchone()
            conn.commit()
        conversation_id = str(fresh["conversation_id"]) if fresh and fresh["conversation_id"] else None
        if not conversation_id:
            if not state.conversation_api:
                return {"ok": False, "error": "database unavailable"}
            conversation_id = str(
                state.conversation_api.create_conversation(
                    user_id,
                    project_id=None,
                    title=DEFAULT_PROJECT_LABEL,
                    metadata=None,
                    session_id=session_id,
                )
            )
            with api.get_db() as conn:
                cursor = conn.cursor()
                cursor.execute("SET app.current_user_id = %s", (user_id,))
                cursor.execute(
                    "UPDATE prompt_sessions SET conversation_id = %s WHERE id = %s",
                    (conversation_id, session_id),
                )
                conn.commit()
    return {
        "ok": True,
        "session_id": session_id,
        "conversation_id": conversation_id,
        "project_id": project_id,
        "label": DEFAULT_PROJECT_LABEL,
        "resumed": False,
    }


@router.post("/projects/{project_id}/rename")
def builder_project_rename(
    project_id: str,
    payload: dict,
    x_user_id: str | None = Header(None, alias="X-User-ID"),
) -> dict:
    """RENAME A PROJECT — ONE NAME, WRITTEN TO BOTH HOMES.

    The project's name lives in two places by design: the tool's label (the engine) and the
    platform's package title (the console card, the room's header). Renaming writes the ENGINE
    first (it is the tool's own field) and the package second; the room's entry read keeps the
    pair in step the same direction (engine → package), so they cannot drift. Trimmed, and
    empty is refused — a project without a name is a defect, not a state.
    """
    user_id = get_user_id_from_header(x_user_id)
    name = str((payload or {}).get("name") or "").strip()
    if not name:
        return {"ok": False, "error": "a name is required"}
    if len(name) > 120:
        name = name[:120]
    try:
        response = httpx.patch(
            f"{ENGINE_URL}/api/v1/vcaas/projects/{project_id}",
            json={"label": name},
            timeout=SYNC_TIMEOUT_SECONDS,
        )
        body = response.json()
        if response.status_code != 200 or (body.get("errors")):
            return {
                "ok": False,
                "error": ((body.get("errors") or {}).get("errorMessage")) or f"HTTP {response.status_code}",
            }
    except Exception as error:  # noqa: BLE001 — down is the answer
        print(f"[builder] engine unreachable — could not rename {project_id} ({error})")
        return {"ok": False, "error": "engine unreachable"}
    api = state.prompt_sessions_api
    if api:
        with api.get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SET app.current_user_id = %s", (user_id,))
            cursor.execute(
                "UPDATE prompt_sessions SET title = %s, updated_at = NOW() "
                "WHERE user_id = %s AND metadata->>'builder_project_id' = %s",
                (name, user_id, project_id),
            )
            conn.commit()
    return {"ok": True, "project_id": project_id, "name": name}


@router.post("/development/room")
def builder_development_room(x_user_id: str | None = Header(None, alias="X-User-ID")) -> dict:
    """ENSURE THE DEVELOPMENT ROOM'S OWN PACKAGE — its own chat, never another room's.

    Owner, 2026-10-06: *"developers are going to have a package, they're gonna have chats
    related to the conversation ID … development processes that are [not] shared … only for
    development,"* after watching the room borrow the Composer's (then Product's) seat:
    *"It doesn't seem to own its own chat … un-bind those."* This is the room's identity
    door: one package per user (marked `dev_room`), one conversation ensured under it — the
    same package/conversation shape every room keeps, scoped to Development alone. The row
    wears `draft` so it never surfaces as a console card.
    """
    user_id = get_user_id_from_header(x_user_id)
    api = state.prompt_sessions_api
    if not api:
        return {"ok": False, "error": "database unavailable"}
    label = "Development"

    with _ROOM_LOCK:
        session_id = None
        conversation_id = None
        with api.get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SET app.current_user_id = %s", (user_id,))
            cursor.execute(
                "SELECT id, conversation_id, title FROM prompt_sessions "
                "WHERE user_id = %s AND metadata->>'dev_room' = 'true' "
                "ORDER BY created_at ASC LIMIT 1",
                (user_id,),
            )
            row = cursor.fetchone()
            if row:
                session_id = str(row["id"])
                conversation_id = str(row["conversation_id"]) if row["conversation_id"] else None
                if row["title"]:
                    label = str(row["title"])

        if session_id is None:
            if not state.conversation_api:
                return {"ok": False, "error": "database unavailable"}
            session = api.create_session(
                user_id=user_id,
                title=label,
                description="The development team's room \u2014 its own package and conversations.",
                room_domain="development",
            )
            session_id = str(session["id"])
            with api.get_db() as conn:
                cursor = conn.cursor()
                cursor.execute("SET app.current_user_id = %s", (user_id,))
                cursor.execute(
                    "UPDATE prompt_sessions SET metadata = COALESCE(metadata, '{}'::jsonb) || %s::jsonb WHERE id = %s",
                    (json.dumps({"dev_room": "true", "draft": "true"}), session_id),
                )
                # create_session births the conversation too — read the row's own back (see
                # the full note in `builder_room_open`); the explicit create below fires only
                # for a row that somehow has none.
                cursor.execute(
                    "SELECT conversation_id FROM prompt_sessions WHERE id = %s", (session_id,)
                )
                fresh = cursor.fetchone()
                if fresh and fresh["conversation_id"]:
                    conversation_id = str(fresh["conversation_id"])
                conn.commit()

        if not conversation_id:
            if not state.conversation_api:
                return {"ok": False, "error": "database unavailable"}
            conversation_id = str(
                state.conversation_api.create_conversation(
                    user_id,
                    project_id=None,
                    title=label,
                    metadata=None,
                    session_id=session_id,
                )
            )
            with api.get_db() as conn:
                cursor = conn.cursor()
                cursor.execute("SET app.current_user_id = %s", (user_id,))
                cursor.execute(
                    "UPDATE prompt_sessions SET conversation_id = %s WHERE id = %s",
                    (conversation_id, session_id),
                )
                conn.commit()

    return {"ok": True, "session_id": session_id, "conversation_id": conversation_id, "label": label}


@router.post("/governance/room")
def builder_governance_room(x_user_id: str | None = Header(None, alias="X-User-ID")) -> dict:
    """ENSURE THE GOVERNANCE ROOM'S OWN PACKAGE — its own chat, never another room's.

    Owner, 2026-10-07 (the room became the frame: OpenMetadata in the left pane, the
    platform's seat in the right). The Development endpoint's rule, one room over: one
    package per user (marked `governance_room`), one conversation ensured under it — the
    same package/conversation shape every room keeps, scoped to Governance alone. The row
    wears `draft` so it never surfaces as a console card.
    """
    user_id = get_user_id_from_header(x_user_id)
    api = state.prompt_sessions_api
    if not api:
        return {"ok": False, "error": "database unavailable"}
    label = "Governance"

    with _ROOM_LOCK:
        session_id = None
        conversation_id = None
        with api.get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SET app.current_user_id = %s", (user_id,))
            cursor.execute(
                "SELECT id, conversation_id, title FROM prompt_sessions "
                "WHERE user_id = %s AND metadata->>'governance_room' = 'true' "
                "ORDER BY created_at ASC LIMIT 1",
                (user_id,),
            )
            row = cursor.fetchone()
            if row:
                session_id = str(row["id"])
                conversation_id = str(row["conversation_id"]) if row["conversation_id"] else None
                if row["title"]:
                    label = str(row["title"])

        if session_id is None:
            if not state.conversation_api:
                return {"ok": False, "error": "database unavailable"}
            session = api.create_session(
                user_id=user_id,
                title=label,
                description="The governance room's own package \u2014 its own conversations.",
                room_domain="governance",
            )
            session_id = str(session["id"])
            with api.get_db() as conn:
                cursor = conn.cursor()
                cursor.execute("SET app.current_user_id = %s", (user_id,))
                cursor.execute(
                    "UPDATE prompt_sessions SET metadata = COALESCE(metadata, '{}'::jsonb) || %s::jsonb WHERE id = %s",
                    (json.dumps({"governance_room": "true", "draft": "true"}), session_id),
                )
                cursor.execute(
                    "SELECT conversation_id FROM prompt_sessions WHERE id = %s", (session_id,)
                )
                fresh = cursor.fetchone()
                if fresh and fresh["conversation_id"]:
                    conversation_id = str(fresh["conversation_id"])
                conn.commit()

        if not conversation_id:
            if not state.conversation_api:
                return {"ok": False, "error": "database unavailable"}
            conversation_id = str(
                state.conversation_api.create_conversation(
                    user_id,
                    project_id=None,
                    title=label,
                    metadata=None,
                    session_id=session_id,
                )
            )
            with api.get_db() as conn:
                cursor = conn.cursor()
                cursor.execute("SET app.current_user_id = %s", (user_id,))
                cursor.execute(
                    "UPDATE prompt_sessions SET conversation_id = %s WHERE id = %s",
                    (conversation_id, session_id),
                )
                conn.commit()

    return {"ok": True, "session_id": session_id, "conversation_id": conversation_id, "label": label}


@router.get("/projects/{project_id}/conversation")
def builder_project_conversation(project_id: str) -> dict:
    """THE THREAD, FROM THE ENGINE — with the facts the app's chat design groups by.

    The conversation is the app's OWN record, so the room carries it VERBATIM in the
    engine's own vocabulary: every message keeps its `messageType` (`regular` for the
    person's prompt, `starting` / `building` for a run's steps, `finished` for the
    completed card, `error` for stops and failures) and its `versionId` — the exact keys
    `groupMessages` in the builder reads. The run clock (`startedAt`) rides too, for the
    progress line under a live run.
    """
    status = _engine_conversation(project_id)
    if status is None:
        return {"ok": False, "error": "engine unreachable"}
    messages = []
    for message in status.get("realtimeConversation") or []:
        text = str(message.get("message") or "")
        if not text.strip():
            continue
        messages.append(
            {
                "role": "user" if str(message.get("author")) == "user" else "assistant",
                "content": text,
                "createdAt": message.get("createdAt"),
                # THE APP'S GROUPING KEYS, PASSED THROUGH UNTOUCHED (see the docstring).
                "messageType": message.get("messageType") or None,
                "versionId": message.get("versionId") or None,
            }
        )
    payload = {"ok": True, "status": str(status.get("status") or "idle"), "messages": messages}
    # THE RUN CLOCK — the same fact the app's RunProgress reads (its `startedAt`).
    started = status.get("startedAt") or status.get("runStartedAt")
    if started:
        payload["runStartedAt"] = started
    # THE ENGINE'S OWN ESTIMATE — the app's `agent/status.expectedMinutes`, verbatim: the
    # bar fills against it while the run is inside it, and climbs its ladder after it.
    expected = status.get("expectedMinutes")
    if isinstance(expected, (int, float)) and expected > 0:
        payload["expectedMinutes"] = int(expected)
    return payload


@router.post("/projects/{project_id}/stop")
def builder_project_stop(project_id: str) -> dict:
    """THE APP'S OWN STOP — forwarded to the engine's own `agent/stop` (its real abort).

    The builder's Stop button calls exactly this endpoint on its own engine. Wired here
    so the room's chat can offer the same act with the same effect: the run's AbortController
    fires, the engine appends its "Stopped." message, and the turn closes honestly.
    """
    try:
        response = httpx.post(
            f"{ENGINE_URL}/api/v1/vcaas/projects/{project_id}/agent/stop",
            timeout=SYNC_TIMEOUT_SECONDS,
        )
        payload = response.json() if response.content else {}
    except Exception as exc:  # noqa: BLE001 - the honest answer is the failure's own words
        return {"ok": False, "error": f"engine unreachable: {exc}"}
    data = payload.get("data") or {}
    return {"ok": True, "stopped": bool(data.get("stopped", True))}


@router.post("/projects/{project_id}/files/upload")
async def builder_project_upload(project_id: str, request: Request) -> JSONResponse:
    """THE ATTACH DOOR — FORWARDED TO THE ENGINE, ANSWER AND ALL (owner, 2026-10-06:
    *"all of these stubs go. And you're gonna put the products wiring down"*).

    The builder app's paperclip posts its multipart (field `file`) to the engine's own
    `/projects/{id}/files/upload`; the product room's foot asks the same door, one hop
    through here so the browser never crosses origins. Nothing is invented: the engine's
    payload — including its honest local-mode refusal, "Attachments are not supported by
    the local engine." — is returned verbatim with the engine's own status.
    """
    form = await request.form()
    upload = form.get("file")
    if upload is None or not hasattr(upload, "read"):
        return JSONResponse(
            {
                "errors": {"errorCode": "VALIDATION", "errorMessage": "No file in the upload."},
                "data": None,
            },
            status_code=400,
        )
    content = await upload.read()
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{ENGINE_URL}/api/v1/vcaas/projects/{project_id}/files/upload",
            files={
                "file": (
                    upload.filename or "file",
                    content,
                    upload.content_type or "application/octet-stream",
                )
            },
        )
    try:
        payload = response.json()
    except Exception:
        payload = {
            "errors": {
                "errorCode": "ENGINE",
                "errorMessage": response.text or f"The engine answered {response.status_code}.",
            },
            "data": None,
        }
    return JSONResponse(payload, status_code=response.status_code)
