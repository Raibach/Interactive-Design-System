/*
 * GovernanceNavFrame — the Governance room's own left navigation, framed.
 *
 * WHAT IT IS: an <iframe> over the transferred navigation page
 * (frontend/public/govnav -> governance/nav-copy/gov-nav.html — the nav's one source
 * of truth; the link keeps them from ever drifting). The page renders the rail's two
 * states itself (300px expanded / 60px collapsed, its own chevron toggle, its own
 * localStorage persistence).
 *
 * THE CONTRACT (postMessage, same origin):
 *   nav -> shell   { type: 'gov-nav-go', href: '/explore' }   a row was clicked
 *   nav -> shell   { type: 'gov-nav-width', collapsed: bool } the rail toggled (and once on load)
 * The shell answers 'gov-nav-go' by writing the embed's path with the room's existing
 * navigateGovernanceTool — the same one-attribute write the retired rail used. This
 * component never navigates itself; it is a view of the nav plus the two handshakes.
 *
 * The column width follows the rail's own state so the embed fills the rest of the
 * room; background matches the rail's tone so no white ever flashes under the frame.
 * NOTHING HERE IS A FALLBACK: if the frame fails to load, the column stands in the
 * rail's own colour with no nav — the failure is visible, not disguised.
 */
import { useEffect, useState } from 'react';

interface GovernanceNavFrameProps {
  /** Writes a path onto the room's embedded tool (navigateGovernanceTool). */
  onNavigate: (path: string) => void;
}

export default function GovernanceNavFrame({ onNavigate }: GovernanceNavFrameProps) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const d = e.data as { type?: string; href?: string; collapsed?: boolean } | null;
      if (!d || typeof d !== 'object') return;
      if (d.type === 'gov-nav-go' && typeof d.href === 'string') {
        onNavigate(d.href);
      } else if (d.type === 'gov-nav-width') {
        setCollapsed(!!d.collapsed);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onNavigate]);

  const width = collapsed ? 60 : 300;

  return (
    <div
      style={{
        flex: '0 0 auto',
        width,
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
        background: '#110E1F',
        transition: 'width 200ms ease',
      }}
    >
      <iframe
        src="/govnav/gov-nav.html"
        title="Governance navigation"
        style={{ display: 'block', width: '100%', height: '100%', border: 'none', background: 'transparent' }}
      />
    </div>
  );
}
