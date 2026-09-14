/**
 * repairSections — the finding, turned into the four sections a repair prompt is.
 *
 * A finding is a report, and this module is what its "Repair" button builds: the
 * prompt that would repair it, in the left column, where a person can read it, change
 * it, and Run it like any other prompt. Clicking Repair applies NOTHING.
 *
 * THE CHECK HAS ALREADY RUN. That verdict is the reason the finding is in the queue,
 * so none of these sections repeats the rule back at the reader: the finding's own
 * sentence, the check's name in backticks, and who owns the work are all absent on
 * purpose. What the prompt carries is the CORRECTION —
 *
 *   User       what the person knows, in the fields the app asks for;
 *   Tool Call  the address they are written to (the tool and the node it opens);
 *   Agent      what the change is, what to do with the fields, and what finishes it;
 *   System     nothing. There is nothing left to say: the check said it.
 *
 * `fix` and the field hints are the check's / the guide's OWN text, copied — never
 * paraphrased. The model reads the source's words, not a summary of them.
 *
 * Section types are the canonical ids from @/shared/promptSections (system / user /
 * agent / tool-call), and the names are the labels CORE_ROLE_LABELS recognises — so
 * Run maps shipped sections into core_roles instead of dropping them into
 * custom_roles. Both lists are derived from one declaration; neither is retyped here.
 */
import { repairMaterialFor, renderRepairForm, type RepairFinding } from './repairMaterial';

/** One seat in the left column, in the shape the section editor and Run expect. */
export interface RepairSection {
  name: string;
  type: string;
  content: string;
  position: number;
  visible: boolean;
}

/**
 * What the Agent section asks the answer to BE.
 *
 * This line used to read: "Make the correction, then verify it. When it holds, this
 * finding is done." The model answered with that sentence, in three moves:
 *
 *   "Correction applied …"                    ← a DONE claim, from "make the correction"
 *   "Verification: … matching … exactly."     ← a check it invented, from "verify it"
 *   "The finding holds."                      ← this app's word for still broken, from "when it holds"
 *
 * A person read four lines and could not tell whether their repair existed — and the
 * two halves contradicted each other, because "correction applied" and "it holds" are
 * opposite claims. Every word of it came from here. Worse, it COULD NOT have existed:
 * no run can write a file (the only tool it may call is a Figma read), so the repair
 * was a sentence about a write that nothing in this app was able to make.
 *
 * Two things changed, and they change together:
 *
 *   the prompt   now asks for the corrected file ITSELF — `FILE: <path>` over one
 *                fenced block holding the whole file — because the whole file is the
 *                only thing the app can write over the old one without guessing;
 *   the app      writes that block (see shared/repairApply + backend/repair_apply),
 *                keeps a backup, and SAYS what it wrote.
 *
 * So the seat no longer asks the model to claim anything about the file: it hands over
 * the file and says nothing else. The verdict is still not the model's to give — a
 * repair is settled by the NEXT catalog check (see settleRepair, which also says the
 * outcome in the chat), never by the run that made the change and never by an invented
 * comparison of two strings the same model typed.
 */
export const REPAIR_DONE_LINE = [
  'Answer in plain English, in exactly this shape:',
  'Line 1 — RESULT: DONE, or RESULT: NOT DONE, or RESULT: COULD NOT CHECK. Then one short sentence saying which one it is.',
  'Next — WHAT CHANGED: the file the change goes in, and the change, one line each.',
  'Then the corrected file, whole, exactly like this — this app writes this block over that file for you, so it must be the ENTIRE file, every unchanged line included, never a fragment, a summary or a diff:',
  'FILE: <the file path from the Tool Call section, exactly as it is written there>',
  '```tsx',
  '<every line of the file, with the change made>',
  '```',
  'A file that arrives cut off is refused and nothing is written, so give the whole file or say plainly that you could not. Do not claim a file was changed: the app reports what it actually wrote. The next catalog check decides whether the problem is gone, and it says so in the chat.',
].join('\n');

