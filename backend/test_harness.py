"""Permanent test harness for forced persistence failures.

The row 8 browser tests used temporary DB triggers to force `conversation_messages` writes to
fail. Those triggers are gone; this is the permanent seam. A test (or a test server started with
`CONSOLE_TEST_FORCED_FAILURE=user|assistant`) can make the teacher's write fail without touching
the database schema.

Production has no forced role, so `maybe_fail` is a no-op. The flag is server-side only; no
browser request can set it.
"""
from __future__ import annotations

import os
from contextlib import contextmanager

_FORCED_FAILURE: str | None = os.getenv("CONSOLE_TEST_FORCED_FAILURE", "").strip() or None


class ForcedPersistenceError(RuntimeError):
    """The test harness was asked to make this turn's write fail."""


def forced_failure(role: str) -> bool:
    return _FORCED_FAILURE == role


def maybe_fail(role: str) -> None:
    if forced_failure(role):
        raise ForcedPersistenceError(f"forced {role} persistence failure (test harness)")


@contextmanager
def force_failure(role: str):
    """Force one role's write to fail for the duration of the block, then restore."""
    global _FORCED_FAILURE
    previous = _FORCED_FAILURE
    _FORCED_FAILURE = role
    try:
        yield
    finally:
        _FORCED_FAILURE = previous
