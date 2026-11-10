"""console_scope — ONE definition of what the console may draw.

The eligibility predicate used to exist in three places (the index scope, the push-down reader,
the id reader), which is how the 350-index/23-eligible drift happened. This module is the single
source: `ELIGIBILITY_SQL` is the clause set, `ELIGIBILITY_VERSION` is a hash of it recorded on
every indexed vector and every surface turn, so a replay can say when the predicate changed
instead of silently drawing a different set.

No literal `%` anywhere: `starts_with` replaces `LIKE 'prefix%'`, so the same SQL is safe with or
without psycopg2 parameters.
"""
from __future__ import annotations

import hashlib

# Read as: the row is not archived, is not an unsaved draft, is not the console's own row, is not
# a governance container, is not a design container (a kept design_session is a card), and is not
# one of the design room's conversation pages.
CLAUSES: tuple[str, ...] = (
    "ps.is_archived IS NOT TRUE",
    "(ps.metadata->>'draft') IS DISTINCT FROM 'true'",
    "COALESCE(ps.metadata->>'session_type', 'prompt_engineering') <> 'console'",
    "NOT starts_with(COALESCE(ps.metadata->>'session_type', 'prompt_engineering'), 'governance')",
    (
        "("
        "NOT starts_with(COALESCE(ps.metadata->>'session_type', 'prompt_engineering'), 'design')"
        " OR COALESCE(ps.metadata->>'session_type', 'prompt_engineering') = 'design_session'"
        ")"
    ),
    (
        "NOT ("
        "COALESCE(ps.metadata->>'session_type', '') = 'design_tab'"
        " AND COALESCE(ps.metadata->>'design_tab', '') IN ('chat','ux','console')"
        ")"
    ),
)

ELIGIBILITY_SQL = " AND ".join(CLAUSES)
ELIGIBILITY_VERSION = hashlib.sha1(ELIGIBILITY_SQL.encode("utf-8")).hexdigest()[:12]
