/**
 * THE STUDIO'S STATIC SERVER — the tunnel's origin (owner, 2026-10-23).
 *
 * Replaces `vite preview` for serving the built files: the page document is stamped
 * "no-store" so every visit asks for the current document and its current file names,
 * and the hashed asset files keep a long-lived cache. No framework, no cache surprises.
 */
import { createServer, request as httpRequest } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { brotliCompress, constants as zlibConstants, gzip } from "node:zlib";
import { promisify } from "node:util";

const brotli = promisify(brotliCompress);
const gzipAsync = promisify(gzip);

const root = fileURLToPath(new URL("./dist", import.meta.url));
const port = Number(process.env.PORT || 4173);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".woff2": "font/woff2",
  ".json": "application/json",
  ".map": "application/json",
};

// THE FIRST VISITOR PAYS THE WHOLE TRANSFER (owner, 2026-10-24). Every visitor arrives with
// an empty cache, so the bytes on the wire are the experience. The build's first four files
// are 2.87 MB uncompressed and 0.57 MB at Brotli quality 5, which takes 31 ms. Hashed assets
// are compressed once and kept; the page document is compressed on each request because its
// name never changes.
const COMPRESSIBLE = new Set([".html", ".js", ".css", ".svg", ".json", ".map"]);
const compressed = new Map();

function encodingFor(req) {
  const accept = String(req.headers["accept-encoding"] ?? "");
  if (/\bbr\b/.test(accept)) return "br";
  if (/\bgzip\b/.test(accept)) return "gzip";
  return null;
}

async function compress(data, encoding) {
  if (encoding === "br") {
    return brotli(data, {
      params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 5 },
    });
  }
  return gzipAsync(data, { level: 9 });
}

async function compressedBody(filePath, data, encoding, cacheable) {
  const key = `${filePath}:${encoding}`;
  if (cacheable && compressed.has(key)) return compressed.get(key);
  const body = await compress(data, encoding);
  if (cacheable) compressed.set(key, body);
  return body;
}

async function sendFile(req, res, filePath, cacheable) {
  const data = await readFile(filePath);
  const ext = extname(filePath);
  const canCompress = COMPRESSIBLE.has(ext);
  const encoding = canCompress ? encodingFor(req) : null;
  const headers = {
    "Content-Type": MIME[ext] ?? "application/octet-stream",
    // THE PAGE DOCUMENT IS NEVER KEPT; THE HASHED ASSETS ARE KEPT FOREVER.
    "Cache-Control": cacheable
      ? "public, max-age=31536000, immutable"
      : "no-store, no-cache, must-revalidate",
  };
  if (canCompress) headers.Vary = "Accept-Encoding";
  let body = data;
  if (encoding) {
    body = await compressedBody(filePath, data, encoding, cacheable);
    headers["Content-Encoding"] = encoding;
  }
  headers["Content-Length"] = body.length;
  res.writeHead(200, headers);
  res.end(body);
}

// THE SAME FORWARDS THE PREVIEW CARRIED — the tunnel's one origin speaks to every tool.
const PROXIES = [
  { prefix: "/api", host: "127.0.0.1", port: 8000 },
  { prefix: "/builder", host: "127.0.0.1", port: 3223 },
  { prefix: "/dev", host: "127.0.0.1", port: 8090 },
  { prefix: "/governance", host: "127.0.0.1", port: 3100 },
  { prefix: "/posthog", host: "127.0.0.1", port: 8200 },
  /*
   * POSTHOG'S OWN SCRIPT FOLDER — the app's bundle writes root-absolute `/static/…` addresses,
   * not `/posthog/static/…`. Vite has this rewrite on 5001; this server did not, so on the tunnel
   * every PostHog script came back as the studio's HTML page and the Design room's frame could
   * not start. Same rewrite as the dev server, same target.
   */
  {
    prefix: "/static",
    host: "127.0.0.1",
    port: 8200,
    rewrite: (p) => p.replace(/^\/static/, "/posthog/static"),
  },
];

