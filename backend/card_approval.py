"""THE PENDING CARD'S APPROVAL — the layer name is the identity, and the write is the application's.

WHAT THIS SERVES (owner, 2026-11-16). A person takes a component that is already in the design
system — the composer's text area, say — changes it in Figma, and the Figma tool lands it as a
pending card. The person approves the card. This module performs the write that approval means:

  1. the drawing and the layer name are read from the CARD'S OWN RECORD (`metadata.preview`);
  2. the layer name resolves the element in the Lit catalogue — the name, and nothing else;
  3. the element's behaviour stays in its companion, and a hand-built element with no companion is
     refused rather than silently replaced by a drawing-only file;
  4. the drawing is written at the ELEMENT'S OWN file path under the ELEMENT'S OWN tag, with the
     behaviour import corrected for that folder;
  5. the catalogue entry and the layer record are updated for that layer name;
  6. the card's stage becomes approved in the same action, so its word reads Active.

WHAT THIS DOES NOT DO. It does not tell the Composer, the Console, or any other built surface that
the catalogue changed. A surface built from the catalogue reads it when it assembles, so the next
assembly picks up the new element and the new entry by itself. Whether a surface is assembling from
the catalogue at all is that surface's own conformance question, not this action's.

A FIGMA NODE ID IS AN ADDRESS, NOT AN IDENTITY. Nothing here compares node ids, requires an `f-`
tag, or looks a component up by the node it came from. The draft's `f-` tag appears in exactly one
place — rewriting the generated drawing's own seam and custom-element definition to the element's
tag — and a node id is carried in the layer record as provenance, never as a condition.

THE ORDER IS THE RECEIPT'S. The element is written, the catalogue is written, the layer record is
written, and the card's stage is written; the acceptance receipt is recorded LAST, because it claims
work that already stands. A refusal is a value, not an exception path with no words: every refusal
names the layer and what is missing so the conversation can say it.
"""
from __future__ import annotations

import copy
import json
import os
import re
import subprocess
import tempfile
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import catalog_write

REPO_ROOT = Path(__file__).resolve().parents[1]
FRONTEND_DIR = REPO_ROOT / "frontend"
LIT_DIR = FRONTEND_DIR / "src" / "components" / "lit"
BEHAVIOUR_DIR = LIT_DIR / "behaviour"
CATALOG_DIR = FRONTEND_DIR / "src" / "components" / "A2UI" / "catalogs"
TREE_DIR = FRONTEND_DIR / "catalog-tree"
REGISTRY_PATH = FRONTEND_DIR / "src" / "components" / "registry.json"
LAYERS_DIR = FRONTEND_DIR / "public" / "catalog-figma"
INGEST_LOG_PATH = REPO_ROOT / "backend" / "logs" / "figma-ingest.jsonl"
PIPELINE = os.getenv("FIGMA_INGEST_CATALOG", "prompt-composer")
COMMON = "https://a2ui.org/specification/v0_9/common_types.json"

# THE PROP KINDS THE VALIDATOR READS. A child reference is not a string: it MUST carry the
# `ComponentId` reference, and a list of children MUST carry `ChildList`, because that is how the
# validator knows the field is a structural link and checks that the target component exists. The
# schemas themselves come from `catalog_write._PROP_SCHEMA` — the one table that already defines
# them — so this action cannot drift from the catalogue writer.
_PROP_KINDS: dict[str, str] = {
    "value": "text",
    "placeholder": "text",
    "label": "text",
    "title": "text",
    "text": "text",
    "content": "text",
    "description": "text",
    "name": "text",
    "minHeight": "number",
    "min-height": "number",
    "count": "number",
    "index": "number",
    "size": "number",
    "width": "number",
    "height": "number",
    "disabled": "boolean",
    "open": "boolean",
    "checked": "boolean",
    "selected": "boolean",
    "busy": "boolean",
    "children": "children",
    "items": "children",
    "actions": "children",
    "child": "componentRef",
    "componentRef": "componentRef",
}


class CardApprovalRefused(RuntimeError):
    """The write did not happen, and this is why. The caller says it; nothing is substituted."""

    def __init__(
        self,
        code: str,
        message: str,
        *,
        layer: str = "",
        missing: list[str] | None = None,
        facts: dict[str, Any] | None = None,
    ):
        super().__init__(message)
        self.code = code
        self.message = message
        self.layer = layer
        self.missing = missing or []
        self.facts = facts or {}

    def as_detail(self) -> dict[str, Any]:
        return {
            "error": self.code,
            "message": self.message,
            "layer": self.layer,
            "missing": self.missing,
            **self.facts,
        }


@dataclass(frozen=True)
class ResolvedElement:
    """The element a layer name resolves to, and the files the approval touches."""

    layer: str
    tag: str
    file: Path
    existed: bool
    catalogue_path: Path
    entry: dict[str, Any] | None
    companion: Path
    sources: tuple[str, ...] = field(default_factory=tuple)


