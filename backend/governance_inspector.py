"""THE GOVERNANCE INSPECTOR — deterministic code, two small local tools, one protocol.

The owner, 2026-09-18: "it should not even have to reason because it should be following a
strict JSON protocol and an AI-native protocol… so it should not be sucking up compute." And:
"I need two models — one that they're gonna have to work together to check each other."

So the division of labour is absolute, and there are TWO agents:

  · THIS FILE reads everything — runs the catalog check, reads both ledgers, asks git, and
    compares against the previous inspection. It computes every fact and, where the answer is
    arithmetic, the answer itself.
  · THE AUDITOR (persona from backend/role_caps.py: `governance` — "is the AI behaving
    safely?") receives `inspection.json` and the sheet and classifies every row.
  · THE SKEPTIC (persona `research` — "analyst, synthesizer"; a DIFFERENT model) receives the
    same sheet plus the auditor's answer and must flag any row the evidence does not support.
    Agreement is the verdict; a disagreement IS the finding.

Both tools: small, non-reasoning, temperature 0, one bounded call each, no retries, no tools,
no follow-up turns. They are LOADED for the run and UNLOADED after it (LM Studio's native
/api/v1), so nothing of theirs sits in memory between runs. A run where either does not answer
is recorded with what happened — never substituted, never silent.

They speak to the LOCAL server only (LM Studio's OpenAI-compatible base URL; `INSPECTION_*`
env vars). There is no path to the cloud from this file.
"""

from __future__ import annotations

import asyncio
import json
import os
import subprocess
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

REPO = Path(__file__).resolve().parents[1]
PROTOCOL_FILE = REPO / "inspection.json"
REGISTER_FILE = REPO / "open-items.json"
CORRECTIONS_FILE = REPO / "corrections.json"
REPORT_FILE = REPO / "frontend" / "catalog-audit" / "prompt-composer.json"

# THE INSPECTOR'S OWN MODEL, AND NOT GRACE'S. `LOCAL_MODEL_*` in backend/.env are Grace's local
# model and the whole app's provider chain reads them; the inspector must not borrow her
# address, or repointing it would change her. These names are the inspector's alone.
INSPECTION_MODEL_URL = os.getenv("INSPECTION_MODEL_URL", "http://127.0.0.1:1234/v1")
# A CLASSIFIER, NOT A REASONER (measured 2026-09-18): the first run used a 9B THINKING model,
# which burned its whole token budget reasoning (699/699 tokens all `reasoning_tokens`) and
# returned no JSON — compute spent to answer six two-value questions. This is the small
# non-reasoning coder model the owner chose: ~0.5 GB, seconds to load, seconds to answer.
INSPECTION_MODEL_ID = os.getenv("INSPECTION_MODEL_ID", "qwen2.5-coder-0.5b-instruct")
# THE SECOND TOOL, deliberately a DIFFERENT model: two answers from one model are one opinion.
INSPECTION_REVIEWER_MODEL_ID = os.getenv("INSPECTION_REVIEWER_MODEL_ID", "qwen2.5-coder-1.5b-instruct")
# THE DEEP PASS — the owner's bigger tool, called ONLY when the run needs a person (status
# attention or unverified), never on a clean run. It gets the A2UI primer from inspection.json
# so it understands what it is looking at, and it is loaded and unloaded around its one call.
INSPECTION_DEEP_MODEL_ID = os.getenv("INSPECTION_DEEP_MODEL_ID", "qwen/qwen3.5-9b")
INSPECTION_CONTEXT = int(os.getenv("INSPECTION_CONTEXT", "4096"))
INTERVAL_HOURS = float(os.getenv("INSPECTION_INTERVAL_HOURS", "24"))
FIRST_RUN_DELAY_SECONDS = float(os.getenv("INSPECTION_FIRST_RUN_DELAY_SECONDS", "120"))
OWNER_ID = os.getenv("INSPECTION_OWNER_ID", "00000000-0000-0000-0000-000000000001")

_run_lock = asyncio.Lock()


# ── the deterministic half ───────────────────────────────────────────────────


def _read_json(path: Path) -> Optional[Any]:
    try:
        return json.loads(path.read_text())
    except Exception as exc:  # noqa: BLE001 — reported, never swallowed
        print(f"⚠️  [inspection] could not read {path.name}: {exc}")
        return None


def _git(*args: str) -> str:
    try:
        out = subprocess.run(["git", *args], cwd=REPO, capture_output=True, text=True, timeout=30)
        return out.stdout.strip()
    except Exception as exc:  # noqa: BLE001
        return f"(git {args[0]} failed: {exc})"


def run_catalog_check() -> Optional[Dict[str, Any]]:
    """Run the deterministic checker, then read its report. A RED run is a finding, not an error."""
    try:
        done = subprocess.run(
            ["npm", "run", "catalog:check"],
            cwd=REPO / "frontend",
            capture_output=True,
            text=True,
            timeout=300,
        )
        if done.returncode != 0:
            print(f"ℹ️  [inspection] catalog check returned {done.returncode} (the report is still read)")
    except Exception as exc:  # noqa: BLE001
        print(f"⚠️  [inspection] the catalog check could not be run: {exc}")
        return None
    return _read_json(REPORT_FILE)


