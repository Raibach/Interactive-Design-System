"""THE FACTS OF ONE INGEST, KEPT — so two ingests can be compared value for value.

WHY THIS EXISTS. The proof inside an ingest compares the design against the component that was
drawn from it. That answers "did the drawing follow the design?" and it cannot answer "what changed
since the last one?" — which is the question a designer asks after moving one node by one pixel.
Without a record of both measurements, the old one is gone the moment the new ingest replaces it.

WHAT IS KEPT. One row per layer per fact: the layer, its Figma node id, the fact's name, the value
Figma stated, the value the component carried, and the verdict. The row is exactly the proof's own
row, so the record and the answer cannot disagree — a second shape would be a second answer.

THE FINGERPRINT is taken from `(node id, fact, source value)` only. It therefore names the DESIGN,
not the drawing: ingesting the same file twice gives the same fingerprint, and moving one node by
one pixel gives a different one. A drawing that drifted while the design stood still keeps the
fingerprint and shows up as `differs` in that ingest's own proof.

A FILE PER JOB, under `backend/logs/figma-facts/`. The ledger and the activity table keep counts and
prose; this keeps the values, because a count cannot answer "which layer moved, and from what".
"""
from __future__ import annotations

import hashlib
import json
import os
from typing import Any

FACTS_ROOT = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend", ".preview"
)

# ── EPHEMERAL, LIKE THE PREVIEW IT BELONGS TO ─────────────────────────────────────────────────
# The fact table lives INSIDE the preview's own folder and in memory, for the life of that preview.
# It is not a record, not a database, and not a store: a discard takes the folder and this memory
# entry together, and nothing of the measurement remains. The owner's rule (2026-10-26): *"it has
# got to be held in a temporary ephemeral state, and it has got to be completely removed… you
# shouldn't even be adding it to the database until approval."*
#
# The comparison between two ingests still works because the previous record is read into memory
# BEFORE the new preview replaces the folder it lived in.
_MEMORY: dict[str, dict[str, Any]] = {}
_LATEST_BY_NODE: dict[str, str] = {}


def _key(row: dict[str, Any]) -> str:
    # THE NAME PATH IS THE IDENTITY, not the node id. A designer who re-draws a design gets new
    # node ids for the same layers; a comparison keyed on ids would call every fact added and
    # removed at once. The path falls back to the id only for a row that carries no path.
    identity = row.get("path") or row.get("id") or row.get("layer")
    return f"{identity}·{row.get('fact')}"


def fingerprint(rows: list[dict[str, Any]]) -> str:
    """A hash of the DESIGN's values: one identity per layer per fact, with the Figma value."""
    material = sorted(
        [str(_key(row)), str(row.get("source", ""))]
        for row in rows
    )
    return hashlib.sha256(json.dumps(material, ensure_ascii=False).encode("utf-8")).hexdigest()


def exactness(rows: list[dict[str, Any]]) -> dict[str, Any]:
    """The count, computed FROM THE ROWS — one definition, so a summary cannot contradict them.

    This is computed rather than stored-and-trusted because a summary that disagrees with its own
    rows is the class of untruth this work exists to remove. `reads` recomputes it every time.
    """
    exact = sum(1 for row in rows if row.get("verdict") == "drawn")
    # EVERY ROW THAT IS NOT EXACT COUNTS AGAINST THE TOTAL. This used to include only the rows the
    # comparison could run on, so a fact that was never read was subtracted from the denominator
    # and the surface read "100%" beside a named failure — the suppression the owner named on
    # 2026-10-26. A fact that asks for nothing (`accepted`, with a reason) is the only kind that is
    # not in the total, and the answer says how many those are.
    not_exact = sum(
        1 for row in rows
        if row.get("verdict") in ("differs", "uncomparable", "not-read", "not-drawn", "defect")
    )
    compared = exact + not_exact
    return {
        "exact": exact,
        "compared": compared,
        "differs": sum(1 for row in rows if row.get("verdict") in ("differs", "uncomparable")),
        "percent": round(exact / compared * 100, 2) if compared else 100.0,
    }


def build(
    job_id: str,
    report: dict[str, Any],
    *,
    file_key: str | None = None,
    node_id: str | None = None,
    tag: str | None = None,
    at: str | None = None,
) -> dict[str, Any]:
    """The record for one ingest, from the proof's own report."""
    rows = [
        {
            "layer": row.get("layer"),
            "path": row.get("path"),
            "id": row.get("id"),
            "fact": row.get("fact"),
            "source": row.get("source", ""),
            "drawn": row.get("drawn", ""),
            "delta": row.get("delta", ""),
            "verdict": row.get("verdict"),
        }
        for row in report.get("rows") or []
    ]
    return {
        "jobId": job_id,
        "fileKey": file_key,
        "nodeId": node_id or report.get("node"),
        "tag": tag or report.get("tag"),
        "at": at,
        "layers": report.get("layers"),
        "exactness": exactness(rows),
        "counts": report.get("counts") or {},
        "fingerprint": fingerprint(rows),
        # THE ANNOTATIONS, kept with the measurement so the component's own record can show them
        # when it is selected from the catalogue — the same display in both places.
        "annotations": report.get("annotations") or [],
        "rows": rows,
    }


