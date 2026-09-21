# Case Study — Raibach Interactive Design System (IDS)

**Project:** Raibach IDS — an A2UI-compliant enterprise AI prompt-package platform
**Timeline:** June 2026 – September 2026
**Role:** Principal Designer — system design, UX strategy, governance architecture, React/TypeScript and Python frontend development
**Team:** John Holt, with AI-assisted engineering (DeepSeek)
**Status:** Live — deployed, audited, and running · [Demo](https://site--semantic-design-systems--mgtvxtd7xr2v.code.run) (pin 7377)

## Project Summary

This project is a continuation of Southern California Edison's AI lifecycle management project, which ran as a three-month discovery engagement. During discovery, I researched agentic interfaces and agent flows in depth. I decided to continue the build AI-native, using A2UI protocols — the application assembles itself fully from a Lit catalog using only AI, wrapped in a React shell that holds the AI-native surface. The goal was a seamless interface that keeps every function inside a prompt package, tying all governance and artifacts to a particular prompt ID.

## The Product

**The Console** is the central prompt-management surface: a card grid of packages, reshuffled and filtered by AI commands over the same assembly channel. A Trace tab records everything the surface can see about itself — network calls with status and duration, events, errors, audit summaries, and main-thread stalls — so a slow load is explained, not guessed at.

**The Prompt Composer** is the working surface: a section editor on the left, compiled output in the middle, and the conversation panel on the right, with version trace, token-cost and status readouts, and per-package chat scoped from the first keystroke. Packages carry role-based capability (what each role sees and can do), provenance, and audit history as first-class metadata — the package is the aggregate root, and governance travels inside it.

Both surfaces are drawn from the same single catalog of **51 trusted components** — 17 A2UI protocol primitives plus 34 project-specific Lit elements. The backend loads that catalog's schema at startup and refuses to start if it fails to; every AI payload is validated against it on each request, and a component the catalog doesn't own is refused outright; and a blocking build check holds the documented component count against the actual catalog file, so the number cannot drift from what the documentation claims.

## Key Challenges

**The original problem: AI-generated interfaces are ungoverned, and ungoverned interfaces drift.**

A runtime model asked to "build the screen" will paraphrase the design into something plausible but wrong, invent components that were never drawn, and quietly replace a failed response with its own inner monologue dressed as a result. For an enterprise, that means three things at once: no standardization (every session produces a different surface), no auditability (nothing traces a pixel back to a decision), and silent failure (the screen goes blank or wrong without a record of why). Meanwhile the design file — the one artifact that actually states intent — sits outside the build entirely, so code and design drift apart in both directions.

**The insight: constraint is the product.**

The fix is not to ask the model to behave; it is to structure the system so the model *cannot* misbehave. Fix the catalog, bind values by path, and the answer space collapses — the model copies instead of chooses, and the remaining invention happens exactly where the structure has a gap, which is precisely where checks should live. Governance is not a layer added to the product; it is the spine of it.

## Solution Overview

**A deterministic shell, with AI filling slots.** The React + Lit shell renders unconditionally — navigation, frame, error states, slot containers — regardless of what the AI does or doesn't do. The AI decides which prompt blocks, data, and chat populate the left/middle/right slots; it cannot create or remove them. If the AI fails, the shell shows the failure. If it is slow, the shell shows loading. The user never stares at a blank page.

**One surface, one database, one canvas.** There are no pages and no URL routes — navigation is an AI command. The request says which surface to show — the console, the composer, or a saved session — and the AI assembles that surface from the trusted catalog inside the React shell. One database behind the surface handles everything: packages, conversations, versions, roles, and audit records. The Composer is a three-column workspace: the prompt column on the left, the compiled output in the center, and the chat column on the right. Either side column can be pushed aside — the chat to the right, the prompt to the left — dragged by its gripper until it docks, and the compiled output always flexes into the freed space: the canvas opens up to full width. The chat column never disappears when collapsed; it leaves its rail behind, so the work surface is one click from being a conversation again.

**Everything lives in the package.** The prompt sections, the compiled output, the conversation, the run trace, the version history, and the governance records are all held in one unit: the package. There is no separate destination for writing a prompt, holding a conversation, reading a trace, or checking a version — all of it happens in the same package. That is why the workspace works the way it does: the editor, the output, and the conversation are three views of one package, not three places to move between. The package is what gets versioned, shared, and audited, and everything it holds stays tied to its prompt ID.

**Design intent as the source of truth.** The Figma-to-Lit pipeline makes the drawing the specification: every component is extracted node by node, with the designer's Dev Mode annotations as the single source of its behavior. Each element is registered in three places, and all three must agree:

1. **The allowlist** — what may be rendered
2. **The design map** — which Figma node each component came from, with provenance
3. **The catalog schema** — what the server validates every AI response against (one per pipeline; a component it doesn't own is refused)

The audit that gates delivery checks exactly this, and it does not accept intent as evidence — only records. A behavioral element that no allowlist entry, catalog entry, design-map entry, or drawing parent claims is **refused at build time**, not argued with.

## Every Action Optimized: What the System Costs to Run

The cost of an AI-native interface depends on how many decisions the model makes, and this system is built to minimize the number of decisions. A model produces the next token from a set of candidates; the catalog and the value bindings decide how many candidates that set holds. With the catalog fixed and every value bound by path, the set holds one or two items, and the model copies instead of choosing. The model spends reasoning tokens when the candidate set is wide.

Same prompt, reasoning off for surfaces: 251 completion tokens instead of 460, 1.53 seconds instead of 6.05, and the same valid JSON. If the model were deciding, turning the reasoning off would have changed the answer. The answer was unchanged.

Per console load, three model calls became one: about 11,280 tokens down to 3,551, 68% fewer, and a 27% request-failure rate went to zero. The second call was a duplicate; the third became a file read. The checker's findings come from the report it already wrote, which is a file read of one or two milliseconds rather than another model call. Each eliminated failure also saves the two attempts that used to follow it — about 7,500 tokens — on a screen that never appeared.

Only the conversation uses reasoning, because it is the only mode where the candidate set is wide. Surfaces run without reasoning; so do tagging, summarizing, and recall, and no-reasoning is the default, so a caller that forgets its mode still gets the no-reasoning setting.

At volume: about half a cent of model compute per console load at commodity prices — five dollars per thousand loads, and a hundred million loads a year is about half a million dollars. On owned hardware the limiting resource is GPU seconds rather than dollars per token, so two-thirds fewer tokens and four times less latency means fewer machines for the same work. Assembly runs on a small local model because the catalog fixes the answer space; only the conversation needs a large one.

The constraint is a live property: every entry added to the catalog, and every field no check covers, gives the model a decision to make again, and decisions are where the tokens go. The annotations, the checks, and the catalog do two jobs: they make the system auditable, and they keep the token cost minimal.

## Annotations and the Import Pipeline

The behavioral spec lives inside the design file. Every component in the Figma drawing carries a **Dev Mode annotation** — a note tied to its node ID that states what the element is for and what it dispatches. The annotation is the single source of behavior: a button's states, a grip's drag contract, a dropdown's event. The import pipeline pulls the design context node by node, extracts layout, visual, and typographic values together with the annotation, and writes each component into the three catalog locations — the Lit element, the allowlist, and the design map, which records which Figma node the component came from and whether its registration is verbatim or inferred.

The import is audited as it lands. A per-component report flags every element as annotated, missing, or failed to pull from the file, so an unannotated drawing is caught the moment it arrives rather than after it ships. A fidelity harness then compares the Figma drawing against the code by each element's node ID — same address, same count — which turns "does this match the design?" into a structural fact a machine answers the same way every time: a missing or doubled element is caught by count, not by eye. The first component built end to end this way, the role dropdown, has been followed by the full catalog.

**Sovereignty: Figma is the drafting table, not the foundation.** Once a component is imported and registered, its home is the Lit catalog in this repository. The application at runtime never calls Figma — the catalog, the schema, the audit, and the site all run independently, and the drawings are cached at authoring time. **If the connection to Figma is lost, the design system loses nothing: every component, its annotation, and its provenance already live in the repo.** Components are deliberately added to our own catalog rather than rented from a platform.

## Model-Agnostic by Design

The platform is built on open standards — A2UI and MCP — with **no dependency on any one model provider, and no cloud requirement at all**. The assembly path runs on a small local model because the catalog fixes the answer space and every value is checked; the conversation runs on a larger one. Models are swapped by configuration, not rework: replacing a provider never gives up the component tree or the production logic.

The whole stack can live on owned hardware — PostgreSQL for the data, an embedded vector store with local embeddings, and local models for assembly, conversation, and governance. Nothing in the platform requires a cloud service. **Wire any local system or any cloud service to it you want — the platform is the harness, not the subscription.**

## The Case Within the Case: a redesign that had to land on a live system

When wireframe revision 4b replaced the conversation panel — new palette, new navigation rail, new input stack — it had to land on a platform already live in production, not a prototype. The work broke into five moves:

**Read the drawing region by region.** The new panel was extracted from the design file area by area and matched to existing components: the four-button rail (Chat, Trace, Versions, Tools), each button a component with named states; send and stop merged into the single control the design specified; the conversations dropdown carrying the thread list; the 20-pixel grip with its dot glyph. Eight existing elements were updated in place, and one — the user's own message bubble — was built new, to the file's measurements.

**Refuse the temptation to delete.** Controls the new drawing no longer showed — the model selector, the add button, several readouts — were unhooked and left in place, each recorded as a decision waiting rather than an accidental casualty. A redesign is not permission for capabilities to disappear.

**Register everything in all three layers.** Every element — including the one reference that makes each reachable — was registered in the allowlist, the design map, and the catalog schema. The audit gates on exactly this, and it accepts only records.

**Fix what the redesign surfaced beneath the surface.** Two real defects came up: a rename that returned "not found" because the database reported the wrong count of touched rows, and a conversation list that ignored its package scope and returned every conversation in the system. Both were fixed at the source rather than papered over.

**Prove the lifecycle end to end.** Create a conversation from the footer mark, name it from its own first words, archive it, list archived and active threads with a per-row delete that refuses the open one, and start the successor already selected — each behavior verified live at runtime, not from a report.

## Production

**The deploy window is a design surface.** Failures that followed every deploy were traced to the window itself — the minutes when the old version is gone and the new one is not yet answering. Memory guards went in front of the platform's heaviest AI library after the host killed the container for exceeding its limit, and the repository's local weight came down from roughly a quarter of a terabyte to under two gigabytes by removing model experiments and years of accumulated file history. The container now runs at about half its memory ceiling with no out-of-memory kills since the guards went in, and a deploy is minutes, not hours.

## Governance and Verification: the product's spine

Verification is structural, not cultural. On every build and every change, the pipeline runs:

- **The catalog audit** — every component must trace to a drawn node and an annotation; zero blocking findings.
- **Doc-claim drift** — a stale number in the documentation fails the build; it does not wait to be remembered.
- **The registers** — the open-items register and the corrections ledger, whose recorded counts, cited findings, and even tracked status are checked; drift fails the build, and a corrected finding that comes back fails it as a regression.
- **372 automated tests**, covering the surface contract, the envelope, the panels, and the failure modes.

Beyond the build, a **governance inspector** runs daily on local models: the code prepares an evidence sheet and decides every fact, two models classify it independently, and any disagreement is stored with both answers — a second opinion over the state of the repository itself.

## The Method

The working doctrine behind the platform is **live-verification design engineering**: claims are hypotheses; only observed runtime behavior is knowledge. Every assertion earns a mark — verified with a receipt, partial, or specified-not-built — and anything unverifiable is demoted until it can be verified. Documentation synchronizes after behavior, never before; if the record and the runtime disagree, the runtime wins and the record is corrected publicly. And frontend behavior is verified like a person experiences it: does the loading state exist, does failure render as guidance rather than blankness, can the user undo it — not just does the happy path pass a parser.

This is design work expressed as engineering: intelligence is spent once, at the moment of naming — the Figma node, the annotation, the registration — and after that the system runs free, holding itself honest without re-arguing what the design is.

## Outcomes

- **A live, audited platform** built on open standards (A2UI, MCP) with no dependency on any one model provider; models can be replaced without giving up the component tree or the production logic.
- **Zero blocking audit findings** across both pipeline catalogs; 372 tests passing; the catalog audit and doc-claim checks running on every change.
- **A 68% reduction in tokens and roughly a 4× reduction in latency** per console load, with the 27% request-failure rate eliminated entirely — about half a cent of model compute per load at commodity prices, and assembly running on a small local model because the catalog fixes the answer space.
- **The conversation lifecycle working end to end**, counts included, with archived threads recoverable rather than lost.
- **A production system that survives its own deployment**: memory-guarded containers, no out-of-memory kills since the guards went in, and a repository light enough that a deploy is minutes instead of hours.
- **Every element on screen traceable** to a drawn node and an annotation that states what it is for.

## What Carries Forward

- **Annotate before building.** A drawing without an annotation gets flagged empty by the audit — the missing specification is the work, not an obstacle to it.
- **Governance-first architecture.** Audit trails, role capability, and provenance ride inside every package, so adoption and compliance are the same motion rather than competing ones.
- **Keep the laboratory out of the shipping lane.** A multi-gigabyte model experiment run alongside the product very nearly took the delivery pipeline down with it. The fix was not to stop experimenting, but to build a wall between the experiment and the line.
- **Design the deploy window as deliberately as the screens.** A live product is judged on the first load after every change; that moment is a design surface like any other.

---

*References: [README.md](README.md) · [READ-ME/IMPLEMENTATION_CONFORMANCE.md](READ-ME/IMPLEMENTATION_CONFORMANCE.md) (A2UI v0.9.1 conformance map) · [READ-ME/THE_METHOD.md](READ-ME/THE_METHOD.md) (live-verification design engineering) · [CHANGELOG.md](CHANGELOG.md) (measured verification receipts)*
