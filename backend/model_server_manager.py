"""Model server manager — startup verification and health checks.

Providers are defined once here; query_llm() in grace_gui.py picks the one it calls and
never falls back to another. This module is only used by main.py (startup), /api/health,
and /api/teacher/ensure-model.

THE ENTRY THAT MATTERS IS "qwen". It is the model every mode of query_llm() runs on, so a
health check that reports anything else is reporting on a model nothing calls. DeepSeek was
here and was removed on 2026-09-24 with its runtime entry — the owner needs to know which
model is running, and a registry that still lists a model the app cannot reach answers that
question wrongly.
"""

import os
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv(dotenv_path=Path(__file__).with_name(".env"))

# ── Provider registry ──────────────────────────────────────────────────
PROVIDERS = {
    # THE MODEL, FOR EVERY MODE — assembly and conversation alike. This is the entry
    # /api/health must report on, since it is the only one query_llm() calls.
    #
    # Mirror of MODEL_PROVIDERS in grace_gui.py — kept in step by hand because this
    # module's job is to REPORT on the same model the runtime uses, and the id in both
    # places has to be the one actually being served.
    #
    # `api_key_required: False` matches the runtime: LM Studio ships a placeholder key and
    # ignores it, so demanding a real one here would report a healthy local server as
    # unconfigured. In production this base URL is the tunnel's.
    "qwen": {
        "name": "Qwen9B local (LM Studio / tunnel)",
        "base_url": os.getenv("LOCAL_ASSEMBLY_URL", "http://127.0.0.1:1234/v1"),
        "model": os.getenv("LOCAL_ASSEMBLY_MODEL", "qwen/qwen3.5-9b"),
        "api_key_env": "LOCAL_ASSEMBLY_API_KEY",
        "api_key_required": False,
    },
    # NOT USED BY query_llm(). Kept because /api/teacher/ensure-model still names it, and
    # that endpoint is about a different pipeline with its own provider.
    "zai": {
        "name": "Z.ai API",
        "base_url": "https://api.z.ai/api/paas/v4",
        "model": "glm-4.7",
        "api_key_env": "ZAI_API_KEY",
        "api_key_required": True,
    },
}


def _api_key(provider: str) -> str:
    """The key to dial with, or "" when this provider cannot be dialed.

    A provider that does not require a key gets a placeholder rather than an empty
    string: the OpenAI SDK refuses a None key before it dials, so returning "" here
    would turn "no key needed" into "cannot connect".
    """
    cfg = PROVIDERS.get(provider)
    if not cfg:
        return ""
    key = os.environ.get(cfg["api_key_env"], "")
    if key:
        return key
    return "" if cfg.get("api_key_required", True) else "not-needed"


def load_api_key(provider: str = "deepseek") -> str:
    """Load API key from env for the given provider."""
    cfg = PROVIDERS.get(provider)
    if not cfg:
        print(f"❌ Unknown provider: {provider}")
        return ""
    key = os.environ.get(cfg["api_key_env"], "")
    if not key:
        print(f"⚠️  No API key for {cfg['name']} ({cfg['api_key_env']})")
    return key


def check_api_connection(provider: str = "qwen") -> bool:
    """Ping the provider with a minimal chat completion. Returns True on success.

    Uses _api_key(), not load_api_key(): the local model is keyless by nature, and a
    function that reads the key itself would report a healthy LM Studio as unconfigured
    and skip the ping — which is the failure mode this check exists to catch.

    A KEYLESS PROVIDER IS PINGED AT ALL THREE RETRIES OFF, because a model that was not
    loaded yet has to be loaded: the first call after an idle TTL is a JIT load, and the
    startup check is exactly where paying for it is free.
    """
    cfg = PROVIDERS.get(provider)
    if not cfg:
        print(f"❌ Unknown provider: {provider}")
        return False

    api_key = _api_key(provider)
    if not api_key:
        print(f"⚠️  No API key for {cfg['name']} ({cfg['api_key_env']})")
        return False

    try:
        client = OpenAI(base_url=cfg["base_url"], api_key=api_key, timeout=30, max_retries=0)
        t0 = __import__("time").perf_counter()
        client.chat.completions.create(
            model=cfg["model"],
            messages=[{"role": "user", "content": "Ping"}],
            max_tokens=1,
            stream=False,
        )
        elapsed = __import__("time").perf_counter() - t0
        print(f"✅ {cfg['name']} reachable in {elapsed:.2f}s")
        return True
    except Exception as exc:
        print(f"❌ {cfg['name']} failed: {exc}")
        return False


def test_model_connection(provider: str = "qwen") -> dict:
    """Return a status dict for a provider — used by /api/health."""
    cfg = PROVIDERS.get(provider)
    if not cfg:
        return {"status": "error", "message": f"Unknown provider: {provider}", "details": {"provider": provider}}

    api_key = _api_key(provider)
    if not api_key:
        return {
            "status": "error",
            "message": f"No {cfg['name']} API key",
            "details": {"api_key_available": False, "provider": provider},
        }

    try:
        client = OpenAI(base_url=cfg["base_url"], api_key=api_key, timeout=60)
        client.chat.completions.create(
            model=cfg["model"],
            messages=[{"role": "user", "content": "Hello"}],
            max_tokens=50,
            stream=False,
        )
        return {
            "status": "success",
            "message": f"{cfg['name']} operational",
            "details": {"api_key_available": True, "model": cfg["model"], "provider": provider},
        }
    except Exception as exc:
        return {
            "status": "error",
            "message": f"{cfg['name']} failed: {exc}",
            "details": {"api_key_available": bool(api_key), "model": cfg["model"], "provider": provider},
        }


# Backwards-compatible aliases used by main.py startup and teacher route
def ensure_grace_server(provider: str = "qwen") -> bool:
    return check_api_connection(provider)


if __name__ == "__main__":
    result = test_model_connection("qwen")
    print(f"Status: {result['status']}")
    print(f"Message: {result['message']}")
