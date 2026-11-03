"""IBM watsonx.ai — the app's model, called over the platform's own API.

WHY THIS FILE EXISTS: the application assembles its surfaces and answers its chats with one
model, and the owner asked for it to be IBM's rather than DeepSeek's (2026-10-27). This module
holds that call, and nothing else: the token exchange, the project id, and one request.

THE TWO FACTS THE PLATFORM NEEDS, AND ONLY ONE OF THEM IS IN THE KEY FILE:
  * the API key — `apikey.json` beside this backend, or WATSONX_API_KEY;
  * the PROJECT ID — WATSONX_PROJECT_ID. It is the UUID in the watsonx.ai project's address,
    and every inference call must carry it. Measured with the owner's key on 2026-10-27:
    `/ml/v1/text/generation` answers 400 "Missing either space_id or project_id or
    wml_instance_crn" without it, and the account held no project, no space and no service
    instance to borrow one from.

So `active()` is False until both exist. The app keeps its current model until then; nothing
here runs on a half-configuration.

USE:  python -m watsonx_provider          (prints one line per fact it can prove)
"""

from __future__ import annotations

import json
import os
import threading
import time
from pathlib import Path

import httpx
from dotenv import load_dotenv

# THE BACKEND'S OWN .env, LOADED HERE so this module's values are right whether it is imported
# by the app or run on its own. `override=False`: a value set in the real environment wins.
load_dotenv(dotenv_path=Path(__file__).with_name(".env"), override=False)

WATSONX_URL = os.getenv("WATSONX_URL", "https://us-south.ml.cloud.ibm.com").rstrip("/")
IAM_URL = "https://iam.cloud.ibm.com/identity/token"
DEFAULT_MODEL = os.getenv("WATSONX_MODEL", "ibm/granite-4-h-small")
KEY_FILE = Path(os.getenv(
    "WATSONX_KEY_FILE",
    str(Path(__file__).resolve().parent.parent / "apikey.json"),
))
PROJECT_ID = os.getenv("WATSONX_PROJECT_ID", "").strip()
API_VERSION_CHAT = "2024-10-11"
API_VERSION_SPECS = "2024-01-01"

_lock = threading.Lock()
_token = {"value": "", "expires_at": 0.0}
_probe: dict | None = None


def api_key() -> str:
    """The key the platform is dialed with: the environment first, then the key file."""
    env = os.getenv("WATSONX_API_KEY", "").strip()
    if env:
        return env
    try:
        return (json.loads(KEY_FILE.read_text()).get("apikey") or "").strip()
    except Exception:
        return ""


def iam_token(force: bool = False) -> str:
    """A bearer token, cached until five minutes before it expires."""
    key = api_key()
    if not key:
        return ""
    with _lock:
        if not force and _token["value"] and time.time() < _token["expires_at"]:
            return _token["value"]
        response = httpx.post(
            IAM_URL,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            data={
                "grant_type": "urn:ibm:params:oauth:grant-type:apikey",
                "apikey": key,
            },
            timeout=30,
        )
        response.raise_for_status()
        body = response.json()
        _token["value"] = body.get("access_token", "")
        _token["expires_at"] = time.time() + max(60, int(body.get("expires_in", 3600)) - 300)
        return _token["value"]


def configured() -> bool:
    """Both facts present. Says nothing about whether the platform will answer."""
    return bool(api_key() and PROJECT_ID)


def chat(
    messages: list[dict],
    max_tokens: int = 2000,
    temperature: float = 0.0,
    json_mode: bool = False,
    model: str | None = None,
) -> str:
    """One chat call. Returns the text, or a string that starts with "Error:" on failure.

    The "Error:" prefix is the contract `query_llm` already uses to turn a provider failure
    into a visible message rather than an empty answer.
    """
    if not configured():
        return (
            "Error: IBM watsonx.ai is not configured: "
            f"{'no API key' if not api_key() else 'no project id (WATSONX_PROJECT_ID)'}."
        )
    try:
        token = iam_token()
    except Exception as exc:  # noqa: BLE001 — the reason belongs to the caller
        return f"Error: IBM watsonx.ai token exchange failed: {exc}"

    body = {
        "model_id": model or DEFAULT_MODEL,
        "project_id": PROJECT_ID,
        "messages": messages,
        "parameters": {
            "max_tokens": max_tokens,
            "temperature": temperature,
        },
    }
    if json_mode:
        body["response_format"] = {"type": "json_object"}

    try:
        response = httpx.post(
            f"{WATSONX_URL}/ml/v1/text/chat?version={API_VERSION_CHAT}",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            json=body,
            timeout=120,
        )
    except Exception as exc:  # noqa: BLE001
        return f"Error: IBM watsonx.ai did not answer: {exc}"

    if response.status_code != 200:
        return f"Error: IBM watsonx.ai answered {response.status_code}: {response.text[:300]}"

    try:
        data = response.json()
        return (data["choices"][0]["message"]["content"] or "").strip()
    except Exception:  # noqa: BLE001
        return f"Error: IBM watsonx.ai returned an unreadable body: {response.text[:300]}"


def probe() -> dict:
    """What this machine can prove right now, cached for the life of the process.

    The app uses `active()` to decide whether to route to IBM. A key that cannot reach a
    project must not take the rooms down with it, so the decision is made by a measurement,
    not by the presence of a file.
    """
    global _probe
    if _probe is not None:
        return _probe
    out = {"key": False, "token": False, "models": 0, "project_id": bool(PROJECT_ID), "chat": False}
    if not api_key():
        _probe = out
        return out
    out["key"] = True
    try:
        token = iam_token()
        out["token"] = bool(token)
    except Exception as exc:  # noqa: BLE001
        out["token_error"] = str(exc)[:200]
        _probe = out
        return out
    try:
        specs = httpx.get(
            f"{WATSONX_URL}/ml/v1/foundation_model_specs?version={API_VERSION_SPECS}&limit=100",
            headers={"Authorization": f"Bearer {token}"},
            timeout=30,
        )
        if specs.status_code == 200:
            out["models"] = specs.json().get("total_count", 0)
    except Exception as exc:  # noqa: BLE001
        out["specs_error"] = str(exc)[:200]
    if PROJECT_ID:
        answer = chat([{"role": "user", "content": "Reply with the single word: ok"}], max_tokens=16)
        out["chat"] = bool(answer) and not answer.startswith("Error:")
        if not out["chat"]:
            out["chat_error"] = answer[:300]
    _probe = out
    return out


def active() -> bool:
    """True only when a project id exists AND a real chat call has answered.

    The probe is cached, so this costs one call per process, not one per turn.
    """
    return bool(probe().get("chat"))


if __name__ == "__main__":
    result = probe()
    print(json.dumps(result, indent=2))
    if not result.get("project_id"):
        print("\nThe API key is not enough on its own: every inference call carries a project id.")
        print("Create a project at https://dataplatform.cloud.ibm.com/projects and run again with")
        print("WATSONX_PROJECT_ID=<the UUID in the project's address>.")
