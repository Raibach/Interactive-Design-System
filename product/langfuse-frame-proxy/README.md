# langfuse-frame-proxy

The hosted twin of the local frame proxy (`governance/langfuse-main/nginx-frame-proxy.conf`, gitignored).
It fronts the hosted Langfuse (`langfuse-web` on Northflank) so the studio's **Governance room**
can embed it.

## Why it exists

The stock Langfuse image refuses to be framed — it sends `frame-ancestors 'none'` and
`X-Frame-Options: SAMEORIGIN`. Browsers enforce that, so the room would show nothing.
This proxy:

1. drops both headers and re-issues `frame-ancestors 'self' <STUDIO_ORIGIN>` — framing allowed
   **only** from the studio origin;
2. injects the pre-minted admin session cookie — the room never shows a login
   (cookie minted once via the stock NextAuth sign-in; 10-year expiry because
   `AUTH_SESSION_MAX_AGE=5256000` is set on `langfuse-web`);
3. injects the house-ground styling and the location reporter the shell nav listens for
   (identical block to the local proxy);
4. forwards everything else to `http://langfuse-web:3000` over Northflank's internal network.

## Values — the config rule

Values stay on the service; this folder is value-free. The Northflank service
(`langfuse-frame-proxy`, combined type) carries:

| Env var | Meaning |
| --- | --- |
| `RAIBACH_SESSION_COOKIE` | the `__Secure-next-auth.session-token` value, minted via `POST /api/auth/callback/credentials` on the hosted web |
| `STUDIO_ORIGIN` | the framing allow-list origin, e.g. `https://site--semantic-design-systems--mgtvxtd7xr2v.code.run` |

The official nginx image substitutes both into `nginx.conf.template` at boot.
A missing value fails the config loudly at startup — never silently.

## Deploy shape (Northflank)

- combined service, build from `Raibach/Interactive-Design-System` (`frame-proxy-2026-10-09` branch),
  dockerfile `/wireframe-lab/langfuse-frame-proxy/Dockerfile`, workdir `/wireframe-lab/langfuse-frame-proxy`
- plan `nf-compute-10`; build plan `nf-compute-400-16` (only this class may build)
- port `ui`: internal `8080`, public, HTTP → `https://ui--langfuse-frame-proxy--mgtvxtd7xr2v.code.run`

## Revert

Delete the Northflank service. This folder remains as the record; the local proxy is unaffected.
