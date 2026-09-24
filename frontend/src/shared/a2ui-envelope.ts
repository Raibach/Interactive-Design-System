/**
 * The A2UI envelope boundary — the two labels the shell used to ignore.
 *
 * Every operation the server emits is labeled twice over
 * (backend/routes/ai.py:754–790):
 *
 *   [{ version: 'v0.9.1', createSurface:    { surfaceId: 'main', catalogId: … } },
 *    { version: 'v0.9.1', updateComponents: { surfaceId: 'main', components: […] } },
 *    { version: 'v0.9.1', updateDataModel:  { surfaceId: 'main', path: '/', value: {…} } }]
 *
 * `version` is a sibling of the operation, `surfaceId` is inside it. The shell
 * read neither: it looped the array, kept the last `updateComponents` and the
 * last `updateDataModel`, and decided *which* surface it was drawing by guessing
 * from the data model's shape (`cards` → console, `session` → composer). Two
 * failures fell out of that, both silent:
 *
 *   1. A response written in a version this shell does not implement — v1.0 —
 *      was parsed with v0.9.1 rules. No error, no warning: an empty or wrong
 *      surface, which looks exactly like an assembly that worked.
 *   2. Two surfaces in one response went into one pile. Components of one
 *      surface arrived beside the data model of the other, and the guess above
 *      decided which pile won. Nothing separated them.
 *
 * So the labels are read here, once, before anything reaches the renderer.
 *
 * The shell holds ONE surface: <a2ui-renderer> takes one components list, one
 * data model and one rootId, and there is one mount point for it. An envelope
 * that names more than one surface is therefore REFUSED rather than merged —
 * the shell cannot draw two, and blending them is precisely how a surface ends
 * up carrying parts of another. A refusal is a visible failure; a blend is an
 * invisible one.
 *
 * NOT THIS MODULE'S JOB: deciding which of the three VIEWS to show (console /
 * composer / decision). That is not the surface label — the server mounts all
 * three on the one surface `main` — so the view stays inferred from the data
 * model by the caller. Surface identity and view identity are different
 * questions, and one comment used to answer both with the same guess.
 */

/**
 * The versions this shell implements. Both spellings of each are accepted
 * because the wire has been seen with and without the leading `v`
 * (ai.py emits `v0.9.1`; A2UI-Rules.md writes `0.9`).
 */
export const SUPPORTED_A2UI_VERSIONS = ['0.9.1', '0.9'] as const;

const normVersion = (v: string) => v.trim().toLowerCase().replace(/^v/, '');

/** The three operation kinds that can carry a surface label. */
const OPERATIONS = ['createSurface', 'updateComponents', 'updateDataModel'] as const;

export interface SurfaceReading {
  /** The label the envelope carried — null when no operation named one. */
  surfaceId: string | null;
  /** createSurface.catalogId. Informational: this shell resolves names against its own tables. */
  catalogId: string | null;
  /** The surface's tree. Empty means "no surface", not "unchanged". */
  components: unknown[];
  /** The surface's data model with every updateDataModel applied, in order. */
  dataModel: Record<string, unknown>;
  /** Diagnostics for the caller to log. Never a reason to render something. */
  notes: string[];
}

export type EnvelopeRefusalCode = 'UNSUPPORTED-VERSION' | 'SURFACE-CONFLICT';

export interface EnvelopeRefusal {
  code: EnvelopeRefusalCode;
  message: string;
  detail: Record<string, unknown>;
}

export type EnvelopeRead =
  | { ok: true; reading: SurfaceReading }
  | { ok: false; refusal: EnvelopeRefusal };

const isObject = (v: unknown): v is Record<string, any> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);

const describe = (v: unknown) =>
  v === null ? 'null' : Array.isArray(v) ? 'an array' : typeof v;

/** A traversable copy: arrays stay arrays, objects stay objects. */
const cloneContainer = (v: unknown): Record<string, unknown> =>
  (Array.isArray(v) ? [...v] : isObject(v) ? { ...v } : {}) as Record<string, unknown>;

/**
 * Write one value at one JSON Pointer path, into a copy.
 *
 * `updateDataModel.path` is the third label the shell used to ignore — it wrote
 * every value at the root, so two operations targeting different paths could not
 * both survive. Applied in order, this is also what last-write-wins means for
 * the common `path: "/"` case: a root write replaces the root.
 *
 * `null` deletes the key at the path (A2UI-Rules.md §2.6 — "Setting a path's
 * value to null deletes the key at that path").
 */
