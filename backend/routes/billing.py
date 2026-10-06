"""Billing — the plans, the free trial, and the one seam a payment provider plugs into.

WHAT WAS ALREADY HERE, AND HAD NEVER BEEN WIRED. `subscription_plans`, `user_subscriptions`,
`invoices` and `payment_methods` have been in the schema since it was written. Three plans are
seeded in it — free, pro and enterprise — and four subscription rows sit against them. Nothing
ever read any of it: no endpoint served a plan, nothing started a trial, and every `trial_end`
in the table is NULL. This file is the first thing that reads those rows.

WHY THIS CAN BE BUILT BEFORE THE PAYMENT PROVIDER IS CHOSEN, and it is the whole reason the
order is what it is: **a free trial moves no money.** A trial is a row with a date on it —
`user_subscriptions.trial_end`, the column that was already there — and starting one needs no
card. A provider is needed when the trial ENDS, at the first real charge. So everything in this
file works today, and the provider arrives at the seam below rather than underneath all of it.

WHAT THE FIRST CHARGE WILL NEED, checked here rather than discovered later: a customer at the
provider, a price that matches the plan being bought, and a way to be told the money arrived.
The columns for all three already exist and were named by whoever designed this schema —
`user_subscriptions.stripe_customer_id` and `.stripe_subscription_id`,
`subscription_plans.stripe_price_id_monthly` and `._yearly`, `invoices.stripe_invoice_id`. So
wiring a provider is FILLING THOSE IN, not adding a shape.

ONE NOTHING DOES TODAY, SAID PLAINLY: nothing in this application checks a subscription before
doing work. Starting a trial records a date; no endpoint refuses anything because that date has
passed. Enforcement is a separate decision — see the note on `trial_state` below.
"""
import os
from datetime import datetime, timedelta

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

import services as state
from deps import get_user_id_from_header

router = APIRouter()

# HOW LONG THE FREE TRIAL RUNS. An environment knob because it is a business decision and not a
# property of this code — fourteen days being the default people expect.
DEFAULT_TRIAL_DAYS = 14


def _db():
    """The pool the rest of the app uses. None when the database is down."""
    if not state.prompt_sessions_api:
        return None
    return state.prompt_sessions_api.get_db()


def _trial_days() -> int:
    try:
        return int(os.getenv("TRIAL_DAYS", str(DEFAULT_TRIAL_DAYS)))
    except ValueError:
        return DEFAULT_TRIAL_DAYS


# ══════════════════════════════════════════════════════════════════════════════════════════════
# THE SEAM. THE PAYMENT PROVIDER GOES HERE, AND NOWHERE ELSE.
#
# Everything in this file above and below this block is finished and testable without a provider.
# What a provider adds is the ability to take a card and to be told when money arrived, and both
# of those are the two functions below — which today answer "not configured" and nothing more.
#
# WHEN YOU WIRE IT: fill the four columns named in this file's header, replace the body of
# `_provider_checkout_url` with the provider's checkout call, and add whatever receives their
# webhook. Nothing above this line changes.
# ══════════════════════════════════════════════════════════════════════════════════════════════

def provider_configured() -> bool:
    """Whether a payment provider has been configured. False on every install today."""
    return bool(os.getenv("PAYMENT_PROVIDER_KEY", "").strip())


def _provider_checkout_url(user_id: str, plan_slug: str, cycle: str) -> str | None:
    """THE PROVIDER'S CHECKOUT, WHEN THERE IS ONE.

    Returns None when no provider is configured, and every caller treats None as "there is no
    provider" rather than as a failure — a trial needs no card, so a missing provider must not
    stop one from starting.

    A CONFIGURED KEY WITH NO CODE BEHIND IT IS AN ERROR, NOT A SILENT None. If somebody sets
    `PAYMENT_PROVIDER_KEY` and this function still returns None, the next thing that happens is
    a person being told their trial started and never being asked to pay. Raising here makes
    that a loud 501 during the attempt instead.
    """
    if not provider_configured():
        return None
    raise HTTPException(
        status_code=501,
        detail=(
            "A payment provider is configured but the checkout call has not been written yet — "
            "see the seam in backend/routes/billing.py."
        ),
    )


