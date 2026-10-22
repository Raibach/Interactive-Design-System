"""THE CLOSED VOCABULARY (v2) — every metric the element capture door accepts, by name.

THE RULES ARE WRITTEN INTO THE DATA, NOT INTO A REVIEWER'S MEMORY:

- A metric that is not in METRICS is REFUSED by name, with the vocabulary version. A new metric
  is a code change with typed dimensions, reviewed — there is no "send whatever, sort it later"
  path, because that path is how a metrics table becomes a landfill.
- A dimension key that is not declared for the metric is REFUSED by name. A declared string
  dimension carries `max_length`, so a caller cannot smuggle a paragraph into a label.
- NO CONTENT, EVER. A dimension carries a name, a label, an enum or a number — never message
  text, never prompt text, never a person's words. `message_sent` deliberately has NO text
  dimension: the renderer forwards the event, the message itself is not ours to record.
- The vocabulary is VERSIONED. Every accepted batch records the version it was accepted under,
  so a later change is visible in the data instead of silently rewriting history.

THE TWO CLASSES (the write split lives in routes/element_events.py):

    counter -> upserts ONE aggregate row per (element, metric, bucket_date, dims_hash)
               in design_element_metrics. A person clicking forty times is one row with a
               bigger number — the millions never become rows a person reads.
    trail   -> appends ONE row per event to design_element_activity, carrying the visitor's
               session in its own column and the moment in `at`. For lifecycle facts a person
               reads one at a time — and for the ORDER a funnel is computed from. v2 declares
               the first one (`step`); v1 declared none, so nothing element-level reached the
               trail and a funnel had no sequence to read.

SCOPE: the element keys that may emit the metric. "*" means every element. A scoped metric is
refused for a component outside its list, naming both.
"""

from __future__ import annotations

VOCABULARY_VERSION = "v2"

COUNTER = "counter"
TRAIL = "trail"

# THE THREE INTERACTIONS THE RENDERER ALREADY FORWARDS (a2ui-action, message-sent,
# command-received). All counters: a click is quantitative.
METRICS: dict[str, dict] = {
    "action": {
        "class": COUNTER,
        "scope": ["*"],
        "aggregation": "count",
        "dimensions": {
            "action": {"type": "string", "required": True, "max_length": 120},
            "label": {"type": "string", "required": False, "max_length": 120},
        },
    },
    "message_sent": {
        "class": COUNTER,
        "scope": ["*"],
        "aggregation": "count",
        "dimensions": {
            "kind": {"type": "string", "required": False, "max_length": 64},
        },
    },
    "command_received": {
        "class": COUNTER,
        "scope": ["*"],
        "aggregation": "count",
        "dimensions": {
            "command": {"type": "string", "required": True, "max_length": 120},
        },
    },
    # THE ASSEMBLY'S SEQUENCE — the first TRAIL-class metric and the reason a funnel is now
    # computable. One row per step, with its moment; order is READ FROM THE ROWS, never
    # inferred from array order or from the order the steps happen to be defined in. `step`
    # names the step of the process the person is walking (the composer's own step name) — it
    # is a NAME, never the person's words.
    "step": {
        "class": TRAIL,
        "scope": ["*"],
        "dimensions": {
            "step": {"type": "string", "required": True, "max_length": 120},
        },
    },
}


def metric_names() -> list[str]:
    """The names the door accepts, sorted — used by refusal text and by callers."""
    return sorted(METRICS)


# THE SURFACE CLASS — facts about a SCREEN, not about an element. They live in their own table
# (design_surface_events) and never fake an element to use the metrics table. Closed the same
# way as METRICS: one event on day one, and a new one is a code change. A surface event carries
# NO dimensions yet — the surface id is the fact.
SURFACE_METRICS: dict[str, dict] = {
    "surface_opened": {
        "dimensions": {},
    },
}


def surface_metric_names() -> list[str]:
    return sorted(SURFACE_METRICS)


