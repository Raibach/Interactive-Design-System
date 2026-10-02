/**
 * GATE SPLASH — the React half of the static twin in index.html.
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
 * with "Preparing…" where the fields would be. The same picture the HTML twin draws
 * before any JavaScript exists, so the whole boot reads as one slow gate that
 * becomes typeable, instead of a white page or a bare spinner. It enforces nothing
 * and fetches nothing; it is a card.
 */
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

export default function GateSplash() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#1a1625',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
      aria-busy="true"
    >
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
        <div style={{ marginTop: '6px', fontSize: '12px', color: 'rgba(245,240,232,0.35)' }}>
          Preparing…
        </div>
      </div>
    </div>
  );
}
