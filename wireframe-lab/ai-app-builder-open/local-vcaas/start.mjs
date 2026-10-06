/**
 * `npm run dev:local` — THE TOOL, WHOLE, ONE COMMAND.
 *
 * The builder has no engine of its own (upstream it is all Totalum's cloud API). This
 * repository's stand-in is `local-vcaas/server.mjs` — the same VCaaS surface, with
 * DeepSeek behind it and the generated apps served from this machine. That engine and
 * the Next dev server are two processes that must BOTH be up for the tool to work
 * (without the engine the Code panel and every build fail with the tool's own error
 * text, which reads like a broken feature rather than a stopped process).
 *
 * So this script is the one door: it starts both, forwards their output, and shuts
 * both down together on Ctrl-C. Ports: engine 4000, builder 3223 — see README.md.
 */
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");

const engine = spawn(process.execPath, [join(HERE, "server.mjs")], {
  cwd: ROOT,
  stdio: "inherit",
});
const builder = spawn("npx", ["next", "dev", "--port", "3223"], {
  cwd: ROOT,
  stdio: "inherit",
});

let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  engine.kill("SIGTERM");
  builder.kill("SIGTERM");
  setTimeout(() => process.exit(code), 300);
}
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
engine.on("exit", (code) => {
  if (!stopping) {
    console.error("[dev:local] the engine exited \u2014 stopping the builder too.");
    stop(code ?? 1);
  }
});
builder.on("exit", (code) => {
  if (!stopping) stop(code ?? 1);
});
