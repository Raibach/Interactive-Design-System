"""The design's own parameters, written into the generated module as a strict type.

A preview is not a picture with a list of extras beside it. Every value the Figma file states for a
layer — its geometry, its paints, its layout rule, its style references, its constraints, its
vector path — is written into the generated `.ts` module as a typed property, and the drawing is
generated from the same measured description. There is no second reading and no place for a value
to be left out and still look complete.

THE MAPPING IS CLOSED. A value whose type cannot be stated exactly raises `ParameterTypeError`
with the layer and the property. It does not become `any`, it does not become a comment, and it
does not disappear from the module. The run that produced it has failed.

THE CHECK IS IN MEMORY. `typecheck_module` hands the module text to the TypeScript compiler through
an in-memory source and returns its diagnostics. No file is written for the check.
"""

from __future__ import annotations

import json
import math
import re
import subprocess
from pathlib import Path
from typing import Any

__all__ = [
    "ParameterTypeError",
    "apply_parameters",
    "parameters_block",
    "typecheck_module",
]


class ParameterTypeError(Exception):
    """A stated parameter the module cannot type exactly."""

    def __init__(self, path: str, key: str, value: Any, reason: str) -> None:
        self.path = path
        self.key = key
        self.value = value
        self.reason = reason
        super().__init__(f"{path} · {key}: {reason}")

    def as_dict(self) -> dict[str, str]:
        return {"layer": self.path, "parameter": self.key, "reason": self.reason}


_IDENTIFIER = re.compile(r"^[A-Za-z_$][A-Za-z0-9_$]*$")


def _key(name: str) -> str:
    """A TypeScript property name: bare when it is an identifier, quoted otherwise."""
    return name if _IDENTIFIER.match(name) else json.dumps(name, ensure_ascii=False)


def _string(value: str) -> str:
    # `<\/` is the same character to the parser and cannot close a script tag if the module is
    # ever placed inside one. It changes no value.
    return json.dumps(value, ensure_ascii=False).replace("</", "<\\/")


def _number(value: int | float) -> str:
    if isinstance(value, float):
        if not math.isfinite(value):
            raise ValueError("not a finite number")
        return repr(value)
    return str(value)


def _type_and_value(value: Any, path: str, key: str) -> tuple[str, str]:
    """The exact TypeScript type and the literal for one JSON-like value."""
    if value is None:
        return "null", "null"
    if isinstance(value, bool):
        return "boolean", "true" if value else "false"
    if isinstance(value, (int, float)):
        try:
            return "number", _number(value)
        except ValueError:
            raise ParameterTypeError(path, key, value, "the value is not a finite number")
    if isinstance(value, str):
        return "string", _string(value)
    if isinstance(value, list):
        if not value:
            # An empty list is a stated fact too, and its exact type is the empty tuple. It is not
            # `any`: a later value of any type would be rejected by this type.
            return "readonly []", "[]"
        parts = [
            _type_and_value(item, f"{path}[{index}]", key)
            for index, item in enumerate(value)
        ]
        types = [one_type for one_type, _ in parts]
        unique = list(dict.fromkeys(types))
        literals = ", ".join(one_value for _, one_value in parts)
        if len(unique) == 1 and unique[0] in ("number", "string", "boolean", "null"):
            # A fixed-length list of one primitive is a tuple: its length is part of the fact.
            element = ", ".join(types)
            return f"readonly [{element}]", f"[{literals}]"
        if all(one_type.startswith("{") for one_type in unique):
            union = " | ".join(unique)
            return f"readonly ({union})[]", f"[{literals}]"
        union = " | ".join(unique)
        return f"readonly ({union})[]", f"[{literals}]"
    if isinstance(value, dict):
        if not value:
            return "Readonly<Record<string, never>>", "{}"
        fields: list[str] = []
        literals: list[str] = []
        for child_key, child_value in value.items():
            one_type, one_value = _type_and_value(
                child_value, f"{path}.{child_key}", str(child_key)
            )
            fields.append(f"readonly {_key(str(child_key))}: {one_type};")
            literals.append(f"{_key(str(child_key))}: {one_value},")
        return "{ " + " ".join(fields) + " }", "{ " + " ".join(literals) + " }"
    raise ParameterTypeError(
        path, key, value, f"the type {type(value).__name__} has no exact mapping"
    )


def parameters_block(spec: dict[str, Any]) -> str:
    """The interface and the frozen literal for one design, as module text."""
    one_type, one_value = _type_and_value(spec, "designParameters", "designParameters")
    return (
        "/**\n"
        " * EVERY PARAMETER THE FIGMA FILE STATED FOR THIS DESIGN.\n"
        " *\n"
        " * Written by the ingest from the measured description, one property per stated value.\n"
        " * The type is readonly at every level; a property that could not be typed exactly would\n"
        " * have failed the run, so nothing here is `any` and nothing here is a placeholder.\n"
        " */\n"
        f"export interface DesignParameters {one_type}\n"
        f"export const designParameters: DesignParameters = Object.freeze<DesignParameters>({one_value});\n"
    )


def apply_parameters(module: str, spec: dict[str, Any]) -> str:
    """Insert the parameter block after the module's imports, and nowhere else."""
    block = parameters_block(spec)
    marker = "from './behaviour/attach';"
    index = module.find(marker)
    if index < 0:
        raise ParameterTypeError(
            "designParameters",
            "module",
            "",
            "the generated module has no seam import, so the parameter block has no insertion point",
        )
    end = module.find("\n", index)
    end = len(module) if end < 0 else end + 1
    return module[:end] + block + module[end:]


_FRONTEND = Path(__file__).resolve().parent.parent / "frontend"
_CHECKER = _FRONTEND / "scripts" / "typecheck-generated-module.mjs"


def typecheck_module(module: str, timeout: int = 120) -> dict[str, Any]:
    """Type-check one module in memory and return `{ok, diagnostics}`.

    A missing compiler is an error, not a skipped check. Nothing is written.
    """
    try:
        completed = subprocess.run(
            ["node", str(_CHECKER)],
            input=module,
            capture_output=True,
            text=True,
            cwd=str(_FRONTEND),
            timeout=timeout,
        )
    except FileNotFoundError as error:
        raise RuntimeError("the TypeScript check needs node on PATH") from error
    except subprocess.TimeoutExpired as error:
        raise RuntimeError(
            f"the TypeScript check did not answer within {timeout} seconds"
        ) from error
    if completed.returncode not in (0, 1):
        detail = (completed.stderr or completed.stdout or "").strip()
        raise RuntimeError(f"the TypeScript check failed: {detail[:1200]}")
    try:
        report = json.loads(completed.stdout)
    except json.JSONDecodeError as error:
        raise RuntimeError(
            "the TypeScript check printed no report: " + completed.stdout[:600]
        ) from error
    if not isinstance(report, dict) or "ok" not in report:
        raise RuntimeError("the TypeScript check returned an unexpected report")
    return report
