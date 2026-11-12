"""THE POSTHOG READS — the application's own lists, read server-side before a UX turn.

WHAT THIS IS. The vendor's chat could read its project because it WAS the application. This
module gives OUR engine the same reads through the application's own API: the project, insights,
dashboards, event definitions and feature flags. `_design_turn` runs it before the model call
and folds the block it returns into the turn's context.

WHAT IT IS NOT. It does not run a query (a trend, a funnel, retention). Those numbers live
behind the application's query layer and are the next tool; the block says so, so the model
cannot pretend it saw them.

A FAILURE IS A LINE, NEVER AN EMPTY LIST. Every read that fails becomes a warning (returned to
the chat) AND a line in the block (so the model knows what it does not know). No placeholder
counts, no invented names.

THE SESSION IS THE APPLICATION'S. `AUTO_LOGIN` serves the page, but the JSON API wants the same
session the browser gets. The login is server-side with the install's own demo account, and the
cookie is presented explicitly because the app's cookie is domain-scoped (the same reason
`routes/ux_chat.py` presents it explicitly).
"""
from __future__ import annotations

import os
from typing import Any, Callable

import requests

TIMEOUT_S = 8.0


class PostHogReadError(Exception):
    """A read that could not answer, with a reason a person can read."""


def _base() -> str:
    return os.getenv("POSTHOG_URL", "http://localhost:8200").rstrip("/")


def _project_id() -> str:
    return os.getenv("POSTHOG_PROJECT_ID", "1")


def _sign_in() -> dict[str, str]:
    base = _base()
    email = os.getenv("POSTHOG_DEMO_EMAIL", "demo@raibach.net")
    password = os.getenv("POSTHOG_DEMO_PASSWORD", "")
    if not password:
        raise PostHogReadError("the application's demo password is not configured (POSTHOG_DEMO_PASSWORD)")
    try:
        login = requests.post(
            f"{base}/api/login",
            json={"email": email, "password": password},
            timeout=TIMEOUT_S,
        )
    except Exception as exc:  # noqa: BLE001 — the reason goes into the turn
        raise PostHogReadError(f"the application could not be reached at {base}: {exc}") from exc
    if login.status_code != 200:
        raise PostHogReadError(
            f"the application refused the session ({login.status_code}): {login.text[:160]}"
        )
    session_key = login.cookies.get("sessionid") or ""
    csrf = login.cookies.get("posthog_csrftoken") or ""
    if not session_key:
        raise PostHogReadError("the application's login answered 200 but set no session cookie")
    headers = {
        "Cookie": f"sessionid={session_key}; posthog_csrftoken={csrf}",
        "Referer": f"{base}/",
    }
    if csrf:
        headers["X-CSRFToken"] = csrf
    return headers


def _get(path: str, headers: dict[str, str]) -> Any:
    base = _base()
    try:
        response = requests.get(f"{base}{path}", headers=headers, timeout=TIMEOUT_S)
    except Exception as exc:  # noqa: BLE001 — the reason goes into the turn
        raise PostHogReadError(f"{path} could not be reached: {exc}") from exc
    if response.status_code != 200:
        raise PostHogReadError(f"{path} answered {response.status_code}: {response.text[:160]}")
    try:
        return response.json()
    except Exception as exc:  # noqa: BLE001
        raise PostHogReadError(f"{path} did not answer JSON: {exc}") from exc


def _post(path: str, headers: dict[str, str], payload: dict[str, Any]) -> Any:
    base = _base()
    try:
        response = requests.post(f"{base}{path}", headers=headers, json=payload, timeout=TIMEOUT_S)
    except Exception as exc:  # noqa: BLE001 — the reason goes into the turn
        raise PostHogReadError(f"{path} could not be reached: {exc}") from exc
    if response.status_code != 200:
        raise PostHogReadError(f"{path} answered {response.status_code}: {response.text[:160]}")
    try:
        return response.json()
    except Exception as exc:  # noqa: BLE001
        raise PostHogReadError(f"{path} did not answer JSON: {exc}") from exc


def _hogql(query: str, headers: dict[str, str]) -> list[list[Any]]:
    """THE APPLICATION'S OWN QUERY ENGINE — the same HogQL endpoint its insights use."""
    data = _post(
        f"/api/projects/{_project_id()}/query/",
        headers,
        {"query": {"kind": "HogQLQuery", "query": query}},
    )
    if not isinstance(data, dict):
        raise PostHogReadError("the query answered a shape this reader does not know")
    if data.get("error"):
        raise PostHogReadError(str(data["error"])[:240])
    results = data.get("results")
    if not isinstance(results, list):
        raise PostHogReadError("the query answered no `results` array")
    return results


