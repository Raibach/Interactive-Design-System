#!/usr/bin/env python3
"""READ-ONLY proof for the fidelity-gate fix — run BEFORE and AFTER the `_states` edit.

Fetches node 40001177:2476 (ONE GET, the same endpoint the ingest itself uses), then runs the
REAL checker in-process — `figma_fidelity.fidelity_report` + `fidelity_gate` — over:

  1. the node as fetched (the one that was refused on 2026-10-05);
  2. a counterfactual copy whose stroke is made VISIBLE and non-solid (a gradient border) —
     this MUST keep blocking after the fix: the fix may silence hidden paints only;
  3. a counterfactual copy whose stroke is made VISIBLE and solid (informational — the
     renderer is expected to draw it, so the gate is expected to pass it).

Writes NOTHING anywhere: no Figma writes, no local files, no database rows.
Run:  backend/.venv/bin/python PLANS.AGENT/design-room-2026-10-05/verify_gate.py
"""
import copy
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

FILE_KEY, NODE_ID, TAG = "20UPR2KQMsbAxlo5NJb1se", "40001177:2476", "f-40001177-2476"

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


def settle(node: dict, label: str) -> bool:
    gate = fidelity_gate(fidelity_report(node, TAG))
    print(f"— {label}")
    print(f"    blocks={gate['blocks']} | blocking rows={len(gate['blocking'])}")
    for row in gate["blocking"][:6]:
        print(f"      · {row}")
    return gate["blocks"]


def edit_strokes(node: dict, visible: bool, kind: str) -> None:
    for s in node.get("strokes") or []:
        s["visible"] = visible
        s["type"] = kind
    for c in node.get("children") or []:
        edit_strokes(c, visible, kind)


settle(raw, "1) as fetched — the node that was refused 2026-10-05")

grad = copy.deepcopy(raw)
edit_strokes(grad, True, "GRADIENT_LINEAR")
settle(grad, "2) counterfactual: stroke VISIBLE, non-solid (gradient) — must keep blocking")

solid = copy.deepcopy(raw)
edit_strokes(solid, True, "SOLID")
settle(solid, "3) counterfactual: stroke VISIBLE, solid — informational")

print("DONE — read-only math; nothing was written anywhere.")
