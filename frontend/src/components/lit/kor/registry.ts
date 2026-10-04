/**
 * KOR'S OWN REGISTRY — the kor partition's declaration file, 2026-10-03.
 *
 * THE WALL, IN THE OWNER'S OWN WORDS (2026-09-28, PLANS.AGENT/multiple-catalogs.md §10):
 * *"They're going to be independent… I'm not merging catalogues or anything. I'm not sharing.
 * It's got to be separate. There's gotta be a hard wall between each one of these catalogues —
 * the registries, how they're processed."* And its consequence, stated as a rule: **"The app's
 * three files are the app catalogue's files"** — README counts, `shared/tag-registry.ts` and
 * `components/registry.json` belong to prompt-composer, and a second catalogue never writes
 * into them.
 *
 * WHAT THIS FILE IS. The declaration half of kor's registry: the two elements this system
 * brought in (kor-button, and kor-icon as the dependency its template renders), stated at the
 * `TagDefinition` contract — the same shape the app's allowlist entries use, typed against the
 * interface declared where that schema lives, so a per-system registry cannot drift from the
 * app's contract while living in its own file. A reviewer reads this file and sees Kor, alone.
 *
 * WHAT THIS FILE IS NOT. The RESOLUTION half is DATA — `wireframe-lab/catalogs/kor/registry.json`
 * (the partition's own name→tag table, served by the server and fetched by
 * `shared/a2uiRegistries.ts`). It is data because a bundle is built before a system is ingested
 * and a runtime-written `.ts` can never be imported (wireframe-lab/ADD-A-DESIGN-SYSTEM.md §6).
 * `resolveTag(name, 'kor')` reads THAT table first; nothing of kor resolves through the app's
 * allowlist.
 *
 * THE IMPORTS BELOW ARE ALSO PART OF THE REGISTRY'S JOB: an element in no import is an element
 * the bundle does not contain. The button's own `import '../icon'` registers both; the import
 * here is what guarantees the system is in the bundle whether or not anything else says so.
 */
import type { TagDefinition } from '@/shared/tag-registry';
import './components/button/kor-button';
// THE CONTACT-FORM SET (2026-10-03, late — the owner: *"I need to create a simple contact form…
// that should be all I need to say"*, and *"Just build something that she can use to assemble
// things on the page"*). Four more of Kor's own components, same procedure as the button: the
// source copied in (header + `accessor` adaptation only), the manifest measured from it, the
// catalogue entries written by hand — the ingest stays out of scope per the owner's direction.
import './components/card/kor-card';
import './components/input/kor-input';
import './components/text/kor-text';
import './components/textarea/kor-textarea';

export const SYSTEM = 'kor';