@dataclass(frozen=True)
class CardDrawing:
    """The two facts the approval reads from the card's own record, and the provenance around them."""

    layer: str
    drawing: str
    draft_tag: str
    node_id: str
    tree: dict[str, Any]
    facts: list[dict[str, Any]]
    annotations: list[dict[str, Any]]
    assets: list[dict[str, Any]]


def _relative(path: Path) -> str:
    try:
        return path.resolve().relative_to(REPO_ROOT).as_posix()
    except ValueError:
        return str(path)


def _read_json(path: Path) -> Any:
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


def _write_json_atomic(path: Path, document: Any, *, indent: int = 1) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    handle, temporary = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=str(path.parent))
    try:
        with os.fdopen(handle, "w", encoding="utf-8") as stream:
            json.dump(document, stream, indent=indent, ensure_ascii=False)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    except BaseException:
        if os.path.exists(temporary):
            os.unlink(temporary)
        raise


def _tree_elements() -> list[dict[str, Any]]:
    """Every element the catalogue tree lists, with the tree's own file path."""

    path = TREE_DIR / f"{PIPELINE}.json"
    try:
        document = _read_json(path)
    except (OSError, ValueError):
        return []
    elements: list[dict[str, Any]] = []
    for group in document.get("groups") or []:
        for element in (group or {}).get("elements") or []:
            if isinstance(element, dict):
                elements.append(element)
    return elements


def _registry_components() -> list[dict[str, Any]]:
    try:
        document = _read_json(REGISTRY_PATH)
    except (OSError, ValueError):
        return []
    rows = document.get("components") if isinstance(document, dict) else None
    return [row for row in rows or [] if isinstance(row, dict)]


def _layer_records() -> list[dict[str, Any]]:
    path = LAYERS_DIR / f"{PIPELINE}.json"
    try:
        document = _read_json(path)
    except (OSError, ValueError):
        return []
    return [row for row in (document.get("nodes") or {}).values() if isinstance(row, dict)]


def _file_in_catalogue(value: Any) -> Path | None:
    """A file path from a record, resolved inside the Lit catalogue and nowhere else."""

    text = str(value or "").strip()
    if not text:
        return None
    candidate = Path(text)
    probes = [candidate] if candidate.is_absolute() else [REPO_ROOT / candidate, LIT_DIR / candidate]
    if not candidate.is_absolute() and candidate.parent == Path("."):
        probes.extend(sorted(LIT_DIR.rglob(candidate.name)))
    for probe in probes:
        try:
            resolved = probe.resolve()
        except OSError:
            continue
        if not resolved.exists() or not resolved.is_file():
            continue
        if resolved != LIT_DIR and LIT_DIR not in resolved.parents:
            continue
        return resolved
    return None


def _file_for_tag(tag: str, tree: list[dict[str, Any]], registry: list[dict[str, Any]]) -> Path | None:
    """The element file for a tag, from the tree, the Figma map, or the catalogue root."""

    for element in tree:
        if str(element.get("tag") or "") == tag:
            found = _file_in_catalogue(element.get("file"))
            if found:
                return found
    for row in registry:
        if str(row.get("litComponent") or "") == tag:
            found = _file_in_catalogue(row.get("file"))
            if found:
                return found
    root = LIT_DIR / f"{tag}.ts"
    return root.resolve() if root.exists() else None


def _tag_from_layer(layer: str) -> str:
    """A custom-element name for a layer name that has no element yet.

    The layer name is the identity; the tag is only where the element's file is written. A name
    that cannot produce a legal custom-element name is refused rather than coerced into one.
    """

    slug = re.sub(r"[^a-z0-9]+", "-", layer.lower()).strip("-")
    if not slug:
        raise CardApprovalRefused(
            "LAYER_NAME_UNUSABLE",
            f"The layer name {layer!r} produces no element name, so there is nothing to write.",
            layer=layer,
        )
    if not re.match(r"^[a-z]", slug):
        slug = f"element-{slug}"
    if "-" not in slug:
        slug = f"{slug}-component"
    return slug


