"""console_surface — the console's own doors for replay, refresh and recorded outcomes.

Phase 4 parity, server side only. Replay is a read; refresh re-runs the STORED plan and writes a
new set; an action is an outcome row. None of these call the model.
"""
from __future__ import annotations

import re
from typing import Any

import psycopg2
import psycopg2.extras
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

import surface_turns
from console_lanes import fetch_cards_by_ids, fetch_cards_by_plan

router = APIRouter()


def _uid(x_user_id: str | None) -> str:
    uid = str(x_user_id or "").strip()
    if not uid:
        raise HTTPException(status_code=400, detail="X-User-ID is required")
    return uid


class ReplayRequest(BaseModel):
    conversation_id: str
    namespace: str = "console"


class RefreshRequest(BaseModel):
    conversation_id: str
    namespace: str = "console"


class OrdinalRequest(BaseModel):
    conversation_id: str
    namespace: str = "console"
    ordinal: int


class ActionRequest(BaseModel):
    surface_turn_id: str
    item_id: str
    action: str = "open"


@router.post("/api/console/replay")
def console_replay(payload: ReplayRequest, x_user_id: str | None = Header(None, alias="X-User-ID")) -> dict[str, Any]:
    """Reopen: the active set restored, missing rows said with reasons. No model call."""
    uid = _uid(x_user_id)
    try:
        result = surface_turns.replay(payload.conversation_id, uid, payload.namespace)
    except Exception as exc:  # noqa: BLE001 — the failure is the answer
        raise HTTPException(status_code=503, detail=f"REPLAY FAILURE: {type(exc).__name__}: {exc}") from exc
    plan = result.get("plan") or {}
    cards = result["cards"]
    return {
        **result,
        # REPLAY DRAWS THE RECORDED SET, NOT THE TAB BASE. The cards are the full rows for the
        # ids in `shown_ids`; `base_ids` lives only in the plan and belongs to refresh.
        "cards": cards,
        "query": {
            "text": str(plan.get("explain") or "the recorded view"),
            "sort": plan.get("sort") or "",
            "filters": plan.get("filter") or [],
            "count": len(cards),
            "missing": result.get("missing") or [],
            "drift": result.get("eligibility_drift"),
            "turn_id": str(result.get("active_turn_id") or ""),
            "namespace": str(result.get("namespace") or payload.namespace),
            "shown_ids": result.get("shown_ids") or [],
            "replayed": True,
            "refreshable": True,
        },
    }


@router.post("/api/console/ordinal")
def console_ordinal(
    payload: OrdinalRequest,
    x_user_id: str | None = Header(None, alias="X-User-ID"),
) -> dict[str, Any]:
    """'Number two' against THIS TAB's recorded set. Out of range is a refusal, never a clamp.

    The seat does not resolve against the cards it happens to be drawing: a tab press with no
    recorded turn must refuse, or an ordinal would silently open a card from a set that was never
    recorded under this namespace.
    """
    uid = _uid(x_user_id)
    try:
        result = surface_turns.resolve_ordinal(
            payload.conversation_id, uid, payload.ordinal, payload.namespace,
        )
    except surface_turns.Refusal as exc:
        detail = str(exc)
        if detail == "there is no recorded set in this conversation yet" and payload.namespace != "console":
            detail = (
                'There is no recorded set for this tab yet. Ask for a set first — '
                'for example, "show me the input ones" — then name a number.'
            )
        raise HTTPException(status_code=409, detail=detail) from exc
    except Exception as exc:  # noqa: BLE001 — the failure is the answer
        raise HTTPException(status_code=503, detail=f"ORDINAL FAILURE: {type(exc).__name__}: {exc}") from exc
    return result


def _search_in_base(plan: dict[str, Any], uid: str) -> list[dict[str, Any]]:
    """Re-run a tab search over its recorded base, not the whole library.

    The plan's `text` is the query; `base_ids` is the tab's set at record time (the 8 tools
    cards). A refresh returns the recorded set re-selected inside that base, in the same
    vector-then-title order the live search uses.
    """
    from console_memory import search_cards

    text = str(plan.get("text") or "").strip()
    base_ids = [str(i) for i in (plan.get("base_ids") or []) if i]
    if not text:
        return fetch_cards_by_plan(plan, uid, limit=50)
    hits = search_cards(text, uid, limit=50, card_ids=base_ids or None)
    order = [str(hit.get("card_id")) for hit in hits]
    base_rows = fetch_cards_by_ids(base_ids, uid) if base_ids else []
    by_id = {str(card.get("id")): card for card in base_rows}
    matched = [by_id[card_id] for card_id in order if card_id in by_id]
    tokens = [token for token in re.split(r"\W+", text.lower()) if len(token) >= 2]
    seen = {str(card.get("id")) for card in matched}
    if tokens:
        for card in base_rows:
            if str(card.get("id")) in seen:
                continue
            haystack = " ".join(
                str(card.get(key) or "")
                for key in ("title", "description", "tool", "username", "state", "category")
            ).lower()
            if all(token in haystack for token in tokens):
                matched.append(card)
                seen.add(str(card.get("id")))
    return matched


