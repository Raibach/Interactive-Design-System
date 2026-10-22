"""THE HUMAN-INTERACTION READS — funnels, pacing, friction. Read-only, three doors.

Each is a GET with nothing to configure but the question: the steps in the order a person walks
them, the flow they belong to, the window. No writes, no model call, no vendor. The maths lives in
`element_analytics.py`, beside the rule it implements.
"""

from __future__ import annotations

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from element_analytics import funnel, friction, pacing

router = APIRouter()


def _steps(raw: str) -> list[str]:
    return [step.strip() for step in raw.split(",") if step.strip()]


@router.get("/api/elements/funnel")
def elements_funnel(
    steps: str = Query(..., description="the funnel's steps, in order, comma-separated"),
    flow: str | None = Query(None, description="the composer package's session id; omit for all flows"),
    window_minutes: int | None = Query(None, description="the conversion window from the first step"),
):
    try:
        body = funnel(_steps(steps), flow, window_minutes)
        return JSONResponse(status_code=200, content={"status": "ok", **body})
    except (ValueError, RuntimeError) as exc:
        return JSONResponse(status_code=422, content={"status": "refused", "error": str(exc)})
    except Exception as exc:  # said out loud, with its type — never an empty 500
        return JSONResponse(
            status_code=503,
            content={"status": "error", "error": f"{type(exc).__name__}: {exc}"},
        )


@router.get("/api/elements/pacing")
def elements_pacing(
    steps: str = Query(..., description="two or more steps, in order, comma-separated"),
    flow: str | None = Query(None),
):
    try:
        body = pacing(_steps(steps), flow)
        return JSONResponse(status_code=200, content={"status": "ok", **body})
    except (ValueError, RuntimeError) as exc:
        return JSONResponse(status_code=422, content={"status": "refused", "error": str(exc)})
    except Exception as exc:
        return JSONResponse(
            status_code=503,
            content={"status": "error", "error": f"{type(exc).__name__}: {exc}"},
        )


@router.get("/api/elements/friction")
def elements_friction(
    element_key: str | None = Query(None, description="the catalogue tag to narrow to"),
    flow: str | None = Query(None),
    window_seconds: int = Query(2, ge=1, le=60),
    min_repeats: int = Query(3, ge=2, le=50),
):
    try:
        body = friction(element_key, flow, window_seconds, min_repeats)
        return JSONResponse(status_code=200, content={"status": "ok", **body})
    except RuntimeError as exc:
        return JSONResponse(status_code=422, content={"status": "refused", "error": str(exc)})
    except Exception as exc:
        return JSONResponse(
            status_code=503,
            content={"status": "error", "error": f"{type(exc).__name__}: {exc}"},
        )
