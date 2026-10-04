/**
 * AGNOSTICUI'S OWN REGISTRY — the agnosticui partition's declaration file, 2026-10-03.
 *
 * THE WALL, IN THE OWNER'S OWN WORDS (2026-09-28, PLANS.AGENT/multiple-catalogs.md §10):
 * *"They're going to be independent… I'm not merging catalogues or anything. I'm not sharing.
 * It's got to be separate. There's gotta be a hard wall between each one of these catalogues —
 * the registries, how they're processed."* And its consequence, stated as a rule: **"The app's
 * three files are the app catalogue's files"** — README counts, `shared/tag-registry.ts` and
 * `components/registry.json` belong to prompt-composer, and a second catalogue never writes
 * into them.
 *
 * WHAT THIS FILE IS. The declaration half of agnosticui's registry: `ag-select`, stated at the
 * `TagDefinition` contract — the same shape the app's allowlist entries use. It was declared in
 * `shared/tag-registry.ts` when instance #1 landed (2026-10-03, before the wall was applied);
 * it moved here the same day the second system landed and the rule was enforced.
 *
 * WHAT THIS FILE IS NOT. The RESOLUTION half is DATA — `wireframe-lab/catalogs/agnosticui/
 * registry.json` (the partition's own name→tag table, served by the server and fetched by
 * `shared/a2uiRegistries.ts`). `resolveTag(name, 'agnosticui')` reads THAT table first; nothing
 * of agnosticui resolves through the app's allowlist.
 *
 * THE IMPORT BELOW IS ALSO PART OF THE REGISTRY'S JOB: an element in no import is an element the
 * bundle does not contain. `Select.ts` registers `ag-select` and re-exports the implementation.
 */
import type { TagDefinition } from '@/shared/tag-registry';
import './components/Select/core/Select';

export const SYSTEM = 'agnosticui';

export const COMPONENTS: Record<string, TagDefinition> = {
  'ag-select': {
    tag: 'ag-select',
    surface: 'composer',
    column: 'middle',
    description:
      'A NATIVE-SELECT COMPONENT FROM AGNOSTICUI, copied in (2026-10-03) — the first element brought in from an external design system through this app\'s catalogue pipeline. Implemented by agnosticui/components/Select/core/_Select.ts, copied from upstream verbatim except for two mechanical decorator-mode adaptations (recorded at the top of that file). A lightly-styled native select with an external label, required/invalid/error/help states. Upstream: github.com/AgnosticUI/agnosticui.',
    props: {
      size: { type: 'string', optional: true },
      multiple: { type: 'boolean', optional: true },
      disabled: { type: 'boolean', optional: true },
      multipleSize: { type: 'number', optional: true },
      label: { type: 'string', optional: true },
      labelPosition: { type: 'string', optional: true },
      labelHidden: { type: 'boolean', optional: true },
      noLabel: { type: 'boolean', optional: true },
      required: { type: 'boolean', optional: true },
      invalid: { type: 'boolean', optional: true },
      errorMessage: { type: 'string', optional: true },
      helpText: { type: 'string', optional: true },
    },
    events: ['change'],
    constraints: [
      'COPIED SOURCE FROM ANOTHER DESIGN SYSTEM: its look, its styles and its a11y are upstream\'s — do not restyle it here; the catalogue owns it',
      'its options ride the default slot as real option elements; a draft node places the CONTROL, and options are what placement learns to carry when it learns to carry children',
    ],
  },
};
