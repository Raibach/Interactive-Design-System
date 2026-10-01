"""Give every component in the catalogue its own row — the package each record hangs off.

WHAT THIS IS FOR. A component's identity lives in the catalogue file
(`frontend/src/components/A2UI/catalogs/<surface>/catalog.json`), and a component's record —
what happened to it, what has been said about it, how it changed, how it performs — lives in the
four `design_element_*` tables. Those four all hang off `element_id`, and until now there was no
element row for anything to hang off: `design_master` had zero rows. This reads the catalogue and
creates one row per component, at the level `init_db.py` already documents:

    'design_master'     one per element of a catalogue

WHY IT IS SAFE TO RUN TWICE. The row is keyed `(catalogue_id, element_key)` and the database holds
that rule as a partial unique index (`idx_prompt_sessions_design_master_per_element`), so this uses
the same `ON CONFLICT DO NOTHING` the containers use: running it again writes nothing, and two
runs landing together cannot make two rows for one component.

WHAT IT DOES NOT DO. It does not copy the component, its props or its drawing into the row — the
file remains what draws it. It does not create rows for the composers prompts (those are packages
already, at the untyped level) and it creates no children: an element inside an element
(`design_child`) is created when one actually appears, not in advance.

Usage:  DATABASE_URL=... .venv/bin/python sync_design_elements.py
"""
from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from prompt_sessions_api import PromptSessionsAPI  # noqa: E402
from deps import A2UI_CATALOG_SURFACES  # noqa: E402

# Which catalogues are THIS system's. Taken from the server's own list (`deps.py`) rather than
# restated: the surfaces the server validates are the surfaces whose components belong to the
# design system, and the other catalogues in that directory (ecommerce, primitives) are other
# systems with their own ids.
CATALOG_DIR = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "..", "frontend", "src", "components", "A2UI", "catalogs",
)
DESIGN_SYSTEM = "raibach-ids"
DESIGN_SYSTEM_TITLE = "Raibach IDS"
DEFAULT_USER_ID = os.getenv("DEFAULT_USER_ID", "00000000-0000-0000-0000-000000000001")


def read_catalogues() -> dict[str, dict]:
    """Every component the catalogues declare, by name, with the facts the files carry.

    A name in more than one catalogue is one entry that lists both — the owner's rule for these
    files: *"they have to be entered in composer, and then they have to be re-entered into the
    design… they can share the same name."*
    """
    elements: dict[str, dict] = {}
    for surface in sorted(A2UI_CATALOG_SURFACES):
        path = os.path.join(CATALOG_DIR, surface, "catalog.json")
        if not os.path.isfile(path):
            continue
        with open(path) as fh:
            catalog = json.load(fh)
        for name, spec in (catalog.get("components") or {}).items():
            entry = elements.setdefault(name, {"name": name, "catalogs": [], "description": ""})
            entry["catalogs"].append(surface)
            description = (spec or {}).get("description")
            if description and not entry["description"]:
                entry["description"] = description[:900]
    return elements


def database_url() -> str:
    """The connection string: the environment's, or the one this checkout uses."""
    url = os.getenv("DATABASE_URL")
    if url:
        return url
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    if os.path.isfile(env_path):
        for line in open(env_path):
            if line.startswith("DATABASE_URL="):
                return line.split("=", 1)[1].strip().strip('"')
    raise SystemExit("DATABASE_URL is not set and backend/.env has none")


def log_activity(cur, element_id, action: str, detail: dict) -> None:
    """One line in an element's trail. The trail is the design room's audit log — every add, every
    change and every removal, each entry naming the element it happened to."""
    cur.execute(
        """INSERT INTO design_element_activity (element_id, user_id, actor, action, detail)
           VALUES (%s, NULL, 'catalogue-sync', %s, %s::jsonb)""",
        (element_id, action, json.dumps(detail)),
    )


