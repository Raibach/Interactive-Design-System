/**
 * WHAT A COMPONENT DOES — the allowlist's own account of its behaviour, read from the entry.
 *
 * The tree shows three things about a component and this is the third: which component it is
 * (name, tag, node), what draws it (`component-drawn-by.ts`, the manifest), and now WHAT IT
 * DOES. The first two are derived from files; this one is DECLARED, and the declaration lives
 * in the allowlist beside the props — `description`, `events`, `constraints` — which is the
 * only place in the repository where a component's behaviour is written in words.
 *
 * WHY IT IS READ FROM THE ENTRY RATHER THAN SCANNED FROM THE SOURCE. The source can be
 * searched for `dispatchEvent(...)` and the audit does exactly that — it is how it knows
 * `<chat-panel>` dispatches 23 events the registry does not list. But that scan answers "what
 * does the code do", and this level answers "what does the entry SAY it does", which is the
 * question a person auditing a catalogue is asking: the two being different is the finding.
 * So the entry's words are shown as the entry's words, and the audit's findings stay where they
 * already are.
 *
 * NOTHING IS INVENTED. A component with no entry gets no description and no events, and the
 * caller is told that rather than shown a blank that could be read as "it does nothing".
 */
import { TAG_REGISTRY } from '@/shared/tag-registry';

export interface ComponentContract {
  /** The entry's one-line description of the component. Empty when the entry carries none. */
  description: string;
  /** The events the entry lists, in the entry's order. Empty is a fact, not a failure. */
  events: string[];
  /** The props the entry declares — what a payload may send it. */
  props: string[];
}

/** What the allowlist declares about a tag, or null when it declares nothing. */
export function contractFor(tag: string): ComponentContract | null {
  const registry = TAG_REGISTRY as unknown as Record<string, any> | undefined;
  const entry = tag ? registry?.[tag] : undefined;
  if (!entry || typeof entry !== 'object') return null;
  return {
    description: typeof entry.description === 'string' ? entry.description : '',
    events: Array.isArray(entry.events) ? entry.events.map((e: unknown) => String(e)) : [],
    props: Object.keys(entry.props ?? {}),
  };
}

export interface CatalogEntryFacts {
  /** The catalogue entry's description of the component. Empty when it carries none. */
  description: string;
  /** The slots the entry declares it holds, in the entry's order. */
  slots: string[];
}

/**
 * The CATALOGUE's own words about a component — what it is, and what it holds.
 *
 * A different source from `contractFor`, and for a different reader. The allowlist says what the
 * AI may emit; the catalogue entry describes the component to whoever is looking at a surface.
 * The entry is the one that answers "I clicked it and nothing drew": for a container it says the
 * element renders one item per bound list, or draws its children — which is exactly why a
 * preview document, having no payload and no data, shows an empty frame.
 *
 * Read in whichever of the two shapes the entry is written in, the same way the tree reads it.
 */
export function catalogEntryFacts(doc: any, name: string): CatalogEntryFacts | null {
  const entry = name ? doc?.components?.[name] : undefined;
  if (!entry || typeof entry !== 'object') return null;
  const allOf = Array.isArray(entry.allOf) ? entry.allOf : null;
  const block = allOf && allOf.length ? allOf[allOf.length - 1] ?? {} : entry;
  const props = block?.properties ?? {};
  return {
    description: typeof block?.description === 'string' ? block.description : '',
    slots: Object.keys(props?.children?.properties ?? {}),
  };
}
