/**
 * THE SESSION'S OWN STORAGE — THE GATE MUST BE HONEST ON EVERY LANDING (owner, 2026-10-04).
 *
 * The owner, testing the site: *"I'm just trying to see an honest version of the local site …
 * I'm just seeing shortcuts … You've removed the dev@local login, the registration links …
 * It's like it's cached."* It WAS cached: the sign-in flags lived in localStorage, so a
 * returning browser skipped the gate on every load — and a development bypass
 * (authService's initializeDevAuth, now removed) rewrote the flag on load, so nothing could
 * ever stay cleared. The door appeared to remove itself.
 *
 * So the sign-in belongs to the BROWSING SESSION, not the machine: sessionStorage keeps the
 * gate's own reload (and every reload of the tab) working, and dies with the tab — a new
 * visit, a new tab, a new window all land on the gate, as if for the first time. Every read
 * and write of these keys uses sessionStorage (index.html's gate script, at parse, does the
 * same for its own two reads and its submit's writes).
 *
 * THE LEGACY KEYS ARE RETIRED, not ignored: retireLegacyAuthFlags() deletes the old
 * localStorage copies at boot — index.html runs the same deletion at parse, before any bundle
 * exists — so a browser that has been skipping the gate since before this change meets the
 * gate on the very next load.
 */
export const AUTH_KEYS = {
  authenticated: "grace_is_authenticated",
  userId: "grace_user_id",
  userRole: "grace_user_role",
  door: "grace_door",
  isAdmin: "grace_is_admin",
} as const;

/** Delete the pre-2026-10-04 localStorage copies so no browser keeps skipping the gate. */
export const retireLegacyAuthFlags = (): void => {
  try {
    for (const key of Object.values(AUTH_KEYS)) localStorage.removeItem(key);
  } catch {
    /* no storage — nothing was cached to retire */
  }
};
