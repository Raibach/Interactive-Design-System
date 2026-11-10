"""THE REVIEW RECORD — who a kept session is addressed to, and every gate it has passed.

Owner, 2026-11-02: a session is a growing package that can be shared, picked up by another person and
reassigned; an approval gate is "a recorded event inside of that session". This module is that
record and nothing else: it does not draw, and it does not decide anything a person has not pressed.

WHERE THE THREE FACTS LIVE, and why no table was added:

    the reviewer      `prompt_sessions.metadata.reviewer` — a jsonb key, written once per request
    the stage         `prompt_sessions.metadata.review_stage`, mirrored into `status` so a card can
                      wear it without a second read
    the events        `design_surface_events` — the table already stood with exactly the columns a
                      gate needs (session, surface, event, detail, time) and had no writer

The activity table could not carry these: its `element_id` is NOT NULL, and a review is an event on
a SESSION, not on a component. The surface table is the right home, and giving it a writer is the
second thing this module does.

WHAT A REVIEW IS NOT. It does not publish, and it does not write the catalogue. Approving a session
records that gate; the write into the catalogue is the last gate and it is a separate act.
"""
from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

import services as state

router = APIRouter()

# The words a card wears. One place, so the card, the review and the record cannot disagree.
# THE SAVED WORD IS READ AS "NOT SENT" on the approval surface: the session exists, and no person
# has been asked to look at it yet. The stored status stays `saved`, which is what the cards read.
STAGES = {
    "saved": ("saved", "not sent"),
    "in-review": ("in-review", "in review"),
    "changes-requested": ("changes-requested", "changes requested"),
    "approved": ("approved", "approved"),
}


class ReviewRequest(BaseModel):
    action: str
    reviewer: str | None = None
    note: str | None = None


def _require_user(x_user_id: str | None) -> str:
    if not x_user_id:
        raise HTTPException(status_code=400, detail="X-User-ID is required: a review belongs to a person.")
    return x_user_id


def _readable(api: Any, session_id: str, user_id: str) -> dict[str, Any]:
    """The session, if this person may see it. A refusal says which, never "nothing"."""
    session = api.get_session(session_id, user_id)
    if not session:
        raise HTTPException(
            status_code=404,
            detail="That session does not exist, or you have no access to it.",
        )
    return session


def _row(row: Any, names: tuple[str, ...]) -> dict[str, Any]:
    """The cursor is a real-dict cursor in this app and a plain tuple elsewhere. Read by name."""
    return row if isinstance(row, dict) else dict(zip(names, row))


_PERSON_COLUMNS = ("id", "email", "full_name")


def _find_person(api: Any, words: str) -> dict[str, Any]:
    """THE WORDS A PERSON TYPED, TURNED INTO A PERSON — or a refusal that says why not.

    An email address finds the one row it names. A NAME must belong to exactly one person: this
    database holds six rows named "Test User", and choosing one of them would be inventing the
    person a session was sent to. Both refusals name the fix, because a review sent to nobody is
    worse than a review not sent.
    """
    text = str(words or "").strip()
    if not text:
        raise HTTPException(
            status_code=422,
            detail="A review needs a person: name the reviewer you are sending the session to.",
        )
    with api.get_db() as conn:
        cur = conn.cursor()
        if "@" in text:
            cur.execute(
                """SELECT id::text, email, full_name FROM users
                    WHERE lower(email) = lower(%s) AND deleted_at IS NULL""",
                (text,),
            )
        else:
            cur.execute(
                """SELECT id::text, email, full_name FROM users
                    WHERE lower(full_name) = lower(%s) AND deleted_at IS NULL""",
                (text,),
            )
        rows = cur.fetchall() or []
    found = [_row(r, _PERSON_COLUMNS) for r in rows]
    if not found:
        raise HTTPException(
            status_code=422,
            detail=(
                f'No person is named "{text}" in this system. '
                f"Use the email address that person signs in with."
            ),
        )
    if len(found) > 1:
        raise HTTPException(
            status_code=422,
            detail=(
                f'{len(found)} people are named "{text}". '
                f"Use the email address of the one you mean."
            ),
        )
    return found[0]