export const COMPONENTS: Record<string, TagDefinition> = {
  'kor-button': {
    tag: 'kor-button',
    surface: 'composer',
    column: 'middle',
    description:
      'A BUTTON FROM KOR, copied in (2026-10-03) — instance #2 of the external-design-system pipeline (wireframe-lab/IMPORT-A-DESIGN-SYSTEM.md). Implemented by kor/components/button/kor-button.ts, copied from upstream verbatim except for one mechanical decorator-mode adaptation (recorded at the top of that file). Label / icon / color (primary|secondary|tertiary) / disabled, with a real <kor-icon> drawn when `icon` is set. Upstream: kor-ui.com (@kor-ui/kor).',
    props: {
      label: { type: 'string', optional: true },
      icon: { type: 'string', optional: true },
      color: { type: 'string', optional: true },
      disabled: { type: 'boolean', optional: true },
    },
    events: ['label-changed', 'icon-changed', 'color-changed', 'disabled-changed'],
    constraints: [
      'COPIED SOURCE FROM ANOTHER DESIGN SYSTEM: its look, its styles and its a11y are upstream\'s — do not restyle it here; the catalogue owns it',
      'UNTHEMED UNTIL A THEME LANDS: upstream\'s styles read its own CSS custom properties (--accent-1, --neutral-1, --spacing-xs, --header-2…), which this app does not define — the button draws its structure and states with fallback colours',
    ],
  },
  'kor-icon': {
    tag: 'kor-icon',
    surface: 'composer',
    column: 'middle',
    description:
      'KOR\'S ICON ELEMENT, copied in (2026-10-03) as the dependency kor-button\'s closure needs — the button\'s template renders a real <kor-icon> when `icon` is set, and its module is imported by the button. Implemented by kor/components/icon/kor-icon.ts, copied from upstream verbatim except for one mechanical decorator-mode adaptation (recorded at the top of that file). Upstream: kor-ui.com (@kor-ui/kor).',
    props: {
      icon: { type: 'string', optional: true },
      color: { type: 'string', optional: true },
      size: { type: 'string', optional: true },
      button: { type: 'boolean', optional: true },
      disabled: { type: 'boolean', optional: true },
    },
    events: ['icon-changed', 'color-changed', 'size-changed', 'button-changed', 'disabled-changed'],
    constraints: [
      'COPIED SOURCE FROM ANOTHER DESIGN SYSTEM: its look, its styles and its a11y are upstream\'s — do not restyle it here; the catalogue owns it',
      'its glyph font (`md-icons`, fonts/ in the kor archive) is NOT loaded in this app — a glyph draws as its ligature text until the font lands',
    ],
  },
  'kor-input': {
    tag: 'kor-input',
    surface: 'composer',
    column: 'middle',
    description:
      'KOR\'S TEXT INPUT, copied in (2026-10-03, late) — the contact-form set, the owner: *"I need to create a simple contact form… that should be all I need to say"*. Implemented by kor/components/input/kor-input.ts, copied from upstream verbatim except for one mechanical decorator-mode adaptation (recorded at the top of that file). Label / value / type (text|number|select|password|datetime-local|date) and the number-field family (pattern, min, max, step), with condensed/active/disabled/readonly states. Upstream: kor-ui.com (@kor-ui/kor).',
    props: {
      label: { type: 'string', optional: true },
      icon: { type: 'string', optional: true },
      value: { type: 'string', optional: true },
      name: { type: 'string', optional: true },
      type: { type: 'string', optional: true },
      status: { type: 'string', optional: true },
      pattern: { type: 'string', optional: true },
      min: { type: 'string', optional: true },
      max: { type: 'string', optional: true },
      step: { type: 'number', optional: true },
      condensed: { type: 'boolean', optional: true },
      active: { type: 'boolean', optional: true },
      disabled: { type: 'boolean', optional: true },
      readonly: { type: 'boolean', optional: true },
      noClear: { type: 'boolean', optional: true },
      autofocus: { type: 'boolean', optional: true },
    },
    events: ['label-changed', 'icon-changed', 'value-changed', 'name-changed', 'type-changed', 'status-changed', 'pattern-changed', 'min-changed', 'max-changed', 'step-changed', 'condensed-changed', 'active-changed', 'disabled-changed', 'readonly-changed', 'noClear-changed', 'autofocus-changed'],
    constraints: [
      'COPIED SOURCE FROM ANOTHER DESIGN SYSTEM: its look, its styles and its a11y are upstream\'s — do not restyle it here; the catalogue owns it',
      'UNTHEMED UNTIL A THEME LANDS — upstream\'s CSS custom properties are not defined by this app (same note as kor-button)',
      'its label sits ON TOP and its underline marks the state; the value is a native input inside its shadow root',
    ],
  },
  'kor-textarea': {
    tag: 'kor-textarea',
    surface: 'composer',
    column: 'middle',
    description:
      'KOR\'S TEXTAREA, copied in (2026-10-03, late) as part of the contact-form set. Implemented by kor/components/textarea/kor-textarea.ts, copied from upstream verbatim except for one mechanical decorator-mode adaptation (recorded at the top of that file). Label / value / rows, with active/disabled/readonly states. Upstream: kor-ui.com (@kor-ui/kor).',
    props: {
      label: { type: 'string', optional: true },
      value: { type: 'string', optional: true },
      rows: { type: 'number', optional: true },
      active: { type: 'boolean', optional: true },
      disabled: { type: 'boolean', optional: true },
      readonly: { type: 'boolean', optional: true },
      autofocus: { type: 'boolean', optional: true },
    },
    events: ['label-changed', 'value-changed', 'rows-changed', 'active-changed', 'disabled-changed', 'readonly-changed', 'autofocus-changed'],
    constraints: [
      'COPIED SOURCE FROM ANOTHER DESIGN SYSTEM: its look, its styles and its a11y are upstream\'s — do not restyle it here; the catalogue owns it',
      'UNTHEMED UNTIL A THEME LANDS — upstream\'s CSS custom properties are not defined by this app (same note as kor-button)',
    ],
  },
  'kor-card': {
    tag: 'kor-card',
    surface: 'composer',
    column: 'middle',
    description:
      'KOR\'S CARD — the container a form or any group sits in, copied in (2026-10-03, late) as part of the contact-form set. Implemented by kor/components/card/kor-card.ts, copied from upstream verbatim except for one mechanical decorator-mode adaptation (recorded at the top of that file). Label / icon / image / flexDirection (column|row) / flat, with header, functions and footer slots drawn only when filled. Upstream: kor-ui.com (@kor-ui/kor).',
    props: {
      label: { type: 'string', optional: true },
      icon: { type: 'string', optional: true },
      image: { type: 'string', optional: true },
      flexDirection: { type: 'string', optional: true },
      flat: { type: 'boolean', optional: true },
    },
    events: ['label-changed', 'icon-changed', 'image-changed', 'flexDirection-changed', 'flat-changed'],
    constraints: [
      'COPIED SOURCE FROM ANOTHER DESIGN SYSTEM: its look, its styles and its a11y are upstream\'s — do not restyle it here; the catalogue owns it',
      'UNTHEMED UNTIL A THEME LANDS — upstream\'s CSS custom properties are not defined by this app (same note as kor-button)',
      'a CONTAINER: its children ride slots, and a draft node places the CARD — children are what placement learns to carry when it learns to carry children',
    ],
  },
  'kor-text': {
    tag: 'kor-text',
    surface: 'composer',
    column: 'middle',
    description:
      'KOR\'S TEXT — a typographic block, copied in (2026-10-03, late) as part of the contact-form set (headings and labels for a layout). Implemented by kor/components/text/kor-text.ts, copied from upstream verbatim except for one mechanical decorator-mode adaptation (recorded at the top of that file). size (header-1|header-2|body-1|body-2) / color. Upstream: kor-ui.com (@kor-ui/kor).',
    props: {
      size: { type: 'string', optional: true },
      color: { type: 'string', optional: true },
    },
    events: ['size-changed', 'color-changed'],
    constraints: [
      'COPIED SOURCE FROM ANOTHER DESIGN SYSTEM: its look, its styles and its a11y are upstream\'s — do not restyle it here; the catalogue owns it',
      'its CONTENT rides the default slot — a draft node places the block, and the words are what placement learns to carry when it learns to carry children',
    ],
  },
};