/**
 * Said instead of the file block when the file could not be read from this app.
 *
 * The write can only land if the prompt carried the file the model is replacing —
 * so when the read fails there is nothing to correct, and the honest answer is
 * COULD NOT CHECK rather than a file invented from a component name.
 */
export const REPAIR_FILE_UNREADABLE_NOTE =
  'The file could not be read from this app, so there is nothing to write. Answer RESULT: COULD NOT CHECK and say the file could not be read.';


/**
 * @param fileText The target file's contents AS THEY ARE NOW, read by the app
 *   before the prompt is built. Required for the repair to be writable: the app
 *   replaces the whole file, so the model has to see the whole file to hand back
 *   the whole file. When it is missing (the read failed, or the finding names no
 *   file) the seat says so and the answer is COULD NOT CHECK — a component name is
 *   not enough to invent a component from.
 */
export function buildRepairSections(f: RepairFinding, fileText?: string): RepairSection[] {
  const material = repairMaterialFor(f);
  // The User seat is the information the PERSON holds — the fields, and nothing else.
  // Each field arrives with a slot on its own label line saying what is wanted and where
  // to type it; the app's own words belong to the app's seat, never to this one.
  const userText = renderRepairForm(material.fields);

  // The Tool Call section names the tool the prompt is allowed to call — and Run
  // makes that name real: the server reads this section, calls Figma, and puts
  // Figma's own answer into the prompt. Naming the tool where the address lives
  // means a person editing the node here changes what actually gets checked; a
  // hidden copy of the finding would not.
  const address = [
    f.nodeId ? 'tool        figma.get_design_context' : null,
    f.nodeId ? `figma node  ${f.nodeId}` : null,
    f.file ? `file        ${f.file}` : null,
  ].filter(Boolean).join('\n');

  // The correction, in the check's own words: `fix` where the check wrote one, and
  // what the check needs where it did not — named by component, because a correction
  // that does not say what it lands on is not applicable. The address above says which
  // node it opens.
  const change = f.fix || `Needs ${material.need}`;
  const correction = f.component ? `${f.component}: ${change}` : change;

  // The file as it is now, so the answer can be the file as it should be. The app
  // writes one whole file over another — that is the only way a correction lands
  // without guessing what was already there — so this block, and the block the
  // answer returns, are the two halves of one replacement.
  const fileBlock = f.file
    ? (fileText
        ? [
            `THE FILE AS IT IS NOW (${f.file}):`,
            '```tsx',
            fileText.replace(/\s+$/, ''),
            '```',
            'Change nothing else. Keep every other line exactly as it is, so the block you return is this file with your change in it.',
          ].join('\n')
        : REPAIR_FILE_UNREADABLE_NOTE)
    : null;

  // The Agent seat carries the app's own words: the correction, what the app knows about
  // the fields above (`instruction`), what the answer must BE, and the file it replaces.
  // Nothing twice — the fields carry what the person has, the correction what changes,
  // the instruction what to do with the two.
  const agent = [correction, material.instruction, '', REPAIR_DONE_LINE, fileBlock]
    .filter((l): l is string => typeof l === 'string' && l !== '')
    .join('\n');


  return [
    {
      name: 'System',
      type: 'system',
      // Empty, and deliberately so. This seat used to restate the check, what it
      // needs and who owns the work — the rule the finding already broke, said a
      // second time to a person who is looking at the finding. An empty section is
      // skipped by Run, so the prompt carries the correction and nothing else.
      content: '',
      position: 0,
      visible: true,
    },
    {
      name: 'User',
      type: 'user',
      // The FIELDS — the part a person edits. Written by this module, read back by
      // the section, and read as values by Run: one text, one meaning. A field that
      // arrives filled is the app's suggestion and Run applies it; a field that
      // arrives empty carries what belongs there. A repair with nothing to type
      // (the mechanical ones) leaves this seat empty rather than filling it with
      // prose about the finding.
      content: userText,
      position: 1,
      visible: true,
    },
    { name: 'Tool Call', type: 'tool-call', content: address, position: 2, visible: true },
    {
      name: 'Agent',
      type: 'agent',
      content: agent,
      position: 3,
      visible: true,
    },
  ];
}