def _share_with(api: Any, session_id: str, person_id: str, granted_by: str) -> None:
    """THE ADDRESSED PERSON MAY OPEN THE SESSION — because a review nobody can read is a dead end.

    Access in this system derives from the package (`session_permissions`), so addressing a session
    to a person writes their row. The role is `editor` because recording a gate is a write, and a
    viewer would be refused; a row that already stands is left alone unless it is a viewer.
    """
    with api.get_db() as conn:
        cur = conn.cursor()
        cur.execute("SET app.current_user_id = %s", (granted_by,))
        cur.execute(
            """INSERT INTO session_permissions (session_id, user_id, role, granted_by)
               VALUES (%s, %s, 'editor', %s)
               ON CONFLICT (session_id, user_id) DO UPDATE SET role = 'editor'
                 WHERE session_permissions.role = 'viewer'""",
            (session_id, person_id, granted_by),
        )
        conn.commit()


def _my_name(api: Any, user_id: str) -> str:
    """The signed-in person's own name, so a review sent before this change is still answerable."""
    with api.get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT full_name, email FROM users WHERE id::text = %s AND deleted_at IS NULL",
            (user_id,),
        )
        row = cur.fetchone()
    if not row:
        return ""
    person = _row(row, ("full_name", "email"))
    return str(person.get("full_name") or person.get("email") or "")


def _events(api: Any, session_id: str) -> list[dict[str, Any]]:
    with api.get_db() as conn:
        cur = conn.cursor()
        cur.execute("SET app.current_user_id = %s", ("00000000-0000-0000-0000-000000000001",))
        cur.execute(
            """SELECT event, detail, at FROM design_surface_events
               WHERE session_id = %s AND surface = 'review'
               ORDER BY at ASC""",
            (session_id,),
        )
        rows = cur.fetchall()
        bodies: list[dict[str, Any]] = []
        for row in rows:
            # THE CURSOR IS A REAL-DICT CURSOR. Unpacking a dict yields its KEYS, which is how this
            # endpoint first answered "event: 'event', at: 'at'". Read by name, and fall back to a
            # tuple for any caller whose cursor is plain.
            event, detail, at = (
                (row.get("event"), row.get("detail"), row.get("at"))
                if isinstance(row, dict)
                else row
            )
            body = detail or {}
            if isinstance(body, str):
                try:
                    body = json.loads(body)
                except json.JSONDecodeError:
                    body = {"note": body}
            # THE DETAIL IS KEPT AS ITS OWN FIELD. Spreading it into the row let a detail key called
            # "event" overwrite the event's own name.
            bodies.append({"event": str(event), "at": str(at), "detail": body})
        # WHO DID IT, IN WORDS. The event stores the person's id; a reviewer reading a gate needs
        # the name of the person who took it, not a uuid.
        ids = sorted(
            {str(b["detail"].get("by") or "") for b in bodies if str(b["detail"].get("by") or "")}
        )
        names: dict[str, str] = {}
        if ids:
            cur.execute(
                "SELECT id::text, full_name, email FROM users WHERE id::text = ANY(%s)",
                (ids,),
            )
            for person_row in cur.fetchall() or []:
                person = _row(person_row, ("id", "full_name", "email"))
                names[str(person.get("id"))] = str(
                    person.get("full_name") or person.get("email") or ""
                )
    out: list[dict[str, Any]] = []
    for item in bodies:
        detail = item["detail"]
        by = str(detail.get("by") or "")
        out.append({
            "event": item["event"],
            "at": item["at"],
            "by": names.get(by, by),
            "by_id": by,
            "note": str(detail.get("note") or ""),
            "reviewer": str(detail.get("reviewer") or ""),
        })
    return out


def _stage_of(session: dict[str, Any]) -> str:
    meta = session.get("metadata") or {}
    stage = str(meta.get("review_stage") or "saved")
    return stage if stage in STAGES else "saved"


def _answerable(
    stage: str,
    reviewer_id: str,
    reviewer: str,
    user_id: str,
    my_name: str,
) -> bool:
    """MAY THIS PERSON ANSWER? The one the session was addressed to, and nobody else.

    A row written before `reviewer_id` existed carries only the name; the name is matched against
    the signed-in person's own, so an older review is still answerable and still not answerable by
    anyone else.
    """
    if stage != "in-review":
        return False
    if reviewer_id:
        return reviewer_id == user_id
    return bool(reviewer) and reviewer.strip().lower() == my_name.strip().lower()


