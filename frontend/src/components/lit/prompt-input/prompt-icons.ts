/**
 * prompt-icons.ts — exact vector data from the Figma file
 * (Wireframes v.4b — SCE Enterprise AI Prompt Platform, file 20UPR2KQMsbAxlo5NJb1se)
 *
 * Every path below is the file's own geometry (pulled via the API with
 * geometry=paths). No hand-drawn approximations. Sources:
 *   - Arrow_drop_down / Vector 10   — node 40000746-94 (10×6, fill #4E68D2)
 *   - Database_fill / Union         — node 40000746-94 (22×27.5, fill #222222)
 *   - Database_fill / Vector band   — subtract geometry (stroke cut, #33363F, w=2)
 *   - Meatballs_menu dots           — 6 circles: 2 cols × 3 rows, r=1, stroke #767676, w=2
 *
 * NOTE: these are Lit TemplateResults (html`…`), NOT strings — Lit renders
 * interpolated strings as text, which made the icons print as raw SVG source
 * (the "blown out" look). Templates parse as real elements.
 */
import { html, TemplateResult } from 'lit';

export const ARROW_DROP_DOWN_FILL = '#4e68d2';

/** Arrow_drop_down icon — 14×13 box, vector drawn in a 10×6 space offset (2,4). */
export const arrowDropDownSvg: TemplateResult = html`<svg width="14" height="13" viewBox="0 0 14 13" aria-hidden="true">
  <path transform="translate(2,4)"
        d="M0.230466 4.80794L4.68785 1.09346C5.20891 0.659238 6 1.02976 6 1.70803L6 8.29197C6 8.97024 5.20892 9.34076 4.68785 8.90654L0.230466 5.19206C0.110528 5.09211 0.110528 4.90789 0.230466 4.80794Z"
        fill="${ARROW_DROP_DOWN_FILL}"/>
</svg>`;

export const DATABASE_FILL = '#222222';
export const LIGHTNING_FILL = '#33363f';

/**
 * Database_fill icon — 40×40 (Figma 40000954-23865). Single filled cylinder;
 * the band cuts are baked into the path (no mask).
 */
export const databaseFillSvg: TemplateResult = html`<svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
  <path d="M31 28.25C31 31.2876 26.0751 33.75 20 33.75C13.9249 33.75 9 31.2876 9 28.25V24.6074C9.6573 25.1629 10.3992 25.6332 11.1602 26.0137C13.6284 27.2477 16.8092 27.875 20 27.875C23.1908 27.875 26.3716 27.2477 28.8398 26.0137C29.6008 25.6332 30.3427 25.1629 31 24.6074V28.25ZM31 21.5166C30.4679 22.5684 29.395 23.5002 27.9463 24.2246C25.8194 25.2881 22.9606 25.875 20 25.875C17.0394 25.875 14.1806 25.2881 12.0537 24.2246C10.605 23.5002 9.53211 22.5684 9 21.5166V16.3574C9.6573 16.9129 10.3992 17.3832 11.1602 17.7637C13.6284 18.9977 16.8092 19.625 20 19.625C23.1908 19.625 26.3716 18.9977 28.8398 17.7637C29.6008 17.3832 30.3427 16.9129 31 16.3574V21.5166ZM20 6.25C26.0751 6.25 31 8.71243 31 11.75V13.2666C30.4679 14.3184 29.395 15.2502 27.9463 15.9746C25.8194 17.0381 22.9606 17.625 20 17.625C17.0394 17.625 14.1806 17.0381 12.0537 15.9746C10.605 15.2502 9.53211 14.3184 9 13.2666V11.75C9 8.71243 13.9249 6.25 20 6.25Z"
        fill="${DATABASE_FILL}"/>
</svg>`;

/**
 * lightning_alt_fill_light — 40×37.235 (Figma 40000922-4805). Activity-rail
 * icon for tool/function calls. Fill #33363F.
 */
export const lightningAltFillLightSvg: TemplateResult = html`<svg width="40" height="37.2354" viewBox="0 0 40 37.2354" aria-hidden="true">
  <path d="M18.5996 7.0332L13.2695 17.6924C13.1074 18.0166 13.0264 18.1793 13.0996 18.2979C13.1729 18.4164 13.3544 18.416 13.7168 18.416H17.5312C18.0444 18.416 18.301 18.4164 18.3652 18.5703C18.4291 18.7246 18.2478 18.9065 17.8848 19.2695L15.2188 21.9355C14.8557 22.2986 14.6744 22.4805 14.7383 22.6348C14.8024 22.7888 15.0591 22.7891 15.5723 22.7891H17.9287C18.291 22.7891 18.4725 22.789 18.5459 22.9072C18.6192 23.0258 18.5381 23.1884 18.376 23.5127L16.9307 26.4043C16.5007 27.2641 16.2854 27.6942 16.4463 27.8203C16.6075 27.9462 16.973 27.6336 17.7031 27.0078L24.999 20.7539C25.4292 20.3852 25.6444 20.2004 25.584 20.0371C25.5235 19.8739 25.2403 19.874 24.6738 19.874H22.8604C22.3467 19.874 22.0894 19.874 22.0254 19.7197C21.9615 19.5654 22.1436 19.3838 22.5068 19.0205L25.1719 16.3545C25.5351 15.9913 25.7172 15.8096 25.6533 15.6553C25.5892 15.5012 25.3318 15.501 24.8184 15.501H22.5869C22.176 15.501 21.9701 15.5011 21.8994 15.3691C21.8291 15.2371 21.9429 15.0656 22.1709 14.7236L26.1895 8.69531C29.4745 10.7577 31.6602 14.4102 31.6602 18.5752C31.6602 25.0148 26.4396 30.2353 20 30.2354C13.5604 30.2354 8.33985 25.0148 8.33984 18.5752C8.33984 12.6035 12.8295 7.68401 18.6172 7C18.6119 7.01055 18.6054 7.02169 18.5996 7.0332Z"
        fill="${LIGHTNING_FILL}"/>
</svg>`;