def main() -> None:
    api = PromptSessionsAPI(database_url())
    elements = read_catalogues()
    print(f"catalogue contains {len(elements)} components")

    catalogue = api.get_or_create_design_container(
        user_id=DEFAULT_USER_ID,
        kind="design_catalogue",
        title=DESIGN_SYSTEM_TITLE,
        description="The catalogue this design system's components are drawn from.",
        keys={"design_system": DESIGN_SYSTEM},
    )
    if not catalogue:
        raise SystemExit("the design catalogue row could not be resolved — is the database up?")

    # ── WHAT THE FILE SAYS, AGAINST WHAT THE ROW SAYS ───────────────────────────────────────
    #
    # THE ROW IS NEVER DELETED, AND THE FILE IS NOT THE ONLY WITNESS. Taking a component out of a
    # catalogue does not take it out of the record — the owner, 2026-09-30: *"when I remove them
    # from the lit catalog… that removal becomes a part of a audit log about activity within the
    # design section and I can go and click on that old entry, even though it was removed and see
    # what it was… There is no removal of the data… the metadata stays there even when you remove a
    # component, only a super admin can manage that database."* So a name that has left the file is
    # ARCHIVED — `prompt_sessions.is_archived`, which the table already carries — and an entry in
    # its trail says when it went and what it was. Nothing here ever runs a DELETE.
    #
    # AND EVERY CHANGE IS AN EVENT WHILE THE ELEMENT STAYS ONE ELEMENT — the other half of the same
    # instruction: *"sometimes components might change 56 times a day, all of that gets logged in
    # there, but we're not creating new sections every single time we add an update to an existing
    # catalogue item."* An element edited fifty times is one row with fifty entries.
    with api.get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """SELECT id, metadata, description, is_archived FROM prompt_sessions
                WHERE user_id = %s AND metadata->>'session_type' = 'design_master'
                  AND metadata->>'catalogue_id' = %s""",
            (DEFAULT_USER_ID, str(catalogue["id"])),
        )
        existing: dict[str, dict] = {}
        for row in cur.fetchall():
            if isinstance(row, dict):
                record = {"id": row["id"], "metadata": row.get("metadata"),
                          "description": row.get("description"), "is_archived": row.get("is_archived")}
            else:
                record = {"id": row[0], "metadata": row[1], "description": row[2], "is_archived": row[3]}
            meta = record["metadata"]
            if isinstance(meta, str):
                meta = json.loads(meta) if meta.strip() else {}
            record["meta"] = meta or {}
            existing[record["meta"].get("element_key")] = record

        added = changed = removed = 0
        for name, facts in sorted(elements.items()):
            catalogs = ",".join(sorted(set(facts["catalogs"])))
            row = existing.get(name)
            if row is None:
                created_row = api.get_or_create_design_container(
                    user_id=DEFAULT_USER_ID,
                    kind="design_master",
                    title=name,
                    description=facts["description"],
                    keys={
                        "catalogue_id": str(catalogue["id"]),
                        "element_key": name,
                        "catalogs": catalogs,
                        "element_source": "catalogue-file",
                    },
                )
                if created_row:
                    log_activity(cur, created_row["id"], "catalogue-added",
                                 {"element_key": name, "catalogs": catalogs})
                added += 1
                continue

            was_archived = bool(row.get("is_archived"))
            before_desc = row.get("description") or ""
            before_cats = row["meta"].get("catalogs") or ""
            if before_desc != facts["description"] or before_cats != catalogs or was_archived:
                cur.execute(
                    """UPDATE prompt_sessions
                          SET metadata = metadata || %s::jsonb,
                              description = %s,
                              is_archived = FALSE,
                              updated_at = NOW()
                        WHERE id = %s""",
                    (json.dumps({"catalogs": catalogs}), facts["description"], row["id"]),
                )
                log_activity(cur, row["id"], "catalogue-restored" if was_archived else "catalogue-updated", {
                    "element_key": name,
                    "description_changed": before_desc != facts["description"],
                    "catalogs": {"from": before_cats, "to": catalogs},
                })
                changed += 1

        # Names that have left the file. Their rows stay, their trail grows, and their status says
        # they are gone — which is what makes an old entry clickable a year from now.
        for name, row in existing.items():
            if name in elements or row.get("is_archived"):
                continue
            cur.execute(
                "UPDATE prompt_sessions SET is_archived = TRUE, updated_at = NOW() WHERE id = %s",
                (row["id"],),
            )
            log_activity(cur, row["id"], "removed-from-catalogue", {
                "element_key": name,
                "catalogs": row["meta"].get("catalogs"),
                "last_description": (row.get("description") or "")[:400],
            })
            removed += 1

        # THE COMMIT IS OURS TO MAKE. The pool returns the connection on release and does not commit
        # for us, so anything not committed here quietly does nothing — measured the hard way.
        conn.commit()
        cur.close()

    # Read back through the pool, with the level's own marker — the same way the surface reads it.
    with api.get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT title, metadata FROM prompt_sessions
            WHERE user_id = %s AND metadata->>'session_type' = 'design_master'
            ORDER BY metadata->>'element_key'
            """,
            (DEFAULT_USER_ID,),
        )
        rows = cur.fetchall()
        cur.close()

    print(f"  components now in the database: {len(rows)}  "
          f"(added {added}, changed {changed}, removed {removed})")
    for row in rows[:6]:
        # The pool hands rows back as mappings and jsonb back already parsed; both are allowed for
        # here rather than assumed, because a reader that only works one way is a reader that
        # breaks the first time a connection is configured differently.
        if isinstance(row, dict):
            title, meta = row.get("title"), row.get("metadata")
        else:
            title, meta = row[0], row[1]
        if isinstance(meta, str):
            meta = json.loads(meta) if meta.strip() else {}
        meta = meta or {}
        print(f"    {meta.get('element_key', '?'):<28} in {meta.get('catalogs', '?'):<32} {str(title)[:34]}")
    if len(rows) > 6:
        print(f"    … and {len(rows) - 6} more")


if __name__ == "__main__":
    main()
