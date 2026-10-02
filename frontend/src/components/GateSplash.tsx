/**
 * GATE SPLASH — the React half of the static twin in index.html, and THE HOLD.
 *
 * WHY IT EXISTS. The sign-in gate is interactive as soon as its OWN JavaScript has
 * arrived; the application is not, and the two waits are different waits:
 *
 *   · a session already signed in (the flag is in localStorage) skips the gate — App
 *     draws the console, and the console's chunk is the app (registrations, the
 *     surface, the pages). That is a real wait on a first load.
 *   · the demo flag (`/api/config`) settles in under a round-trip, but the tree must
 *     not draw before it knows which build it is.
 *
 * Both waits show THIS: the gate's own card — same colours, same logo, same type —
 * with a spinner and "Preparing…" where the fields would be.
 *
 * AND ONE OF THEM IS NOT A WAIT ANY MORE — IT IS A HOLD (owner, 2026-10-02): "when I
 * type in the password and hit enter, no one expects it to go directly to the page and
 * land … hold it at the login page, just indicate something is working, and take that
 * time to set up everything on the console … it should all ease in, it shouldn't jar
 * the user." So with `holdUntilDrawn`, this card STAYS on screen until the console has
 * FINISHED its first attempt, and only then cross-fades away (700 ms ease).
 *
 * FINISHED IS READ FROM THE CONSOLE ITSELF — NO TIMER DECIDES. The check is
 * shadow-DOM aware because the renderer draws its tree inside its own shadow root:
 *
 *   · DRAWN — a package card, a prompt section editor, or the output viewer exists.
 *   · FAILED — the console's own standby message ("…building this interface…") was
 *     seen and is gone without a surface: the attempt ended in its error state, and
 *     the reveal shows that error instead of waiting out a clock.
 *
 * The 2-minute cap is a last-resort abort so a dead server cannot freeze the tab. It
 * is not the deciding clock — the console's real state is.
 */
import { useEffect, useState } from 'react';
import raibachLogo from '@/assets/raibach-logo.jpg';

const card: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  width: '380px',
  boxSizing: 'border-box',
  background: '#231f2e',
  borderRadius: '16px',
  padding: '48px 40px 44px',
  boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
  border: '1px solid rgba(255,255,255,0.06)',
};

const SAFETY_CAP_MS = 120000;
const FADE_MS = 700;
const STAND_BY_MARKER = 'building this interface';

/** A drawn surface — shadow-DOM aware; the renderer paints inside its own shadow root. */
function surfaceHasDrawn(): boolean {
  let found = false;
  const walk = (root: Document | ShadowRoot) => {
    if (found) return;
    const all = root.querySelectorAll('*');
    for (let i = 0; i < all.length; i += 1) {
      if (found) return;
      const el = all[i];
      if (el.shadowRoot) walk(el.shadowRoot);
      const tag = el.tagName ? el.tagName.toLowerCase() : '';
      if (tag === 'agent-card-element' || tag === 'prompt-section-editor' || tag === 'compiled-output-viewer') {
        found = true;
        return;
      }
      if (el.getAttribute && el.getAttribute('data-tag') === 'agent-card') {
        found = true;
        return;
      }
    }
  };
  walk(document);
  return found;
}

/** The console's own standby line, while its first assembly is in flight. */
function standByShowing(): boolean {
  return (document.body.innerText || '').indexOf(STAND_BY_MARKER) !== -1;
}

export default function GateSplash({ holdUntilDrawn = false }: { holdUntilDrawn?: boolean }) {
  const [fading, setFading] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (!holdUntilDrawn) return;
    let finished = false;
    let sawStandBy = false;
    let fadeTimer: ReturnType<typeof setTimeout> | null = null;
    const reveal = () => {
      if (finished) return;
      finished = true;
      if (interval) clearInterval(interval);
      setFading(true);
      fadeTimer = setTimeout(() => setGone(true), FADE_MS + 50);
    };
    const interval: ReturnType<typeof setInterval> | null = setInterval(() => {
      if (surfaceHasDrawn()) {
        reveal();
        return;
      }
      if (standByShowing()) {
        sawStandBy = true;
      } else if (sawStandBy) {
        // The attempt ENDED without a surface — the console is showing its own
        // failure. Reveal: the error is the honest thing to show, and no clock
        // should keep a spinner over it.
        reveal();
      }
    }, 150);
    const cap = setTimeout(() => {
      console.warn('[gate] hold safety cap reached — revealing whatever is there');
      reveal();
    }, SAFETY_CAP_MS);
    return () => {
      if (interval) clearInterval(interval);
      clearTimeout(cap);
      if (fadeTimer) clearTimeout(fadeTimer);
    };
  }, [holdUntilDrawn]);

  if (holdUntilDrawn && gone) return null;

  return (
    <div
      style={{
        position: holdUntilDrawn ? 'fixed' : undefined,
        inset: holdUntilDrawn ? 0 : undefined,
        zIndex: holdUntilDrawn ? 2147483646 : undefined,
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#1a1625',
        fontFamily: "'Inter', system-ui, sans-serif",
        opacity: fading ? 0 : 1,
        transition: `opacity ${FADE_MS}ms ease`,
      }}
      aria-busy="true"
    >
      <style>{'@keyframes gate-splash-spin { to { transform: rotate(360deg); } }'}</style>
      <div style={card}>
        <div
          style={{
            width: '72px',
            height: '72px',
            borderRadius: '14px',
            overflow: 'hidden',
            marginBottom: '28px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          }}
        >
          <img
            src={raibachLogo}
            alt=""
            style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
        <div
          style={{
            fontWeight: 900,
            fontSize: '32px',
            letterSpacing: '-0.02em',
            color: '#f5f0e8',
            lineHeight: 1,
          }}
        >
          Raibach
        </div>
        <div
          style={{
            fontWeight: 500,
            fontSize: '14px',
            color: 'rgba(245,240,232,0.35)',
            marginTop: '4px',
          }}
        >
          Interactive Design
        </div>
        <div style={{ fontSize: '13px', color: 'rgba(245,240,232,0.55)', marginTop: '6px' }}>
          AI-Driven Design System Management
        </div>
        <div
          style={{
            width: '40px',
            height: '2px',
            borderRadius: '2px',
            margin: '20px 0',
            background: 'linear-gradient(-90deg, rgb(240,179,35), rgb(254,209,65))',
          }}
        />
        <div
          aria-hidden="true"
          style={{
            width: '22px',
            height: '22px',
            borderRadius: '50%',
            border: '2px solid rgba(240,179,35,0.25)',
            borderTopColor: 'rgb(240,179,35)',
            animation: 'gate-splash-spin 0.9s linear infinite',
            marginTop: '6px',
          }}
        />
        <div style={{ marginTop: '10px', fontSize: '12px', color: 'rgba(245,240,232,0.5)' }}>Preparing…</div>
      </div>
    </div>
  );
}