def resolve_layer(layer: str) -> ResolvedElement:
    """THE LAYER NAME IS THE WHOLE LOOKUP.

    Three records can name the same layer, and all three are consulted by NAME: the Figma map
    (`registry.json`, hand curated), the catalogue tree (generated from the catalogue), and the
    layer record written by a previous approval. A tag is taken as the answer only when the records
    agree, or when exactly one of the candidate tags has an element file in the catalogue. Node ids
    are never read.
    """

    layer = str(layer or "").strip()
    if not layer:
        raise CardApprovalRefused(
            "CARD_NAMES_NO_LAYER",
            "The card names no layer, so there is no element to resolve.",
        )

    tree = _tree_elements()
    registry = _registry_components()
    records = _layer_records()

    candidates: dict[str, set[str]] = {}

    def add(tag: Any, source: str) -> None:
        text = str(tag or "").strip()
        if text:
            candidates.setdefault(text, set()).add(source)

    for row in registry:
        if str(row.get("figmaName") or "") == layer:
            add(row.get("litComponent"), "registry")
    for element in tree:
        provenance = element.get("provenance") if isinstance(element.get("provenance"), dict) else {}
        if layer in (str(element.get("name") or ""), str(provenance.get("figmaName") or "")):
            add(element.get("tag"), "tree")
    for record in records:
        record_tree = record.get("tree") if isinstance(record.get("tree"), dict) else {}
        if str(record_tree.get("name") or "") == layer:
            add(record.get("tag"), "layer record")

    with_files = {tag: _file_for_tag(tag, tree, registry) for tag in candidates}
    found = {tag: path for tag, path in with_files.items() if path is not None}

    if len(found) > 1:
        raise CardApprovalRefused(
            "LAYER_AMBIGUOUS",
            (
                f"The layer name {layer!r} resolves to more than one element file: "
                + ", ".join(sorted(_relative(path) for path in found.values()))
                + ". Nothing was written."
            ),
            layer=layer,
            facts={"candidates": sorted(found)},
        )

    if found:
        tag = next(iter(found))
        file = found[tag]
        sources = tuple(sorted(candidates.get(tag) or ()))
    elif len(candidates) == 1:
        tag = next(iter(candidates))
        file = LIT_DIR / f"{tag}.ts"
        sources = tuple(sorted(candidates.get(tag) or ()))
    elif len(candidates) > 1:
        raise CardApprovalRefused(
            "LAYER_AMBIGUOUS",
            (
                f"The layer name {layer!r} is recorded against several tags with no element file "
                f"to decide between them ({', '.join(sorted(candidates))}). Nothing was written."
            ),
            layer=layer,
            facts={"candidates": sorted(candidates)},
        )
    else:
        tag = _tag_from_layer(layer)
        file = LIT_DIR / f"{tag}.ts"
        sources = ()
        if file.exists():
            raise CardApprovalRefused(
                "ELEMENT_NAME_IN_USE",
                (
                    f"The layer {layer!r} would be written as <{tag}>, and "
                    f"{_relative(file)} is already an element for another layer. Nothing was "
                    "written."
                ),
                layer=layer,
                facts={"tag": tag},
            )

    catalogue_path = CATALOG_DIR / PIPELINE / "catalog.json"
    if not catalogue_path.exists():
        raise CardApprovalRefused(
            "CATALOGUE_MISSING",
            (
                f"The catalogue {_relative(catalogue_path)} does not exist, so there is nowhere to "
                f"declare {tag}."
            ),
            layer=layer,
        )
    catalogue = _read_json(catalogue_path)
    entry = (catalogue.get("components") or {}).get(tag)
    existed = bool(found) or bool(candidates)

    return ResolvedElement(
        layer=layer,
        tag=tag,
        file=file,
        existed=existed,
        catalogue_path=catalogue_path,
        entry=entry if isinstance(entry, dict) else None,
        companion=BEHAVIOUR_DIR / f"{tag}.behaviour.ts",
        sources=sources,
    )


def read_card(metadata: dict[str, Any]) -> CardDrawing:
    """The drawing and the layer name, from the card's own record.

    `metadata.preview` is the record the Tools tab saves: the compiled drawing, the measured tree,
    the facts and the annotations. The layer name is the preview's `layerName` (when a selection
    written it) or the design's own `name`. The draft's Figma tag is read only to rewrite the
    generated drawing's seam; it is not an identity and nothing is compared with it.
    """

    preview = metadata.get("preview") if isinstance(metadata, dict) else None
    if not isinstance(preview, dict) or not preview:
        raise CardApprovalRefused(
            "CARD_HAS_NO_DRAWING",
            "This card holds no stored drawing, so there is nothing to approve into the catalogue.",
        )

    drawing = preview.get("componentSource")
    if not isinstance(drawing, str) or not drawing.strip():
        raise CardApprovalRefused(
            "CARD_HAS_NO_DRAWING",
            "This card's stored record holds no drawing, so there is nothing to write.",
        )

    layer = str(preview.get("layerName") or preview.get("name") or "").strip()
    if not layer:
        raise CardApprovalRefused(
            "CARD_NAMES_NO_LAYER",
            "The card's stored record names no layer, so the catalogue cannot be asked what it is.",
        )

    draft_tag = str(preview.get("tag") or "").strip()
    if not draft_tag:
        match = re.search(r"behaviourProperties\(\s*['\"]([^'\"]+)['\"]", drawing)
        draft_tag = match.group(1) if match else ""

    tree = preview.get("tree") if isinstance(preview.get("tree"), dict) else {"name": layer}
    facts = preview.get("facts") if isinstance(preview.get("facts"), list) else []
    annotations = preview.get("annotations") if isinstance(preview.get("annotations"), list) else []
    assets = preview.get("assets") if isinstance(preview.get("assets"), list) else []

    return CardDrawing(
        layer=layer,
        drawing=drawing,
        draft_tag=draft_tag,
        node_id=str(preview.get("nodeId") or ""),
        tree=tree,
        facts=[row for row in facts if isinstance(row, dict)],
        annotations=[row for row in annotations if isinstance(row, dict)],
        assets=[row for row in assets if isinstance(row, dict)],
    )


