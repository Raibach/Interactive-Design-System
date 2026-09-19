"""THE GOVERNANCE ROUTES — the manual trigger for one inspection.

The scheduled runs live in the app's lifespan (`governance_inspector.daily_loop`); this is the
same run, on demand. It is report-only by the owner's decision (2026-09-18): an inspection
writes findings into the console's own conversation and the trace, and opens no repairs.
"""

from fastapi import APIRouter

from governance_inspector import run_inspection

router = APIRouter()


@router.post("/api/governance/inspect")
async def inspect_now():
    """Run one inspection now, in the same shape a scheduled run takes.

    Returns the verdict (or the reason the run did NOT happen — a local model that is not
    answering is never substituted by another one).
    """
    try:
        return await run_inspection("manual")
    except Exception as exc:  # noqa: BLE001 — a failed run is SAYS so, never an empty 500
        return {"status": "error", "error": f"{type(exc).__name__}: {exc}"}
