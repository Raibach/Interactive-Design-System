import type { Plugin } from 'vite';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Vite plugin serving previews of Figma drafts that are not in the catalogue yet.
 *
 * The backend writes a preview as a TEMPORARY FILE, and the pane imports it as:
 *
 *   import '/@figma-preview/<jobId>/f-1234-5678.ts'
 *
 * This plugin answers that request by reading the file the backend wrote. THE FOLDER IS NOT THE
 * CATALOGUE'S: `.preview/` sits outside `src/` entirely, so no path in it can be taken for a
 * component, nothing in the application imports from it, and there is no name in it that resolves
 * against anything the repository holds. It is deleted when the designer leaves, discards, or
 * asks for something else — see `_drop_preview` in backend/routes/figma.py.
 */
const PREFIX = '/@figma-preview/';

/** A tag is `f-` and node-id characters; a job id is a UUID. Anything else never reaches a path. */
const SAFE_JOB = /^[0-9a-fA-F-]{20,64}$/;
const SAFE_TAG = /^f-[A-Za-z0-9-]{1,120}$/;

/**
 * A module whose body throws. The preview's `import()` rejects with this message, so the
 * failure is drawn in the preview pane — which is where the designer is looking — instead of
 * stopping the dev server with an error overlay over the entire application.
 */
function moduleThatFails(message: string): string {
  return `throw new Error(${JSON.stringify(message)});\n`;
}

export default function figmaPreviewPlugin(): Plugin {
  // Vite's project root — where `.preview/` sits, beside the app rather than inside it.
  let projectRoot = process.cwd();

  return {
    name: 'vite-plugin-figma-preview',
    enforce: 'pre',

    configResolved(config) {
      projectRoot = config.root;
    },

    resolveId(source, importer) {
      // ── A PREVIEW'S OWN SEAM, RESOLVED INSIDE THE PREVIEW'S NAMESPACE ──────────────────────────
      // The drafted element's first line is `import … from './behaviour/attach'` — a RELATIVE path,
      // so it resolves beside whatever file is read, which is the whole point: the catalogue reaches
      // the real loader beside it and a preview reaches its own inert copy. Vite cannot make that
      // resolution itself, because the importer is a virtual id and there is no such folder on disk:
      // measured 2026-09-30, the draft failed with `Failed to resolve import "./behaviour/attach"`
      // while the copy it should have found served fine at its own URL. So this ONE specifier, from a
      // preview module and nowhere else, is claimed and named in the namespace. Nothing else relative
      // is touched, and the fs is never consulted for it.
      if (source === './behaviour/attach' && importer && importer.startsWith(PREFIX)) {
        const job = importer.slice(PREFIX.length).split('/')[0];
        return PREFIX + job + '/behaviour/attach.ts';
      }
      return source.startsWith(PREFIX) ? source : null;
    },

    async load(id) {
      const path = id.split('?')[0];
      if (!path.startsWith(PREFIX)) return null;

      const rest = path.slice(PREFIX.length);
      const slash = rest.indexOf('/');
      if (slash < 1) return null;
      const jobId = rest.slice(0, slash);
      const file = rest.slice(slash + 1);
      if (!file.endsWith('.ts')) return null;
      const tag = file.slice(0, -'.ts'.length);
      // ── THE SEAM'S COPY IS THE ONE NESTED FILE A PREVIEW SERVES ────────────────────────────────
      // A drafted element's first line imports `./behaviour/attach`, which in the catalogue is the
      // hand-written loader and here must be the preview's OWN inert copy — a preview resolves
      // nothing the application ships (`PREVIEW_SEAM`, backend/routes/figma.py). It is named
      // LITERALLY and it is the only path allowed below the job's root, so nothing about this can
      // walk anywhere; every other request is still `f-<node id>.ts` and nothing else.
      const isSeam = file === 'behaviour/attach.ts';
      // A PREVIEW IS A FILE IN A FOLDER, so the names that reach a path are checked first.
      if (!SAFE_JOB.test(jobId) || !(isSeam || SAFE_TAG.test(tag))) return null;

      const previewFile = join(projectRoot, '.preview', jobId, file);
      let source: string;
      try {
        source = await readFile(previewFile, 'utf-8');
      } catch {
        if (isSeam) {
          return moduleThatFails(
            'This preview was written without its own seam copy, so the drafted element cannot open. Ingest it again.',
          );
        }
        // A preview is deleted when it is discarded, approved, replaced by the next ingest, or
        // when the screen that asked for it left — so a request for one that is gone is ordinary,
        // not an error. It is drawn in the pane, where the designer is looking.
        return moduleThatFails(
          `Nothing is being previewed as ${tag} any more. It was discarded, or approved, or replaced by the next ingest. Ingest it again to look at it.`,
        );
      }

      // ── THE PREVIEW IS THE FILE, EXACTLY AS THE INGEST WROTE IT ─────────────
      // AND NOTHING IS LOADED BESIDE IT. This used to read the catalogue's manifest and import
      // every catalogue module the draft's markup mentioned, so a draft that composed a catalogue
      // element had that element defined — which made the preview read the catalogue, and made a
      // draft render as something other than what the ingest produced.
      //
      // The rule is the opposite: a preview is BLIND to the catalogue. It never reads it, never
      // resolves it, never imports from it, and never sees its assets. The catalogue is surfaced
      // only after the designer approves, which is the moment a component acquires standing
      // (owner, 2026-09-29: *"The preview should never touch or even know about the lit catalog at
      // all or any assets related to the lit catalog. It should be completely blind to the
      // catalog."*).
      return source;
    },
  };
}