def ensure_behaviour(resolved: ResolvedElement) -> str:
    """THE BEHAVIOUR MUST OUTLIVE THE DRAWING.

    A generated element already carries the seam (`attachBehaviour` / `behaviourProperties`), so
    its behaviour is either in a companion or absent by design. A hand-built element carries its
    behaviour inside the file the drawing would replace; that file is refused until the behaviour
    has a companion. The companion is never invented here — moving hand-written TypeScript is not
    something a text substitution can do honestly.
    """

    if resolved.companion.exists():
        return "kept"
    if not resolved.file.exists():
        return "none"
    source = resolved.file.read_text(encoding="utf-8")
    if "attachBehaviour(" in source and "behaviourProperties(" in source:
        return "already external"
    raise CardApprovalRefused(
        "BEHAVIOUR_HAS_NO_COMPANION",
        (
            f"The element <{resolved.tag}> at {_relative(resolved.file)} carries hand-written "
            f"behaviour and has no companion at {_relative(resolved.companion)}. A drawing would "
            "replace that behaviour, so nothing was written. The behaviour must be moved into the "
            "companion first."
        ),
        layer=resolved.layer,
        missing=[_relative(resolved.companion)],
        facts={"tag": resolved.tag, "file": _relative(resolved.file)},
    )


def _behaviour_import(target: Path) -> str:
    relative = os.path.relpath(BEHAVIOUR_DIR, target.parent).replace(os.sep, "/")
    return f"{relative}/attach" if relative not in (".", "") else "./behaviour/attach"


def rewrite_drawing(drawing: str, draft_tag: str, resolved: ResolvedElement) -> str:
    """The drawing, under the element's own tag and with a working behaviour path.

    The generated file names the tag it was built under in exactly three places: the behaviour
    properties spread, the two lifecycle calls, and the custom-element definition. All of them
    become the element's tag. The behaviour import is relative to the generated file, so a file
    that lives in a subfolder gets the `../behaviour/attach` path it needs.
    """

    text = drawing
    if draft_tag and draft_tag != resolved.tag:
        text = text.replace(draft_tag, resolved.tag)

    # THE SEAM'S PATH IS THE WRITE FOLDER'S FACT, NOT THE DRAFT'S. A root element imports
    # `./behaviour/attach`; an element in `prompt-input/` imports `../behaviour/attach`.
    import_path = _behaviour_import(resolved.file)
    text = re.sub(
        r"from\s+(['\"])(?:\.{1,2}/)+behaviour/attach\1",
        f"from '{import_path}'",
        text,
    )

    # A DRAWING WITH NO SEAM IS NOT A DRAWING-ONLY FILE. Writing it would delete the element's
    # behaviour, which is the one thing this action must never do.
    if "attachBehaviour(" not in text:
        raise CardApprovalRefused(
            "DRAWING_HAS_NO_SEAM",
            (
                f"The stored drawing for {resolved.layer!r} does not call the behaviour loader, so "
                "it is not a drawing-only file. Nothing was written."
            ),
            layer=resolved.layer,
            facts={"tag": resolved.tag},
        )

    # The three quoted tag arguments and the definition, for a drawing whose draft tag was not
    # recorded. This never invents a tag: it writes the one the layer resolved to.
    text = re.sub(
        r"attachBehaviour\(this,\s*(['\"])[^'\"]*\1",
        f"attachBehaviour(this, '{resolved.tag}'",
        text,
    )
    text = re.sub(
        r"detachBehaviour\(this,\s*(['\"])[^'\"]*\1",
        f"detachBehaviour(this, '{resolved.tag}'",
        text,
    )
    text = re.sub(
        r"behaviourProperties\(\s*(['\"])[^'\"]*\1",
        f"behaviourProperties('{resolved.tag}'",
        text,
    )
    if "customElements.define(" in text:
        text = re.sub(
            r"customElements\.define\(\s*(['\"])[^'\"]*\1",
            f"customElements.define('{resolved.tag}'",
            text,
        )
    return text


