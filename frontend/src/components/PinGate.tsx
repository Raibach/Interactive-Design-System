import { useState } from 'react';
import raibachLogo from '@/assets/raibach-logo.jpg';
import { storeUserId } from '@/services/authService';

/**
 * THE DEMO GATE — AN ILLUSION OF A LOGIN, ON PURPOSE.
 *
 * The owner, 2026-09-19: "would you just make a simple gate? I'm just trying to give the
 * impression of a login. It's not a real login. It's just an illusion."
 *
 * So the pair below is accepted HERE, in the browser. Nothing is sent anywhere, and that is
 * the point: the real endpoint is a credential check the app's own code performs — bcrypt
 * against `users.password_hash`, a lockout after five misses, a network and a database that
 * must all be in order — and an illusion that depends on all of that is an illusion that
 * breaks. This one cannot: it needs no server, no row, and no password that has survived.
 *
 * WHAT IT WRITES IS THE SAME THREE KEYS the real sign-in wrote, so the rest of the app is
 * untouched by the swap: the signed-in flag, the user id, and the role. The pair is the DEMO
 * ACCOUNT ITSELF — `dev@local`, the email that `users` row carries, with the password set on
 * it 2026-09-19 — and the id stored is that same account's (00000000-…-0001), the one
 * tonight's conversations belong to, so the demo opens onto the data that exists instead of
 * an empty seat. The role is that account's own.
 *
 * THE USER IS FIXED AND SHOWN, on the owner's instruction: "give them a break. dev@local."
 * It is prefilled and read-only — one thing to type, the pin — and the field is a TEXT input,
 * not `type="email"`: the demo account's email carries no domain, and an email input silently
 * refuses to submit a value its own pattern rejects, so the button would do nothing and
 * nothing would say why.
 *
 * THE REAL PATH IS NOT DELETED, ONLY UNUSED: `services/authService.ts::login()` still posts
 * to `POST /api/auth/login` and still works; this form simply does not call it while the
 * demo wants an illusion.
 */
const DEMO_EMAIL = 'dev@local';
const DEMO_PASSWORD = '7377';
const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_ROLE = 'student';

/** Sign in — against the pair above, in this browser, with no request. */
export default function PinGate({ onLoginSuccess }: { onLoginSuccess: () => void }) {
  const [email, setEmail] = useState(DEMO_EMAIL);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    // THE PIN IS THE CREDENTIAL. The user above it is fixed and shown, not asked for and not
    // checked — the owner, 2026-09-19: "then it is a real pin gate with 7377." A wrong pin is
    // refused with the words the endpoint used, so the illusion reads the same from outside.
    if (password !== DEMO_PASSWORD) {
      setError('Invalid email or password');
      return;
    }
    storeUserId(DEMO_USER_ID);
    localStorage.setItem('grace_user_role', DEMO_ROLE);
    localStorage.setItem('grace_is_authenticated', 'true');
    onLoginSuccess();
  };

  const field: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    height: '48px',
    padding: '0 14px',
    fontFamily: "'Inter', system-ui, sans-serif",
    fontSize: '14px',
    color: '#f5f0e8',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px',
    outline: 'none',
    marginBottom: '12px',
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#1a1625',
        margin: 0,
      }}
    >
      <form
        onSubmit={submit}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '380px',
          background: '#231f2e',
          borderRadius: '16px',
          padding: '48px 40px 44px',
          boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
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
          <img src={raibachLogo} alt="Raibach" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>

        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <div
            style={{
              fontFamily: "'Inter', system-ui, sans-serif",
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
              fontFamily: "'Inter', system-ui, sans-serif",
              fontWeight: 500,
              fontSize: '14px',
              color: 'rgba(245,240,232,0.35)',
              marginTop: '4px',
            }}
          >
            Interactive Design
          </div>
          <div
            style={{
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: '13px',
              color: 'rgba(245,240,232,0.55)',
              marginTop: '6px',
            }}
          >
            AI-Driven Design System Management
          </div>
        </div>

        <div
          style={{
            width: '40px',
            height: '2px',
            background: 'linear-gradient(-90deg, rgb(240,179,35), rgb(254,209,65))',
            borderRadius: '2px',
            margin: '20px 0',
          }}
        />

        <input
          type="text"
          autoComplete="username"
          placeholder="Email"
          value={email}
          readOnly
          style={field}
        />
        <input
          type="password"
          autoFocus
          placeholder="Password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(''); }}
          style={field}
        />

        {error && (
          <p
            style={{
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: '12px',
              color: '#ff6b6b',
              margin: '4px 0 12px',
              textAlign: 'center',
            }}
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          style={{
            width: '100%',
            height: '46px',
            marginTop: '8px',
            fontFamily: "'Inter', system-ui, sans-serif",
            fontWeight: 700,
            fontSize: '14px',
            color: '#1a1625',
            background: 'linear-gradient(-90deg, rgb(240,179,35), rgb(254,209,65))',
            border: 'none',
            borderRadius: '10px',
            cursor: 'pointer',
          }}
        >
          Sign in
        </button>
      </form>
    </div>
  );
}
