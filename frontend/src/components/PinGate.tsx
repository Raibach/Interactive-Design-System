import { useState } from 'react';
import raibachLogo from '@/assets/raibach-logo.jpg';
import { login, storeUserId } from '@/services/authService';

/**
 * Sign in. Was a hardcoded 4-digit PIN held in this file pointing at one user —
 * which is why the system only ever had one. It now asks the database.
 */
export default function PinGate({ onLoginSuccess }: { onLoginSuccess: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    const res = await login(email.trim(), password);
    setBusy(false);
    if (!res.success) {
      setError(res.error || 'Invalid email or password');
      return;
    }
    if (res.userId) storeUserId(res.userId);
    if (res.role) localStorage.setItem('grace_user_role', res.role);
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
          type="email"
          autoFocus
          placeholder="Email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError(''); }}
          style={field}
        />
        <input
          type="password"
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
          disabled={busy}
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
            cursor: busy ? 'default' : 'pointer',
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