@router.get("/api/design/sessions/{session_id}/review")
def read_review(session_id: str, x_user_id: str | None = Header(None, alias="X-User-ID")):
    """The session's review: its stage, the person it is addressed to, and every gate event."""
    uid = _require_user(x_user_id)
    api = state.prompt_sessions_api
    if not api:
        raise HTTPException(status_code=503, detail="Database not available.")
    session = _readable(api, session_id, uid)
    meta = session.get("metadata") or {}
    stage = _stage_of(session)
    reviewer = str(meta.get("reviewer") or "")
    reviewer_id = str(meta.get("reviewer_id") or "")
    owner_id = str(session.get("user_id") or "")
    return {
        "session_id": str(session.get("id")),
        "title": str(session.get("title") or ""),
        "stage": stage,
        "stage_word": STAGES[stage][1],
        "reviewer": reviewer,
        "reviewer_id": reviewer_id,
        "owner_id": owner_id,
        "owner_name": str(session.get("author_name") or ""),
        "mine": owner_id == uid,
        "can_answer": _answerable(stage, reviewer_id, reviewer, uid, _my_name(api, uid)),
        # A SESSION ASKED BACK IS SENDABLE AGAIN — changes requested returns it to the designer,
        # and the designer's next act is to send it once more.
        "can_send": stage in ("saved", "changes-requested") and owner_id == uid,
        "events": _events(api, session_id),
    }


@router.post("/api/design/sessions/{session_id}/review")
def write_review(
    session_id: str,
    body: ReviewRequest,
    x_user_id: str | None = Header(None, alias="X-User-ID"),
):
    """One gate, recorded. `request` addresses the session; `approve` and `changes` answer it."""
    uid = _require_user(x_user_id)
    api = state.prompt_sessions_api
    if not api:
        raise HTTPException(status_code=503, detail="Database not available.")
    session = _readable(api, session_id, uid)

    action = str(body.action or "").strip().lower()
    note = str(body.note or "").strip()
    now_stage = _stage_of(session)
    meta = session.get("metadata") or {}
    reviewer = str(meta.get("reviewer") or "")
    reviewer_id = str(meta.get("reviewer_id") or "")

    if action == "request":
        person = _find_person(api, str(body.reviewer or ""))
        reviewer = str(person.get("full_name") or person.get("email") or "")
        reviewer_id = str(person.get("id") or "")
        stage = "in-review"
        event = "review-requested"
        # THE ROUTING MASK IS THE RECORD'S OWN. The stage says the card is in the queue; the
        # mask says where it was sent, so a card cannot be asked about as if it were never
        # routed. The reviewer is still the person this gate was addressed to.
        _routing = meta.get("routing") if isinstance(meta.get("routing"), dict) else {}
        metadata = {
            "reviewer": reviewer,
            "reviewer_id": reviewer_id,
            "review_stage": stage,
            "routing": {
                **_routing,
                "destination": "approval",
                "approval": True,
                "queued_at": datetime.now().isoformat(),
                "queued_by": uid,
            },
        }
    elif action == "approve":
        if now_stage != "in-review":
            raise HTTPException(
                status_code=409,
                detail=f"This session is '{now_stage}', so there is nothing to approve yet.",
            )
        if not _answerable(now_stage, reviewer_id, reviewer, uid, _my_name(api, uid)):
            raise HTTPException(
                status_code=403,
                detail=(
                    f"This session is addressed to {reviewer or 'another person'}, "
                    f"so it is not yours to answer."
                ),
            )
        stage = "approved"
        event = "review-approved"
        metadata = {"review_stage": stage}
    elif action == "changes":
        if now_stage != "in-review":
            raise HTTPException(
                status_code=409,
                detail=f"This session is '{now_stage}', so changes cannot be asked for yet.",
            )
        if not _answerable(now_stage, reviewer_id, reviewer, uid, _my_name(api, uid)):
            raise HTTPException(
                status_code=403,
                detail=(
                    f"This session is addressed to {reviewer or 'another person'}, "
                    f"so it is not yours to answer."
                ),
            )
        stage = "changes-requested"
        event = "changes-requested"
        metadata = {"review_stage": stage}
    else:
        raise HTTPException(
            status_code=422,
            detail="action must be 'request', 'approve' or 'changes'.",
        )

    try:
        updated = api.update_session(
            user_id=uid,
            session_id=session_id,
            status=STAGES[stage][1],
            metadata=metadata,
        )
    except ValueError:
        updated = None
    if not updated:
        raise HTTPException(
            status_code=403,
            detail="This session could not be written by you, so the review was not recorded.",
        )

    # THE ADDRESSED PERSON CAN OPEN THE SESSION — written after the stage stands, so a refused
    # request shares nothing, and before the event, so the record never names a person who cannot
    # read what it names.
    if action == "request":
        _share_with(api, session_id, reviewer_id, uid)

    with api.get_db() as conn:
        cur = conn.cursor()
        cur.execute("SET app.current_user_id = %s", (uid,))
        cur.execute(
            """INSERT INTO design_surface_events (session_id, surface, event, detail, at)
               VALUES (%s, 'review', %s, %s::jsonb, NOW())""",
            (
                session_id,
                event,
                json.dumps({
                    "by": uid,
                    "note": note,
                    "reviewer": reviewer,
                }),
            ),
        )
        conn.commit()

    return read_review(session_id, x_user_id)


