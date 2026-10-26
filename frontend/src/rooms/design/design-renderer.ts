/**
 * design-renderer — THE DESIGN ROOM'S OWN A2UI RENDERER.
 *
 * Owner, 2026-10-18: *"may even need to create an A2UI renderer.ts file just for design imagine
 * that."* So Design draws its surfaces through an element of its own, registered here and used by
 * nothing else:
 *
 *   <design-renderer>   Design's surfaces — the console and the Tools seat (the Figma section).
 *   <a2ui-renderer>     every other room — Composer, Console, Product, Governance.
 *
 * WHY A SEPARATE TAG AND NOT A SWAPPED TREE. An element instance IS state: its drawn shadow tree,
 * its seats, its listeners and the surface it holds. One shared instance means one room's assembly
 * writes over another's, and neither can hold a surface while the other holds one. The behaviour
 * is the same on purpose — this class IS the app's renderer, extended — so the two rooms look
 * alike; the INSTANCE and the TAG are what make them separate.
 *
 * WHAT IS SHARED: the catalogue, the resolver and the components — the reasons the rooms look the
 * same. What is not shared: the element, and therefore the state.
 */
import { A2UIRenderer } from "@/components/lit/a2ui-renderer";

export class DesignRenderer extends A2UIRenderer {}

if (!customElements.get("design-renderer")) customElements.define("design-renderer", DesignRenderer);

declare global {
  interface HTMLElementTagNameMap {
    "design-renderer": DesignRenderer;
  }
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'design-renderer': React.DetailedHTMLProps<React.HTMLAttributes<DesignRenderer>, DesignRenderer>;
    }
  }
}