function writeAtPath(
  root: Record<string, unknown>,
  path: string,
  value: unknown,
): Record<string, unknown> {
  const segments = path.split('/').filter(Boolean);

  if (segments.length === 0) {
    if (value === null || value === undefined) return {};
    return isObject(value) ? { ...value } : {};
  }

  const out: Record<string, unknown> = { ...root };
  let cursor: Record<string, unknown> = out;
  for (const key of segments.slice(0, -1)) {
    // `/cards/0/title` walks through an ARRAY by index, so the copy has to keep
    // the container's kind. Coercing an array to an object here would delete the
    // list on the way to the field.
    cursor[key] = cloneContainer(cursor[key]);
    cursor = cursor[key] as Record<string, unknown>;
  }

  const last = segments[segments.length - 1];
  if (value === null) delete cursor[last];
  else cursor[last] = value;

  return out;
}

/**
 * Read one A2UI response: its version, its surface, and that surface's two
 * channels. Returns a refusal — never a partial reading — when the envelope is
 * written for a version this shell does not implement, or describes more than
 * one surface.
 *
 * `base` IS THE SURFACE'S CURRENT MODEL, and it is why this takes an argument at
 * all. An envelope is a list of OPERATIONS against a model that already exists —
 * `updateDataModel` says "write this value at this path", and a path write means
 * nothing against an empty model. The four assemblies that build a whole surface
 * (console, composer, session, run) write `/` and there is nothing to write over,
 * so the old no-argument call produced the right answer for them by accident.
 * Measured 2026-09-23: the RUN's assembly writes only `/run` — it updates a
 * surface that is already carrying the person's rows, their conversation and the
 * nodes they dragged — so reading it against `{}` would have handed the renderer
 * a model holding one key and taken the rest of the screen's data away.
 */
export function readA2UIEnvelope(raw: unknown, base?: Record<string, unknown>): EnvelopeRead {
  const operations = (Array.isArray(raw) ? raw : [raw]).filter(isObject);
  const notes: string[] = [];

  // ── version ──────────────────────────────────────────────────────────────
  const declared = [
    ...new Set(
      operations
        .map((op) => op.version)
        .filter((v): v is string => typeof v === 'string'),
    ),
  ];
  const supported = SUPPORTED_A2UI_VERSIONS as readonly string[];
  const unknown = declared.filter((v) => !supported.includes(normVersion(v)));

  if (unknown.length) {
    return {
      ok: false,
      refusal: {
        code: 'UNSUPPORTED-VERSION',
        message:
          `A2UI envelope declares version ${unknown.map((v) => `"${v}"`).join(', ')}` +
          `; this shell implements v${SUPPORTED_A2UI_VERSIONS.join(' / v')}.` +
          ` Refusing to draw it: re-reading a newer envelope with v0.9.1 rules` +
          ` produces a surface that is empty or wrong, and says nothing about why.`,
        detail: { declared, supported: [...SUPPORTED_A2UI_VERSIONS] },
      },
    };
  }
  if (declared.length === 1) notes.push(`envelope version "${declared[0]}"`);
  // A version-less envelope is tolerated, not blessed: nothing was claimed, so
  // there is nothing to refuse. It is noted, because a producer that stopped
  // stamping its version is drift worth seeing.

  // ── surface identity ─────────────────────────────────────────────────────
  const surfaceIds = new Set<string>();
  let catalogId: string | null = null;
  for (const op of operations) {
    for (const key of OPERATIONS) {
      const payload = op[key];
      if (!isObject(payload)) continue;
      if (typeof payload.surfaceId === 'string' && payload.surfaceId) {
        surfaceIds.add(payload.surfaceId);
      }
      if (key === 'createSurface' && typeof payload.catalogId === 'string' && !catalogId) {
        catalogId = payload.catalogId;
      }
    }
  }

  if (surfaceIds.size > 1) {
    const ids = [...surfaceIds];
    return {
      ok: false,
      refusal: {
        code: 'SURFACE-CONFLICT',
        message:
          `A2UI envelope describes ${ids.length} surfaces (${ids.join(', ')})` +
          `; this shell draws one. Refusing to merge them: the parts of one` +
          ` surface would be drawn beside the parts of another, and the` +
          ` difference would not be visible on screen.`,
        detail: { surfaceIds: ids },
      },
    };
  }

  const surfaceId = surfaceIds.size === 1 ? [...surfaceIds][0] : null;
  if (!surfaceId) {
    notes.push('no operation named a surface — reading the envelope as one unnamed surface');
  }

  // ── the surface's two channels ───────────────────────────────────────────
  // With one label (or none) every operation belongs to it, so `belongs` is
  // only a guard against an operation naming a *different* surface — which the
  // refusal above has already excluded.
  const belongs = (op: Record<string, any>) =>
    surfaceId === null ||
    OPERATIONS.some((key) => isObject(op[key]) && op[key].surfaceId === surfaceId);

  let components: unknown[] = [];
  // The one model every operation in this envelope is applied to, in order. A
  // caller with a surface on screen hands its model in; a caller assembling a
  // fresh one leaves it empty and the root write replaces it (see `writeAtPath`).
  let dataModel: Record<string, unknown> = base ? { ...base } : {};

  for (const op of operations) {
    if (!belongs(op)) continue;

    if (op.updateComponents) {
      const list = op.updateComponents.components;
      // The renderer guards its own input too, but a non-array carried into
      // React state would be re-checked on every render. Normalised once here.
      if (list !== undefined && !Array.isArray(list)) {
        notes.push(
          `updateComponents.components is ${describe(list)}, not an array — discarded.` +
          ` The surface renders nothing rather than part of it.`,
        );
      }
      components = Array.isArray(list) ? list : [];
    }

    if (op.updateDataModel) {
      const { path, value } = op.updateDataModel;
      const target = typeof path === 'string' && path ? path : '/';
      if (value === undefined) {
        notes.push(
          `updateDataModel at "${target}" has no value — ignored. The spec requires` +
          ` it, so this envelope is short of a field rather than deleting one.`,
        );
        continue;
      }
      if (target === '/' && value !== null && !isObject(value)) {
        notes.push(
          `updateDataModel.value is ${describe(value)} at "/", not an object — ignored.` +
          ` Every { path } binding would resolve to nothing; using an empty model instead.`,
        );
        continue;
      }
      dataModel = writeAtPath(dataModel, target, value);
    }
  }

  return { ok: true, reading: { surfaceId, catalogId, components, dataModel, notes } };
}