@router.get("/api/design/reviews")
def list_reviews(x_user_id: str | None = Header(None, alias="X-User-ID")):
    """THE PERSON'S OWN APPROVAL LIST — every design session they own or that was sent to them.

    Owner, 2026-11-02: a session is a growing package that can be shared and handed to another
    person, and any person can be a reviewer. So this list is not "the sessions in review": it is
    everything this person can act on — the sessions they have not sent yet (they send one from
    here), the ones they are waiting to hear about, and the ones they were asked to answer. The
    stage word says which, and `can_send` and `can_answer` are the record's own facts so the
    surface cannot invent an answer a person is not entitled to give.
    """
    uid = _require_user(x_user_id)
    api = state.prompt_sessions_api
    if not api:
        raise HTTPException(status_code=503, detail="Database not available.")
    my_name = _my_name(api, uid)
    with api.get_db() as conn:
        cur = conn.cursor()
        cur.execute("SET app.current_user_id = %s", (uid,))
        cur.execute(
            """SELECT ps.id::text AS id, ps.title, ps.status, ps.user_id::text AS owner_id,
                      u.full_name AS owner_name, u.email AS owner_email,
                      ps.metadata->>'review_stage' AS stage,
                      ps.metadata->>'reviewer' AS reviewer,
                      ps.metadata->>'reviewer_id' AS reviewer_id,
                      ps.updated_at
                 FROM prompt_sessions ps
                 LEFT JOIN users u ON u.id = ps.user_id
                WHERE ps.metadata->>'session_type' = 'design_session'
                  AND ps.is_archived IS NOT TRUE
                  AND (
                        ps.user_id = %s
                        OR EXISTS (
                            SELECT 1 FROM session_permissions sp
                            WHERE sp.session_id = ps.id AND sp.user_id = %s
                        )
                  )
                ORDER BY ps.updated_at DESC""",
            (uid, uid),
        )
        rows = cur.fetchall() or []
    out: list[dict[str, Any]] = []
    for row in rows:
        item = _row(
            row,
            (
                "id", "title", "status", "owner_id", "owner_name", "owner_email",
                "stage", "reviewer", "reviewer_id", "updated_at",
            ),
        )
        stage = str(item.get("stage") or "saved")
        if stage not in STAGES:
            stage = "saved"
        reviewer = str(item.get("reviewer") or "")
        reviewer_id = str(item.get("reviewer_id") or "")
        owner_id = str(item.get("owner_id") or "")
        out.append({
            "session_id": str(item.get("id") or ""),
            "title": str(item.get("title") or ""),
            "stage": stage,
            "stage_word": STAGES[stage][1],
            "reviewer": reviewer,
            "reviewer_id": reviewer_id,
            "owner_id": owner_id,
            "owner_name": str(item.get("owner_name") or item.get("owner_email") or ""),
            "mine": owner_id == uid,
            # A SESSION ASKED BACK IS SENDABLE AGAIN — changes requested returns it to the
            # designer, and the designer's next act is to send it once more.
            "can_send": stage in ("saved", "changes-requested") and owner_id == uid,
            "can_answer": _answerable(stage, reviewer_id, reviewer, uid, my_name),
            "updated_at": str(item.get("updated_at") or ""),
        })
    return {"reviews": out}