def _counts_from_report(report: Dict[str, Any]) -> Dict[str, Any]:
    findings = report.get("findings") or []
    by_check: Dict[str, int] = {}
    for f in findings:
        if f.get("level") == "pass":
            continue
        by_check[f.get("check", "?")] = by_check.get(f.get("check", "?"), 0) + 1
    blocking = [f for f in findings if f.get("level") == "blocking"]
    # THE REPORT'S OWN SCHEMA, read as measured 2026-09-19: `status` carries the verdict,
    # `counts.checksRan` carries the number of checks that ran, and `checks` lists only the
    # checks that DERIVED something. Reading `verdict` and `len(checks)` reported "None · 7
    # checks" over a run that was GREEN with 28 checks.
    counts = report.get("counts") or {}
    return {
        # THE VERDICT IS DERIVED FROM THE COUNTS, because `status` describes the RUN
        # ("complete" when every check ran) and not the result. Measured 2026-09-19: reading
        # `status` printed "verdict: complete" beside a GREEN console line.
        "verdict": "RED" if (blocking or counts.get("checksDidNotRun")) else "GREEN",
        "checks_ran": counts.get("checksRan") or len(report.get("checks") or []),
        "open_by_check": dict(sorted(by_check.items())),
        "blocking": [
            {"id": f.get("id"), "check": f.get("check"), "what": (f.get("what") or "")[:160]}
            for f in blocking
        ],
    }


def _register_summary(register: Dict[str, Any]) -> Dict[str, Any]:
    rows = register.get("rows") or []
    open_rows = [r for r in rows if r.get("status") == "open"]
    return {
        "rows": len(rows),
        "open": [
            {"id": r.get("id"), "recorded": r.get("recorded"), "witness": (r.get("witness") or "")[:120]}
            for r in open_rows
        ],
        "recorded_counts": {
            r.get("id", "").removeprefix("check:"): r.get("recorded")
            for r in rows
            if r.get("id", "").startswith("check:")
        },
    }


def _previous_inspection(conversation_id: Optional[str]) -> Optional[Dict[str, Any]]:
    """The last inspection message in the console conversation, if there is one."""
    if not conversation_id:
        return None
    import services as state

    if not state.conversation_api:
        return None
    try:
        rows = state.conversation_api.get_messages(conversation_id, OWNER_ID, limit=50) or []
    except Exception as exc:  # noqa: BLE001
        print(f"⚠️  [inspection] the console conversation could not be read: {exc}")
        return None
    for m in reversed(rows):
        meta = m.get("metadata") or {}
        if isinstance(meta, str):
            try:
                meta = json.loads(meta)
            except Exception:  # noqa: BLE001
                meta = {}
        if meta.get("kind") == "inspection":
            return meta
    return None


