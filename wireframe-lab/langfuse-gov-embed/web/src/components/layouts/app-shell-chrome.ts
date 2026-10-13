/**
 * Top chrome row of the page header. RAIBACH IDS (2026-10-12, owner: "close up
 * that space above"): the sidebar is deleted, so this row no longer aligns to
 * anything — the dead min-height and its junction border are deleted with it.
 * The row now takes its natural height: zero when it carries nothing (an
 * empty band must not stand over the page) and the controls' own height when
 * a page hoists them in. Padding stays call-site specific (full-width row,
 * optional container on the content).
 */
export const APP_SHELL_CHROME_ROW_CLASS = "flex items-center";

export const APP_SHELL_CHROME_ROW_TEST_ID = "app-shell-chrome-row";
