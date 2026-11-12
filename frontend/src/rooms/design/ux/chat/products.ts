/**
 * THE UX FOOTER'S PRODUCT MAP — STAGE 0 OF `PLAN-ux-chat-tools.md`.
 *
 * A place in the framed Product analytics application maps to one product entry. The labels and
 * the product family come from PostHog's own navigation (`productsCatalog.ts`) and its mode
 * definitions (`MODE_DEFINITIONS` in `scenes/max/max-constants.tsx`). The map is intentionally
 * data, not a second navigation: the frame reports the path, this file names it.
 *
 * The selector and the location actions are not built in this stage. The chip reads only
 * `label` and `color`; `mode` is carried for the shared selector that follows.
 */
export type UxProduct = {
  key: string;
  label: string;
  color: string;
  /** The Grace mode this product uses in the shared selector, when it has one. */
  mode?: string;
  /** Path shapes after the `/posthog` section prefix is removed. */
  paths: RegExp[];
};

export const UX_AUTO: UxProduct = {
  key: 'auto',
  label: 'Auto',
  color: '#5b6b7f',
  paths: [],
};

/**
 * The ten-plus places the navigation can open. The first eight are the shared selector's
 * products; Web analytics, Logs and Customer analytics are navigation products that share or
 * extend that family. A place that matches none reads as Auto.
 */
export const UX_PRODUCTS: UxProduct[] = [
  {
    key: 'product_analytics',
    label: 'Product analytics',
    color: '#2d6cdf',
    mode: 'product_analytics',
    paths: [/(^|\/)(insights|dashboard|dashboards|saved-insights)(\/|$)/],
  },
  {
    key: 'web_analytics',
    label: 'Web analytics',
    color: '#1f8fef',
    mode: 'product_analytics',
    paths: [/(^|\/)web(\/|$)/],
  },
  {
    key: 'sql',
    label: 'SQL',
    color: '#e85d2a',
    mode: 'sql',
    paths: [/(^|\/)sql(\/|$)/],
  },
  {
    key: 'session_replay',
    label: 'Session replay',
    color: '#16a085',
    mode: 'session_replay',
    paths: [/(^|\/)replay(\/|$)/],
  },
  {
    key: 'error_tracking',
    label: 'Error tracking',
    color: '#d64545',
    mode: 'error_tracking',
    paths: [/(^|\/)error-tracking(\/|$)/],
  },
  {
    key: 'surveys',
    label: 'Surveys',
    color: '#d9468f',
    mode: 'survey',
    paths: [/(^|\/)surveys?(\/|$)/],
  },
  {
    key: 'flags',
    label: 'Flags',
    color: '#7c5cfc',
    mode: 'flags',
    paths: [/(^|\/)(feature_flags|experiments)(\/|$)/],
  },
  {
    key: 'ai_observability',
    label: 'AI observability',
    color: '#6b5bd2',
    mode: 'ai_observability',
    paths: [/(^|\/)(llm-analytics|ai-observability)(\/|$)/],
  },
  {
    key: 'logs',
    label: 'Logs',
    color: '#5b6b7f',
    paths: [/(^|\/)logs(\/|$)/],
  },
  {
    key: 'customer_analytics',
    label: 'Customer analytics',
    color: '#c58a00',
    mode: 'customer_analytics',
    paths: [/(^|\/)customer-analytics(\/|$)/],
  },
];

/** The shared product menu, exactly the seven products PostHog's selector shows. */
export const UX_SELECTOR_PRODUCTS: UxProduct[] = [
  UX_AUTO,
  ...UX_PRODUCTS.filter((product) =>
    [
      'product_analytics',
      'sql',
      'session_replay',
      'error_tracking',
      'surveys',
      'flags',
      'ai_observability',
    ].includes(product.key),
  ),
];

/** A place that shares a product family reads as that family in the chip. */
const PLACE_TO_CHIP: Record<string, string> = {
  web_analytics: 'product_analytics',
  logs: 'auto',
  customer_analytics: 'auto',
};

/** The path the framed application reports, without the `/posthog` section prefix. */
export function productForPath(path: string): UxProduct {
  const clean = path.replace(/^\/posthog(?=\/|$)/, '');
  for (const product of UX_PRODUCTS) {
    if (product.paths.some((shape) => shape.test(clean))) return product;
  }
  return UX_AUTO;
}

/** The product the shared selector shows for a place. */
export function chipProductForPath(path: string): UxProduct {
  const place = productForPath(path);
  const key = PLACE_TO_CHIP[place.key] ?? place.key;
  return UX_SELECTOR_PRODUCTS.find((product) => product.key === key) ?? UX_AUTO;
}