const server = createServer(async (req, res) => {
  const rawPath = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
  const target = PROXIES.find((p) => rawPath.startsWith(p.prefix));
  if (target) {
    const forward = httpRequest(
      {
        host: target.host,
        port: target.port,
        path: target.rewrite ? target.rewrite(req.url) : req.url,
        method: req.method,
        // THE TARGET'S HOST, NOT THE BROWSER'S (2026-10-24). Forwarding the tunnel's host header
        // made the local ingress answer /dev/server_info with the studio document, so the tool's
        // backend manager read no version and reported the backend disconnected. The proxy now
        // identifies itself to the target as the target; the browser's host stays at the edge.
        headers: { ...req.headers, host: `${target.host}:${target.port}` },
      },
      (upstream) => {
        const headers = { ...upstream.headers };
        const type = String(headers["content-type"] || "");
        /*
         * THE GOVERNANCE PROGRAM'S TWO COSTS, PAID AT THIS DOOR (owner, 2026-10-25: *"go ahead and
         * fix that governance"*). Measured through the tunnel: a single Langfuse chunk arrived as
         * 112 KB with NO `content-encoding`, and every asset carried
         * `public, max-age=31536000, immutable, no-store` — the `no-store` won, so each visit
         * re-downloaded the whole program. Two fixes, scoped to /governance so no other room's
         * delivery changes:
         *   1. hashed `/_next/static` files keep their year-long cache (no-store dropped);
         *   2. text assets are compressed here (brotli when the browser asks, gzip otherwise)
         *      when Langfuse did not compress them itself.
         */
        const isGovernance = rawPath.startsWith("/governance");
        const isHashedStatic = isGovernance && rawPath.includes("/_next/static/");
        if (isHashedStatic) {
          delete headers["cache-control"];
          delete headers["expires"];
          headers["cache-control"] = "public, max-age=31536000, immutable";
        }
        const compressible =
          isGovernance &&
          upstream.statusCode === 200 &&
          req.method !== "HEAD" &&
          !headers["content-encoding"] &&
          !/event-stream/i.test(type) &&
          /^(text\/|application\/(javascript|json|xml)|image\/svg)/i.test(type);
        if (compressible) {
          const chunks = [];
          upstream.on("data", (chunk) => chunks.push(chunk));
          upstream.on("end", () => {
            const body = Buffer.concat(chunks);
            const sendPlain = () => {
              delete headers["content-length"];
              res.writeHead(upstream.statusCode ?? 200, headers);
              res.end(body);
            };
            if (body.length < 1024) return sendPlain();
            const wantsBrotli = /\bbr\b/.test(String(req.headers["accept-encoding"] || ""));
            const encode = wantsBrotli ? brotli(body) : gzipAsync(body);
            encode
              .then((packed) => {
                const existingVary = String(headers.vary || "");
                const vary = /accept-encoding/i.test(existingVary)
                  ? existingVary
                  : existingVary
                    ? `${existingVary}, Accept-Encoding`
                    : "Accept-Encoding";
                res.writeHead(upstream.statusCode ?? 200, {
                  ...headers,
                  "content-encoding": wantsBrotli ? "br" : "gzip",
                  "content-length": String(packed.length),
                  vary,
                });
                res.end(packed);
              })
              .catch(sendPlain);
          });
          upstream.on("error", () => {
            if (!res.headersSent) res.writeHead(502, { "Content-Type": "text/plain" });
            res.end();
          });
          return;
        }
        res.writeHead(upstream.statusCode ?? 502, headers);
        upstream.pipe(res);
      },
    );
    forward.on("error", () => {
      res.writeHead(502, { "Content-Type": "text/plain" });
      res.end("upstream unreachable");
    });
    req.pipe(forward);
    return;
  }
  try {
    const pathname = rawPath;
    let filePath = join(root, normalize(pathname).replace(/^([/\\])+/, ""));
    if (filePath.endsWith("/") || !extname(filePath)) filePath = join(root, "index.html");
    await sendFile(req, res, filePath, pathname.startsWith("/assets/"));
  } catch {
    if (res.headersSent) {
      res.end();
      return;
    }
    // The SPA fallback: anything else is the page document.
    try {
      await sendFile(req, res, join(root, "index.html"), false);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("not found");
    }
  }
});

/*
 * THE UPGRADE PATH — THE BUILDER'S DEV CLIENT NEEDS ITS SOCKET (owner, 2026-10-25: *"it's
 * clearly a build problem or a tunnel problem"* — measured: on 5001 the Product room's builder
 * draws; on the tunnel it stops at Next's pre-hydration shell, with its document and every
 * chunk byte-identical and 200 on both paths). Next's Turbopack client connects its dev socket
 * before it hydrates; a plain `http.request` proxy never answers an Upgrade, so on the tunnel
 * that socket died and the page never drew. This forwards the Upgrade to the same target as
 * every other request, so the builder behaves on the tunnel exactly as it does on 5001.
 */
server.on("upgrade", (req, socket, head) => {
  const rawPath = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
  const target = PROXIES.find((p) => rawPath.startsWith(p.prefix));
  if (!target) {
    socket.destroy();
    return;
  }
  const upstream = httpRequest({
    host: target.host,
    port: target.port,
    path: target.rewrite ? target.rewrite(req.url) : req.url,
    method: req.method,
    headers: { ...req.headers, host: `${target.host}:${target.port}` },
  });
  upstream.on("upgrade", (res, upstreamSocket, upstreamHead) => {
    const lines = [`HTTP/1.1 ${res.statusCode} ${res.statusMessage || "Switching Protocols"}`];
    for (let i = 0; i < res.rawHeaders.length; i += 2) {
      lines.push(`${res.rawHeaders[i]}: ${res.rawHeaders[i + 1]}`);
    }
    socket.write(`${lines.join("\r\n")}\r\n\r\n`);
    if (upstreamHead?.length) socket.write(upstreamHead);
    if (head?.length) upstreamSocket.write(head);
    upstreamSocket.on("error", () => socket.destroy());
    socket.on("error", () => upstreamSocket.destroy());
    upstreamSocket.pipe(socket);
    socket.pipe(upstreamSocket);
  });
  // A target that answers without upgrading: hand the answer over and close.
  upstream.on("response", (res) => {
    socket.write(`HTTP/1.1 ${res.statusCode} ${res.statusMessage || ""}\r\n`);
    for (let i = 0; i < res.rawHeaders.length; i += 2) {
      socket.write(`${res.rawHeaders[i]}: ${res.rawHeaders[i + 1]}\r\n`);
    }
    socket.write("\r\n");
    res.pipe(socket);
  });
  upstream.on("error", () => socket.destroy());
  upstream.end();
});

server.listen(port, () => {
  console.log(`studio static server on :${port} serving ${root}`);
});
