#!/usr/bin/env python3
"""
Apply the verified raibach.net record set to the Hetzner DNS zone via the Cloud API.
(§ discovered 2026-10-11: Hetzner's API manages RRSets — one entry per name+type;
endpoint POST /v1/zones/{zone}/rrsets, body {"name","type","ttl","records":[{"value"}]}.)

Idempotent: creates what is missing, reconciles values into existing RRSets via
add_records. Safe to re-run.

Reads the token from Keys/hetzner-api-token (workspace, gitignored).
Usage: python3 apply-zone-hetzner.py [zone-name]

Values are the verified live set (checked against ns1.siteground.net 2026-10-11).
TTL 300 = fast settling on switch day; relax later if wanted.
"""
import json
import sys
import urllib.error
import urllib.request
import pathlib

TOKEN = pathlib.Path("Keys/hetzner-api-token").read_text().strip()
API = "https://api.hetzner.cloud/v1"
ZONE = sys.argv[1] if len(sys.argv) > 1 else "raibach.net"

# (name, type, ttl, [values]) — the verified raibach.net set
DESIRED = [
    ("@", "A", 300, ["188.245.25.26"]),
    ("www", "A", 300, ["188.245.25.26"]),
    ("studio", "A", 300, ["188.245.25.26"]),
    ("staging2", "A", 300, ["188.245.25.26"]),
    ("design.system", "A", 300, ["188.245.25.26"]),
    ("portfolio", "A", 300, ["35.212.127.26"]),
    ("mail", "A", 300, ["35.212.127.26"]),
    ("autodiscover", "A", 300, ["35.212.127.26"]),
    ("autoconfig", "A", 300, ["35.212.127.26"]),
    ("ftp", "A", 300, ["35.212.127.26"]),
    ("@", "MX", 300, ["10 mail.protonmail.ch.", "20 mailsec.protonmail.ch."]),
    ("@", "TXT", 300, [
        '"v=spf1 include:_spf.protonmail.ch ~all"',
        '"protonmail-verification=f22a07da22d5d53905f3f593f06f6f36ca73905d"',
        '"google-site-verification=Dvo39gwO0nAI7zyoPxEccKbPk7vOM0yh7CjULwhFp8A"',
        '"zone-ownership-verification-408880232baa40294e126f2f7249f0b21011d6c0ae509158d6275cb8e0f278fe"',
    ]),
    ("_dmarc", "TXT", 300, ['"v=DMARC1; p=quarantine"']),
    ("verify-2p5wb10thxqci2frwb0s28pj", "TXT", 300,
     ['"92aa4a75882bf1094ef5cca8c201ce0956382db5ff75b8d68052b052615d8c3c"']),
    ("protonmail._domainkey", "CNAME", 300,
     ["protonmail.domainkey.dzrebbfryivxadwbpe4b3jnpydyszhw72vzpb2bohhrn4s6agpkra.domains.proton.ch."]),
    ("protonmail2._domainkey", "CNAME", 300,
     ["protonmail2.domainkey.dzrebbfryivxadwbpe4b3jnpydyszhw72vzpb2bohhrn4s6agpkra.domains.proton.ch."]),
    ("protonmail3._domainkey", "CNAME", 300,
     ["protonmail3.domainkey.dzrebbfryivxadwbpe4b3jnpydyszhw72vzpb2bohhrn4s6agpkra.domains.proton.ch."]),
]

