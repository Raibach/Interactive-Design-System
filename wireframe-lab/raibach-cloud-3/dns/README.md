# DNS — the zones for the raibach-cloud-3 sites

The repo's copy of the DNS records that live at the domain provider. The live
copy is at the provider; this folder is the **record of record** for what should
be there, verified against the wire before every change.

## State (2026-10-11)

- `raibach.net` — zone being moved from SiteGround DNS to **Hetzner DNS**.
  - Full copy **verified record-by-record** against SiteGround's authoritative
    name servers (`ns1/ns2.siteground.net`): every A, MX, TXT and DKIM row
    matches. Import file: `raibach.net.zone`.
  - Delegation (the domain's NS setting) is **still SiteGround** — switch only
    after Hetzner's name servers answer the whole zone correctly.
- `holtportfolio.com` — full record set captured and **verified record-by-record**
  against the live zone (2026-10-11), including the wildcard row. Import file:
  `holtportfolio.com.zone`. Same switch recipe; one domain at a time — raibach
  goes first.
- Mail for both domains is at **Proton (Switzerland)** and rides on these rows:
  MX ×2, SPF, 3× DKIM CNAME, DMARC. Never remove them as "cleanup."

## Hetzner side — rules learned from their docs (2026-10-11)

- Hetzner creates the SOA record and its **three name servers automatically**
  (`hydrogen.ns.hetzner.com`, `oxygen.ns.hetzner.com`, `helium.ns.hetzner.de`).
  Nothing to create by hand; they cannot be deleted from a primary zone.
- The **old `ns1/ns2.siteground.net` NS rows must NOT be carried over** into the
  Hetzner zone — if they exist there, delete them. They are the old delegation,
  not part of the record set.
- BIND format: a name **without** trailing dot gets the zone appended
  (`www` → `www.raibach.net`); a name **with** trailing dot is taken literally
  (needed in MX/CNAME targets, e.g. `mail.protonmail.ch.`).
- DNS zones at Hetzner are free; limits: 500 records/zone, TTL ≥ 60s.

## Who does what

- **Option A (hands-off):** owner creates a Hetzner API token (Console →
  API tokens, Read/Write) and saves it as `Keys/hetzner-dns-token`
  (workspace, gitignored — same pattern as the SSH key; never in chat).
  The assistant then creates/verifies/deletes every record via the API.
- **Option B (one paste):** owner imports `raibach.net.zone` in the Hetzner
  console (DNS → zone → import), or adds rows by hand from the table below.
  The assistant verifies the result from outside either way.

## Switch-day checklist (the delegation flip — do not skip steps)

1. Hetzner zone exists and answers completely — assistant verifies *every*
   record by asking Hetzner's name servers directly (while the world still
   uses SiteGround, so nothing can break).
2. Old NS rows (`ns1/ns2.siteground.net`) deleted from the Hetzner zone.
3. Assistant shortens TTLs on the live zone at SiteGround (one pass) so caches
   drain fast after the switch.
4. Owner switches the domain's name servers to Hetzner's (one domain at a
   time; `raibach.net` first, `holtportfolio.com` after it proves clean for a
   day). This is the only click that is the owner's by rule — everything
   around it is prepared and verified.
5. Assistant verifies from outside: sites 200, mail rows intact on the new
   delegation. Cache re-learning: hours, worst case a day; no record values
   change, so nothing visibly changes for visitors or mail.

## raibach.net records (verified 2026-10-11)