def path_for(job_id: str) -> str:
    """The fact table's place: INSIDE the preview's own folder, so it dies with the preview."""
    safe = "".join(char for char in str(job_id) if char.isalnum() or char in "-_")
    return os.path.join(FACTS_ROOT, safe, "facts.json")


def write(record: dict[str, Any]) -> str:
    job_id = record["jobId"]
    _MEMORY[job_id] = record
    node_id = record.get("nodeId")
    if node_id:
        _LATEST_BY_NODE[node_id] = job_id
    destination = path_for(job_id)
    os.makedirs(os.path.dirname(destination), exist_ok=True)
    with open(destination, "w", encoding="utf-8") as handle:
        json.dump(record, handle, ensure_ascii=False, indent=1)
    return destination


def forget(job_id: str) -> None:
    """Remove a measurement from memory as well as from disk. Called by discard."""
    _MEMORY.pop(job_id, None)
    for node_id, latest in list(_LATEST_BY_NODE.items()):
        if latest == job_id:
            _LATEST_BY_NODE.pop(node_id, None)


def read(job_id: str) -> dict[str, Any] | None:
    record = _MEMORY.get(job_id)
    if record is None:
        try:
            with open(path_for(job_id), encoding="utf-8") as handle:
                record = json.load(handle)
        except (OSError, ValueError):
            return None
    # THE SUMMARY IS RECOMPUTED FROM THE ROWS IT SUMMARISES. A stored count that a later hand-edit
    # (or a half-written file) can put out of step with its own rows is not evidence.
    rows = record.get("rows") or []
    if rows:
        record["exactness"] = exactness(rows)
        record["fingerprint"] = fingerprint(rows)
    return record


def latest_for(node_id: str, exclude_job: str | None = None) -> dict[str, Any] | None:
    """The most recent fact table measured for this Figma node, other than this job.

    THIS IS HOW A CHANGE IS NAMED WITHOUT ASKING. The designer moves one node by one pixel and
    ingests again; the previous measurement of the same node is already on disk, so the answer can
    say `position: x 16, y 20 → x 16, y 21` in the same breath as the drawing. Without it, an
    exact drawing of the new design looks identical to an exact drawing of the old one — which is
    precisely the question "did it pick up my change?" that a count cannot answer.
    """
    if not node_id:
        return None
    latest = _LATEST_BY_NODE.get(node_id)
    if not latest or latest == exclude_job:
        return None
    return read(latest)


def compare(before: dict[str, Any], after: dict[str, Any]) -> dict[str, Any]:
    """What changed between two measured designs — added facts, removed facts, changed facts.

    A CHANGED FACT CARRIES BOTH VALUES. That is the whole point: `position: x 16, y 20 → x 16, y 21`
    tells a designer what moved without asking anyone to trust a count.

    THIS IS TWO INGESTS OF THE DESIGNER'S OWN DESIGN, never the catalogue. The catalogue is blind to
    this comparison: the only thing an ingest may take from it is the layer's NAME.

    THE KEY IS THE NAME PATH when both sides carry one, and the node id otherwise — a record written
    before paths existed must not be reported as every fact removed and every fact added.
    """
    before_rows = before.get("rows") or []
    after_rows = after.get("rows") or []
    use_path = bool(before_rows and after_rows) and all(
        row.get("path") for row in before_rows + after_rows
    )

    def key(row: dict[str, Any]) -> str:
        identity = row.get("path") if use_path else (row.get("id") or row.get("layer"))
        return f"{identity}·{row.get('fact')}"

    old = {key(row): row for row in before_rows}
    new = {key(row): row for row in after_rows}

    added = [new[key] for key in new.keys() - old.keys()]
    removed = [old[key] for key in old.keys() - new.keys()]
    changed: list[dict[str, Any]] = []
    unchanged = 0
    for key in sorted(old.keys() & new.keys()):
        left, right = old[key], new[key]
        if str(left.get("source", "")) == str(right.get("source", "")):
            unchanged += 1
            continue
        changed.append({
            "layer": right.get("layer") or left.get("layer"),
            "id": right.get("id") or left.get("id"),
            "fact": right.get("fact") or left.get("fact"),
            "before": left.get("source", ""),
            "after": right.get("source", ""),
            "delta": f"{left.get('source', '')} → {right.get('source', '')}",
        })

    return {
        "before": {"jobId": before.get("jobId"), "fingerprint": before.get("fingerprint"),
                   "exactness": before.get("exactness")},
        "after": {"jobId": after.get("jobId"), "fingerprint": after.get("fingerprint"),
                  "exactness": after.get("exactness")},
        "designChanged": before.get("fingerprint") != after.get("fingerprint"),
        "added": added,
        "removed": removed,
        "changed": sorted(changed, key=lambda row: (str(row.get("layer")), str(row.get("fact")))),
        "unchanged": unchanged,
        "summary": (
            "The design did not change: both ingests measured the same values."
            if before.get("fingerprint") == after.get("fingerprint")
            else (
                f"{len(changed)} fact(s) changed, {len(added)} added, {len(removed)} removed, "
                f"{unchanged} unchanged."
            )
        ),
    }
