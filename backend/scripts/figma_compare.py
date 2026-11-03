"""COMPARE TWO INGESTS OF A DESIGN, value for value — the one-pixel test in writing.

WHY A SCRIPT AND NOT ONLY AN ADDRESS. The application answers this question over HTTP
(`/api/figma/ingest/<job>/compare/<other job>`), and that answer is what the screen reads. This
script answers the same question from the command line, so a test does not depend on the server
running or on anyone reading a screen — and it uses the SAME comparison (`figma_facts.compare`), so
the test and the product cannot give two answers.

TWO WAYS TO RUN IT:

  1. TWO JOBS the application already measured:
       python backend/scripts/figma_compare.py JOB_A JOB_B

  2. TWO SAVED FIGMA ANSWERS, measured here and now (no server, no Figma):
       python backend/scripts/figma_compare.py --raw-before before.json --raw-after after.json

The second form is the one to use for a controlled test: take the REST answer once, move one node
by one pixel in the file, take the answer again, and this prints the changed facts with both
values. Nothing is written and nothing is approved.
"""
from __future__ import annotations

import argparse
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.dirname(HERE)
if BACKEND not in sys.path:
    sys.path.insert(0, BACKEND)

import figma_facts  # noqa: E402
from figma_fidelity import fidelity_report  # noqa: E402


def _record_from_raw(path: str) -> dict:
    """A fact table measured from a saved Figma node document, without touching anything."""
    with open(path, encoding="utf-8") as handle:
        raw = json.load(handle)
    document = raw.get("document") or raw
    report = fidelity_report(document, tag=None)
    return figma_facts.build(
        f"raw:{os.path.basename(path)}",
        report,
        node_id=document.get("id"),
        tag=report.get("tag"),
    )


def _load(reference: str) -> dict:
    """A job's kept fact table, or a path to one."""
    if os.path.exists(reference):
        with open(reference, encoding="utf-8") as handle:
            return json.load(handle)
    record = figma_facts.read(reference)
    if not record:
        raise SystemExit(
            f"No measured facts for {reference!r}. Pass a job id that has a fact table, or a path "
            "to one of the files under backend/logs/figma-facts/."
        )
    return record


def _exactness(record: dict) -> str:
    exact = record.get("exactness") or {}
    if not exact:
        return "not measured"
    return f"{exact.get('exact')}/{exact.get('compared')} exact ({exact.get('percent')}%)"


def main() -> int:
    parser = argparse.ArgumentParser(description="Compare two measured designs, fact by fact")
    parser.add_argument("before", nargs="?", help="job id (or fact-table path) of the first ingest")
    parser.add_argument("after", nargs="?", help="job id (or fact-table path) of the second ingest")
    parser.add_argument("--raw-before", help="a saved Figma node document, measured here")
    parser.add_argument("--raw-after", help="a saved Figma node document, measured here")
    parser.add_argument("--json", action="store_true", help="emit the comparison as JSON")
    args = parser.parse_args()

    if args.raw_before and args.raw_after:
        before = _record_from_raw(args.raw_before)
        after = _record_from_raw(args.raw_after)
    elif args.before and args.after:
        before = _load(args.before)
        after = _load(args.after)
    else:
        parser.error("give two job ids, or --raw-before and --raw-after")

    result = figma_facts.compare(before, after)
    if args.json:
        print(json.dumps(result, indent=1, ensure_ascii=False))
        return 0

    print(f"node {before.get('nodeId')}  tag {before.get('tag')}")
    print(f"  before  {before.get('jobId')}  {_exactness(before)}  {before.get('fingerprint', '')[:12]}")
    print(f"  after   {after.get('jobId')}  {_exactness(after)}  {after.get('fingerprint', '')[:12]}")
    print(f"  design changed: {'yes' if result['designChanged'] else 'no'}")
    print(f"  {result['summary']}")

    for heading, rows in (("CHANGED", result["changed"]), ("ADDED", result["added"]), ("REMOVED", result["removed"])):
        if not rows:
            continue
        print(f"\n{heading}")
        for row in rows:
            if heading == "CHANGED":
                print(f"  {row['layer']} · {row['fact']}: {row['delta']}")
            elif heading == "ADDED":
                print(f"  {row['layer']} · {row['fact']}: {row.get('source', '')}")
            else:
                print(f"  {row['layer']} · {row['fact']}: {row.get('source', '')}")

    if not (result["changed"] or result["added"] or result["removed"]):
        print("\nNo fact changed. The two measurements are the same design.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
