/**
 * THE TRAY'S VIEW — the foot of the column: the product room's tools, or the seat's own tray.
 *
 * The second half of the header/footer/tray extraction named in RULES.md. The markup leaves the
 * seat; the view takes values and callbacks and returns the template. It owns no state, and the
 * seat still forwards the two product events.
 */
import { html, type TemplateResult } from 'lit';
import '../parts/design-chat-product-tools';
import '../parts/design-chat-plugin-tray';

export interface TrayViewValues {
  productTools: boolean;
  figmaConnected: boolean;
  githubConnected: boolean;
  visualEditActive: boolean;
  onProductAttach: (e: CustomEvent<{ files: File[] }>) => void;
  onProductTool: (e: CustomEvent<{ tool: string }>) => void;
}

export const trayView = (v: TrayViewValues): TemplateResult =>
  v.productTools
    ? html`<design2-chat-product-tools
        .figmaConnected=${v.figmaConnected}
        .githubConnected=${v.githubConnected}
        .visualEditActive=${v.visualEditActive}
        @product-attach=${v.onProductAttach}
        @product-tool=${v.onProductTool}
      ></design2-chat-product-tools>`
    : html`<design2-chat-plugin-tray></design2-chat-plugin-tray>`;