def _names(data: Any, limit: int = 20) -> str:
    """The names a list endpoint returned, with the real count. Never a made-up count."""
    if not isinstance(data, dict):
        raise PostHogReadError("the list answered a shape this reader does not know")
    total = data.get("count")
    results = data.get("results")
    if not isinstance(results, list):
        raise PostHogReadError("the list answered no `results` array")
    if not results:
        return "0"
    shown = results[:limit]
    names = []
    for row in shown:
        if not isinstance(row, dict):
            continue
        name = str(row.get("name") or row.get("title") or "").strip()
        if name:
            names.append(name[:80])
    suffix = ""
    if isinstance(total, int) and total > len(shown):
        suffix = f" (showing {len(shown)} of {total})"
    return f"{len(shown)}{suffix}: " + "; ".join(names) if names else f"{len(shown)} (unnamed)"


def read_for_turn(question: str) -> tuple[str, list[str]]:
    """The block a UX turn's model reads, and the failures the person is shown.

    `question` is accepted because the next read is question-driven; the list reads are not
    filtered by it yet. It is not used to invent a narrower answer.
    """
    lines: list[str] = ["=== POSTHOG APPLICATION — read from the app's own API before this turn ==="]
    warnings: list[str] = []

    try:
        headers = _sign_in()
    except PostHogReadError as exc:
        warnings.append(f"PostHog reads: {exc}")
        lines.append(f"The application's session could not be opened, so nothing was read: {exc}")
        lines.append("Do not invent the project, its insights, its events or its flags. Say that the read failed, and why.")
        return "\n".join(lines), warnings

    project = _project_id()

    def take(label: str, path: str, render: Callable[[Any], str]) -> None:
        try:
            data = _get(path, headers)
        except PostHogReadError as exc:
            warnings.append(f"{label}: {exc}")
            lines.append(f"{label}: COULD NOT BE READ — {exc}")
            return
        try:
            lines.append(f"{label}: {render(data)}")
        except Exception as exc:  # noqa: BLE001 — a shape this reader cannot trust is a failure
            warnings.append(f"{label}: the answer could not be read: {exc}")
            lines.append(f"{label}: COULD NOT BE READ — {exc}")

    take("Project", f"/api/projects/{project}/", lambda data: (
        f"{str(data.get('name') or '(unnamed)')} "
        f"(timezone {str(data.get('timezone') or 'unknown')})"
        if isinstance(data, dict) else "the project answered a shape this reader does not know"
    ))
    take("Insights", f"/api/projects/{project}/insights/?limit=20", _names)
    take("Dashboards", f"/api/projects/{project}/dashboards/?limit=20", _names)
    take("Event definitions", f"/api/projects/{project}/event_definitions/?limit=20", _names)
    take("Feature flags", f"/api/projects/{project}/feature_flags/?limit=20", _names)

    try:
        total = _hogql("select count() as events from events", headers)
        count = total[0][0] if total and total[0] else 0
        lines.append(f"Events recorded (HogQL): {count}")
    except PostHogReadError as exc:
        warnings.append(f"Events recorded: {exc}")
        lines.append(f"Events recorded: COULD NOT BE READ — {exc}")

    try:
        rows = _hogql(
            "select event, count() as count from events group by event order by count desc limit 20",
            headers,
        )
        if rows:
            lines.append(
                "Events by name: " + "; ".join(f"{row[0]} ({row[1]})" for row in rows if len(row) >= 2)
            )
        else:
            lines.append("Events by name: none recorded")
    except PostHogReadError as exc:
        warnings.append(f"Events by name: {exc}")
        lines.append(f"Events by name: COULD NOT BE READ — {exc}")

    lines.append(
        "NOT READ HERE: the numbers inside an insight — a trend, a funnel, retention, a recording. "
        "Those need the query tools, which are not built yet. Do not invent them; say what the "
        "person would need to open."
    )
    return "\n".join(lines), warnings