def _compile_check(source: str, target: Path) -> None:
    """Refuse a drawing the frontend cannot parse. A file that does not build is not a component."""

    esbuild = FRONTEND_DIR / "node_modules" / ".bin" / "esbuild"
    if not esbuild.exists():
        raise CardApprovalRefused(
            "DRAWING_UNVERIFIED",
            (
                "The frontend's TypeScript parser (esbuild) is not installed, so the drawing could "
                "not be checked before it would replace the element. Nothing was written."
            ),
            facts={"missing": str(esbuild)},
        )
    target.parent.mkdir(parents=True, exist_ok=True)
    handle, temporary = tempfile.mkstemp(prefix=".approve-drawing-", suffix=".ts", dir=str(target.parent))
    output = temporary + ".js"
    result: subprocess.CompletedProcess[str] | None = None
    try:
        with os.fdopen(handle, "w", encoding="utf-8") as stream:
            stream.write(source)
        result = subprocess.run(
            [str(esbuild), temporary, f"--outfile={output}", "--log-level=error"],
            capture_output=True,
            text=True,
            timeout=60,
        )
    except subprocess.TimeoutExpired:
        raise CardApprovalRefused(
            "DRAWING_UNVERIFIED",
            "The drawing check timed out, so the drawing was not written.",
        )
    except OSError as error:
        raise CardApprovalRefused(
            "DRAWING_UNVERIFIED",
            f"The drawing could not be checked ({error}), so it was not written.",
        )
    finally:
        for path in (temporary, output):
            try:
                os.unlink(path)
            except OSError:
                pass
    if result is None or result.returncode != 0:
        raise CardApprovalRefused(
            "DRAWING_DOES_NOT_COMPILE",
            (
                "The stored drawing does not parse, so it was not written over the element: "
                + (result.stderr or result.stdout or "no compiler output").strip()[:600]
            ),
        )


def _write_text_atomic(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    handle, temporary = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=str(path.parent))
    try:
        with os.fdopen(handle, "w", encoding="utf-8") as stream:
            stream.write(text)
            if not text.endswith("\n"):
                stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    except BaseException:
        if os.path.exists(temporary):
            os.unlink(temporary)
        raise


def _entry_body(entry: dict[str, Any]) -> dict[str, Any]:
    all_of = entry.get("allOf")
    if isinstance(all_of, list):
        for block in all_of:
            if isinstance(block, dict) and isinstance(block.get("properties"), dict):
                return block
    return entry


def _prop_schema(name: str, existing: Any) -> dict[str, Any]:
    """The schema for one prop, from the validator's own kinds.

    A child reference is `ComponentId` and a child list is `ChildList`; those references are what
    tell the validator the field is a structural link. The schema comes from `catalog_write`'s
    table, so the approval and every other catalogue writer state the same reference. A prop this
    table does not know keeps the schema the catalogue already declared — the action does not
    guess that a field holds a component id, because guessing is interpretation.
    """

    kind = _PROP_KINDS.get(name)
    if kind:
        return copy.deepcopy(catalog_write._PROP_SCHEMA[kind])
    return copy.deepcopy(existing) if isinstance(existing, dict) else {}


def catalogue_entry(resolved: ResolvedElement, description: str) -> dict[str, Any]:
    """The catalogue entry for the element, in the shape the published types describe.

    A name that already exists keeps its declared props and its placement rules; the known props
    are written with the standard Dynamic* references so the model is told what they accept. A new
    name declares the component itself and nothing else it does not know.
    """

    properties: dict[str, Any] = {"component": {"const": resolved.tag}}
    required: list[str] = ["component"]
    body: dict[str, Any] = {}

    if resolved.entry:
        old = _entry_body(resolved.entry)
        for name, schema in (old.get("properties") or {}).items():
            if name == "component":
                continue
            properties[name] = _prop_schema(str(name), schema)
        for name in (old.get("required") or []):
            if name != "component" and name not in required:
                required.append(str(name))
        for key in ("allowedParents", "allowedChildren", "checks", "actions"):
            if key in old:
                body[key] = copy.deepcopy(old[key])

    body.update({
        "type": "object",
        "description": description,
        "properties": properties,
        "required": required,
        "unevaluatedProperties": False,
    })
    entry: dict[str, Any] = {
        "type": "object",
        "allOf": [
            {"$ref": f"{COMMON}#/$defs/ComponentCommon"},
            {"$ref": "#/$defs/CatalogComponentCommon"},
            body,
        ],
    }
    declarations = resolved.entry.get("x-a11y") if resolved.entry else None
    if isinstance(declarations, dict) and declarations:
        entry["x-a11y"] = declarations
    return entry


def _description(resolved: ResolvedElement, previous: str) -> str:
    source = (
        f"Drawn from the approved Figma layer {resolved.layer!r} and written at "
        f"{_relative(resolved.file)}."
    )
    if resolved.companion.exists():
        source += f" Its behaviour lives in {_relative(resolved.companion)}."
    base = str(previous or "").strip()
    if not base:
        return f"The {resolved.layer} element. {source}"
    if "Drawn from the approved Figma layer" in base:
        return base
    return f"{base} {source}"


