#!/usr/bin/env python3
"""READ-ONLY: reproduce the 2026-10-05 refusal for node 40001177:2458 on the running build.

Fetches the node (ONE GET — the same endpoint the ingest itself uses), then runs the REAL
checker in-process (backend/figma_fidelity.fidelity_report + fidelity_gate) and prints
every blocking row, the coverage verdicts, and the counts.

Writes NOTHING: no Figma writes, no local files, no database rows.
Run:  backend/.venv/bin/python PLANS.AGENT/design-room-2026-10-05/probe_node_2458.py
"""
import os
import sys

import requests

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Load backend/.env into the environment first, the way RESTART-LOCAL does — the checker's
# module chain reads env at import time.
_env = os.path.join(ROOT, "backend", ".env")
if os.path.exists(_env):
    with open(_env) as fh:
        for line in fh:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, val = line.partition("=")
                os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))

sys.path.insert(0, os.path.join(ROOT, "backend"))

from figma_fidelity import fidelity_gate, fidelity_report  # noqa: E402

FILE_KEY, NODE_ID, TAG = "20UPR2KQMsbAxlo5NJb1se", "40001177:2458", "f-40001177-2458"

tok = os.environ.get("FIGMA_TOKEN", "")
if not tok:
    sys.exit("FIGMA_TOKEN not found (backend/.env) — refusing to call Figma.")

r = requests.get(
    f"https://api.figma.com/v1/files/{FILE_KEY}/nodes?ids={NODE_ID}&geometry=paths",
    headers={"X-Figma-Token": tok},
    timeout=30,
)
r.raise_for_status()
raw = r.json()["nodes"][NODE_ID]["document"]

report = fidelity_report(raw, TAG)
gate = fidelity_gate(report)

print(f"node: {raw.get('name')} ({raw.get('type')})")
print(f"blocks={gate['blocks']} | blocking rows={len(gate['blocking'])}")
for row in gate["blocking"][:40]:
    print(f"  · {row}")
if len(gate["blocking"]) > 40:
    print(f"  … and {len(gate['blocking']) - 40} more")
print("key_coverage omissions:", report["key_coverage"]["omissions"])
print("key_coverage examined :", report["key_coverage"]["examined"])
print("counts:", report["counts"])
print("DONE — read-only math; nothing was written anywhere.")