def list_conversations() -> list[dict[str, Any]]:
    """THE APPLICATION'S OWN CONVERSATION LIST — PostHog's threads, newest first."""
    headers = _sign_in()
    data = _get(f"/api/projects/{_project_id()}/conversations/", headers)
    rows = data.get("results") if isinstance(data, dict) else data
    if not isinstance(rows, list):
        raise PostHogReadError("the conversation list answered a shape this reader does not know")
    return [
        {
            "id": str(row.get("id") or ""),
            "title": str(row.get("title") or ""),
            "updated_at": str(row.get("updated_at") or ""),
            "created_at": str(row.get("created_at") or ""),
            "type": str(row.get("type") or ""),
        }
        for row in rows
        if isinstance(row, dict) and row.get("id")
    ]


def get_conversation(conversation_id: str) -> dict[str, Any]:
    """ONE OF THE APPLICATION'S CONVERSATIONS, with its messages in the order spoken."""
    headers = _sign_in()
    data = _get(f"/api/projects/{_project_id()}/conversations/{conversation_id}/", headers)
    if not isinstance(data, dict):
        raise PostHogReadError("the conversation answered a shape this reader does not know")
    messages = data.get("messages")
    if not isinstance(messages, list):
        raise PostHogReadError("the conversation answered no `messages` array")
    return {
        "id": str(data.get("id") or conversation_id),
        "title": str(data.get("title") or ""),
        "updated_at": str(data.get("updated_at") or ""),
        "messages": [
            {
                "type": str(message.get("type") or ""),
                "content": str(message.get("content") or ""),
                "posthog_message_id": str(message.get("id") or ""),
            }
            for message in messages
            if isinstance(message, dict)
        ],
    }


def remove_conversation(conversation_id: str) -> None:
    """REMOVE ONE OF THE APPLICATION'S CONVERSATIONS — its own DELETE, not a local row."""
    headers = _sign_in()
    base = _base()
    try:
        response = requests.delete(
            f"{base}/api/projects/{_project_id()}/conversations/{conversation_id}/",
            headers=headers,
            timeout=TIMEOUT_S,
        )
    except Exception as exc:  # noqa: BLE001 — the reason goes to the seat
        raise PostHogReadError(f"the remove door could not be reached: {exc}") from exc
    if response.status_code not in (200, 202, 204):
        raise PostHogReadError(
            f"the remove door answered {response.status_code}: {response.text[:200]}"
        )


def send_turn(conversation_id: str, question: str) -> str:
    """HAND ONE TURN TO THE APPLICATION'S OWN CHAT, and return its words.

    The conversation id is OURS and is handed to the application; it creates the conversation
    (or continues it), stores the thread in its own tables, and streams the answer. Nothing is
    written to our database here — the session records the id, the application owns the thread.
    """
    headers = _sign_in()
    headers["Content-Type"] = "application/json"
    headers["X-POSTHOG-SESSION-ID"] = conversation_id
    base = _base()
    try:
        stream = requests.post(
            f"{base}/api/projects/{_project_id()}/conversations/",
            headers=headers,
            json={
                "conversation": conversation_id,
                "content": question,
                "trace_id": str(__import__("uuid").uuid4()),
            },
            stream=True,
            timeout=180,
        )
    except Exception as exc:  # noqa: BLE001 — the reason goes to the seat
        raise PostHogReadError(f"the application's chat could not be reached: {exc}") from exc
    if stream.status_code != 200:
        raise PostHogReadError(
            f"the application's chat refused the turn ({stream.status_code}): {stream.text[:300]}"
        )
    stream.encoding = "utf-8"
    answer = ""
    current_event = ""
    last_event = ""
    app_error = ""
    for line in stream.iter_lines(decode_unicode=True):
        if not line:
            continue
        if line.startswith("event:"):
            current_event = line[len("event:"):].strip()
            continue
        if not line.startswith("data:"):
            continue
        payload = line[len("data:"):].strip()
        if not payload or not payload.startswith("{"):
            continue
        try:
            event = json.loads(payload)
        except Exception:  # noqa: BLE001 — a malformed frame is not the answer
            continue
        kind = str(event.get("type") or current_event or "")
        if kind:
            last_event = kind
        if kind == "ai" and isinstance(event.get("content"), str):
            answer = event["content"]
        elif kind in ("error", "ai/failure") or current_event in ("error", "ai/failure"):
            said = event.get("content") or event.get("error") or event.get("message") or ""
            if isinstance(said, str) and said.strip():
                app_error = said.strip()
    if not answer.strip():
        detail = f" — the application's agent said: {app_error[:400]}" if app_error else (
            f" (the last event the application sent was `{last_event}`)" if last_event else ""
        )
        raise PostHogReadError(f"the application's chat finished with no words for this turn{detail}")
    return answer