class RequestCreate(BaseModel):
    kind: str
    subject: str
    reason: str | None = None
    session_id: str | None = None


def _row_to_request(row: Any) -> dict[str, Any]:
    item = row if isinstance(row, dict) else {
        "id": row[0], "session_id": row[1], "kind": row[2], "subject": row[3], "reason": row[4],
        "requested_by": row[5], "decision": row[6], "decided_by": row[7], "decided_at": row[8],
        "note": row[9], "at": row[10],
    }
    return {
        "id": int(item.get("id")),
        "session_id": str(item.get("session_id") or ""),
        "kind": str(item.get("kind") or ""),
        "subject": str(item.get("subject") or ""),
        "reason": str(item.get("reason") or ""),
        "requested_by": str(item.get("requested_by") or ""),
        "decision": str(item.get("decision") or "pending"),
        "decided_by": str(item.get("decided_by") or ""),
        "decided_at": str(item.get("decided_at") or ""),
        "note": str(item.get("note") or ""),
        "at": str(item.get("at") or ""),
    }


_QUEUE_COLUMNS = ("id, session_id, kind, subject, reason, requested_by, decision, decided_by, "
                  "decided_at, note, at")


@router.post("/api/design/requests")
def create_request(body: RequestCreate, x_user_id: str | None = Header(None, alias="X-User-ID")):
    """ASK FOR SOMETHING THE SYSTEM DOES NOT HOLD — a font, or a component.

    The owner, 2026-11-02: when the ingest meets a face the system does not ship, the chat offers to
    replace it or to ask for it to be added, and "asking for it to be added enters the approval
    queue". This is that queue. It holds the request until a person decides, and the decision is one
    row rather than a second copy of the request.
    """
    uid = _require_user(x_user_id)
    api = state.prompt_sessions_api
    if not api:
        raise HTTPException(status_code=503, detail="Database not available.")
    kind = str(body.kind or "").strip().lower()
    subject = str(body.subject or "").strip()
    if not kind:
        raise HTTPException(status_code=422, detail="A request needs a kind: 'font' or 'component'.")
    if not subject:
        raise HTTPException(status_code=422, detail="A request needs a subject: what is being asked for.")
    with api.get_db() as conn:
        cur = conn.cursor()
        cur.execute("SET app.current_user_id = %s", (uid,))
        cur.execute(
            f"""INSERT INTO design_requests (session_id, kind, subject, reason, requested_by)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING {_QUEUE_COLUMNS}""",
            (str(body.session_id or ""), kind, subject, str(body.reason or ""), uid),
        )
        row = cur.fetchone()
        conn.commit()
    return _row_to_request(row)


@router.get("/api/design/requests")
def list_requests(
    decision: str | None = None,
    x_user_id: str | None = Header(None, alias="X-User-ID"),
):
    """Everything still waiting, or everything decided, when `decision` says which."""
    uid = _require_user(x_user_id)
    api = state.prompt_sessions_api
    if not api:
        raise HTTPException(status_code=503, detail="Database not available.")
    with api.get_db() as conn:
        cur = conn.cursor()
        cur.execute("SET app.current_user_id = %s", (uid,))
        if decision:
            cur.execute(
                f"SELECT {_QUEUE_COLUMNS} FROM design_requests WHERE decision = %s ORDER BY at DESC",
                (decision,),
            )
        else:
            cur.execute(f"SELECT {_QUEUE_COLUMNS} FROM design_requests ORDER BY at DESC")
        rows = cur.fetchall()
    return {"requests": [_row_to_request(row) for row in rows]}