# ── WHAT THE REST OF THE APPLICATION MAY ASK ─────────────────────────────────────────────────
#
# `trial_state` USED TO LIVE HERE and was deleted the same hour it was written: the only caller
# turned out to want the plan's name beside the trial's dates, so the two endpoints below read
# the row themselves (`_trial_fields` is the shared half, and it is shared because both of them
# genuinely need it). A helper written for a caller that does not exist is the shape of thing
# that outlives everyone who could explain it.


@router.get("/api/billing/plans")
async def list_plans():
    """The plans on offer.

    READ FROM THE TABLE, not from a list here: `subscription_plans` has held three rows since
    the schema was written, and a price written into code is a price that disagrees with the
    database the moment somebody changes one of them. Inactive plans are left out — `is_active`
    is the switch for retiring one without deleting the subscriptions that point at it.
    """
    conn = _db()
    if conn is None:
        raise HTTPException(status_code=503, detail="Database not available")
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT slug, name, description, price_monthly, price_yearly,
                   queries_per_month, memory_storage_mb, features, sort_order
            FROM subscription_plans
            WHERE is_active = TRUE
            ORDER BY sort_order, price_monthly
            """
        )
        plans = []
        for r in cursor.fetchall():
            plans.append({
                "slug": r["slug"],
                "name": r["name"],
                "description": r["description"],
                "price_monthly": float(r["price_monthly"]) if r["price_monthly"] is not None else 0.0,
                "price_yearly": float(r["price_yearly"]) if r["price_yearly"] is not None else None,
                "queries_per_month": r["queries_per_month"],
                "memory_storage_mb": r["memory_storage_mb"],
                "features": r["features"] or {},
            })
        return {"plans": plans, "trial_days": _trial_days(), "provider_configured": provider_configured()}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not read the plans: {exc}")
    finally:
        conn.close()


@router.get("/api/billing/subscription")
async def my_subscription(x_user_id: str | None = Header(None, alias="X-User-ID")):
    """This identity's plan and trial — the one call the shell needs to know where it stands."""
    conn = _db()
    if conn is None:
        raise HTTPException(status_code=503, detail="Database not available")
    uid = get_user_id_from_header(x_user_id)
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT s.status, s.billing_cycle, s.trial_end, s.current_period_start,
                   s.current_period_end, s.cancel_at_period_end,
                   p.slug AS plan_slug, p.name AS plan_name, p.price_monthly
            FROM user_subscriptions s
            JOIN subscription_plans p ON p.id = s.plan_id
            WHERE s.user_id = %s
            ORDER BY s.created_at DESC
            LIMIT 1
            """,
            (uid,),
        )
        row = cursor.fetchone()
        if not row:
            return {"plan": None, "subscription": None, "provider_configured": provider_configured()}
        return {
            "plan": {"slug": row["plan_slug"], "name": row["plan_name"], "price_monthly": float(row["price_monthly"] or 0)},
            "subscription": {
                "status": row["status"],
                "billing_cycle": row["billing_cycle"],
                "cancel_at_period_end": row["cancel_at_period_end"],
                **_trial_fields(row),
            },
            "provider_configured": provider_configured(),
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not read the subscription: {exc}")
    finally:
        conn.close()


def _trial_fields(row) -> dict:
    trial_end = row["trial_end"]
    days_left = max(0, (trial_end - datetime.now()).days) if trial_end else None
    return {
        "trial_end": trial_end.isoformat() if trial_end else None,
        "trial_days_left": days_left,
    }


class StartTrialRequest(BaseModel):
    plan_slug: str = "pro"
    billing_cycle: str = "monthly"


@router.post("/api/billing/start-trial")
async def start_trial(
    request: StartTrialRequest,
    x_user_id: str | None = Header(None, alias="X-User-ID"),
):
    """START THE FREE TRIAL — the step the sign-up wizard's last screen takes.

    NO CARD, NO PROVIDER, NO CHARGE: it writes `trial_end` on a subscription row and returns.
    That is the whole of a trial, and it is why this endpoint is finished before the payment
    provider is.

    ONE TRIAL PER IDENTITY, ENFORCED BY THE DATA RATHER THAN BY THIS CODE. If a subscription row
    already exists for this person, the trial is NOT restarted — moving `trial_end` forward on
    every visit would make the trial endless, which is the one thing a trial must not be.
    A row that already has a `trial_end` gets that same date back and a `already_started` flag,
    so the screen can say "your trial ends on…" instead of pretending to start a second one.

    THE PLAN IS THE ONE ASKED FOR, and an unknown slug is refused by name rather than silently
    falling back to free — a person who chose Pro and silently got Free has been lied to by the
    software, which is worse than an error message.
    """
    conn = _db()
    if conn is None:
        raise HTTPException(status_code=503, detail="Database not available")
    uid = get_user_id_from_header(x_user_id)
    cycle = (request.billing_cycle or "monthly").strip().lower()
    if cycle not in ("monthly", "yearly"):
        conn.close()
        raise HTTPException(status_code=400, detail="billing_cycle must be 'monthly' or 'yearly'")

    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, name, slug FROM subscription_plans WHERE slug = %s AND is_active = TRUE",
            ((request.plan_slug or "").strip().lower(),),
        )
        plan = cursor.fetchone()
        if not plan:
            raise HTTPException(
                status_code=404,
                detail=f"There is no active plan called '{request.plan_slug}'.",
            )

        cursor.execute(
            """
            SELECT s.id, s.status, s.trial_end, s.billing_cycle,
                   p.slug AS plan_slug, p.name AS plan_name
            FROM user_subscriptions s
            JOIN subscription_plans p ON p.id = s.plan_id
            WHERE s.user_id = %s
            ORDER BY s.created_at DESC
            LIMIT 1
            """,
            (uid,),
        )
        existing = cursor.fetchone()

        if existing and existing["trial_end"]:
            # A trial already runs for this identity. Report it; do not move its end.
            #
            # THE PLAN REPORTED IS THE ONE THE TRIAL RUNS ON, not the one just asked for: this
            # branch ignores `plan_slug` entirely, and echoing the request back would tell the
            # person they had been moved to a plan nothing moved them to.
            return {
                "success": True,
                "already_started": True,
                "plan_slug": existing["plan_slug"],
                "plan_name": existing["plan_name"],
                "billing_cycle": existing["billing_cycle"],
                "trial_end": existing["trial_end"].isoformat(),
                "trial_days_left": max(0, (existing["trial_end"] - datetime.now()).days),
            }

        trial_end = datetime.now() + timedelta(days=_trial_days())
        if existing:
            cursor.execute(
                """
                UPDATE user_subscriptions
                   SET plan_id = %s, status = 'trialing', billing_cycle = %s,
                       trial_end = %s, current_period_start = NOW(), current_period_end = %s,
                       updated_at = NOW()
                 WHERE id = %s
                """,
                (plan["id"], cycle, trial_end, trial_end, existing["id"]),
            )
        else:
            cursor.execute(
                """
                INSERT INTO user_subscriptions
                       (user_id, plan_id, status, billing_cycle,
                        current_period_start, current_period_end, trial_end)
                VALUES (%s, %s, 'trialing', %s, NOW(), %s, %s)
                """,
                (uid, plan["id"], cycle, trial_end, trial_end),
            )
        conn.commit()

        # THE PROVIDER, IF THERE IS ONE. Called AFTER the row is committed and its answer is not
        # required for the trial to exist — a trial that started is a trial that started, whether
        # or not a card was ever taken. Today it returns None and nothing is asked of the person.
        checkout_url = _provider_checkout_url(uid, plan["slug"], cycle)

        return {
            "success": True,
            "already_started": False,
            "plan_slug": plan["slug"],
            "trial_end": trial_end.isoformat(),
            "trial_days_left": _trial_days(),
            "checkout_url": checkout_url,
        }
    except HTTPException:
        raise
    except Exception as exc:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Could not start the trial: {exc}")
    finally:
        conn.close()
