import type { ColorThemeDefinition } from "../types";
import { NEUTRAL_HEROUI, NEUTRAL_SCALE } from "../palettes/neutral";

/**
 * THE HOUSE THEME — the Raibach IDS palette, owned in the app's own theme
 * system (not injected over the built output).
 *
 * Grounds take the pin gate's navy #110E1F; panels and cards take the house
 * purple #22202D. Only the semantic --oh-* tokens are overridden (as literal
 * hex, independent of the cool-grey scale), so hover states and the HeroUI
 * token scale stay exactly as the neutral theme defines them.
 */
export const openhandsHouse: ColorThemeDefinition = {
  label: "Raibach House",
  appearance: "dark",
  scale: NEUTRAL_SCALE,
  heroui: NEUTRAL_HEROUI,
  tokens: {
    "--oh-color-base": "#110E1F", // ground / frame
    "--oh-color-base-secondary": "#22202D", // panels
    "--oh-surface": "#22202D", // cards & panels
    "--oh-surface-raised": "#22202D", // raised cards
    "--oh-surface-deep": "#110E1F", // deep panels
    "--oh-bg-dark": "#110E1F", // dark grounds
    "--oh-bg-light": "#22202D", // raised controls
    "--oh-bg-input": "#22202D", // the composer's field
    "--oh-bg-workspace": "#22202D", // workspace surfaces
    "--oh-bg-editor-sidebar": "#22202D", // editor chrome
    "--oh-bg-editor-active": "#22202D", // editor chrome
    "--oh-color-tertiary": "#22202D", // rows, base buttons
  },
};
