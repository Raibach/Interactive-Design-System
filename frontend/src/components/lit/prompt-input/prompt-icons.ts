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
export const DATABASE_BAND = '#33363f';

/**
 * Database_fill icon — 22×27.5. Union cylinder path filled #222222 with the
 * file's subtract geometry applied as an SVG mask, reproducing the band cuts
 * exactly (no traced approximation).
 */
export const databaseFillSvg: TemplateResult = html`<svg width="22" height="27.5" viewBox="0 0 22 27.5" aria-hidden="true">
  <defs>
    <mask id="db-band-cut">
      <rect x="-2" y="-2" width="26" height="31.5" fill="white"/>
      <path transform="translate(-1.375,0)" d="M3.98191 13.3689L3.53469 14.2634L3.53469 14.2634L3.98191 13.3689ZM3.98191 5.11893L4.42912 4.2245L4.42912 4.2245L3.98191 5.11893ZM20.7681 5.11892L21.2153 6.01335L21.2153 6.01335L20.7681 5.11892ZM0 8.25L-1 8.25C-1 11.0672 1.18227 13.0871 3.53469 14.2634L3.98191 13.3689L4.42912 12.4745C2.31497 11.4174 1 9.9193 1 8.25L0 8.25ZM3.98191 13.3689L3.53469 14.2634C6.00303 15.4975 9.18401 16.125 12.375 16.125L12.375 15.125L12.375 14.125C9.41437 14.125 6.556 13.5379 4.42912 12.4745L3.98191 13.3689ZM12.375 15.125L12.375 16.125C15.566 16.125 18.747 15.4975 21.2153 14.2634L20.7681 13.3689L20.3209 12.4745C18.194 13.5379 15.3356 14.125 12.375 14.125L12.375 15.125ZM20.7681 13.3689L21.2153 14.2634C23.5677 13.0871 25.75 11.0672 25.75 8.25L24.75 8.25L23.75 8.25C23.75 9.9193 22.435 11.4174 20.3209 12.4745L20.7681 13.3689ZM0 0L-1 0C-1 2.81722 1.18227 4.83714 3.53469 6.01335L3.98191 5.11893L4.42912 4.2245C2.31497 3.16742 1 1.6693 1 0L0 0ZM3.98191 5.11893L3.53469 6.01335C6.00303 7.24752 9.18401 7.875 12.375 7.875L12.375 6.875L12.375 5.875C9.41437 5.875 6.556 5.28794 4.42912 4.2245L3.98191 5.11893ZM12.375 6.875L12.375 7.875C15.566 7.875 18.747 7.24752 21.2153 6.01335L20.7681 5.11892L20.3209 4.2245C18.194 5.28794 15.3356 5.875 12.375 5.875L12.375 6.875ZM20.7681 5.11892L21.2153 6.01335C23.5677 4.83714 25.75 2.81722 25.75 0L24.75 0L23.75 0C23.75 1.6693 22.435 3.16742 20.3209 4.2245L20.7681 5.11892Z"
            stroke="${DATABASE_BAND}" stroke-width="2" fill="none"/>
    </mask>
  </defs>
  <path d="M11 0C17.0751 0 22 2.46243 22 5.5L22 22C22 25.0376 17.0751 27.5 11 27.5C4.92487 27.5 0 25.0376 0 22L0 5.5C0 2.46243 4.92487 0 11 0Z"
        fill="${DATABASE_FILL}" mask="url(#db-band-cut)"/>
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
