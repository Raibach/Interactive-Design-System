"""
repair_apply — the one place in this project that overwrites source code.

A repair is only real if the file changes. Until this module existed, nothing in
the run path could write one: the only tool a run may execute is a READ
(`figma.get_design_context`, see figma_mcp.SUPPORTED_TOOLS), and /api/files/write
accepts only .md/.mdx under three documentation directories. So no code path in
the app could correct a component, and an answer that said "Correction applied"
was describing a write that could not have happened.

Two rules keep that from turning into corruption:

  the target   must be the app's own source (frontend/src), must already EXIST,
               must be .ts/.tsx/.json, and must resolve inside the repo — so a
               path that came back from a model cannot reach .git, node_modules,
               build output or .env;
  the content  must look COMPLETE before a byte is written (`looks_complete`):
               a truncated, half-applied or patch-shaped answer is refused and
               reported, never saved.

Every write keeps a timestamped backup of the file it replaced, so the previous
version is always one rename away.

Kept apart from routes/files.py on purpose: it imports nothing but the standard
library, so it can be exercised directly, and because being the only writer is a
thing a reader should be able to verify by looking at one small file.
"""

import os
import subprocess
from datetime import datetime
from typing import Optional

# backend/repair_apply.py -> the repository root it is allowed to work inside.
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

# The app's own source, and nothing else. A repair corrects the app; it does not
# rewrite the server (that is how you lose the endpoint that writes), and it does
# not touch configuration.
ALLOWED_PREFIXES = ("frontend/src/",)
ALLOWED_SUFFIXES = (".ts", ".tsx", ".json")
BLOCKED_PARTS = (".git", "node_modules", "dist", "build", ".venv", "__pycache__")

# A correction may legitimately DELETE lines. It may not halve the file: that is
# what a cut-off answer looks like.
MIN_KEEP = 0.5
# Below this, "shorter than half" is meaningless — a 4-line file is not truncated.
MIN_LENGTH_FOR_RATIO = 200


class Refused(Exception):
    """The change was not applied. `str(exc)` is shown to the person, so it is
    written the way they would say it out loud."""


def target_path(path: str) -> str:
    """The absolute path a repair may write, or `Refused` explaining why not."""
    raw = (path or "").strip().strip("`").strip()
    if not raw:
        raise Refused("the answer did not name a file")
    if "\x00" in raw:
        raise Refused("the file name contains a null byte")
    if os.path.isabs(raw) or raw.startswith("~"):
        raise Refused(f"'{raw}' is not a path inside this project")

    # Normalise BEFORE the checks, and reject traversal outright rather than
    # letting it be clipped: an answer that tries to leave the source tree is not
    # a repair that needs a second chance.
    normalised = os.path.normpath(raw).replace(os.sep, "/")
    if normalised.startswith("../") or "/../" in normalised or normalised == "..":
        raise Refused(f"'{raw}' climbs out of this project")
    if not normalised.startswith(ALLOWED_PREFIXES):
        raise Refused(
            f"'{normalised}' is not one of the app's own files "
            f"(a repair may only change files under {ALLOWED_PREFIXES[0]})"
        )
    if not normalised.endswith(ALLOWED_SUFFIXES):
        raise Refused(
            f"'{normalised}' is not a file a repair can write "
            f"({'/'.join(ALLOWED_SUFFIXES)})"
        )
    if any(part in BLOCKED_PARTS for part in normalised.split("/")):
        raise Refused(f"'{normalised}' is inside a directory repairs may not write")

    full = os.path.abspath(os.path.join(REPO_ROOT, normalised))
    # Resolve symlinks too: the checks above reason about the name, this one
    # reasons about where the name actually points.
    if not (full == REPO_ROOT or full.startswith(REPO_ROOT + os.sep)):
        raise Refused(f"'{normalised}' resolves outside this project")
    if os.path.islink(full) and not os.path.realpath(full).startswith(REPO_ROOT + os.sep):
        raise Refused(f"'{normalised}' is a link out of this project")
    if not os.path.isfile(full):
        raise Refused(f"'{normalised}' does not exist, and a repair only changes a file that does")
    return full


def _unbalanced(text: str) -> Optional[str]:
    """Name the bracket that is left open, if one is. A truncated answer shows up
    here first: a file cut mid-way has opened more than it closed."""
    for opener, closer, what in (("{", "}", "curly brace"), ("(", ")", "round bracket"),
                                 ("[", "]", "square bracket")):
        if text.count(opener) != text.count(closer):
            opened, closed = text.count(opener), text.count(closer)
            return (
                f"more {what}s open than close ({opened} vs {closed}), "
                "which is what an answer that was cut off looks like"
            )
    return None