def write_catalogue(resolved: ResolvedElement) -> dict[str, Any]:
    """Replace or add the entry for the element's tag, then read it back."""

    catalogue = _read_json(resolved.catalogue_path)
    components = catalogue.get("components") or {}
    existed = resolved.tag in components
    previous = ""
    if isinstance(components.get(resolved.tag), dict):
        previous = str(_entry_body(components[resolved.tag]).get("description") or "")
    description = _description(resolved, previous)
    entry = catalogue_entry(resolved, description)

    try:
        updated = catalog_write.apply(catalogue, resolved.tag, entry)
        catalog_write.write(str(resolved.catalogue_path), updated)
    except OSError as error:
        raise CardApprovalRefused(
            "CATALOGUE_NOT_WRITTEN",
            (
                f"The element was not written because the catalogue could not be written: "
                f"{error}. The element file still stands."
            ),
            layer=resolved.layer,
        )

    try:
        written = _read_json(resolved.catalogue_path)["components"][resolved.tag]
        written_body = _entry_body(written)
        written_name = str((written_body.get("properties") or {}).get("component", {}).get("const") or "")
        written_description = str(written_body.get("description") or "")
    except Exception as error:  # noqa: BLE001 — the sentence is the report
        raise CardApprovalRefused(
            "CATALOGUE_UNVERIFIED",
            (
                f"The catalogue was written and could not be read back for {resolved.tag}: {error}. "
                "The entry is not a claim this approval can make."
            ),
            layer=resolved.layer,
        )
    if written_name != resolved.tag or written_description != description:
        raise CardApprovalRefused(
            "CATALOGUE_MISMATCH",
            (
                f"The catalogue holds {written_name!r} with a description this approval did not "
                f"write ({resolved.tag!r}). The element file stands."
            ),
            layer=resolved.layer,
            facts={"expected": resolved.tag, "written": written_name},
        )
    return {
        "path": _relative(resolved.catalogue_path),
        "action": "replaced" if existed else "added",
        "tag": resolved.tag,
        "description": description,
    }


def _count_layers(node: Any) -> int:
    if not isinstance(node, dict):
        return 0
    total = 1
    for child in node.get("children") or []:
        total += _count_layers(child)
    return total


def write_layer_record(drawing: CardDrawing, resolved: ResolvedElement) -> dict[str, Any]:
    """ONE LAYER NAME, ONE RECORD. The record is what makes the name live and openable.

    The record is keyed by the node the drawing came from (provenance) and pruned of every other
    entry that claims the same layer name, so the name resolves to this element and no older one.
    """

    path = LAYERS_DIR / f"{PIPELINE}.json"
    document: dict[str, Any] = {"pipeline": PIPELINE, "nodes": {}}
    if path.exists():
        try:
            prior = _read_json(path)
            if isinstance(prior, dict):
                document = prior
        except (OSError, ValueError):
            pass
    nodes = document.setdefault("nodes", {})
    if not isinstance(nodes, dict):
        nodes = {}
        document["nodes"] = nodes

    removed: list[str] = []
    for key, record in list(nodes.items()):
        record_tree = record.get("tree") if isinstance(record, dict) else None
        if not isinstance(record_tree, dict):
            continue
        if str(record_tree.get("name") or "") == resolved.layer:
            removed.append(str(key))
            del nodes[key]

    key = drawing.node_id or resolved.layer
    nodes[key] = {
        "tag": resolved.tag,
        "nodeId": drawing.node_id,
        "approvedAt": datetime.now(timezone.utc).isoformat(),
        "layers": _count_layers(drawing.tree),
        "tree": drawing.tree,
        "assets": drawing.assets,
        "facts": drawing.facts,
        "annotations": drawing.annotations,
    }
    document["pipeline"] = PIPELINE
    document["generatedAt"] = datetime.now(timezone.utc).isoformat()
    _write_json_atomic(path, document, indent=1)
    return {
        "file": _relative(path),
        "nodeId": drawing.node_id,
        "layer": resolved.layer,
        "replaced": removed,
    }


def regenerate_tree() -> dict[str, Any]:
    """Rebuild the manifest and the catalogue tree, so the row shows the source just written.

    Both are DERIVED files; editing them by hand would be a second declaration. A failure here does
    not undo the element or its catalogue entry — it is reported as the stale display it is.
    """

    steps: list[dict[str, Any]] = []
    commands = [
        ("manifest", [
            "npx", "@custom-elements-manifest/analyzer", "analyze", "--litelement",
            "--globs", "src/components/lit/**/*.ts",
            "--exclude", "src/components/lit/**/*.test.ts",
            "--exclude", "src/components/lit/**/*.spec.ts",
            "--exclude", "src/components/lit/**/*.stories.ts",
            "--outdir", ".",
        ]),
        ("tree", ["npm", "run", "catalog:tree"]),
    ]
    for name, command in commands:
        try:
            result = subprocess.run(
                command, cwd=str(FRONTEND_DIR), capture_output=True, text=True, timeout=240,
            )
            steps.append({
                "step": name,
                "ok": result.returncode == 0,
                "detail": (result.stdout or result.stderr or "").strip()[-600:],
            })
        except Exception as error:  # noqa: BLE001 — the sentence is the report
            steps.append({"step": name, "ok": False, "detail": f"{type(error).__name__}: {error}"})
    return {"ok": all(step["ok"] for step in steps), "steps": steps}


