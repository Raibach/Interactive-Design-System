/**
 * THE OFFICIAL LIT BRIDGE FOR THE PROMPT-COMPOSER CATALOGUE.
 *
 * The Composer and the Console draw their surfaces from the prompt-composer catalogue. The names
 * resolve through the same living table the old renderer uses — `resolveTag` — so the official
 * adapter and the room agree on what each name draws. The shared adapter supplies the light-DOM
 * element and the official surface does the rendering.
 */
import catalogDoc from '@/components/A2UI/catalogs/prompt-composer/catalog.json';
import {resolveTag} from '@/components/lit/a2ui-renderer';
import {createLitCatalog} from './litCatalog';

/* ── the primitive floor; the application entry registers every other element ─────────────── */
import '@/components/lit/a2ui-primitives';

const names = Object.keys((catalogDoc as {components: Record<string, unknown>}).components);

/** Every prompt-composer name and the tag the living renderer resolves it to. */
export const LIT_COMPOSER_TAGS: Record<string, string> = {};
for (const name of names) {
  const tag = resolveTag(name);
  if (tag) LIT_COMPOSER_TAGS[name] = tag;
}

/** The prompt-composer catalogue, with one official Lit adapter for every component it names. */
export const createOfficialLitComposerCatalog = () =>
  createLitCatalog(catalogDoc as Record<string, any>, LIT_COMPOSER_TAGS);
