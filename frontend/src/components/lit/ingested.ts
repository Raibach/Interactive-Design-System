/**
 * THE INGESTED COMPONENTS, REGISTERED — every `f-*` element defines itself here.
 *
 * WHY THIS FILE EXISTS. Approval writes a component to `lit/<tag>.ts`, declares it in the
 * allowlist, in the pipeline's catalogue and in the Figma map — and none of that DEFINES the
 * element, because a custom element is defined by an IMPORT and nothing imported the file. So
 * every component this pipeline has ever approved was an empty box waiting to happen: the
 * renderer resolves the name, finds `<f-40001206-2888>` defined by nothing, and draws
 *
 *     resolved to <f-40001206-2888>, which no element defines
 *
 * — which is the failure mode `main.tsx` warns about in four separate comments, arriving
 * through the one door none of them covered.
 *
 * MEASURED 2026-09-30, in the running page, BEFORE this file existed:
 *
 *     f-40001206-2888   defined: false
 *     f-40001204-5752   defined: false
 *     f-40001207-3497   defined: false
 *     f-40001207-3559   defined: false
 *     chat-panel        defined: true
 *     prompt-section-editor defined: true
 *
 * Four approved components, none of them renderable, beside hand-built ones that render.
 *
 * WHY A GLOB AND NOT ANOTHER LINE IN main.tsx. Every generated tag is `f-<figma node id>` — the
 * ingest's own guard (`_SAFE_TAG_RE`, `routes/figma.py`) accepts nothing else — so `./f-*.ts`
 * selects exactly the ingested components and can never select a hand-written one. `main.tsx`
 * stays what it is: a curated list where every entry carries the reason it is there. Approval
 * needs no edit to it, and that is the point — the step that was missing cannot be forgotten
 * again because it is no longer a step.
 *
 * EAGER, AND WHAT THAT COSTS. Eager loads these with the application rather than on demand,
 * which is the opposite of the choice made for `<agent-flow>`/`<agent-canvas>` in `main.tsx`.
 * It is right while the generated components are few and are drawn in columns that are already
 * on screen. It becomes wrong when there are hundreds, and the seam for that day is written
 * here so it is a decision and not a discovery: drop `eager`, keep the map the glob returns,
 * and resolve a tag lazily at the moment the renderer needs it.
 *
 * Every generated file guards its own definition (`if (!customElements.get(tag))`), so this is
 * safe to import once, and safe if a generated file is ever imported twice.
 */
import.meta.glob('./f-*.ts', { eager: true });
