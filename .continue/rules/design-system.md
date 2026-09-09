# Design-System Rules (persistent overrides)
## This repo uses Lit (Web Components). Components live in `frontend/src/components/lit/`.

1. **Never invent design values.** Every size, color, spacing, radius, shadow, or
   font must trace to a fresh `get_design_context` pull (MCP, `127.0.0.1:3845`),
   a cached pull in `frontend/src/design/*.json`, or the composed spec for that
   node. If a value is absent from the pull, write `UNSPECIFIED` and stop. Do not
   pad with a plausible number.

2. **Before generating any component, check `frontend/src/components/registry.json`.**
   - If the component exists in the registry, import it. Do NOT regenerate.
   - If it does not exist, ask before building.
   - Never output React, JSX, or Tailwind.

3. **Match the pull 1:1, then stop.** Reconstruct only what the MCP pull proves.
   Do not add new capabilities, controls, states, or endpoints. Anything
   click-behavioral that is not drawn in the design is out of scope:
   - Render the control so it looks correct and is present in the DOM.
   - Give it the correct tag/role so it is focusable/accessible.
   - Leave the handler unimplemented with:
     `// TODO(behavior): action undefined in Figma — node <id>`
   - Never wire it to a made-up endpoint, fake state, or placeholder logic.

4. **Break loud, don't absorb.** If the design cannot be reproduced because
   parameters are missing, the component must visibly break rather than
   silently round. That break is the signal to fix the Figma file.

5. **Carry node IDs.** Every CSS declaration and every DOM element that maps to a
   Figma node carries its `data-node-id` (and a `/* node 40…:… */` comment).
   Preserve the tree mapping: Figma node → Lit element, node for node.