def _log_approval(record: dict[str, Any]) -> None:
    stamped = {"at": datetime.now(timezone.utc).isoformat(timespec="seconds"), **record}
    try:
        INGEST_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(INGEST_LOG_PATH, "a", encoding="utf-8") as stream:
            stream.write(json.dumps(stamped, ensure_ascii=False) + "\n")
    except OSError as error:
        print(f"⚠️ [card-approval] the approval ledger could not be written: {error}")


def _record_surface_event(api: Any, session_id: str, actor: str, facts: dict[str, Any]) -> None:
    try:
        with api.get_db() as conn:
            cur = conn.cursor()
            cur.execute("SET app.current_user_id = %s", (actor,))
            cur.execute(
                """INSERT INTO design_surface_events (session_id, surface, event, detail, at)
                   VALUES (%s, 'catalog', 'updated', %s::jsonb, NOW())""",
                (session_id, json.dumps(facts)),
            )
            conn.commit()
    except Exception as error:  # noqa: BLE001 — stated, never hidden
        print(f"[card-approval] the catalogue event could not be recorded: {error}")


def _mark_card_active(api: Any, session_id: str, actor: str, facts: dict[str, Any]) -> dict[str, Any]:
    """The card is Active because the element is in the catalogue — in this same action."""

    updated = api.update_session(
        user_id=actor,
        session_id=session_id,
        status="approved",
        metadata={"review_stage": "approved", "approval": facts},
    )
    if not updated:
        # ONE RETRY, because a card left Pending after a successful write is the half-state this
        # action exists to prevent. The retry is the same write; nothing else changes.
        updated = api.update_session(
            user_id=actor,
            session_id=session_id,
            status="approved",
            metadata={"review_stage": "approved", "approval": facts},
        )
    if not updated:
        return {
            "ok": False,
            "error": "the card could not be written by this person, so its stage was not changed",
        }
    session = api.get_session(session_id=session_id, user_id=actor) or updated
    meta = session.get("metadata") or {}
    if isinstance(meta, str):
        try:
            meta = json.loads(meta)
        except (json.JSONDecodeError, ValueError):
            meta = {}
    stage = str((meta or {}).get("review_stage") or "")
    if stage != "approved":
        return {"ok": False, "error": f"the card's stage reads {stage!r}, not approved"}
    return {"ok": True, "review_stage": "approved", "word": "Active"}


def _register_new_element(
    drawing: CardDrawing,
    resolved: ResolvedElement,
    actor: str,
) -> dict[str, Any]:
    """THE OTHER LAYERS A NEW NAME MUST REACH, through the application's own writers.

    A tag that exists only in the element file and the catalogue is not resolvable: the allowlist
    is the table the renderer resolves through, the Figma map records the design relationship, and
    the element row is the row the catalogue lists and the designer opens. This action does not
    keep a second copy of those rules; it calls the writers the approval already uses.

    THE ALLOWLIST IS THE USABLE TEST. If the allowlist cannot record the tag, the renderer cannot
    resolve it, so the element is not usable and the caller must not mark the card Active. The
    other two are records: a failure there leaves the element usable and is reported as the
    incomplete record it is.
    """

    try:
        from routes.figma import (
            _register_element_row,
            _register_in_allowlist,
            _register_in_figma_map,
        )
    except Exception as error:  # noqa: BLE001 — the sentence is the report
        return {"all": f"the registration writers could not be loaded: {error}"}

    meta = {
        "figmaName": resolved.layer,
        "nodeId": drawing.node_id,
        "figmaType": str(drawing.tree.get("type") or ""),
        "targetNode": drawing.tree,
        "contract": {"props": [], "events": [], "accessibility": {}},
    }
    registration: dict[str, Any] = {}
    try:
        registration["allowlist"] = _register_in_allowlist(resolved.tag, meta)
    except Exception as error:  # noqa: BLE001
        registration["allowlist"] = f"failed: {type(error).__name__}: {error}"
    try:
        registration["figmaMap"] = _register_in_figma_map(
            resolved.tag, drawing.node_id, resolved.layer
        )
    except Exception as error:  # noqa: BLE001
        registration["figmaMap"] = f"failed: {type(error).__name__}: {error}"
    try:
        registration["elementRow"] = _register_element_row(resolved.tag, meta, actor)
    except Exception as error:  # noqa: BLE001
        registration["elementRow"] = f"failed: {type(error).__name__}: {error}"
    return registration