def looks_complete(original: str, corrected: str, path: str = "") -> tuple[bool, str]:
    """(usable, why-not). Called BEFORE the file is touched; nothing is written
    when this says no, so a bad answer costs a sentence instead of a file."""
    if not corrected or not corrected.strip():
        raise Refused("the answer came back with no file in it")
    if corrected.strip() == original.strip():
        raise Refused("the answer is the file unchanged, so there is nothing to apply")

    # A patch is not a file. This app replaces the whole file; it cannot read a
    # diff, and saving one would put its markers into source.
    head = corrected.lstrip().splitlines()
    if head and (head[0].startswith(("---", "***", "diff ")) or
                 any(l.startswith("+++ ") for l in head[:8]) or
                 any(l.startswith("@@") for l in head[:40])):
        raise Refused(
            "the answer came back as a patch rather than the whole file, and this app "
            "replaces whole files — it cannot apply a diff"
        )

    if path.endswith(".json"):
        import json
        try:
            json.loads(corrected)
        except Exception as e:
            raise Refused(f"the answer is not valid JSON ({e}), so it was not written")
    elif len(original) >= MIN_LENGTH_FOR_RATIO and len(corrected) < len(original) * MIN_KEEP:
        raise Refused(
            f"the answer is {len(corrected.splitlines())} lines where the file has "
            f"{len(original.splitlines())}, which is too much of a drop to be a correction"
        )
    elif _unbalanced(corrected):
        raise Refused(f"the answer has {_unbalanced(corrected)}")

    return True, ""


def _with_final_newline(original: str, corrected: str) -> str:
    """A file that ended in a newline keeps one. Cheap, and it stops a rewrite
    from showing up in every future diff as 'no newline at end of file'."""
    if original.endswith("\n") and not corrected.endswith("\n"):
        return corrected + "\n"
    return corrected


def read_source(path: str) -> dict:
    """The file as it is now, for the prompt that has to change it."""
    full = target_path(path)
    with open(full, "r", encoding="utf-8") as f:
        content = f.read()
    return {
        "path": os.path.relpath(full, REPO_ROOT).replace(os.sep, "/"),
        "content": content,
        "size": len(content),
        "lines": len(content.splitlines()),
    }


def apply_repair(path: str, content: str) -> dict:
    """Write `content` over the file at `path`, keeping a backup.

    Raises `Refused` (with a person-readable sentence) when the target is not
    writable or the content does not look whole. Returns what happened when it
    does, so the caller can SAY it in the chat instead of asserting it.
    """
    full = target_path(path)
    with open(full, "r", encoding="utf-8") as f:
        original = f.read()

    looks_complete(original, content, path)          # raises Refused
    corrected = _with_final_newline(original, content)

    backup = f"{full}.backup.{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    with open(backup, "w", encoding="utf-8") as f:
        f.write(original)

    # Write to a sibling and rename, so a half-written file is never the live one.
    temp = f"{full}.repairing"
    with open(temp, "w", encoding="utf-8") as f:
        f.write(corrected)
    os.replace(temp, full)

    rel = os.path.relpath(full, REPO_ROOT).replace(os.sep, "/")
    return {
        "path": rel,
        "bytes": len(corrected),
        "backup": os.path.basename(backup),
        "lines_before": len(original.splitlines()),
        "lines_after": len(corrected.splitlines()),
    }


# ── After the write: a verdict worth having ────────────────────────────────
#
# The report the app reads (/api/catalog/audit) is produced by
# frontend/scripts/catalog-check.mjs, which was removed from this project along
# with the rest of the governance tooling. This function is kept because it fails
# honestly: with the checker absent it returns {"ran": False, "why": …}, and the
# caller reports that the check did not run instead of inventing a verdict. A
# stale report left on disk must never be read as a fresh one.

DEFAULT_CATALOG = "prompt-composer"
CHECK_TIMEOUT = 180


def rerun_catalog_check(catalog: str = DEFAULT_CATALOG, timeout: int = CHECK_TIMEOUT) -> dict:
    """Re-derive the catalog report now that a file has changed.

    Never raises. A checker that could not run is reported as `{"ran": False, "why": …}`:
    "the check did not run" and "the check passed" are different facts, and the caller
    says which one it is instead of choosing one of them for the reader.
    """
    frontend = os.path.join(REPO_ROOT, "frontend")
    if not os.path.isfile(os.path.join(frontend, "scripts", "catalog-check.mjs")):
        return {"ran": False, "why": "the checker is not in this project"}
    try:
        proc = subprocess.run(
            ["node", "scripts/catalog-check.mjs", "--catalog", catalog],
            cwd=frontend, capture_output=True, text=True, timeout=timeout,
        )
    except FileNotFoundError:
        return {"ran": False, "why": "node is not installed on this machine"}
    except subprocess.TimeoutExpired:
        return {"ran": False, "why": f"the check did not finish in {timeout}s"}

    verdict = ""
    for line in (proc.stdout or "").splitlines():
        if line.strip().startswith("VERDICT:"):
            verdict = line.strip()
    return {
        "ran": True,
        "exit_code": proc.returncode,
        "catalog": catalog,
        # The checker FAILS its own run when findings stay open, so a non-zero exit
        # here is not an error in the check — it is the check reporting the catalog.
        "verdict": verdict or ("no findings" if proc.returncode == 0 else "findings remain"),
    }
