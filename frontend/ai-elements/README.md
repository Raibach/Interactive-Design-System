# frontend/ai-elements — the React originals, vendored (not yet wired)

**What these files are.** Verbatim copies from Vercel's **AI Elements** (MIT — the owner's own
pointer, 2026-10-03: *"I want to use these elements and make it look a little more
sophisticated"*), taken from `wireframe-lab/ai-elements-main/packages/elements/src/`:

- `reasoning.tsx` — the `<Reasoning>` component: shimmering "Thinking..." while streaming,
  auto-collapse to "Thought for N seconds" a beat after, click to reopen, markdown content.
- `shimmer.tsx` — the shimmering-text primitive (`<Shimmer>`, `motion/react`).

They sit OUTSIDE `src/` on purpose: `tsc -b` and the bundle do not see them, so their imports
(`streamdown`, `@streamdown/*`, `motion`, `@radix-ui/react-use-controllable-state`,
`@repo/shadcn-ui`) are not installed yet.

**Why they are not wired directly.** The seat that would host them (`chat-panel` /
`chat-messages`) is a **Lit element with a shadow root**. React components inside it would need
(a) a React island bridge, and (b) Tailwind's stylesheet — including its preflight — injected
into that shadow root, where preflight would fight the seat's own styles. That adapter is real
work and its own slice.

**What IS live today, behaviorally identical.** The seat carries a 1:1 behavioural port of
`<Reasoning>` in `src/components/lit/chat-messages.ts` (`_workStart/_workMs/_workOpen`,
`willUpdate`, the shimmer label, the collapse timer, click-to-reopen), driven by the seat's own
facts: `sending` (in flight) and `stage` (`'thinking'` → `'building'`, announced by the room's
host through `a2ui:grace-status`). So the interaction the owner asked for runs now; these files
are the literal sources for the next slice.

**Activation plan (when wanted), in order of fidelity:**

1. Add the missing deps: `streamdown`, `motion`, `@radix-ui/react-use-controllable-state`
   (tailwind, lucide-react and `@radix-ui/react-collapsible` are already in `frontend/`), plus
   the shadcn `collapsible` component (`npx shadcn@latest add collapsible`) — `components.json`
   and `src/lib/utils.ts` (`cn`) already exist.
2. Build a second Tailwind pass **without preflight** scoped to these components
   (`corePlugins: { preflight: false }`, content = this folder), and inject that stylesheet
   into the seat's shadow root via `adoptedStyleSheets`.
3. Mount a React island: a tiny Lit element that `createRoot`s into its shadow root and renders
   `<Reasoning isStreaming duration>` with the same two facts the port already uses — swap the
   port for the original behind the same interface, and delete the port.
4. Same pattern for `message.tsx` / `conversation.tsx` / `prompt-input.tsx` if the thread and
   composer get the full treatment.