def build_sheet(previous: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Everything the tools are shown. Terse on purpose — a small tool imitates what it reads."""
    report = run_catalog_check()
    register = _read_json(REGISTER_FILE) or {}
    corrections = _read_json(CORRECTIONS_FILE) or {}

    checker = _counts_from_report(report or {})
    reg = _register_summary(register)

    # ── the arithmetic the CODE does, so the tools are asked to classify, not to compute ──
    derived = checker["open_by_check"]
    recorded = reg["recorded_counts"]
    disagreements = [
        f"{c}: register={recorded[c]} run={derived.get(c, 0)}"
        for c in sorted(recorded)
        if str(recorded[c]).isdigit() and int(recorded[c]) != derived.get(c, 0)
    ]
    open_without_witness = [
        r["id"]
        for r in reg["open"]
        if "check:" not in (r.get("witness") or "") and "no check" not in (r.get("witness") or "").lower()
    ]
    suppressions_run = derived.get("error-suppression", 0)
    suppressions_rec = int(recorded.get("error-suppression", "0") or 0)
    changed_files = len([l for l in _git("status", "--porcelain").splitlines() if l.strip()])
    prev_verdict = (previous or {}).get("verdict")

    # expected = what the arithmetic says. The tools' answers are held against it, and the
    # agreement (or not) is recorded — a tool that disagrees with arithmetic is a finding
    # about the tool, and the code says so rather than silently preferring either side.
    rows: List[Dict[str, Any]] = [
        {
            "id": "counts-agree",
            "evidence": f"{len(disagreements)} of {len(recorded)} recorded counts disagree: "
                        + (", ".join(disagreements[:4]) if disagreements else "none"),
            "expected": "attention" if disagreements else "ok",
        },
        {
            "id": "no-orphan-findings",
            "evidence": f"blocking findings: {len(checker['blocking'])}"
                        + (f" ({checker['blocking'][0]['id']})" if checker["blocking"] else ""),
            "expected": "attention" if checker["blocking"] else "ok",
        },
        {
            "id": "open-rows-have-witnesses",
            "evidence": f"open rows without a witness: {len(open_without_witness)}"
                        + (f" ({', '.join(open_without_witness)})" if open_without_witness else ""),
            "expected": "attention" if open_without_witness else "ok",
        },
        {
            "id": "suppressions-not-growing",
            "evidence": f"suppressions: run={suppressions_run} recorded={suppressions_rec}",
            "expected": "attention" if suppressions_run > suppressions_rec else "ok",
        },
        {
            "id": "uncommitted-work",
            "evidence": f"uncommitted files: {changed_files}",
            "expected": "attention" if changed_files else "ok",
        },
        {
            "id": "since-last-run",
            "evidence": f"previous verdict: {prev_verdict or 'none'}; checker: {checker['verdict']}",
            "expected": "attention" if (prev_verdict == "attention") else "ok",
        },
    ]

    full_facts = {
        "checker": checker,
        "counts": {"compared": len(recorded), "disagreements": len(disagreements)},
        "register": reg,
        "corrections_rows": len(corrections.get("rows") or []),
        "workspace": {
            "changed_files": changed_files,
            "diff_stat": _git("diff", "--shortstat") or "(clean)",
            "recent_commits": _git("log", "--oneline", "-8").splitlines(),
        },
        "previous": previous or {"verdict": "(none — first inspection)"},
        "expected_answers": {r["id"]: r["expected"] for r in rows},
    }
    slim = {
        "checker_verdict": checker["verdict"],
        "checks_ran": checker["checks_ran"],
        "counts_compared": len(recorded),
        "count_disagreements": len(disagreements),
        "blocking_findings": checker["blocking"],
        "open_register_rows": len(reg["open"]),
        "changed_files": changed_files,
        "previous_verdict": prev_verdict,
    }
    return {"facts": slim, "full_facts": full_facts, "rows": rows}


# ── the tools ────────────────────────────────────────────────────────────────


def _persona(role_id: str) -> Tuple[str, str]:
    """The persona of a role, read from backend/role_caps.py — the ONE home for personas.

    The owner remembered "an old profile called the Keeper who was the governor": Keeper was
    removed from the chat interface ("Chat mode is always 'grace' — Keeper removed") and the
    `governance` role is the seat it became. Nothing is invented here; the strings are HIS.
    """
    try:
        from role_caps import ROLE_CAPABILITIES

        entry = ROLE_CAPABILITIES.get(role_id) or {}
        return entry.get("persona", ""), entry.get("driving_question", "")
    except Exception as exc:  # noqa: BLE001
        print(f"⚠️  [inspection] role_caps could not be read: {exc}")
        return "", ""


def _protocol_text(row_ids: List[str]) -> str:
    protocol = _read_json(PROTOCOL_FILE)
    if not protocol:
        raise RuntimeError(
            "inspection.json is missing or unreadable — the protocol is the inspector's whole "
            "definition, so there is nothing to run (no invented fallback prompt)."
        )
    persona, question = _persona("governance")
    # THE SMALLEST POSSIBLE TASK, BECAUSE THE TOOL IS SMALL. Three measured lessons are baked
    # in here: (1) a literal `a|b` in a template gets ECHOED back, so the example is filled in;
    # (2) anything long gets imitated, so evidence stays in the code's record and never travels
    # to the tool; (3) the CODE's own answer (`expected`) must never appear in front of the
    # tool — measured 2026-09-18, the auditor copied the expected values straight back.
    return (
        f"You are the governance inspector. {persona}. Your question: {question}\n"
        "You are given rows, each with an id and its evidence. For each row decide one word: "
        "ok when the evidence needs no action, attention when it does.\n"
        "Answer with ONE JSON object mapping each id to its word, nothing else.\n"
        "Example (only an example): {\"counts-agree\":\"ok\",\"uncommitted-work\":\"attention\"}\n"
        "The ids you must answer:\n"
        + json.dumps(row_ids)
        + "\nOutput the JSON object now."
    )


def _review_text() -> str:
    persona, question = _persona("research")
    return (
        f"You are the skeptical reviewer. {persona}. Your question: {question}\n"
        "You are shown rows with their evidence, and another agent's one-word answers. Decide "
        "one thing: does the evidence shown SUPPORT each answer?\n"
        "You output JSON only, of this shape, and nothing else:\n"
        '{"agree": true, "flagged": [], "note": "at most 16 words"}\n'
        "agree is true only when every answer is supported by its evidence; otherwise flagged "
        "lists the row ids whose answer the evidence does not support. Judge only what is shown."
    )


class _LocalTools:
    """The local model server: load what we need, unload what WE loaded, never touch hers."""

    def __init__(self) -> None:
        self._loaded_by_us: List[str] = []

    @staticmethod
    def _root() -> str:
        """THE SERVER ROOT — the native API is NOT under the OpenAI base path.

        Measured 2026-09-18: INSPECTION_MODEL_URL is `http://127.0.0.1:1234/v1` (the
        OpenAI-compatible base the owner configured), and the native endpoints live at the
        ROOT (`/api/v1/chat`). Concatenating them asked for `/v1/api/v1/chat`, and LM Studio
        answered HTTP 200 with `{"error": "Unexpected endpoint or method…"}` — a response this
        client then read as an EMPTY SUCCESS. Both halves are fixed here: the `/v1` suffix is
        stripped for native paths, and an `error` payload is a failure, never a quiet blank.
        """
        root = INSPECTION_MODEL_URL.rstrip("/")
        return root[: -len("/v1")] if root.endswith("/v1") else root

    def _post(self, path: str, body: Dict[str, Any], timeout: int = 60) -> Dict[str, Any]:
        req = urllib.request.Request(
            f"{self._root()}{path}",
            data=json.dumps(body).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:  # noqa: S310 — local endpoint
            return json.loads(resp.read().decode())

    def _get(self, path: str, timeout: int = 15) -> Dict[str, Any]:
        with urllib.request.urlopen(f"{self._root()}{path}", timeout=timeout) as resp:  # noqa: S310
            return json.loads(resp.read().decode())

    def load(self, model_key: str) -> Optional[str]:
        """Load a model if it is not already loaded. Returns an error string, or None."""
        try:
            models = self._get("/api/v1/models")
            loaded = [
                str(m.get("key") or "")
                for m in (models.get("models") or [])
                if m.get("loaded_instances")
            ]
            if model_key in loaded:
                return None  # already up — we do not own it and will not unload it
            self._post("/api/v1/models/load", {"model_key": model_key, "context_length": INSPECTION_CONTEXT}, timeout=180)
            self._loaded_by_us.append(model_key)
            return None
        except (urllib.error.URLError, TimeoutError, OSError, ValueError) as exc:
            # Not fatal: LM Studio loads on demand at the chat call. Said, not hidden.
            return f"preload of {model_key} did not run ({exc})"

    def unload_ours(self) -> List[str]:
        out: List[str] = []
        for key in self._loaded_by_us:
            try:
                self._post("/api/v1/models/unload", {"model_key": key}, timeout=60)
                out.append(key)
            except Exception as exc:  # noqa: BLE001 — said in the report, not swallowed
                print(f"⚠️  [inspection] {key} could not be unloaded: {exc}")
                out.append(f"{key} (failed: {exc})")
        self._loaded_by_us = []
        return out

    def chat(self, model_key: str, system_prompt: str, user_input: str, max_tokens: int) -> Dict[str, Any]:
        """ONE native call. Returns {ok, content, stats|error, seconds}."""
        body = {
            "model": model_key,
            "system_prompt": system_prompt,
            "input": user_input,
            "temperature": 0,
            "max_output_tokens": max_tokens,
        }
        started = time.time()
        try:
            payload = self._post("/api/v1/chat", body, timeout=180)
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            return {"ok": False, "error": f"{model_key} did not answer ({exc})", "seconds": round(time.time() - started, 2)}
        # AN `error` PAYLOAD IS A FAILURE, NEVER A QUIET BLANK. LM Studio answers some requests
        # with HTTP 200 and {"error": …} (measured: the wrong endpoint), and reading only
        # `output` turned that into an empty success.
        if payload.get("error"):
            return {"ok": False, "error": f"{model_key}: {payload['error']}", "seconds": round(time.time() - started, 2)}
        output = payload.get("output") or []
        content = ""
        for part in output:
            if isinstance(part, dict) and part.get("type") == "message":
                content = str(part.get("content") or "")
        if not content.strip():
            # The stats ride the failure too: a thinking model that burns its whole budget on
            # reasoning returns no message, and the evidence of that must not be dropped.
            return {
                "ok": False,
                "error": f"{model_key} returned no message text",
                "seconds": round(time.time() - started, 2),
                "stats": payload.get("stats") or {},
            }
        return {
            "ok": True,
            "content": content.strip(),
            "stats": payload.get("stats") or {},
            "seconds": round(time.time() - started, 2),
            "model": model_key,
        }


def _extract_json_object(content: str) -> Optional[Dict[str, Any]]:
    """Tolerant about the WRAPPER, strict about the CONTENT — the models are her tools.

    Any of them may fence its JSON or add a sentence; that is a formatting habit, not a wrong
    answer. The object is extracted (fences off, first balanced braces) and then validated.
    """
    text = (content or "").strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text
    if "```" in text:
        text = text.split("```")[0]
    start = text.find("{")
    end = text.rfind("}")
    if start < 0 or end <= start:
        return None
    try:
        parsed = json.loads(text[start : end + 1])
        return parsed if isinstance(parsed, dict) else None
    except Exception:  # noqa: BLE001
        return None


def _validate_answer(parsed: Dict[str, Any], sheet: Dict[str, Any]) -> Dict[str, Any]:
    """Strict: exactly the sheet's ids, each one of two words. The verdict is derived HERE."""
    rows = sheet["rows"]
    expected_ids = [r["id"] for r in rows]
    if set(parsed.keys()) != set(expected_ids):
        return {"error": "the answer does not carry exactly the sheet's ids", "got": sorted(parsed.keys())[:8]}
    for rid in expected_ids:
        if parsed.get(rid) not in ("ok", "attention"):
            return {"error": f"row {rid} answered {parsed.get(rid)!r}"}
    # The shape the record keeps: the same row list the report renders.
    answered = [{"id": rid, "answer": parsed[rid], "evidence": next(r["evidence"] for r in rows if r["id"] == rid)} for rid in expected_ids]
    verdict = "attention" if any(r["answer"] == "attention" for r in answered) else "ok"
    return {"answer": {"verdict": verdict, "rows": answered, "note": ""}}


def _validate_review(parsed: Dict[str, Any], sheet: Dict[str, Any]) -> Dict[str, Any]:
    if parsed.get("agree") not in (True, False):
        return {"error": "the review has no boolean agree"}
    flagged = parsed.get("flagged")
    if flagged is None and parsed["agree"] is True:
        # MEASURED 2026-09-18: a tool that agrees sends {"agree": true} and omits the empty
        # list. The list only MEANS something when the reviewer disagrees, so an agreeing
        # answer without it is complete — recorded as an empty list, not refused.
        flagged = []
    if not isinstance(flagged, list):
        return {"error": "the review has no flagged list"}
    ids = {r["id"] for r in sheet["rows"]}
    unknown = [f for f in flagged if f not in ids]
    if unknown:
        return {"error": f"the review flagged unknown rows: {unknown}"}
    if parsed["agree"] is False and not flagged:
        return {"error": "the review disagrees but flags no rows"}
    return {"review": {"agree": bool(parsed["agree"]), "flagged": flagged, "note": str(parsed.get("note") or "")[:200]}}


def _roster(role: str) -> List[str]:
    """The tools assigned to a role, in order — from inspection.json, with sane defaults.

    The owner, 2026-09-18: "we have another one that can all be sitting and waiting to be
    assigned as necessary, whichever one works the best." That is what a roster is: candidates
    that do not run unless assigned, and the assignment is MEASURED (see _swarm_audit_sync),
    never assumed. A candidate that answers badly is not silently dropped — its answer, or its
    failure, is in the run's record.
    """
    protocol = _read_json(PROTOCOL_FILE) or {}
    listed = (protocol.get("roster") or {}).get(role) or []
    if listed:
        return [str(m) for m in listed]
    return [INSPECTION_MODEL_ID] if role == "auditor" else [INSPECTION_REVIEWER_MODEL_ID]


def _swarm_audit_sync(
    tools: "_LocalTools", sheet: Dict[str, Any], meta: Dict[str, Any]
) -> Dict[str, Any]:
    """THE SWARM — every roster candidate answers the same sheet, and the CODE judges.

    No tool is asked to be clever and none is averaged away: unanimity IS the verdict, and any
    dissenting vote turns its row to `attention` with every vote recorded. Sequential on
    purpose — the candidates are tiny and the local server serializes requests anyway, so
    parallel calls would queue, not speed anything up.
    """
    candidates = _roster("auditor")
    prompt = _protocol_text([r["id"] for r in sheet["rows"]])
    user = json.dumps({"rows": [{"id": r["id"], "evidence": r["evidence"]} for r in sheet["rows"]]})

    results: Dict[str, Dict[str, Any]] = {}
    for key in candidates:
        note = tools.load(key)
        if note:
            meta.setdefault("load_notes", {})[key] = note
        call = tools.chat(key, prompt, user, 200)
        entry: Dict[str, Any] = {"ok": bool(call.get("ok")), "seconds": call.get("seconds"), "stats": call.get("stats")}
        if not call.get("ok"):
            entry["error"] = call.get("error")
        else:
            parsed = _extract_json_object(call["content"])
            checked = _validate_answer(parsed, sheet) if parsed else {"error": "no JSON object in the answer"}
            if "error" in checked:
                entry["error"] = checked["error"]
                entry["raw"] = (call.get("content") or "")[:300]
            else:
                entry["answers"] = {r["id"]: r["answer"] for r in checked["answer"]["rows"]}
        results[key] = entry

    meta["swarm"] = results
    answered = {k: v for k, v in results.items() if "answers" in v}
    if not answered:
        return {"verdict": None, "error": "no tool in the roster answered a valid classification"}

    final: Dict[str, str] = {}
    dissent: Dict[str, Dict[str, str]] = {}
    divergences: Dict[str, Dict[str, str]] = {}
    for row in sheet["rows"]:
        votes = {k: v["answers"][row["id"]] for k, v in answered.items()}
        expected = row.get("expected")
        if expected:
            # THE ARITHMETIC DECIDES — the tools' job on this row is to be caught disagreeing
            # with it, and that divergence is a fact about the TOOL (recorded), not a reason to
            # raise an alarm about the code. The owner's rule: it should not have to reason
            # about what the code already knows.
            final[row["id"]] = expected
            wrong = {k: v for k, v in votes.items() if v != expected}
            if wrong:
                divergences[row["id"]] = wrong
        elif len(set(votes.values())) == 1:
            final[row["id"]] = next(iter(votes.values()))
        else:
            final[row["id"]] = "attention"   # a judgement row split by the swarm needs a person
            dissent[row["id"]] = votes
    note_parts = []
    if dissent:
        note_parts.append("dissent: " + json.dumps(dissent))
    if divergences:
        note_parts.append("tool divergence: " + json.dumps(divergences))
    verdict = {
        "verdict": "attention" if (dissent or any(v == "attention" for v in final.values())) else "ok",
        "rows": [
            {"id": row["id"], "answer": final[row["id"]], "evidence": row["evidence"]}
            for row in sheet["rows"]
        ],
        "note": " · ".join(note_parts),
    }
    return {
        "verdict": verdict,
        "error": None,
        "dissent": dissent,
        "divergences": divergences,
        "answered_by": list(answered),
    }
def _token_totals(meta: Dict[str, Any]) -> Dict[str, int]:
    """The run's input/output tokens, summed from what each call itself reported.

    The provider's usage object is the only place these numbers exist — LM Studio's native
    chat returns `stats` shaped input_tokens/total_output_tokens, an OpenAI-shaped server
    returns prompt_tokens/completion_tokens — so both shapes are read. A run where neither
    arrived reads 0/0 rather than implying a cost it cannot show.
    """
    prompt = 0
    completion = 0
    stats_objects = [entry.get("stats") for entry in (meta.get("swarm") or {}).values()]
    stats_objects += [meta.get("review_stats"), meta.get("deep_stats"), meta.get("stats")]
    for stats in stats_objects:
        if not isinstance(stats, dict):
            continue
        prompt += int(stats.get("prompt_tokens") or stats.get("input_tokens") or 0)
        completion += int(stats.get("completion_tokens") or stats.get("total_output_tokens") or 0)
    return {"prompt_tokens": prompt, "completion_tokens": completion}


def _render_message(status: str, verdict: Optional[Dict[str, Any]], review: Optional[Dict[str, Any]],
                    facts: Dict[str, Any], meta: Dict[str, Any]) -> str:
    checker = facts.get("checker", {})
    lines = [
        f"INSPECTION — {status.upper()}  ·  {time.strftime('%Y-%m-%d %H:%M')}  ·  "
        f"{meta.get('model')} auditing, {meta.get('reviewer_model')} reviewing",
        "",
    ]
    if verdict:
        lines.append(f"Verdict: {verdict['verdict']}")
        for r in verdict["rows"]:
            mark = "✓" if r["answer"] == "ok" else "‼"
            extra = f" — {r['evidence']}" if r.get("evidence") else ""
            lines.append(f"  {mark} {r['id']}: {r['answer']}{extra}")
        if verdict.get("note"):
            lines.append(f"Note: {verdict['note']}")
        # ── WHAT IS IN GOOD ORDER, MEASURED ────────────────────────────────────────────
        # The owner, 2026-09-18: "It should be reporting success, not just failures." A report
        # that lists only problems reads as an alarm. Each item below is a fact this run
        # derived: the rows that passed, the counts that agree, the findings that are absent.
        passed = [r["id"] for r in verdict["rows"] if r["answer"] == "ok"]
        raised = [r for r in verdict["rows"] if r["answer"] != "ok"]
        derived = checker.get("open_by_check") or {}
        counts = facts.get("counts") or {}
        compared = counts.get("compared", 0)
        disagreements = counts.get("disagreements", 0)
        suppressions = derived.get("error-suppression", 0)
        successes = [
            f"{len(passed)} of {len(verdict['rows'])} rows pass"
            + (f" ({', '.join(passed)})" if passed else ""),
            f"{compared - disagreements} of {compared} recorded counts agree",
            f"{len(checker.get('blocking') or [])} blocking findings",
            f"{suppressions} suppressed failures on the governed path",
            f"{checker.get('checks_ran')} checks ran, verdict {checker.get('verdict')}",
        ]
        lines.append("Succeeded: " + " · ".join(successes))
        if raised:
            lines.append(
                "Needs a person: "
                + " · ".join(f"{r['id']} ({r['evidence']})" for r in raised)
            )
    else:
        lines.append(f"NOT DONE — {meta.get('error')}")
    if review:
        if review["agree"]:
            lines.append("Reviewer: agrees with every row.")
        else:
            lines.append(f"Reviewer: DISAGREES on {', '.join(review['flagged']) or '(unnamed)'} — {review.get('note')}")
    elif meta.get("review_error"):
        lines.append(f"Reviewer: did not confirm — {meta['review_error']}")
    if meta.get("deep"):
        lines.append(f"Deep pass: {meta['deep']}")
    elif meta.get("deep_error"):
        lines.append(f"Deep pass: not run — {meta['deep_error']}")
    lines.append("")
    lines.append(
        f"Checker: {checker.get('verdict')} · {checker.get('checks_ran')} checks · "
        f"suppressions run={checker.get('open_by_check', {}).get('error-suppression', 0)} · "
        f"open register rows={len(facts.get('register', {}).get('open') or [])} · "
        f"uncommitted files={facts.get('workspace', {}).get('changed_files')}"
    )
    costs = [f"{meta.get('model')}={meta.get('seconds')}s"] if meta.get("seconds") is not None else []
    if meta.get("review_seconds") is not None:
        costs.append(f"{meta.get('reviewer_model')}={meta['review_seconds']}s")
    # TOKEN BURN, ON THE RECORD. Token cost underlies every initiative here, so the report
    # carries it beside the seconds — a reduction a change claims is then readable, not
    # asserted (owner, 2026-09-19: "token burn is always underlying our initiatives").
    tokens = _token_totals(meta)
    if tokens["prompt_tokens"] or tokens["completion_tokens"]:
        costs.append(f"tokens {tokens['prompt_tokens']} in / {tokens['completion_tokens']} out")
    if costs:
        lines.append("Cost: " + " · ".join(costs))
    if meta.get("unloaded"):
        lines.append(f"Unloaded after the run: {', '.join(meta['unloaded'])}")
    return "\n".join(lines)


# ── the run ──────────────────────────────────────────────────────────────────


async def run_inspection(reason: str = "scheduled", file_message: bool = True) -> Dict[str, Any]:
    """Sheet → auditor → skeptic → the console conversation. One run at a time.

    `file_message=False` is for a run asked for IN the chat: that turn is itself stored in the
    conversation, so the inspector must not file a second copy of the same report. The rendered
    text is returned in `text` either way.
    """
    if _run_lock.locked():
        print("ℹ️  [inspection] a run is already in flight — this call was told so, not queued")
        return {"status": "in_flight"}

    async with _run_lock:
        import services as state

        meta: Dict[str, Any] = {
            "kind": "inspection",
            "at": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "reason": reason,
            "model": INSPECTION_MODEL_ID,
            "reviewer_model": INSPECTION_REVIEWER_MODEL_ID,
        }
        console = None
        if state.prompt_sessions_api:
            try:
                console = state.prompt_sessions_api.get_or_create_console_session(user_id=OWNER_ID)
            except Exception as exc:  # noqa: BLE001
                meta["console_error"] = f"the console conversation could not be opened ({exc})"
        conversation_id = (console or {}).get("conversation_id")

        previous = _previous_inspection(conversation_id)
        sheet = await asyncio.to_thread(build_sheet, previous)

        # THE CLOSEST FILED RECORDS, FROM OUR OWN STORE. Deterministic evidence, attached to
        # since-last-run and quoted by the code — never handed to the models as a task (the
        # protocol's rule: the repository is read by code, not by the tool). This is the
        # vector store's job here: the run's history stays queryable without ever being
        # dumped into a prompt.
        related_refs: List[str] = []
        try:
            import governance_vector
            open_ids = [str(r.get("id", "")) for r in (sheet.get("facts", {}).get("register", {}).get("open") or [])]
            query = " ".join(open_ids) or " ".join(r["id"] for r in sheet.get("rows", []))
            hits = governance_vector.search(query, k=4)
            related_refs = [f"{h.get('kind')}:{h.get('ref_id')}" for h in hits if h.get("ref_id")]
        except Exception as exc:  # noqa: BLE001 — a store that cannot answer says so
            meta["related_error"] = f"{type(exc).__name__}: {exc}"
        if related_refs:
            meta["related"] = related_refs
            for row in sheet.get("rows", []):
                if row.get("id") == "since-last-run":
                    row["evidence"] = (row["evidence"] + f" · closest filed records: {', '.join(related_refs)}")[:400]

        tools = _LocalTools()
        verdict: Optional[Dict[str, Any]] = None
        review: Optional[Dict[str, Any]] = None
        status = "not_done"

        swarm = await asyncio.to_thread(_swarm_audit_sync, tools, sheet, meta)
        verdict = swarm["verdict"]
        if verdict is None:
            meta["error"] = swarm["error"]
        else:
            meta["seconds"] = max(
                (v.get("seconds") or 0) for v in (meta.get("swarm") or {}).values()
            )

        # ── the skeptic: a DIFFERENT model, the answer it must not take on trust ──
        if verdict is not None:
            def _revise() -> Dict[str, Any]:
                note = tools.load(INSPECTION_REVIEWER_MODEL_ID)
                if note:
                    meta["reviewer_load_note"] = note
                return tools.chat(
                    INSPECTION_REVIEWER_MODEL_ID, _review_text(),
                    json.dumps({"rows": sheet["rows"], "auditor_answer": verdict}), 300,
                )

            rc = await asyncio.to_thread(_revise)
            if not rc.get("ok"):
                meta["review_error"] = rc.get("error")
            else:
                meta["review_seconds"] = rc.get("seconds")
                meta["review_stats"] = rc.get("stats")
                rparsed = _extract_json_object(rc["content"])
                rchecked = _validate_review(rparsed or {}, sheet) if rparsed else {"error": "the review contains no JSON object"}
                if "error" in rchecked:
                    meta["review_error"] = rchecked["error"]
                    meta["review_raw"] = rc["content"][:1000]
                else:
                    review = rchecked["review"]

        # The verdict the run reports: the auditor's, unless the skeptic would not confirm it.
        confirmed = bool(review and review["agree"])
        if verdict is None:
            status = "not_done"
        elif review is None:
            status = "unverified"
        elif confirmed:
            status = "ok"
        else:
            status = "attention"
            verdict = {**verdict, "verdict": "attention",
                       "note": (verdict.get("note") or "") + f" [reviewer disagrees: {', '.join(review['flagged'])}]"}

        meta["status"] = status
        meta["verdict"] = verdict.get("verdict") if verdict else None
        meta["rows"] = verdict["rows"] if verdict else None
        meta["review"] = review
        meta["expected"] = sheet["full_facts"]["expected_answers"]
        meta["facts"] = sheet["full_facts"]

        # ── THE DEEP PASS — the bigger tool, ONLY when a person is needed ──────────────
        # A clean run costs the two small tools and nothing else. When the status asks for a
        # person (attention) or the skeptic would not confirm (unverified), the deeper model
        # is asked to explain what to look at — with the A2UI primer from inspection.json in
        # front of it, so it knows what it is inspecting (the owner: "a great lightweight
        # small model to inspect code once it understands what a two UI is").
        needs_a_person = status in ("attention", "unverified") or (verdict and verdict["verdict"] == "attention")
        if needs_a_person:
            deep_cfg = next(
                (a for a in (_read_json(PROTOCOL_FILE) or {}).get("agents", []) if a.get("id") == "deep"),
                {},
            )
            primer = deep_cfg.get("primer", "")
            task = deep_cfg.get("task", "Explain what a person should look at.")

            def _deep() -> Dict[str, Any]:
                """THE DEEP ROLE WEARS THE ROSTER TOO: candidates in order, first that answers
                wins, and every attempt is recorded. Measured 2026-09-18: the 9B (a reasoning
                model) returned no message at 700 and at 2500 tokens — its whole budget went to
                thinking — so the pass must be able to fall to the next tool rather than report
                nothing while a working one sits idle. Not a hidden substitution: the attempts
                are in the record, with what each one did."""
                attempts: List[Dict[str, Any]] = []
                for key in _roster("deep"):
                    note = tools.load(key)
                    if note:
                        meta.setdefault("deep_load_notes", {})[key] = note
                    call = tools.chat(
                        key,
                        # /no_think FIRST. Measured 2026-09-18 on the 9B: without it, the
                        # model spends the ENTIRE budget reasoning and returns no message
                        # (1199/1199 reasoning tokens, 19 s, nothing said); with it, it answers
                        # in ~4 s. A directive is cheaper than a bigger budget.
                        f"/no_think\n{primer}\n\n{task}\nOutput JSON only: {{\"explanation\": \"at most 80 words\"}}",
                        json.dumps({
                            "status": status,
                            "rows": verdict["rows"] if verdict else None,
                            "review": review,
                            "error": meta.get("error"),
                        }),
                        1200,
                    )
                    attempt = {"model": key, "ok": bool(call.get("ok")), "seconds": call.get("seconds"),
                               "stats": call.get("stats")}
                    if call.get("ok"):
                        text_out = call["content"].strip()
                        dparsed = _extract_json_object(text_out)
                        if dparsed and isinstance(dparsed.get("explanation"), str):
                            attempt["explanation"] = dparsed["explanation"][:600]
                            attempts.append(attempt)
                            return {"explanation": attempt["explanation"], "by": key, "attempts": attempts,
                                    "seconds": call.get("seconds"), "stats": call.get("stats")}
                        # PLAIN PROSE IS AN ANSWER TOO. The deep pass asks for an explanation;
                        # a tool that writes it as prose answered, and refusing that added a
                        # failure with no gain (measured: both roster tools did this).
                        if 0 < len(text_out) <= 800:
                            attempt["explanation"] = text_out[:600]
                            attempt["form"] = "prose"
                            attempts.append(attempt)
                            return {"explanation": attempt["explanation"], "by": key, "attempts": attempts,
                                    "seconds": call.get("seconds"), "stats": call.get("stats")}
                        attempt["error"] = "no explanation in the answer"
                        attempt["raw"] = text_out[:300]
                    else:
                        attempt["error"] = call.get("error")
                    attempts.append(attempt)
                return {"error": "no tool in the deep roster returned an explanation", "attempts": attempts}

            deep = await asyncio.to_thread(_deep)
            meta["deep_attempts"] = deep.get("attempts")
            if deep.get("explanation"):
                meta["deep"] = deep["explanation"]
                meta["deep_by"] = deep.get("by")
                meta["deep_seconds"] = deep.get("seconds")
                meta["deep_stats"] = deep.get("stats")
            else:
                meta["deep_error"] = deep.get("error")

        # ── memory returns to its owner: unload what WE loaded ──
        unloaded = await asyncio.to_thread(tools.unload_ours)
        if unloaded:
            meta["unloaded"] = unloaded

        text = _render_message(status, verdict, review, sheet["full_facts"], meta)
        meta["text"] = text

        if file_message and conversation_id and state.conversation_api:
            try:
                state.conversation_api.add_message(conversation_id, OWNER_ID, "assistant", text, metadata=meta)
            except Exception as exc:  # noqa: BLE001
                print(f"❌ [inspection] the report could not be written to the console conversation: {exc}")
                meta["error"] = f"the report could not be filed ({exc})"
            # AND INTO POSTGRES FIRST — the relational home, where the row is counted,
            # filtered and joined (a report that concerns a package links to it) — then the
            # vector index of the same row, so the next run's retrieval can find it.
            try:
                import governance_store
                import governance_vector
                row = {"id": meta.get("at", ""), "at": meta.get("at", ""), "text": text}
                governance_store.upsert_items("inspection", [row])
                governance_vector.index_rows("inspection", [row])
            except Exception as exc:  # noqa: BLE001 — a store failure never kills the run
                print(f"⚠️  [inspection] the report could not be stored ({type(exc).__name__}: {exc})")
                meta["index_error"] = f"{type(exc).__name__}: {exc}"
        elif file_message:
            print("⚠️  [inspection] no console conversation available — the report was not filed")

        print(f"[inspection] {status} · reason={reason} · {meta.get('error') or meta.get('verdict')}")
        return {"status": status, "verdict": verdict, "review": review, "meta": meta, "text": text}


async def daily_loop() -> None:
    """The schedule: one run shortly after boot, then every INTERVAL_HOURS. Cancelled on shutdown."""
    await asyncio.sleep(FIRST_RUN_DELAY_SECONDS)
    while True:
        try:
            await run_inspection("scheduled")
        except asyncio.CancelledError:
            raise
        except Exception as exc:  # noqa: BLE001 — the loop must not die silently
            print(f"❌ [inspection] scheduled run failed: {exc}")
        await asyncio.sleep(max(60.0, INTERVAL_HOURS * 3600))