| Type | Name | Value |
|---|---|---|
| A | raibach.net | 188.245.25.26 |
| A | www | 188.245.25.26 |
| A | studio | 188.245.25.26 |
| A | staging2 | 188.245.25.26 |
| A | design.system | 188.245.25.26 |
| A | portfolio | 35.212.127.26 (legacy, SiteGround host) |
| A | mail | 35.212.127.26 (legacy) |
| A | autodiscover | 35.212.127.26 (legacy) |
| A | autoconfig | 35.212.127.26 (legacy) |
| A | ftp | 35.212.127.26 (legacy) |
| MX | raibach.net | 10 mail.protonmail.ch. |
| MX | raibach.net | 20 mailsec.protonmail.ch. |
| TXT | raibach.net | v=spf1 include:_spf.protonmail.ch ~all |
| TXT | raibach.net | protonmail-verification=f22a07da22d5d53905f3f593f06f6f36ca73905d |
| TXT | raibach.net | google-site-verification=Dvo39gwO0nAI7zyoPxEccKbPk7vOM0yh7CjULwhFp8A |
| TXT | raibach.net | zone-ownership-verification-408880232baa40294e126f2f7249f0b21011d6c0ae509158d6275cb8e0f278fe |
| TXT | verify-2p5wb10thxqci2frwb0s28pj | 92aa4a75882bf1094ef5cca8c201ce0956382db5ff75b8d68052b052615d8c3c |
| TXT | _dmarc | v=DMARC1; p=quarantine |
| CNAME | protonmail._domainkey | protonmail.domainkey.dzrebbfryivxadwbpe4b3jnpydyszhw72vzpb2bohhrn4s6agpkra.domains.proton.ch. |
| CNAME | protonmail2._domainkey | protonmail2.domainkey.dzrebbfryivxadwbpe4b3jnpydyszhw72vzpb2bohhrn4s6agpkra.domains.proton.ch. |
| CNAME | protonmail3._domainkey | protonmail3.domainkey.dzrebbfryivxadwbpe4b3jnpydyszhw72vzpb2bohhrn4s6agpkra.domains.proton.ch. |

Notes:
- `studio` and `staging2` point at the box but nothing serves those names yet
  (dormant, no Caddy block). No harm; wire them when there is content.
- `portfolio`, `mail`, `autodiscover`, `autoconfig`, `ftp` still point at the
  old host and will keep working exactly as long as that hosting exists.
  Retire or repoint each one deliberately, never as a side effect.

## holtportfolio.com records (verified 2026-10-11)

| Type | Name | Value |
|---|---|---|
| A | holtportfolio.com | 188.245.25.26 |
| A | www | 188.245.25.26 |
| A | john | 188.245.25.26 (the site) |
| A | www.john | 188.245.25.26 |
| A | * (wildcard) | 188.245.25.26 |
| A | autodiscover | 35.212.127.26 (legacy) |
| A | autoconfig | 35.212.127.26 (legacy) |
| A | ssh | 35.212.127.26 (legacy) |
| A | mail | 35.212.127.26 (legacy) |
| A | ftp | 35.212.127.26 (legacy) |
| MX | holtportfolio.com | 10 mail.protonmail.ch. |
| MX | holtportfolio.com | 20 mailsec.protonmail.ch. |
| TXT | holtportfolio.com | v=spf1 include:_spf.protonmail.ch ~all |
| TXT | holtportfolio.com | protonmail-verification=85a4bc4cfd48f51a1fd84d6348f50d4dce361cdc |
| TXT | verify-grah5m087yfpuouh3ov7wgnx.john | 5dd4878fb7da93428b7eefcbe4dbb3bdcea8a945249da61b9894e6e64e2fb1e |
| TXT | _dmarc | v=DMARC1; p=quarantine |
| CNAME | protonmail._domainkey | protonmail.domainkey.dauvbe7zslpx3ezj5w6ua4tyrnsohfb5wismii4jinod4pmg2qydq.domains.proton.ch. |
| CNAME | protonmail2._domainkey | protonmail2.domainkey.dauvbe7zslpx3ezj5w6ua4tyrnsohfb5wismii4jinod4pmg2qydq.domains.proton.ch. |
| CNAME | protonmail3._domainkey | protonmail3.domainkey.dauvbe7zslpx3ezj5w6ua4tyrnsohfb5wismii4jinod4pmg2qydq.domains.proton.ch. |

Notes:
- No Hetzner zone-claim TXT exists for holt yet (that comes only if/when its
  zone is claimed at Hetzner DNS, same as raibach).
- The wildcard means ANY name under holtportfolio.com reaches the box; new
  service names need their own row (the five legacy rows above already have
  theirs, which is why they still reach the old host, not the box).