def approve_card(
    api: Any,
    session_id: str,
    actor: str,
    *,
    row: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """The whole action, in the order the receipt claims it. Returns facts, never a speech."""

    session = row or api.get_session(session_id=session_id, user_id=actor)
    if not session:
        raise CardApprovalRefused(
            "CARD_NOT_FOUND",
            f"No card {session_id} exists for this person.",
        )
    metadata = session.get("metadata") or {}
    if isinstance(metadata, str):
        try:
            metadata = json.loads(metadata)
        except (json.JSONDecodeError, ValueError):
            metadata = {}
    if str((metadata or {}).get("session_type") or "") != "design_session":
        raise CardApprovalRefused(
            "NOT_A_CARD",
            f"Session {session_id} is a working visit, not a saved card, so it has nothing to approve.",
        )

    drawing = read_card(metadata)
    resolved = resolve_layer(drawing.layer)

    # ── AN APPROVED CARD IS NOT REWRITTEN BY A SECOND PRESS ─────────────────────────────────────
    # The element and the stage already stand, so the answer is the facts of the work already done.
    if (
        str((metadata or {}).get("review_stage") or "") == "approved"
        and resolved.file.exists()
        and resolved.entry is not None
    ):
        return {
            "ok": True,
            "already": True,
            "action": "already approved",
            "layer": resolved.layer,
            "tag": resolved.tag,
            "file": _relative(resolved.file),
            "card": {"review_stage": "approved", "word": "Active"},
        }

    behaviour = ensure_behaviour(resolved)
    rewritten = rewrite_drawing(drawing.drawing, drawing.draft_tag, resolved)
    _compile_check(rewritten, resolved.file)

    # 4. THE DRAWING AT THE ELEMENT'S OWN PATH, UNDER THE ELEMENT'S OWN TAG.
    file_existed = resolved.file.exists()
    _write_text_atomic(resolved.file, rewritten)

    # 5. THE CATALOGUE AND THE LAYER RECORD, BOTH FOR THE LAYER NAME.
    catalogue = write_catalogue(resolved)
    registration: dict[str, Any] = {}
    if not file_existed:
        registration = _register_new_element(drawing, resolved, actor)
        allowlist = str(registration.get("allowlist") or "")
        if allowlist.lower().startswith(("unreadable", "could not", "failed", "no catalogue")):
            raise CardApprovalRefused(
                "NEW_ELEMENT_NOT_LISTED",
                (
                    f"The element was written at {_relative(resolved.file)} and declared in the "
                    f"catalogue, but the allowlist could not record {resolved.tag}: {allowlist}. "
                    "The renderer cannot resolve a tag the allowlist does not hold, so the element "
                    "is not usable and the card stays Pending."
                ),
                layer=resolved.layer,
                missing=["frontend/src/shared/tag-registry.ts"],
                facts={"elementWritten": True, "registration": registration},
            )
    layer_record = write_layer_record(drawing, resolved)
    tree = regenerate_tree()

    # 6. THE CARD, IN THE SAME ACTION.
    facts_for_card = {
        "layer": resolved.layer,
        "tag": resolved.tag,
        "file": _relative(resolved.file),
        "catalogue": catalogue,
        "registration": registration,
        "action": "replaced" if file_existed else "added",
        "at": datetime.now(timezone.utc).isoformat(),
    }
    card = _mark_card_active(api, session_id, actor, facts_for_card)
    if not card.get("ok"):
        raise CardApprovalRefused(
            "CARD_STAGE_NOT_WRITTEN",
            (
                f"The element is in the catalogue at {_relative(resolved.file)}, and the card's "
                f"stage was not written: {card.get('error')}. The element stands; the card still "
                "reads Pending."
            ),
            layer=resolved.layer,
            facts={"elementWritten": True, "card": card},
        )

    # THE RECEIPT LAST. `record_accepted` is the one writer of the acceptance event.
    acceptance: dict[str, Any]
    try:
        from routes.design_acceptance import AcceptanceNotRecorded, record_accepted

        acceptance = record_accepted(api, session_id, resolved.layer, actor)
    except AcceptanceNotRecorded as error:
        acceptance = {"error": str(error)}
    except Exception as error:  # noqa: BLE001 — the sentence is the report
        acceptance = {"error": f"the acceptance receipt could not be written: {error}"}

    record_failures = [
        f"{step}: {value}"
        for step, value in registration.items()
        if isinstance(value, str)
        and value.lower().startswith(("unreadable", "could not", "failed", "no catalogue"))
    ]
    facts = {
        "ok": not bool(acceptance.get("error")) and bool(tree.get("ok")) and not record_failures,
        "action": "replaced" if file_existed else "added",
        "layer": resolved.layer,
        "tag": resolved.tag,
        "file": _relative(resolved.file),
        "companion": _relative(resolved.companion) if resolved.companion.exists() else "",
        "behaviour": behaviour,
        "catalogue": catalogue,
        "registration": registration,
        "recordFailures": record_failures,
        "layerRecord": layer_record,
        "tree": tree,
        "card": card,
        "acceptance": acceptance,
        "resolvedFrom": list(resolved.sources),
    }

    _record_surface_event(api, session_id, actor, facts_for_card)
    _log_approval({
        "kind": "approved",
        "surface": "card-approval",
        "sessionId": session_id,
        "sessionTitle": str(session.get("title") or ""),
        "actor": actor,
        "layer": resolved.layer,
        "nodeId": drawing.node_id,
        "nodeName": resolved.layer,
        "tags": [resolved.tag],
        "written": [_relative(resolved.file)],
        "file": _relative(resolved.file),
        "registration": {
            "catalogue": catalogue,
            "layers": layer_record,
            "tree": tree,
        },
        "action": facts["action"],
    })
    return facts
