# The Accessibility Contract Plan

*Written 2026-11-13. This is the plan the Design tab's ingest follows when a component is
approved into the catalogue.*

## What the designer experiences

The designer points the Design tab at a Figma frame and sees the drawing and its measured facts,
exactly as before. Beside them, the preview reports the accessibility contract: the role, the
label, the keyboard behavior, and the screen-reader announcement, each with the source it came
from. An incomplete contract is named in the conversation, not hidden.

When the designer presses Approve, one of two things happens. Either the component enters the
catalogue with its contract attached, or the approval is refused with HTTP 503 and a body that
names every declaration the file did not make. The catalogue is unchanged by a refusal. The
designer adds the declarations to the Figma layer and ingests again.

The person composing with the agent then cannot place a component whose contract is absent or
incomplete, and cannot send an image without its description or an icon-only control without its
name. Accessibility is a condition of the component existing in the catalogue, not a review that
happens after the page ships.

## The decision

An audit tells a company what already shipped. A gate decides what may ship. For a regulated
firm under a WCAG obligation, the gate is the control that matters.

The ingest is deterministic and reports inconsistencies; it never changes the design. The
refusal therefore belongs at approval, which is the catalogue's admission boundary and already a
refusing boundary. The ingest still draws the preview and reports what it found. The approval is
what writes, and the approval is what refuses.

## The four declarations

The contract requires four declarations:

| Declaration | Where it comes from | Why it cannot be guessed |
| --- | --- | --- |
| `role` | The component type, when the type is unambiguous. | An explicit annotation wins when the designer states one. |
| `label` | The first text layer, or an explicit annotation. | A decorative component declares `label=decorative`; silence is not the same answer. |
| `keyboard` | The designer's annotation. | Guessing keyboard behavior would be a fabricated result. |
| `announcement` | The designer's annotation. | Guessing what a screen reader says would be a fabricated result. |

The Figma annotation grammar extends the `Data: name` channel the ingest already reads:

```
A11y: role=button
A11y: label=Submit
A11y: keyboard=Enter and Space activate
A11y: announce=state changes are announced
```

A component that genuinely has no keyboard behavior or no announcement declares that fact
explicitly with `not-applicable`. Silence is refused.

## The contract that travels

The contract follows the shape of Design System Contract 1.0: declarations with their sources,
criteria with their verification mode, and rules a payload can be checked against.

```json
{
  "version": "1.0",
  "level": "AA",
  "complete": true,
  "declarations": {
    "role": { "value": "button", "source": "derived-component-type" },
    "label": { "value": "Submit", "source": "figma-text-layer", "nodeId": "40001010:25769" },
    "keyboard": { "value": "Enter and Space activate", "source": "figma-annotation" },
    "announcement": { "value": "state changes are announced", "source": "figma-annotation" }
  },
  "criteria": [
    { "id": "name-role-value", "verification": "automated", "wcag": ["4.1.2"] },
    { "id": "keyboard", "verification": "manual", "wcag": ["2.1.1"] },
    { "id": "focus-visible", "verification": "manual", "wcag": ["2.4.7"] },
    { "id": "target-size", "verification": "automated", "wcag": ["2.5.8"] }
  ],
  "rules": [],
  "requiredProperties": [],
  "governance": { "owner": "the approving designer", "lastReviewed": "" }
}
```

Every WCAG identifier is checked against `backend/standards/wcag-2.2.jsonld`, the machine-readable
WCAG 2.2 standard. A criterion the standard does not contain is a finding, not a silent pass. The
standard file is required; if it is missing, the module raises rather than returning an empty set
that would pass every claim.

## Where the gate binds

| Boundary | What happens |
| --- | --- |
| Ingest | The contract is derived from the same node the ingest already reads and carried in the job metadata. The preview reports it. Nothing is refused and nothing about the design changes. |
| Approval | The approval route refuses with HTTP 503 when the contract is absent or incomplete, before the retag, before the write, and before every registration. The refusal names the missing declarations and the next step. |
| Catalogue | The approved entry carries the contract at its top level, and its required properties become the entry's required properties. |
| Allowlist | The registry entry carries the same contract, so the component tree can read it. |
| Palette | The draft-safe palette includes the contract beside the name and description, so the requirement is visible before the first payload. |
| Composition | `validate_a2ui_components` refuses a payload that names an uncertified component, and refuses a payload missing a property the contract marks as required. Entries without a block predate the contract and are left alone. |

## The approval refusal

The refusal body is the artifact to show. It answers "what is missing" three ways: the missing
list, the declarations beside their sources with the absent ones set to null, and one finding per
path.

```json
{
  "error": "ACCESSIBILITY_CONTRACT_INCOMPLETE",
  "message": "Nothing was written. The component's accessibility contract is incomplete. Missing: keyboard, announcement.",
  "missing": ["keyboard", "announcement"],
  "declarations": {
    "role": { "value": "button", "source": "derived-component-type" },
    "label": { "value": "Submit", "source": "figma-text-layer", "nodeId": "40001010:25769" },
    "keyboard": null,
    "announcement": null
  },
  "findings": [
    { "path": "declarations.announcement", "code": "MISSING_DECLARATION", "severity": "error", "message": "announcement is not declared" },
    { "path": "declarations.keyboard", "code": "MISSING_DECLARATION", "severity": "error", "message": "keyboard is not declared" }
  ],
  "summary": "Accessibility contract incomplete. Missing: keyboard, announcement.",
  "nextStep": "Add the missing declarations to the Figma layer as A11y annotations (A11y: keyboard=<behaviour>, A11y: announce=<announcement>), then ingest again. The catalogue was not changed."
}
```

## The failure modes the contract catches

