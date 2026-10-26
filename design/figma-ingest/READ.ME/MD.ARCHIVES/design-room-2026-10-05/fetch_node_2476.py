#!/usr/bin/env python3
"""READ-ONLY probe — fetch ONE Figma node and print its stroke-related fields exactly as Figma returns them.

WHY: today's design-room ingest was refused by the fidelity gate with:
  "prompt-textarea-container-system (FRAME) · strokes: stated and never reached the spec"

The gate treats a non-empty `strokes` list as a stated fact that must reach the spec, but the
spec builder (routes/figma.py:_figma_spec_for_model, line ~2647) only writes spec["stroke"]
when a stroke paint is BOTH visible:true AND type:"SOLID". This script fetches the same node the
ingest fetches — SAME endpoint the ingest uses (routes/figma.py:_fetch_figma_nodes):
    GET https://api.figma.com/v1/files/20UPR2KQMsbAxlo5NJb1se/nodes?ids=40001177:2476&geometry=paths

WHAT IT READS: backend/.env (for FIGMA_TOKEN — same token the app uses; never printed).
WHAT IT WRITES: nothing. One GET request to Figma; no local files; no Figma changes.

Note: 40001177:2476 IS `prompt-textarea-container-system` itself — the node the owner submitted.
"""
import json
import os
import sys

import requests

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # repo root
FILE_KEY = "20UPR2KQMsbAxlo5NJb1se"
NODE_ID = "40001177:2476"

tok = os.environ.get("FIGMA_TOKEN", "")
if not tok:
    with open(os.path.join(ROOT, "backend", ".env")) as fh:
        for line in fh:
            line = line.strip()
            if line.startswith("FIGMA_TOKEN="):
                tok = line.split("=", 1)[1].strip().strip("'\"")
if not tok:
    sys.exit("FIGMA_TOKEN not found (backend/.env) — refusing to call Figma.")

url = f"https://api.figma.com/v1/files/{FILE_KEY}/nodes?ids={NODE_ID}&geometry=paths"
r = requests.get(url, headers={"X-Figma-Token": tok}, timeout=30)
r.raise_for_status()
doc = r.json()["nodes"][NODE_ID]["document"]

print(f"root: {doc.get('id')} | {doc.get('name')} | {doc.get('type')}")


def walk(n: dict) -> None:
    strokes = n.get("strokes")
    if strokes or n.get("strokeWeight") is not None or n.get("strokeAlign"):
        solid_visible = next(
            (s for s in (strokes or []) if s.get("visible", True) and s.get("type") == "SOLID"),
            None,
        )
        print(f"— {n.get('id')} | {n.get('name')} | {n.get('type')}")
        print(f"    strokes: {json.dumps(strokes)}")
        print(
            f"    strokeWeight: {n.get('strokeWeight')} | strokeAlign: {n.get('strokeAlign')} "
            f"| individualStrokeWeights: {n.get('individualStrokeWeights')}"
        )
        print(
            "    visible SOLID paint exists? "
            f"{bool(solid_visible)} → the spec builder would "
            + ("write spec['stroke']" if solid_visible else "NOT write spec['stroke']")
        )
    for c in n.get("children") or []:
        walk(c)


walk(doc)
print("DONE — read-only GET, nothing was written anywhere.")
