/**
 * A UUID v4 generator that works on THIS origin, which is plain HTTP.
 *
 * THE PROBLEM IT FIXES, SAID PLAINLY: `crypto.randomUUID()` exists only in
 * "secure contexts" — HTTPS or localhost. The studio is served over plain HTTP
 * (`http://2.28.109.69:5001`) until a domain + TLS certificate are in place,
 * so on that origin `crypto.randomUUID` is `undefined` and calling it throws
 * `TypeError: crypto.randomUUID is not a function`. That is the exact failure
 * that broke Figma ingest: the ingest built its job id with `crypto.randomUUID()`
 * and died before the request ever left the browser.
 *
 * WHAT THIS IS: a real RFC 4122 version-4 UUID built from
 * `crypto.getRandomValues`, which IS available in every context — secure or
 * not. The bytes are genuine CSPRNG output, the same source `crypto.randomUUID`
 * draws from. The output is indistinguishable from what `crypto.randomUUID`
 * would have produced.
 *
 * WHAT THIS IS NOT: it does NOT touch `crypto.randomUUID` itself, does NOT
 * monkeypatch it into existence, and does NOT hide the fact that the origin is
 * insecure. It simply stops depending on an API the insecure origin does not
 * provide. When a domain and TLS arrive, this code needs no change — it keeps
 * producing valid UUIDs either way.
 */
export function generateUuid(): string {
  const c = globalThis.crypto;
  const bytes = c.getRandomValues(new Uint8Array(16));
  // version 4 (bits 12–15 of the 6th byte)
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  // RFC 4122 variant (top two bits of the 9th byte)
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