These are the failures an agent produces when no constraint is present. Each one is a rule the
contract can evaluate.

| Failure mode | Rule |
| --- | --- |
| Placeholder-only labeling | The accessible name may not equal the component name, the property name, an empty string, or `undefined`. |
| A container pretending to be a button | A component that binds an action must be an interactive type and must carry a role. |
| Hallucinated alternative text | The label must trace to a Figma text layer or a declared property, with the node recorded as evidence. |
| Visual-only structure | A layer that visually acts as a heading or region must declare that semantic. |
| Colour-only state | If two state variants differ only by fill or stroke, the rule fails unless text, icon, or an announced state also changes. |
| Suppressed focus | The generated element must carry a visible focus style tied to a focus-variant fact. |

## Build status

| Part | State |
| --- | --- |
| WCAG 2.2 standard vendored | Built. `backend/standards/wcag-2.2.jsonld`. |
| Contract module | Built. `backend/accessibility_contract.py`. |
| Contract in the ingest's job metadata | Built. `_component_contract` adds the block. |
| Report in the preview and the conversation | Built. The status response carries the contract; the chat reports an incomplete one. |
| Refusal at approval | Built. HTTP 503 before any write. |
| Contract carried into the catalogue and allowlist | Built. The entry and the registry entry hold the block. |
| Accept refusal for uploaded design systems | Built. The archive may carry the contract; an incomplete one is refused. |
| Composition refusal | Built. An uncertified component and a missing required property are both refused. |
| Contract reader in the component tree | Built. `contractFor` returns the block. |
| Palette carries the contract | Built. `_draft_safe_palette` includes it. |
| Dry test | Built. `backend/test_accessibility_contract.py` exercises the failure, the approval, and the composition refusal. |

## What the gate enforces today

| Check | State |
| --- | --- |
| The four declarations are present and each names its source | Enforced at approval. `role`, `label`, `keyboard`, and `announcement`; a value with no allowed source is a finding. |
| Every WCAG identifier exists in the vendored standard | Enforced. An identifier the JSON-LD does not contain is `UNKNOWN_WCAG_CRITERION`, never a silent pass. |
| Every criterion names a verification mode | Enforced. `automated`, `manual`, or `unverified`. |
| The contract is complete before the catalogue write | Enforced at approval. An incomplete contract returns HTTP 503 with the missing declarations, and the catalogue is unchanged. |
| The contract travels with the entry | Enforced. The catalogue entry and the allowlist entry hold the block; the palette includes it. |
| The composition names a certified component | Enforced. An entry whose block is incomplete is refused at composition. |
| Every property the contract marks required is present and non-empty | Enforced at composition. A missing or blank property is `ACCESSIBILITY_PROPERTY_MISSING`. |

## What the gate does not enforce yet

These are the six generative failure modes the contract is built around. The contract carries each
rule's vocabulary and shape; the checks that need the rendered element's own facts are the next
increment.

| Failure mode | What the check needs | State |
| --- | --- | --- |
| Placeholder-only labeling | A forbidden-value list for the accessible name: the component name, the property name, an empty string, `undefined`, and the generic words a model reaches for (`Button`, `Image`, `Label`). | Not enforced. The gate checks presence and a non-empty value; it does not yet refuse a generic word. |
| A container pretending to be a button | The component's declared type and the generated element's role; an action binding must appear only on an interactive type, and the element must carry a role or be a native button. | Not enforced. The contract records the type; the composition gate does not yet test the action binding. |
| Hallucinated alternative text | A source for the accessible name, recorded as the Figma node and fact. | Partly enforced. The label must come from a text layer or a declaration; a guessed value has no allowed source. There is no accuracy check against the design. |
| Visual-only structure | The node's visual role (heading, region, list) and the element's semantic role. | Not enforced. The contract has no heading or region rule yet. |
| Colour-only state | A comparison of state variants: if only fill or stroke changes, the rule fails unless text, icon, or an announced state also changes. | Not enforced. The fact table records fills and effects; the variant comparison is not written. |
| Suppressed focus | A focus-variant fact and a visible focus style in the generated element. | Not enforced. The fact table has no focus-indicator fact and the generated source has no focus style. |

## What the measurement adds

The contract states its criteria but does not yet run an automated contrast or target-size
measurement against the rendered element. When that measurement lands, three things become
possible:

- **Contrast (WCAG 1.4.3).** Compute the ratio from the text fill and the surface fill when both
  are solid. When the surface is an image or a gradient, the criterion stays manual and the
  contract records the gap rather than inventing a number.
- **Target size (WCAG 2.5.8).** Measure the node's width and height against the minimum.
- **Evidence.** Attach the measurement's artifact to the criterion, so an `automated` claim has a
  record behind it. Today the verification mode is declared; the evidence is the next increment.

## The demonstration

1. Ingest a Figma component without `A11y: keyboard` and `A11y: announce`. The conversation says
   the contract is incomplete and names the two missing declarations. The drawing is unchanged.
2. Press Approve. The 503 body above appears. The catalogue file's modification time has not moved.
3. Add the two annotations. Ingest again. The contract is reported complete.
4. Press Approve. The component is written with the contract on its catalogue entry.

The dry run prints the same refusal and the same approval from the real module:

```
python3 backend/test_accessibility_contract.py
```

## The words for the room

Open with this:

> "The hardest problem in agent-composed interfaces is not making the agent produce a component.
> It is preventing the agent from producing an inaccessible one at scale. I made accessibility a
> condition of the component existing in the catalogue, so the agent cannot compose what the
> catalogue has not certified."

Close with this:

> "An audit tells you what shipped. A gate decides what may ship. For a company under a WCAG
> obligation, the second is the control that matters."