@router.post("/api/console/refresh")
def console_refresh(payload: RefreshRequest, x_user_id: str | None = Header(None, alias="X-User-ID")) -> dict[str, Any]:
    """Re-run the STORED plan and write a new superseding set. No model call, no mutation."""
    uid = _uid(x_user_id)
    active = surface_turns.active_set(payload.conversation_id, payload.namespace)
    if not active:
        raise HTTPException(status_code=404, detail="there is no recorded set to refresh")

    plan = active.get("plan") or {}
    try:
        cards = _search_in_base(plan, uid)
        row = surface_turns.record(
            conversation_id=payload.conversation_id,
            user_id=uid,
            message_id=str(active.get("message_id") or "") or None,
            plan=plan,
            shown_ids=[str(card["id"]) for card in cards],
            model_version=str(active.get("model_version") or ""),
            origin="refresh",
            namespace=payload.namespace,
        )
    except surface_turns.Refusal as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=503, detail=f"REFRESH FAILURE: {type(exc).__name__}: {exc}") from exc

    return {
        "turn_id": str(row["id"]),
        "count": len(cards),
        "origin": "refresh",
        "cards": cards,
        "query": {
            "text": str(plan.get("explain") or "the recorded view"),
            "sort": plan.get("sort") or "",
            "filters": plan.get("filter") or [],
            "count": len(cards),
            "turn_id": str(row["id"]),
            "namespace": payload.namespace,
            "shown_ids": [str(card["id"]) for card in cards],
            "refreshable": True,
        },
    }


@router.post("/api/console/actions")
def console_action(payload: ActionRequest, x_user_id: str | None = Header(None, alias="X-User-ID")) -> dict[str, Any]:
    """Record a load as an outcome. Idempotent per (set, item, action); stale presses refuse."""
    uid = _uid(x_user_id)
    try:
        with psycopg2.connect(surface_turns.DATABASE_URL) as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute("SET app.current_user_id = %s", (uid,))
                cur.execute("SELECT * FROM surface_turns WHERE id = %s", (payload.surface_turn_id,))
                turn = cur.fetchone()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=503, detail=f"ACTION READ FAILURE: {type(exc).__name__}: {exc}") from exc
    if not turn:
        raise HTTPException(status_code=404, detail="no such set")

    shown = [str(i) for i in (turn.get("shown_ids") or [])]
    if payload.item_id not in shown:
        raise HTTPException(status_code=400, detail="that item is not in this set")

    available = fetch_cards_by_ids([payload.item_id], uid)
    result = {"status": "opened"} if available else {"status": "refused", "reason": "no longer on the surface"}

    try:
        with psycopg2.connect(surface_turns.DATABASE_URL) as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute("SET app.current_user_id = %s", (uid,))
                cur.execute(
                    """
                    INSERT INTO surface_actions (surface_turn_id, item_id, action, actor, result)
                    VALUES (%s, %s, %s, %s, %s::jsonb)
                    ON CONFLICT (surface_turn_id, item_id, action) DO NOTHING
                    RETURNING id, result
                    """,
                    (payload.surface_turn_id, payload.item_id, payload.action, uid,
                     psycopg2.extras.Json(result)),
                )
                row = cur.fetchone()
                created = row is not None
                if row is None:
                    cur.execute(
                        "SELECT id, result FROM surface_actions WHERE surface_turn_id = %s AND item_id = %s AND action = %s",
                        (payload.surface_turn_id, payload.item_id, payload.action),
                    )
                    row = cur.fetchone()
                conn.commit()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=503, detail=f"ACTION WRITE FAILURE: {type(exc).__name__}: {exc}") from exc

    return {"action_id": str(row["id"]), "result": row["result"], "idempotent": not created}
