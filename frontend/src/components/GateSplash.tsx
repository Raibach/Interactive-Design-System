/**
 * GATE SPLASH — the React half of the static twin in index.html, and THE HOLD.
 *
 * WHY IT EXISTS. The sign-in gate is interactive as soon as its own JavaScript has
 * arrived; the application is not, and the two waits are different waits:
 *
 *   · a session already signed in skips the gate — App draws the console, and the
 *     console's chunk is the app (registrations, the surface, the pages).
 *   · the demo flag (`/api/config`) settles in under a round-trip, but the tree must
 *     not draw before it knows which build it is.
 *
 * AND ONE OF THEM IS NOT A WAIT ANY MORE — IT IS A HOLD (owner, 2026-10-02): "when I
 * type in the password and hit enter, no one expects it to go directly to the page and
 * land … hold it at the login page, just indicate something is working, and take that
 * time to set up everything on the console … it should all ease in, it shouldn't jar
 * the user." So with `holdUntilDrawn`, this card STAYS on screen until the console has
 * actually drawn its first surface — a card, a section editor, a compiled output — and
 * only then cross-fades away (700 ms ease). What is under it when it leaves is
 * finished: the ground is already playing and the cards are already there. The cap
 * (20 s, the owner's own number — "you can have a spinner there for 20 seconds or
 * more") is a floor, not a deadline: preparation that never finishes must never trap
 * the person, so at the cap the card leaves and shows whatever is there.
 *
 * THE GROUND is the console's own waves — one file, one stable URL, shared with
 * index.html's static twin and the console's ground layer, so the browser fetches it
 * once and the room never changes under the person's feet: gate, hold, and console all
 * stand on the same moving water.
 */
import { useEffect, useState } from 'react';
import raibachLogo from '@/assets/raibach-logo.jpg';

const card: React.CSSProperties = {
  position: 'relative',
  zIndex: 1,
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

const HOLD_CAP_MS = 20000;
const FADE_MS = 700;

/**
 * Has the console drawn a surface yet? Shadow-DOM aware, because the renderer draws
 * its tree inside its own shadow root — a document-level query would never see it.
 * A drawn console has at least one of these: a package card, a prompt section editor,
 * or the compiled-output column of an opened package.
 */
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

export default function GateSplash({ holdUntilDrawn = false }: { holdUntilDrawn?: boolean }) {
  const [fading, setFading] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (!holdUntilDrawn) return;
    let finished = false;
    let fadeTimer: ReturnType<typeof setTimeout> | null = null;
    const reveal = () => {
      if (finished) return;
      finished = true;
      if (interval) clearInterval(interval);
      setFading(true);
      fadeTimer = setTimeout(() => setGone(true), FADE_MS + 50);
    };
    // The poll is the readiness signal: "ready" is not an event anybody emits, it is
    // the cards existing. 150 ms is cheap and lands within a frame of the draw.
    const interval: ReturnType<typeof setInterval> | null = setInterval(() => {
      if (surfaceHasDrawn()) reveal();
    }, 150);
    const cap = setTimeout(reveal, HOLD_CAP_MS);
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
        position: 'fixed',
        inset: 0,
        zIndex: 2147483646,
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
      <video
        src="/console-waves.mp4"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden="true"
        style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
      />
      <div aria-hidden="true" style={{ position: 'fixed', inset: 0, background: 'rgba(26, 22, 37, 0.55)' }} />
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
