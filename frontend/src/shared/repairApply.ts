/**
 * repairApply — the answer, turned into the file that gets written.
 *
 * A repair used to end at a sentence: the run described a change and nothing put
 * it anywhere, so "Correction applied" was a claim with no file behind it. This
 * module is the part that makes it real, in three steps:
 *
 *   correctionFromAnswer   find the corrected file in the answer. The Agent seat
 *                          asks for it as `FILE: <path>` above one fenced block;
 *                          anything else is not a file and returns null — the
 *                          caller then writes NOTHING and says so.
 *   applyReadiness         decide whether that text may replace the file at all,
 *                          in the same words the server would refuse it in. A
 *                          cut-off, patch-shaped or unchanged answer is refused
 *                          HERE, before a byte moves.
 *   applyRepair            POST it. The server backs the file up first, and its
 *                          refusal reasons are shown to the person verbatim.
 *
 * The rule both sides keep: an answer that does not look like a WHOLE file is
 * never written. A missing correction is a disappointment; a half-written
 * component is a broken app.
 */
import { API_BASE } from './apiHelper';

export interface Correction {
  /** The file the answer says the change goes in, as the prompt named it. */
  path: string;
  /** The complete replacement file. */
  content: string;
}

/** `FILE: <path>` — the path may be bare, or wrapped in backticks/bold. */
const FILE_LINE = /^[ \t>#*]*FILE:[ \t]*`?([^`\s]+?)`?[ \t]*$/m;

/**
 * The one shape the Agent seat asks for: a `FILE:` line, then a fenced block
 * holding the whole file. Returns null when the answer has no such block — a
 * prose answer is exactly what this app must never turn into a write.
 */
export function correctionFromAnswer(answer: string): Correction | null {
  const label = FILE_LINE.exec(answer || '');
  if (!label) return null;
  const path = label[1].trim();
  if (!path) return null;

  // Only look AFTER the label: a fence earlier in the answer belongs to
  // something else (the design dump, an example), not to the file being replaced.
  const rest = answer.slice(label.index + label[0].length);
  const fence = /```[^\n]*\n([\s\S]*?)```/.exec(rest);
  if (!fence) return null;

  return { path, content: fence[1].replace(/\n$/, '') + '\n' };
}

export type Readiness = { ok: true; content: string } | { ok: false; reason: string };

/** Below this, "shorter than half" says nothing — a 4-line file is not truncated. */
const MIN_LENGTH_FOR_RATIO = 200;

function unbalanced(text: string): string | null {
  const pairs: Array<[string, string, string]> = [
    ['{', '}', 'curly brace'],
    ['(', ')', 'round bracket'],
    ['[', ']', 'square bracket'],
  ];
  for (const [open, close, what] of pairs) {
    const opened = text.split(open).length - 1;
    const closed = text.split(close).length - 1;
    if (opened !== closed) {
      return `more ${what}s open than close (${opened} vs ${closed}), which is what an answer that was cut off looks like`;
    }
  }
  return null;
}

/**
 * May `corrected` replace `original`? Mirrors the server's own check (see
 * backend/repair_apply.looks_complete) so a bad answer is caught before it is
 * sent, and refused with the same plain sentence either way.
 */
export function applyReadiness(original: string, corrected: string): Readiness {
  if (!corrected || !corrected.trim()) {
    return { ok: false, reason: 'came back with no file in it' };
  }
  if (corrected.trim() === (original || '').trim()) {
    return { ok: false, reason: 'is the file unchanged, so there was nothing to apply' };
  }

  // A patch is not a file: this app replaces the whole file and cannot apply a diff.
  const head = corrected.replace(/^\s+/, '').split('\n');
  const isPatch =
    /^(---|\*\*\*|diff )/.test(head[0] || '') ||
    head.slice(0, 8).some((l) => l.startsWith('+++ ')) ||
    head.slice(0, 40).some((l) => l.startsWith('@@'));
  if (isPatch) {
    return {
      ok: false,
      reason:
        'came back as a patch rather than the whole file, and this app replaces whole files — it cannot apply a diff',
    };
  }

  if (
    (original || '').length >= MIN_LENGTH_FOR_RATIO &&
    corrected.length < original.length * 0.5
  ) {
    const lines = corrected.split('\n').length;
    const had = original.split('\n').length;
    return {
      ok: false,
      reason: `is ${lines} lines where the file has ${had}, which is too much of a drop to be a correction`,
    };
  }

  const bad = unbalanced(corrected);
  if (bad) return { ok: false, reason: `has ${bad}` };

  // A file that ended in a newline keeps one.
  const content =
    (original || '').endsWith('\n') && !corrected.endsWith('\n') ? `${corrected}\n` : corrected;
  return { ok: true, content };
}

/** What the server reports back after a write. */
export interface ApplyResult {
  ok: boolean;
  path?: string;
  bytes?: number;
  backup?: string;
  lines_before?: number;
  lines_after?: number;
  /** The re-run of the catalog check that decides the verdict (see the server). */
  check?: { ran: boolean; why?: string; verdict?: string; exit_code?: number };
  /** Present when ok is false — a sentence written for a person. */
  reason?: string;
}

/**
 * Write the correction to disk. Never throws: a refusal and an unreachable server
 * both come back as `{ ok: false, reason }`, because the caller's job is to SAY
 * what happened, and a thrown error is a sentence nobody can read.
 */
export async function applyRepair(correction: Correction): Promise<ApplyResult> {
  try {
    const res = await fetch(`${API_BASE}/repair/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: correction.path, content: correction.content }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        path: correction.path,
        reason: body?.detail || `the server refused the change (HTTP ${res.status})`,
      };
    }
    return { ok: true, ...body };
  } catch (e) {
    return {
      ok: false,
      path: correction.path,
      reason: `the part of the app that writes files could not be reached (${
        e instanceof Error ? e.message : String(e)
      })`,
    };
  }
}

/** The file as it is now, so the prompt can carry it. Null when it cannot be read. */
export async function readRepairTarget(path: string): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/repair/read?path=${encodeURIComponent(path)}`);
    if (!res.ok) return null;
    const body = await res.json();
    return typeof body?.content === 'string' ? body.content : null;
  } catch {
    return null;
  }
}