/**
 * The refusal as an Error, for callers whose failure path classifies by error
 * (WritingAreaIndex throws it into the assembly catch, which names the code,
 * clears the surface and shows the report). The refusal itself rides along, so
 * the classifying side can read `code` without parsing a sentence.
 */
export function envelopeRefusalError(refusal: EnvelopeRefusal): Error {
  const error = new Error(`${refusal.code}: ${refusal.message}`);
  error.name = 'EnvelopeRefusalError';
  (error as Error & { refusal?: EnvelopeRefusal }).refusal = refusal;
  return error;
}

/**
 * APPLY AN `updateComponents` TO A SURFACE THAT IS ALREADY DRAWN.
 *
 * The spec's own semantics, and the half this shell never had: a component whose
 * id is already in the surface is UPDATED; one whose id is new is ADDED; every
 * component the update does not mention is left exactly as it is. That is what
 * makes `updateComponents` an update rather than a replacement, and it is what a
 * RUN needs — the third column moves while the other two stay put.
 *
 * WHY IT IS NOT THE HOST DECIDING WHAT THE COLUMN IS. The run's update arrives
 * from `/api/ai/assemble-surface` with the model's own composition in it: which
 * component stands in the middle, which slots it fills, what each child is bound
 * to, and — through the layout root the model also returns — the pointer that
 * puts it in the middle slot. This function moves those components into the list
 * by id. It names no component, holds no shape and knows no slot, which is the
 * whole difference between applying an assembly and being one.
 *
 * A COMPONENT THE ROOT NO LONGER REACHES IS LEFT WHERE IT IS. It is inert — the
 * renderer walks from the root and draws what it finds, so an unreferenced entry
 * is simply not drawn — and dropping it here would be this module guessing at
 * reachability. Measured 2026-09-23 on a Run: the viewer that stood in the middle
 * before the canvas is exactly that case, and the panel's "go back to the output"
 * control still names it by id.
 */
export function applyComponentUpdate(
  base: unknown[],
  update: unknown[],
): unknown[] {
  const out = Array.isArray(base) ? [...base] : [];
  const at = new Map<string, number>();
  out.forEach((c, i) => {
    const id = (c as { id?: unknown } | null)?.id;
    if (typeof id === 'string') at.set(id, i);
  });

  for (const comp of update) {
    const id = (comp as { id?: unknown } | null)?.id;
    if (typeof id !== 'string') continue; // the renderer reports a malformed entry; it cannot be merged by id
    const index = at.get(id);
    if (index === undefined) {
      at.set(id, out.length);
      out.push(comp);
    } else {
      out[index] = comp;
    }
  }
  return out;
}