/**
 * lightning_alt_fill_light (variant 1) — 14×28 (Figma 40000922-4822). Outlined
 * energy bolt with a #7E72E3 → #4234B8 linear gradient. Rendered in a 40px
 * padded cell (p-[7px]).
 */
export const lightningAltFillLight1Svg: TemplateResult = html`<svg width="14" height="28" viewBox="0 0 14 28" aria-hidden="true">
  <g id="Frame_886948">
    <path d="M5 6.77778V19.2222C5 20.3268 5.89543 21.2222 7 21.2222C8.10457 21.2222 9 20.3268 9 19.2222V5C9 2.79086 7.20914 1 5 1C2.79086 1 1 2.79086 1 5V21C1 24.3137 3.68629 27 7 27C10.3137 27 13 24.3137 13 21V11.1111"
          stroke="url(#lightning-grad)" stroke-width="2" stroke-linecap="round" fill="none"/>
  </g>
  <defs>
    <linearGradient id="lightning-grad" x1="7" y1="1" x2="7" y2="27" gradientUnits="userSpaceOnUse">
      <stop stop-color="#7E72E3"/>
      <stop offset="1" stop-color="#4234B8"/>
    </linearGradient>
  </defs>
</svg>`;

/**
 * The field flag's own red (--blocked in prompt-input-section). Kept as one
 * constant so the rail glyph and the red flag cannot end up two different reds.
 */
export const DANGER_FILL = '#c50000';

/**
 * An exclamation in a circle — the rail's NOTIFICATION glyph.
 *
 * This is the one icon in this file that is NOT Figma geometry, and the only one
 * without a node id behind it. The owner's rule for the rail is that it is the
 * notification column (not just an activity counter), so a prompt that is
 * waiting on a person marks itself there: `! ` in a circle, in the same red the
 * field flag and the field's ring use. Drawn at 26×26 inside the rail's 40px
 * cell, stroke weight 2, matching the other glyphs' weight.
 */
export const alertCircleSvg: TemplateResult = html`<svg width="32" height="32" viewBox="0 0 26 26" aria-hidden="true">
  <circle cx="13" cy="13" r="11.5" fill="none" stroke="${DANGER_FILL}" stroke-width="2"/>
  <path d="M13 6.5V14" stroke="${DANGER_FILL}" stroke-width="2.2" stroke-linecap="round"/>
  <circle cx="13" cy="18.8" r="1.4" fill="${DANGER_FILL}"/>
</svg>`;

export const MEATBALLS_DOT_STROKE = '#767676';

/**
 * One Meatballs_menu instance — 24×24 with 6 dots (2 cols × 3 rows).
 * Dots r=1, stroke #767676, weight 2; columns 7px apart, rows 6px apart.
 */
export const meatballsInstanceSvg: TemplateResult = html`<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
  <circle cx="11" cy="5" r="1" stroke="${MEATBALLS_DOT_STROKE}" stroke-width="2" fill="none"/>
  <circle cx="11" cy="11" r="1" stroke="${MEATBALLS_DOT_STROKE}" stroke-width="2" fill="none"/>
  <circle cx="11" cy="17" r="1" stroke="${MEATBALLS_DOT_STROKE}" stroke-width="2" fill="none"/>
  <circle cx="18" cy="5" r="1" stroke="${MEATBALLS_DOT_STROKE}" stroke-width="2" fill="none"/>
  <circle cx="18" cy="11" r="1" stroke="${MEATBALLS_DOT_STROKE}" stroke-width="2" fill="none"/>
  <circle cx="18" cy="17" r="1" stroke="${MEATBALLS_DOT_STROKE}" stroke-width="2" fill="none"/>
</svg>`;

/**
 * Gripper meatballs — 37×39 (Figma 40000941-23074). 3 cols × 2 rows, r=1,
 * stroke #767676, weight 2. Rotated -90° inside the 39×37 gripper shell.
 */
export const gripperMeatballsSvg: TemplateResult = html`<svg width="37" height="39" viewBox="0 0 37 39" aria-hidden="true">
  <circle cx="18" cy="22" r="1" stroke="${MEATBALLS_DOT_STROKE}" stroke-width="2" stroke-linecap="round" fill="none"/>
  <circle cx="12" cy="22" r="1" stroke="${MEATBALLS_DOT_STROKE}" stroke-width="2" stroke-linecap="round" fill="none"/>
  <circle cx="24" cy="22" r="1" stroke="${MEATBALLS_DOT_STROKE}" stroke-width="2" stroke-linecap="round" fill="none"/>
  <circle cx="18" cy="14" r="1" stroke="${MEATBALLS_DOT_STROKE}" stroke-width="2" stroke-linecap="round" fill="none"/>
  <circle cx="12" cy="14" r="1" stroke="${MEATBALLS_DOT_STROKE}" stroke-width="2" stroke-linecap="round" fill="none"/>
  <circle cx="24" cy="14" r="1" stroke="${MEATBALLS_DOT_STROKE}" stroke-width="2" stroke-linecap="round" fill="none"/>
</svg>`;