# holtportfolio.com — verified 2026-10-11 (zone file: holtportfolio.com.zone).
# Delegation was switched to Hetzner 2026-10-11 before the zone existed; zone
# loaded the same hour to close the gap.
HOLT_SET = [
    ("@", "A", 300, ["188.245.25.26"]),
    ("www", "A", 300, ["188.245.25.26"]),
    ("john", "A", 300, ["188.245.25.26"]),
    ("www.john", "A", 300, ["188.245.25.26"]),
    ("*", "A", 300, ["188.245.25.26"]),
    ("autodiscover", "A", 300, ["35.212.127.26"]),
    ("autoconfig", "A", 300, ["35.212.127.26"]),
    ("ssh", "A", 300, ["35.212.127.26"]),
    ("mail", "A", 300, ["35.212.127.26"]),
    ("ftp", "A", 300, ["35.212.127.26"]),
    ("@", "MX", 300, ["10 mail.protonmail.ch.", "20 mailsec.protonmail.ch."]),
    ("@", "TXT", 300, [
        '"v=spf1 include:_spf.protonmail.ch ~all"',
        '"protonmail-verification=85a4bc4cfd48f51a1fd84d6348f50d4dce361cdc"',
    ]),
    ("_dmarc", "TXT", 300, ['"v=DMARC1; p=quarantine"']),
    ("verify-grah5m087yfpuouh3ov7wgnx.john", "TXT", 300,
     ['"5dd4878fb7da93428b7eefcbe4dbb3bdcea8a945249da61b9894e6e64e2fb1e"']),
    ("protonmail._domainkey", "CNAME", 300,
     ["protonmail.domainkey.dauvbe7zslpx3ezj5w6ua4tyrnsohfb5wismii4jinod4pmg2qydq.domains.proton.ch."]),
    ("protonmail2._domainkey", "CNAME", 300,
     ["protonmail2.domainkey.dauvbe7zslpx3ezj5w6ua4tyrnsohfb5wismii4jinod4pmg2qydq.domains.proton.ch."]),
    ("protonmail3._domainkey", "CNAME", 300,
     ["protonmail3.domainkey.dauvbe7zslpx3ezj5w6ua4tyrnsohfb5wismii4jinod4pmg2qydq.domains.proton.ch."]),
]

if ZONE == "holtportfolio.com":
    DESIRED = HOLT_SET


def call(method, path, body=None):
    req = urllib.request.Request(API + path, method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Authorization": "Bearer " + TOKEN, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode())
        except Exception:
            return e.code, {}


def main():
    base = "/zones/%s/rrsets" % ZONE
    for name, rtype, ttl, values in DESIRED:
        code, out = call("POST", base,
                         {"name": name, "type": rtype, "ttl": ttl,
                          "records": [{"value": v} for v in values]})
        if code == 201:
            print("CREATED   %s/%s  (%d value(s))" % (name, rtype, len(values)))
            continue
        if code in (409, 422):
            # exists (or partial). The add_records action's body shape is not
            # documented and its 422s ("records[0].name invalid syntax") are not
            # worth guessing: replace path = delete + recreate with the full
            # desired values. Proven 2026-10-11.
            c2, out2 = call("DELETE", "%s/%s/%s" % (base, name, rtype))
            if c2 not in (200, 202, 204):
                print("FAILED    %s/%s  delete for replace -> %s %s" % (name, rtype, c2, json.dumps(out2)[:180]))
                continue
            c3, out3 = call("POST", base,
                            {"name": name, "type": rtype, "ttl": ttl,
                             "records": [{"value": v} for v in values]})
            if c3 == 201:
                print("REPLACED  %s/%s  (delete + recreate, %d value(s))" % (name, rtype, len(values)))
            else:
                print("FAILED    %s/%s  recreate -> %s %s" % (name, rtype, c3, json.dumps(out3)[:180]))
            continue
        print("FAILED    %s/%s -> HTTP %s %s" % (name, rtype, code, json.dumps(out)[:220]))

    # final read-back
    code, out = call("GET", base + "?per_page=50")
    rrsets = out.get("rrsets", [])
    print()
    print("── zone now holds %d RRSet(s) ──" % len(rrsets))
    for r in sorted(rrsets, key=lambda x: (x["name"], x["type"])):
        vals = " | ".join(rec["value"] for rec in r["records"])
        print("%-38s %-6s %s" % (r["name"], r["type"], vals[:110]))


if __name__ == "__main__":
    import urllib.parse  # noqa: E402  (kept here so the header stays readable)
    main()
