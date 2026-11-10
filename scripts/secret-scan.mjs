#!/usr/bin/env node
/**
 * secret-scan.mjs — SECRET SWEEP
 *
 * Answers one question: does a credential exist in this repository?
 *
 * The tracked working tree is scanned by default. `--history` additionally walks
 * every blob reachable from every ref, because deleting a file does not remove it
 * from the commits that already carry it.
 *
 * Exit code is 1 when anything matches, so it can gate a push.
 *
 *   node scripts/secret-scan.mjs                 # tracked files
 *   node scripts/secret-scan.mjs --history       # tracked files + every commit
 *   node scripts/secret-scan.mjs --all           # include heuristic matches in history
 *   node scripts/secret-scan.mjs --include-vendored
 *
 * Vendored trees (`development/`, the embedded Langfuse web app) are skipped by
 * default: their fixtures are full of fake keys and drown the real findings.
 */

import { execFileSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";

const argv = process.argv.slice(2);
const HISTORY = argv.includes("--history");
const INCLUDE_VENDORED = argv.includes("--include-vendored");
const INCLUDE_HEURISTIC = !HISTORY || argv.includes("--all");

const MAX_BYTES = 10 * 1024 * 1024;
const VENDORED = [/^development\//, /^wireframe-lab\/langfuse-gov-embed\//];

// A right-hand side that names a variable or a known dummy is not a credential.
const PLACEHOLDER = /(placeholder|change[_-]?me|redacted|example|dummy|sample|your[_-]?|process\.env|os\.getenv|os\.environ)/i;
const DUMMY_PASSWORD = /^(?:user|pass|passwd|password|secret|demo|test|example|sample|xxx+|\*+|\.+|%s|<[^>]*>)$/i;

function isPlaceholder(value) {
  return PLACEHOLDER.test(value) || /\{\{|<[a-z]|%\{|^\$/.test(value);
}

const EXAMPLE_HOST = /^(?:localhost|127\.0\.0\.1|0\.0\.0\.0|host|hostname|example\.(?:com|org|net)|db\.example)$/i;

// A value that is really a variable name or an expression is not a credential.
function looksLikeSecretValue(value) {
  if (isPlaceholder(value)) return false;
  if (/^[A-Z][A-Z0-9_]{3,}$/.test(value)) return false; // DEEPSEEK_API_KEY, the name of the variable
  if (/[()\[\]{};]/.test(value)) return false;          // sum(usage_details['input'])
  return true;
}

function dummyUrl(match) {
  // scheme://user:password@host
  const parsed = /^[a-z][a-z0-9+.-]*:\/\/([^:]*):([^@]*)@([^/\s:?]+)/i.exec(match);
  if (!parsed) return true;
  const [, , password, host] = parsed;
  if (EXAMPLE_HOST.test(host)) return true;
  return DUMMY_PASSWORD.test(password) || password.includes("$") || password.includes("{");
}

const PATTERNS = [
  {
    name: "credentialed URL",
    severity: "high",
    re: /[a-z][a-z0-9+.-]*:\/\/[A-Za-z0-9_.-]+:[^@/\s"'<>]+@[A-Za-z0-9_.-]+/gi,
    check: (match) => !dummyUrl(match),
  },
  { name: "Langfuse key", severity: "high", re: /\b(?:sk|pk)-lf-[A-Za-z0-9]{8,}\b/g },
  { name: "API secret key", severity: "high", re: /\bsk-(?!lf-)[A-Za-z0-9_-]{24,}\b/g },
  { name: "Stripe key", severity: "high", re: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{10,}\b/g },
  { name: "GitHub token", severity: "high", re: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}\b|\bgithub_pat_[A-Za-z0-9_]{20,}\b/g },
  { name: "Figma token", severity: "high", re: /\bfigd_[A-Za-z0-9_-]{10,}\b/g },
  { name: "AWS access key id", severity: "high", re: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: "private key", severity: "high", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { name: "JWT", severity: "high", re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g },
  {
    name: "encryption key / salt",
    severity: "high",
    re: /\b([A-Za-z0-9_]*(?:ENCRYPTION_KEY|AES_KEY|FERNET_KEY|MASTER_KEY|SIGNING_KEY|JWT_SECRET|HMAC|SALT)[A-Za-z0-9_]*)\s*["']?\s*[=:]\s*["']([^"'\s]{16,})["']/gi,
    check: (_match, value) => looksLikeSecretValue(value),
  },
  {
    name: "literal credential assignment",
    severity: "heuristic",
    re: /\b([A-Za-z0-9_]*(?:SECRET|PASSWORD|PASSWD|TOKEN|API_KEY|APIKEY|DATABASE_URL|DSN)[A-Za-z0-9_]*)\s*["']?\s*[=:]\s*["']([^"'\s]{16,})["']/gi,
    check: (_match, value) => looksLikeSecretValue(value),
  },
].map((p) => ({ ...p, re: new RegExp(p.re.source, p.re.flags) }));

const findings = [];
const seen = new Set();
const skippedVendored = new Set();
let scanned = 0;

function redact(value) {
  if (value.length <= 8) return "*".repeat(value.length);
  return `${value.slice(0, 4)}…${value.slice(-2)} (${value.length} chars)`;
}

function isVendored(label) {
  return !INCLUDE_VENDORED && VENDORED.some((re) => re.test(label));
}

function scanText(label, text) {
  if (isVendored(label)) {
    skippedVendored.add(label);
    return;
  }
  scanned += 1;
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.length > 4000) continue;
    for (const pattern of PATTERNS) {
      if (pattern.severity === "heuristic" && !INCLUDE_HEURISTIC) continue;
      pattern.re.lastIndex = 0;
      let match;
      while ((match = pattern.re.exec(line)) !== null) {
        const value = match[match.length - 1] ?? match[0];
        if (pattern.check && !pattern.check(match[0], value)) continue;
        const key = `${label}:${i + 1}:${pattern.name}`;
        if (!seen.has(key)) {
          seen.add(key);
          findings.push({ label, line: i + 1, pattern: pattern.name, excerpt: redact(value) });
        }
        if (match[0].length === 0) pattern.re.lastIndex += 1;
      }
    }
  }
}

function isBinary(buf) {
  const limit = Math.min(buf.length, 8000);
  for (let i = 0; i < limit; i += 1) if (buf[i] === 0) return true;
  return false;
}

function scanTrackedTree() {
  const files = execFileSync("git", ["ls-files", "-z"], { maxBuffer: 64 * 1024 * 1024 })
    .toString("utf8")
    .split("\0")
    .filter(Boolean);

  for (const file of files) {
    if (isVendored(file)) continue;
    let buf;
    try {
      buf = readFileSync(file);
    } catch {
      continue; // path exists in the index but not in the working tree
    }
    if (buf.length === 0 || buf.length > MAX_BYTES || isBinary(buf)) continue;
    scanText(file, buf.toString("utf8"));
  }
}

function scanHistory() {
  const objectLines = execFileSync("git", ["rev-list", "--objects", "--all"], {
    maxBuffer: 512 * 1024 * 1024,
  })
    .toString("utf8")
    .split("\n")
    .filter(Boolean);

  const paths = new Map();
  const blobs = new Set();
  for (const entry of objectLines) {
    const split = entry.indexOf(" ");
    if (split === -1) continue;
    const sha = entry.slice(0, split);
    const path = entry.slice(split + 1);
    if (!paths.has(sha)) paths.set(sha, path);
    blobs.add(sha);
  }

  return new Promise((resolve, reject) => {
    const child = spawn("git", ["cat-file", "--batch"], { stdio: ["pipe", "pipe", "inherit"] });
    let buffer = Buffer.alloc(0);
    let pending = blobs.size;

    const pump = () => {
      for (;;) {
        const newline = buffer.indexOf(0x0a);
        if (newline === -1) return;
        const header = buffer.subarray(0, newline).toString("utf8").split(" ");
        if (header[1] === "missing") {
          buffer = buffer.subarray(newline + 1);
          pending -= 1;
          continue;
        }
        const size = Number(header[2]);
        if (!Number.isFinite(size)) {
          buffer = buffer.subarray(newline + 1);
          continue;
        }
        if (buffer.length < newline + 1 + size + 1) return;
        const content = buffer.subarray(newline + 1, newline + 1 + size);
        buffer = buffer.subarray(newline + 1 + size + 1);
        if (size > 0 && size <= MAX_BYTES && !isBinary(content)) {
          scanText(paths.get(header[0]) ?? `${header[0]}.${header[1]}`, content.toString("utf8"));
        }
        pending -= 1;
      }
    };

    child.stdout.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      pump();
    });
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`git cat-file exited ${code}`))));

    if (pending === 0) {
      child.stdin.end();
      return;
    }
    for (const sha of blobs) child.stdin.write(`${sha}\n`);
    child.stdin.end();
  });
}

async function main() {
  scanTrackedTree();
  if (HISTORY) await scanHistory();

  const scope = HISTORY ? "tracked files + every commit" : "tracked files";
  const skipped = skippedVendored.size > 0
    ? `, ${skippedVendored.size} vendored file(s) skipped — --include-vendored to scan them`
    : "";
  if (findings.length === 0) {
    console.log(`secret-scan: clean — ${scanned} ${HISTORY ? "blobs" : "files"} scanned (${scope}${skipped}).`);
    return 0;
  }

  for (const f of findings) console.log(`${f.label}:${f.line}  ${f.pattern}  ${f.excerpt}`);
  console.log(`\nsecret-scan: ${findings.length} finding(s) in ${scanned} ${HISTORY ? "blobs" : "files"} (${scope}${skipped}).`);
  return 1;
}

main().then((code) => process.exit(code), (error) => {
  console.error(`secret-scan: ${error.message}`);
  process.exit(2);
});