def validate_surface_metric(metric: str, dimensions: dict) -> list[dict]:
    """Every refusal for ONE surface event's metric and dimensions; [] means accepted."""
    spec = SURFACE_METRICS.get(metric)
    if spec is None:
        return [{
            "field": "metric",
            "error": f'unknown surface metric "{metric}" (vocabulary {VOCABULARY_VERSION})',
        }]
    declared = spec["dimensions"]
    refusals: list[dict] = []
    for key in sorted(dimensions):
        if key not in declared:
            refusals.append({
                "field": f"dimensions.{key}",
                "error": (
                    f'unknown dimension "{key}" for surface metric "{metric}" '
                    f'(vocabulary {VOCABULARY_VERSION})'
                ),
            })
    return refusals


def metric_class(metric: str) -> str:
    """The write class of a declared metric. Only call with a name that exists."""
    return METRICS[metric]["class"]


def validate_metric(metric: str, component: str, dimensions: dict) -> list[dict]:
    """Every refusal for ONE event's metric and dimensions; an empty list means accepted.

    Returns [{field, error}] — the route adds the event's index. The errors are SENTENCES a
    person can act on: they name the metric or the key and the vocabulary version, never an
    empty 400.
    """
    spec = METRICS.get(metric)
    if spec is None:
        return [{
            "field": "metric",
            "error": f'unknown metric "{metric}" (vocabulary {VOCABULARY_VERSION})',
        }]

    scope = spec["scope"]
    if "*" not in scope and component not in scope:
        return [{
            "field": "component",
            "error": (
                f'metric "{metric}" is not in scope for component "{component}" '
                f'(vocabulary {VOCABULARY_VERSION}; declared scope: {", ".join(scope)})'
            ),
        }]

    refusals: list[dict] = []
    declared = spec["dimensions"]

    # Unknown keys first, in sorted order so the refusal list is stable from run to run.
    for key in sorted(dimensions):
        if key not in declared:
            refusals.append({
                "field": f"dimensions.{key}",
                "error": (
                    f'unknown dimension "{key}" for metric "{metric}" '
                    f'(vocabulary {VOCABULARY_VERSION})'
                ),
            })
            continue
        refusals.extend(_check_type(metric, key, declared[key], dimensions[key]))

    # Required dimensions that are absent. `None` counts as absent: a null is not a value.
    for key, dim in declared.items():
        if dim["required"] and dimensions.get(key) is None:
            refusals.append({
                "field": f"dimensions.{key}",
                "error": f'metric "{metric}" requires dimension "{key}"',
            })

    return refusals


def _check_type(metric: str, key: str, dim: dict, value) -> list[dict]:
    """One dimension's type and cap. Sentences, never booleans."""
    if value is None:
        return []  # absent-or-null: the required check owns that decision
    expected = dim["type"]
    if expected == "string":
        if not isinstance(value, str):
            return [{
                "field": f"dimensions.{key}",
                "error": f'dimension "{key}" on metric "{metric}" must be a string',
            }]
        cap = dim.get("max_length")
        if cap and len(value) > cap:
            return [{
                "field": f"dimensions.{key}",
                "error": (
                    f'dimension "{key}" on metric "{metric}" exceeds its '
                    f'{cap}-character cap (received {len(value)})'
                ),
            }]
        return []
    if expected == "number":
        # bool is a subclass of int in Python; a boolean is not a number here.
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            return [{
                "field": f"dimensions.{key}",
                "error": f'dimension "{key}" on metric "{metric}" must be a number',
            }]
        return []
    if expected == "boolean":
        if not isinstance(value, bool):
            return [{
                "field": f"dimensions.{key}",
                "error": f'dimension "{key}" on metric "{metric}" must be a boolean',
            }]
        return []
    # An unknown declared type is a bug in THIS file, not in the caller — say so.
    return [{
        "field": f"dimensions.{key}",
        "error": (
            f'dimension "{key}" on metric "{metric}" declares the unknown type '
            f'"{expected}" — the vocabulary is broken, not the event'
        ),
    }]
