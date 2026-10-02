"""Demo-policy drift check — run from backend/: `python check_demo_policy.py`.

WHY THIS EXISTS
───────────────
demo_policy.py names demo-allowed routes by their FastAPI path templates. If a
route is renamed or removed, the allowlist entry silently stops matching: the
demo fails CLOSED (that feature is refused), which is safe but invisible. This
script makes the failure loud at build time instead of at a visitor's click — it
asserts every allowlist and pass-list entry exists in `app.routes`, and that
every GET-denylist prefix has a route behind it. It also prints every mutating
route with its demo disposition, so whoever reviews a NEW route can see it is
denied until someone adds it to the allowlist on purpose.

Exit codes: 0 = policy and routes agree; 1 = drift, named line by line.
"""
import sys

from fastapi.routing import APIRoute

from demo_policy import ALLOWED_MUTATIONS, GET_DENYLIST_PREFIXES, PASS_LIST
from main import app

MUTATING_METHODS = ("POST", "PUT", "PATCH", "DELETE")


def main() -> int:
    route_pairs: set[tuple[str, str]] = set()
    get_paths: list[str] = []
    mutating: list[tuple[str, str]] = []

    for route in app.routes:
        if not isinstance(route, APIRoute):
            continue
        for method in route.methods:
            route_pairs.add((method.upper(), route.path))
            if method.upper() == "GET":
                get_paths.append(route.path)
            if method.upper() in MUTATING_METHODS:
                mutating.append((method.upper(), route.path))

    problems: list[str] = []
    notes: list[str] = []

    for method, template in sorted(set(ALLOWED_MUTATIONS) - route_pairs):
        problems.append(
            f"allowlist entry {method} {template} matches no route in app.routes — "
            "the route was renamed or removed, and the demo now refuses it"
        )

    for method, path in sorted(set(PASS_LIST) - route_pairs):
        problems.append(f"pass-list entry {method} {path} matches no route")

    # An unbacked denylist prefix is a NOTE, not drift: it denies a route that does
    # not exist yet, which is the future-proofing it is there for (see the comment
    # on /api/debug/ in demo_policy.py). An unbacked ALLOWLIST entry is drift.
    for prefix in GET_DENYLIST_PREFIXES:
        if not any(path.startswith(prefix) for path in get_paths):
            notes.append(f"GET denylist prefix {prefix!r} has no route behind it today")

    allow = set(ALLOWED_MUTATIONS)
    print(f"Loaded {len(route_pairs)} (method, path) pairs from app.routes.")
    print(f"Mutating routes: {len(mutating)} — disposition when DEMO_MODE=1:")
    for method, path in sorted(mutating):
        if (method, path) in allow:
            disposition = "ALLOWED"
        elif (method, path) in PASS_LIST:
            disposition = "pass-list"
        else:
            disposition = "denied"
        print(f"  {disposition:<9} {method:<7} {path}")

    if notes:
        print("\nℹ️  Notes (not failures):")
        for note in notes:
            print(f"  - {note}")

    if problems:
        print("\n❌ DEMO POLICY DRIFT:")
        for problem in problems:
            print(f"  - {problem}")
        return 1

    print(
        "\n✅ demo_policy and app.routes agree — every allowlist and pass-list entry "
        "exists; denylist prefixes without a route are noted above, not drift."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
