"""Seal OPENHANDS_AUTOMATION_API_KEY into the staged secrets.json.

Mirrors what the local launcher does at boot (seeds the session API key into
agent-server secrets). Sealing derivation copied from the SDK cipher.py:
    fernet_key = b64encode(hashlib.sha256(secret_key.encode()).digest())
"""
import base64
import hashlib
import json
import os

from cryptography.fernet import Fernet

sk = open(os.path.expanduser("~/.openhands/agent-canvas/secret-key.txt")).read().strip()
session_key = open(os.path.expanduser("~/.openhands/agent-canvas/api-key.txt")).read().strip()

fernet = Fernet(base64.b64encode(hashlib.sha256(sk.encode()).digest()))
sealed = fernet.encrypt(session_key.encode()).decode()

p = os.path.join(os.path.dirname(__file__), "settings-bundle", "secrets.json")
d = json.load(open(p))
d.setdefault("custom_secrets", {})["OPENHANDS_AUTOMATION_API_KEY"] = {
    "name": "OPENHANDS_AUTOMATION_API_KEY",
    "secret": sealed,
    "description": "API key for authenticating with the automation backend",
}
json.dump(d, open(p, "w"), indent=2)
print("sealed automation key into", p)
print("round-trip check:", fernet.decrypt(sealed.encode()).decode() == session_key)
