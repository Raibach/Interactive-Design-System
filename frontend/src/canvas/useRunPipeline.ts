/**
 * THE RUN PIPELINE — run-requested, the third column, the repair loop — moved out of `pages/WritingAreaIndex.tsx` verbatim.
 *
 * The statement's text is unchanged; every name it closes over arrives through `deps`, so the
 * behaviour is the page's own. The dependency list is the contract: a new name in the effect is a
 * compile error here until it is declared in the interface below.
 */
import { API_BASE } from '@/shared/apiHelper';
import { CORE_ROLE_LABELS, declaredName } from '@/shared/promptSections';
import { FIGMA_FILE_KEY, RUN_DOCK_MS, deepFind, loadCanvasElements } from '@/canvas/pageHelpers';
import { type FlowSeatInput } from '@/shared/agentFlow';
import { classifyFailure } from '@/shared/error-registry';
import { holdsRun, reviewFlow, runHoldingRepairs } from '@/shared/flowReview';
import { logger } from '@/lib/logger';
import { useEffect } from 'react';

/** Exactly what the block needs from the shell, by name. */
export interface UseRunPipelineDeps {
  COLUMN_VIEWS_RUN: any;
  applyThirdColumn: any;
  askOf: any;
  assembleThirdColumn: any;
  assembledRunColumnRef: any;
  catalogFindings: any;
  currentPromptSessionObjRef: any;
  currentPromptSessionRef: any;
  firstLineOf: any;
  flowFactsRef: any;
  flowInputRef: any;
  handleOpenPromptFromConsole: any;
  handlePromptDescriptionChange: any;
  handlePromptTitleChange: any;
  handleSavePromptRef: any;
  heldRunRef: any;
  publishRepairFlow: any;
  readLiveOutput: any;
  readToolRegister: any;
  refreshEvaluations: any;
  repairFindingRef: any;
  repairSectionsRef: any;
  repairTitleRef: any;
  rowsForDecision: any;
  runApprovedRef: any;
  saveRunState: any;
  setAiAssemblyFailed: any;
  setAiAssemblyMessage: any;
  setAiAssemblyReport: any;
  setCanvasHolding: any;
  setCanvasRunning: any;
  setColumnView: any;
  setCurrentPromptSession: any;
  setIsComposerRunning: any;
  setIsFailureAcknowledged: any;
  setPromptLoadKey: any;
  settleRepair: any;
  speakRepairVerdict: any;
  surfaceDescription: any;
  surfaceSections: any;
  surfaceTitle: any;
  syncCanvasInset: any;
  toolsThatCannotRun: any;
  writeAnswerBack: any;
}

export function useRunPipeline(deps: UseRunPipelineDeps) {
  const { COLUMN_VIEWS_RUN, applyThirdColumn, askOf, assembleThirdColumn, assembledRunColumnRef, catalogFindings, currentPromptSessionObjRef, currentPromptSessionRef, firstLineOf, flowFactsRef, flowInputRef, handleOpenPromptFromConsole, handlePromptDescriptionChange, handlePromptTitleChange, handleSavePromptRef, heldRunRef, publishRepairFlow, readLiveOutput, readToolRegister, refreshEvaluations, repairFindingRef, repairSectionsRef, repairTitleRef, rowsForDecision, runApprovedRef, saveRunState, setAiAssemblyFailed, setAiAssemblyMessage, setAiAssemblyReport, setCanvasHolding, setCanvasRunning, setColumnView, setCurrentPromptSession, setIsComposerRunning, setIsFailureAcknowledged, setPromptLoadKey, settleRepair, speakRepairVerdict, surfaceDescription, surfaceSections, surfaceTitle, syncCanvasInset, toolsThatCannotRun, writeAnswerBack } = deps;
  useEffect(() => {

    // Listen for editor-send-to-model event (from MyStoryEditor) — REMOVED: MyStory is retired

  // `toggle-third-column` WAS NEVER SENT BY ANYONE. It was listened for here with a handler
  // that dispatched `reset-columns-to-equal-widths` — which only the retired React
  // ResizableSplitter ever heard. The element that owns her column is `composer-workspace`,
  // and it broadcasts its own fact as `third-column-toggle` (the name its registry entry
  // declares); the shell has nothing to do with that fact — the layout owns it, and the save
  // reads her state off the element directly. Both dead ends are gone: a listener is not a
  // wire when the name it waits for is one nobody speaks.

  // ── A2UI: Wire run-requested / save-requested from Lit <prompt-section-editor> ──
  // The Lit editor (AI-emitted) is now the source of truth for sections in the AI surface.
  // Run executes the prompt (real backend call) and streams into compiledOutput.
  // Middle column appears on Run (even while streaming) and stays if output exists.
  // Clear-output collapses the middle column. Save persists both left content + compiled output.
  const handleRunRequested = async (e: Event) => {
    const detail = ((e as CustomEvent).detail || {}) as { sections?: any[] };
    // THE ONE READER (rowsForDecision above). It prefers the editor — and reads the ELEMENT
    // rather than trusting what this event carried, so the list reviewed is the list in the
    // column whether or not the payload travelled well. Its fallbacks are the repair prompt and
    // the package's own left column, for the swap window: a Run that arrives while the column
    // is being replaced reads back an empty editor, and running what the column held a moment
    // ago beats running nothing (and beats blaming a save for a payload that was never sent).
    const sections = rowsForDecision();
    console.log(
      '[WritingAreaIndex] run-requested from <prompt-section-editor>',
      `${sections.length} section(s) from the column`,
      detail.sections?.length === 0 ? '— the event carried none' : '',
    );

    // ── HER REVIEW, BEFORE THE RUN ───────────────────────────────────────────
    //
    // A Run used to go straight to the model. Now it is held and she is asked whether the
    // prompt is ready — the list is READ-ME/FLOW-REQUIREMENTS.md, and the point is not
    // compliance but that a bad prompt is caught while it is cheap to fix, by the person
    // who wrote it, before it becomes a bad flow.
    //
    // THE RUN IS RELEASED BY HER SAYING SO, NOT BY HER SILENCE. `<run_ok/>` in her reply
    // is the only thing that proceeds; a `<run_blocked>` or no tag at all leaves it held.
    // Defaulting to "go" on a missing answer is how a prompt with a named problem goes
    // through because the machinery assumed yes.
    //
    // AND THAT SWITCH IS NOT THIS GATE — IT WAS, AND IT SILENTLY TOOK THE REVIEW AWAY.
    //
    // `autoAdvice` is the "stop offering me suggestions" preference: pressing "No thanks" on one
    // of her offers sets it, and it is measured per page (shared/autoAdvice). The review was
    // gated on that same flag, so a person who had waved away ONE suggestion ran every later
    // prompt unreviewed — no hold, no blockers, no reply — and the requirement this branch exists
    // for ("if there's an unsaved prompt and somebody tries to run it, Grace is supposed to stop
    // them", READ-ME/FLOW-REQUIREMENTS.md) was gone while every test still passed. The owner,
    // 2026-09-23, after pressing "No thanks" once: "When I click on a card and then I click on
    // run, nothing happens. Grace doesn't talk anymore. Nothing happens. … All of the blockers
    // checking is gone."
    //
    // SO THE REVIEW IS NOT OPTIONAL. It is the app's own gate, asked once per Run, and only her
    // answer releases it. The advice preference governs what she VOLUNTEERS (a greeting, a
    // suggestion about where to go next) — not whether a Run is checked before it runs.
    //
    // `runApprovedRef` is set by the approval event and read here: the released run
    // arrives as the same `run-requested` and must pass the gate it was just cleared by.
    if (!runApprovedRef.current) {
      // Held, and the held payload is what her approval will release.
      heldRunRef.current = detail;
      /*
       * THE BUTTON ANSWERS THE PRESS. A held run used to leave the controls exactly as they
       * were — no spinner, no change — so the button read as dead while she was in fact
       * reading the prompt. The owner, 2026-09-23: "run should not be a dead button."
       *
       * NOTHING ELSE OF THE RUN'S OPENING MOVE IS TAKEN: the output is NOT cleared and the
       * middle column is not told a run is on, because no run started. The spinner is the
       * whole of it, and she takes it down again — with her verdict (run-approved re-enters
       * this handler and runs, run-blocked stops it) — never on a timer of the shell's.
       */
      setIsComposerRunning(true);
      const heldSections = sections;
      /*
       * BOTH FACTS FROM THE ONE READER THE SEAT USES. The title already read the surface; the
       * description read the session row, and the assembly never filled that row's copy — so a
       * package whose description was on screen was reviewed as `(none)`, I2 held the Run, and the
       * "Add description" button was disabled because the SEAT could see it. See shared/packageFacts.
       */
      const title = surfaceTitle();
      const description = surfaceDescription();
      // SHE REVIEWS THE WORDS, NOT A SUMMARY OF THEM. "Agent Role: has content" tells her
      // nothing she can act on — a seat can be non-empty and still be a bad instruction,
      // which is the thing this gate exists to catch. Each seat goes in whole, cut only
      // when it runs long, so what she judges is what will be run.
      const seatLines = heldSections
        .map((s: any) => {
          const label = s.name || s.section || s.type || 'section';
          const body = String(s.content || '').trim();
          if (!body) return `- ${label}: (EMPTY)`;
          return `- ${label}: ${body.length > 600 ? `${body.slice(0, 600)}…` : body}`;
        })
        .join('\n');
      /*
       * WHAT IT NAMES THAT CANNOT RUN — the requirement the gate could not see without this.
       *
       * The register has two kinds of tool (backend/tools.py): `read`, which is words the system
       * follows and works today, and `call`, which asks another program for something. NOTHING
       * EXECUTES A `call` TOOL YET, so a prompt whose job depends on one is not operational — it
       * says the system will reach out and no part of the system does. The owner, 2026-09-23:
       * "we cannot allow a prompt that's not operational to be run."
       *
       * SHE IS THE ONE WHO SAYS IT, which is why this is a FACT HANDED OVER and not a refusal
       * here: the register is read, the prompt's own words are searched for a tool that cannot
       * run, and the answer becomes a line in her review. Grace stops the run and talks to the
       * person; the shell does not take that conversation away from her.
       *
       * A failure to read the register is NOT a block: the run is held for review either way,
       * and the list of tools is a fact she is usually given anyway (the workspace context
       * carries it). An empty answer here says "nothing found", not "nothing exists".
       */
      const register = await readToolRegister();
      const cannotRun = await toolsThatCannotRun(heldSections, register);
      /*
       * THE BLOCKERS, COMPUTED HERE — THE WHOLE LIST, ONCE.
       *
       * She used to be handed the requirements as prose and left to work out which were unmet,
       * inside a reply capped at 2000 tokens. What the person got was a slightly different
       * subset each turn, with "Add description" arriving after the description had been
       * written. The list is arithmetic — READ-ME/FLOW-REQUIREMENTS.md §8 asks the question
       * itself ("a review that asks a model to count empty seats is paying for arithmetic") —
       * so the shell does the arithmetic and she does the talking. The owner, 2026-09-23:
       * "she only replies to the things that are needed… give the user the ability to apply
       * all. Previously she was handing those over one at a time, which we don't want."
       */
      const unmet = reviewFlow({
        title,
        description,
        // An id is what "saved" means here: no id, no row, no place for a description to live.
        saved: Boolean(currentPromptSessionObjRef.current?.id),
        sections: heldSections,
        register,
      });
      window.dispatchEvent(new CustomEvent('a2ui:ask-grace', {
        detail: {
          // THIS TURN CAN STOP SOMETHING, so the seat is told which kind of turn it is. It owes
          // a verdict for a run review, and it marks its own reply as an alert when the answer
          // is no — the message's weight is decided there, not here.
          review: 'run',
          request: [
            'A person has pressed Run and the prompt is held until you say it is ready.',
            `Its name: ${title || '(none)'}. Its description: ${description || '(none)'}.`,
            'Its seats, as the person left them:',
            seatLines || '(the column is empty)',
            '',
            ...(cannotRun.length
              ? [
                  `THIS PROMPT NAMES TOOLS THAT CANNOT RUN YET: ${cannotRun.join(', ')}.`,
                  'Those tools have no service behind them, so the step they stand for will not',
                  'happen — a prompt that needs one is NOT operational and must not be run. That',
                  'alone is reason enough to block it: say which tool has nothing behind it, name',
                  'the tools that DO run as buttons the person can press instead, and end with',
                  '<run_blocked/>.',
                  '',
                ]
              : []),
            'THE BLOCKERS ARE ALREADY FOUND. This is the WHOLE list — every unmet requirement,',
            'computed from the prompt itself. Reply only to what is needed: say these, in this',
            'one reply. Do NOT add to the list, do NOT re-derive it, and do NOT look for more —',
            'the person can work everything here in one pass, and a list that arrives a piece at',
            'a time hides how much is left.',
            ...(unmet.length
              ? unmet.map((u) => `  · ${u.id}${u.level === 'advisory' ? ' (advisory — worth saying, does not hold the Run)' : ''} — ${u.why}`)
              : ['  · nothing — every requirement is met.']),
            'THE SEATS ARE THE DRAWING. What is listed above is exactly what the canvas will',
            'draw as nodes, so two rows for one step is two nodes for one step, and it is a',
            'reason to hold this Run. It is not a reason to tell anybody off: the person may',
            'have made the second row without meaning to, or may want two — say what you see in',
            'one sentence and offer to combine them as a button the person can press. The merge',
            'moves their words as they wrote them; it does not retype them.',
            /*
             * THE VOCABULARY, NAMED. She was told to offer "a button for each fix" and never told
             * what a button may SAY, so the blockers came back as `[Save the package](action:save)`
             * and `[Name the package](action:set-title|…)` — correct intent, names the app did not
             * answer to, and a person pressing them was told so (measured 2026-09-23). The app now
             * answers those two as well as the ones below it (actionLink), and this list is the
             * other half of the same rule: name the action so she is not left to invent one.
             *
             * EVERY FORM HERE IS PARSED BY actionLink.ts. Adding a line to this list without a
             * matcher on the other end is how this list becomes a lie.
             */
            'IF YOU OFFER A BUTTON, IT MUST SPELL AN ACTION THE APP KNOWS. These are the ones,',
            'exactly as written (the words in <angle brackets> are yours to choose):',
            '  · [Save the package](action:save) — the package has no record yet; nothing else can',
            '    be written into it until it is saved.',
            '  · [Name the package](action:set-title|<the name>) — the title a person will see.',
            '  · [Add a description](action:set-description|<one line>) — what its card will say.',
            '  · [Fill the <seat>](action:write-seat:<seat>|<the text>) — writes or appends to that',
            '    row (System Role, User Role, Agent Role, Tool Call…).',
            '  · [Remove <row>](action:remove-seat:<row>) — the one destructive repair.',
            '  · [Move the tool](action:move-tool:<tool>|<the seat it belongs in>).',
            '  · [Apply all](action:fix-all) — the repairs the app can make for itself, in one press.',
            '  · [Run it](action:run) — ONLY after <run_ok/>, to release the Run you just cleared.',
            'A button with any other action is a button that does nothing, and the person is told',
            'the app cannot do it — so if a fix you want to offer is not in this list, say what',
            'needs doing in words instead of inventing a name.',
            'NAME EVERYTHING THAT IS WRONG, IN THIS ONE REPLY, AND NEVER ONE AT A TIME. Every',
            'unmet requirement goes in this single answer, each with its own button, so the person',
            'can work the whole list in one pass. A reply that names one thing and waits costs',
            'them a trip to the prompt and back for every item, and hides how much is left — they',
            'cannot tell a nearly-finished prompt from one that is barely started. Watched at the',
            'screen, 2026-09-23: "she is making the user click again, then go to the list, then',
            'click again." This is the whole list, once.',
            'IF EVERYTHING IS THERE, CONGRATULATE THEM. One short sentence saying the prompt is',
            'ready, starting with a bottle: 🍾 — the owner, 2026-09-23: "just have her confirm',
            "everything's good and it's ready to run and put a champagne bottle icon there or",
            'something to congratulate them." Then end with <run_ok/>. A person who has just',
            'worked a list of fixes should be told they finished, not left to infer it.',
            'If something is missing — or it names a tool that is not in the register, or one',
            'that nothing can run — offer each fix as a button the person can press, and end with',
            '<run_blocked/>. Do not emit <run_ok/> until it is ready. A prompt that is not',
            'operational does not run.',
            'DO NOT recite the rules themselves and do not congratulate; name only what is',
            'actually wrong with THIS prompt. If nothing is wrong, one short sentence will do.',
          ].join('\n'),
        },
      }));
      /*
       * APPLY ALL, PUT ON SCREEN — because until now it was not.
       *
       * The whole mechanism existed and nothing could reach it: `onFixAll` listens for
       * `a2ui:fix-all`, <chat-panel> dispatches it, and `actionLink` names the action — and NO
       * SURFACE EVER DREW A BUTTON WITH IT, and nothing ever told her to offer one. So the one
       * control that clears the repairs the app can make for itself, and then runs the prompt by
       * the button's own path, was unreachable on every screen. What the person got was the
       * owner's report exactly: a list of blockers, and no way to work them.
       *
       * THE APP SAYS IT, NOT HER, and that is the choice rather than the shortfall: this is a
       * statement about what the APP can do, the same kind of fact as "⚠️ Run did nothing" and the
       * blank seats it already speaks. She explains the requirements; the app offers its own
       * capability. The line is written to stand on its own, because her review arrives after it.
       *
       * OFFERED EXACTLY WHEN A PRESS WOULD DO SOMETHING, from the SAME predicate the apply uses
       * (`runHoldingRepairs`) — so the button and the act cannot come apart. The names come from
       * the repairs actually on this list, so the sentence is about THIS prompt and not a menu.
       */
      const applyable = runHoldingRepairs(unmet);
      if (applyable.length) {
        const kinds = new Set(applyable.map((u) => u.repair.kind));
        const named: string[] = [];
        if (kinds.has('merge-seat')) named.push('a row that stands twice');
        if (kinds.has('move-tool')) named.push('a tool sitting in the wrong step');
        window.dispatchEvent(new CustomEvent('a2ui:system-message', {
          detail: {
            role: 'assistant',
            content: `Some of what is wrong with this prompt the app can fix by itself — `
              + `${named.join(' and ')}. [Apply all](action:fix-all) makes those repairs; `
              + `whatever needs your own words is still yours to write.`,
            label: 'Apply all',
          },
        }));
      }
      /*
       * AND THE ROOM STAYS WHERE IT IS. The Run button docks the prompt and gives the width to
       * the canvas — the layout's own act, armed the moment the button is clicked (see
       * composer-workspace's run-click). A held run draws no canvas, so the dock would take the
       * prompt down to its rail and leave the person looking at a background: measured
       * 2026-09-23, pressing Run on a package she then blocked collapsed the whole workspace.
       * A run that never started must not rearrange the screen, so the layout is told.
       */
      window.dispatchEvent(new CustomEvent('a2ui:run-held'));
      console.log('[WritingAreaIndex] Run held for review');
      return;
    }
    heldRunRef.current = null;
    runApprovedRef.current = false; // one run per approval

    // ── NOTHING TO RUN IS THE ONLY THING THAT STOPS A RUN ────────────────────
    //
    // A RUN DOES NOT NEED A PACKAGE. This used to be nested inside "if there is no
    // session": with no package it tried a save, and when that save did not finish the
    // run refused — "Run did not execute… the save that creates one did not finish."
    // The owner, 2026-09-18: "So it does not have to save the package to run — that is
    // not required." He is right: Run sends the prompt and draws the canvas, and the
    // package is a place to KEEP the answer, not a permission to ask for one.
    //
    // The one real precondition is CONTENT. With nothing in the left column there is no
    // prompt to send, and that is what this says — where the person is looking, not only
    // in the console. Nothing else gates a run: the run's own call carries
    // `session_id: currentPromptSessionRef.current || undefined`, which is what an
    // unsaved prompt has always meant here.
    if (!sections.length) {
      console.warn('[WritingAreaIndex] Run has no sections — nothing was sent anywhere');
      setCurrentPromptSession((prev: any) =>
        prev
          ? { ...prev, compiledOutput: '⚠️ Run did nothing: there was nothing in the left column to run.' }
          : prev
      );
      window.dispatchEvent(new CustomEvent('a2ui:system-message', {
        detail: {
          role: 'assistant',
          content:
            '⚠️ **Run did nothing.** The left column came back empty, so there was no prompt to send ' +
            'and nothing was changed. Put something in a section — or press Repair on a finding — and press Run again.',
        },
      }));
      return;
    }

    // The repair prompt has done its job: Run folds these sections into the
    // session, which owns them from here. Holding the override would make the
    // NEXT package open still holding the previous repair.
    repairSectionsRef.current = null;
    // WHICH finding this run answers, captured before the prompt is let go. The run
    // is the repair; a fresh check is what settles it (see settleRepair).
    const repairingFinding = repairFindingRef.current;
    repairFindingRef.current = null;

    const leftColumnContent = JSON.stringify({ sections });

    // Reset output for fresh run; show middle immediately via isComposerRunning
    setCurrentPromptSession((prev: any) =>
      prev ? { ...prev, leftColumnContent, compiledOutput: '' } : prev
    );
    setIsComposerRunning(true);
    // AND THE DRAWING IS TOLD THE SAME FACT IN THE SAME BREATH. It locks while the model execution
    // loop is in flight and unlocks where the run ends (the run's `finally`) — one fact, two
    // readers, so the lock cannot outlive the run and cannot lag it.
    setCanvasRunning(true);

    // ── THE PROMPT DOCKS, AND THE CANVAS TAKES THE WIDTH ────────────────────
    //
    // The same process, read and then worked: the sections the left column holds are
    // the nodes, the finding is the trigger, and the run's own answers are the steps.
    // The dock itself is the LEFT COLUMN'S OWN act — it hears the Run from its own
    // footer and keeps its rail and one grip, so opening the prompt back up is a
    // gesture, not a navigation (see composer-workspace's run-click). Nothing here
    // forces it, because nothing here owns that width.
    const repairFinding = repairingFinding
      ? (catalogFindings || []).find((f: any) => f.id === repairingFinding)
      : null;
    // ── EVERY RUN DRAWS. The canvas is what the middle column is for, so it takes the
    // column on Run whether or not a repair started it. A repair arrives with a note at
    // the head of the flow; a plain prompt run has no finding, and the flow then starts
    // at the prompt's own seats — the model draws both (see RepairFlowInput.finding).
    // Nothing here asks whether there is something else to compile: there is not. The
    // flow IS the run's output, and the compiled text stays reachable through the
    // column's own selector and Clear.
    flowInputRef.current = {
      finding: repairFinding
        ? {
            id: repairFinding.id,
            check: repairFinding.check,
            component: repairFinding.component,
            nodeId: repairFinding.nodeId,
            file: repairFinding.file,
            level: repairFinding.level,
          }
        : null,
      /*
       * THE ROWS GO OVER WHOLE — and they have to, because this used to pick three fields out of
       * four and the fourth was the name. A SAVED row is `{section, role, content}`: it has no
       * `name` and no `type`, so `{name: s.name, type: s.type}` handed the drawing two rows per
       * package that could not be named at all. The canvas said so out loud, honestly and wrongly —
       * "One row I cannot name yet — a row with no name, a row with no name" — and drew the System
       * and User seats as unresolved nodes while the prompt beside it was perfectly named.
       *
       * `declaredName` is the one reader of that name (promptSections), so this asks it rather than
       * choosing fields. The rest of the row rides along untouched: the builder decides what it
       * needs, and a mapping here that chose for it is how the name went missing in the first place.
       */
      sections: (sections || []).map((s: any) => ({
        ...s,
        name: declaredName(s),
        type: s.type,
        content: s.content,
      })),
      label: repairTitleRef.current
        || (repairFinding
          ? `Repair — ${repairFinding.check}${repairFinding.component ? ` on ${repairFinding.component}` : ''}`
          : currentPromptSessionObjRef.current?.title || 'This run'),
    };
    flowFactsRef.current = { running: true };
    /*
     * THE RUN'S OPENING MOVE, IN THE ORDER A PERSON CAN TRACK — and the order is the owner's, from
     * watching it happen the wrong way round.
     *
     * THE CLICK ANSWERS FIRST, AND IT KEEPS ANSWERING. The controls are told at the click (see
     * `writeBusyToSurface` above), so the RUN button spins under the person's finger while the rest
     * of this happens — and the button is still there, because nothing has folded yet.
     *
     * THEN THE COLUMN IS ASSEMBLED, WITH THE PANELS WHERE THEY ARE. The model composes the third
     * column against the catalog (`assembleThirdColumn`) while the canvas's code is fetched and
     * while the run itself is already going out — one wait, three jobs, on screen as a spinner.
     *
     * THEN THE DOORS SLIDE — `dockPrompt()`, once the column is in hand. This is the piece the
     * owner asked for twice and it is load-bearing: "the assembly should start in the background and
     * then the slide panels should slide back. That's just after you click run." Docking at the
     * CLICK folded the prompt to its rail before the model had answered, and the rail is where the
     * control bar — and the spinning RUN button — lives. So the wait began by taking away the only
     * thing that said the click had been heard.
     *
     * AND THE CANVAS MOUNTS INTO A SETTLED LAYOUT: the dock is one movement (the prompt and her
     * column to their rails on the same 760ms curve — measured: 950 → 60 and 950 → 104 together,
     * and her pane turns into a layer over the drawing without moving a pixel), the pane has its
     * own waiting state while the room is empty, and the canvas goes in when the slide is over.
     * That ordering is the cure for the jump the drawing used to arrive with: a canvas that mounts
     * while the pane beside it is moving takes its width mid-flight and is seen sliding in (see the
     * layout's own note, and the prompt's fold, which was cured the same way).
     *
     * NOTHING HERE IS TIMED EXCEPT THE SLIDE. There is no beat to hold, no floor to wait out: the
     * model's own time is the wait, and `RUN_DOCK_MS` is the pane's transition — the one moment the
     * canvas must not mount into.
     */
    const layoutEl = deepFind<HTMLElement & { dockPrompt?: () => void }>('composer-workspace');
    /*
     * AND THE COLUMN IS TOLD IT IS WORKING FROM THE CLICK — not from the moment its own assembly
     * lands. On a SECOND Run the canvas is already on screen with the previous drawing in it, and
     * the wait for the model is the longest part of the wait: a picture sitting there unchanged
     * for four seconds is the silence this whole sequence exists to remove. The same call covers
     * both cases (it is idempotent, and it waits for an element that does not exist yet on a
     * first Run) — see setCanvasHolding.
     */
    setCanvasHolding(true);

    void (async () => {
      // BOTH ARRIVE BEFORE EITHER IS USED: the canvas's own code (fetched on the way in, never
      // with the bundle — a package opened and never run pays for neither the drawing nor its
      // 591KB ground) and the model's composition of the column.
      const [, assembled] = await Promise.all([loadCanvasElements(), assembleThirdColumn()]);

      /*
       * AND THE COLUMN IS KEPT WHERE THE STATE WILL FIND IT (owner, 2026-10-05) — see
       * assembledRunColumnRef. The components the model just returned ARE the drawing; the
       * run's own state write (saveRunState) and every later manual Save persist them with
       * the rest of the place, so a reopened card draws this exact column instead of paying
       * a model for it again.
       *
       * THE SAVED RECORD IS THE COLUMN, NOT THE TREE — the root stays OUT of it. A saved root
       * is a photograph of THIS tree's child ids, and it gets replayed later over a DIFFERENT
       * assembly's root (see the exclusion in the reopen replay) — the column alone is what the
       * picture is made of, and the replay derives the middle pointer from it.
       */
      assembledRunColumnRef.current = Array.isArray(assembled.components)
        ? (assembled.components as any[]).filter((c) => c?.component !== 'composer-workspace' && c?.id !== 'root')
        : null;

      /*
       * THE DOORS OPEN WHEN THE COLUMN IS READY — NOT BEFORE, AND THAT IS THE ORDER THAT KEEPS THE
       * RUN BUTTON ON SCREEN.
       *
       * The dock was called at the CLICK, and the dock is what folds the prompt to its rail — and
       * the prompt's rail is where the control bar lives, with the RUN button on it. So the one
       * control the person had just pressed was taken off the screen at the exact moment the wait
       * began, and there was nothing anywhere that said the click had been heard. The owner,
       * 2026-09-23: "the user cannot click something and nothing happened, that is not allowed …
       * there is an animation on that run button and it should run until the panels expand."
       *
       * He had said the order a session earlier and it is the same order: "the assembly should start
       * in the background and then the slide panels should slide back. That's just after you click
       * run." Both halves are now true:
       *
       *   the click        the button spins (the controls are told at the click, see above)
       *   the assembly     the MODEL composes the column — the wait a person actually has, filled
       *                    by that spinner, on a button still under their finger
       *   the colum is ready
       *                    the doors slide: `dockPrompt()` closes the prompt and her column in one
       *                    frame, the room opens, and the pane has its own waiting state (see
       *                    composer-workspace's `_runInFlight`) so it is never an empty rectangle
       *   RUN_DOCK_MS later  the canvas mounts — into a layout that has already settled, which is
       *                    the cure for the drawing being seen sliding in — and the drawing follows
       *                    in the same tick.
       *
       * NO FLOOR IS ADDED TO ANY OF IT: the model's own time is the wait, and the only timed thing
       * here is the pane's own 760ms slide, which is the moment the canvas must not mount into.
       */
      layoutEl?.dockPrompt?.();
      await new Promise((r) => window.setTimeout(r, RUN_DOCK_MS));
      applyThirdColumn(assembled);
      // The header is told what this column can now offer — the drawing itself, the output it came
      // from, and the draft — by the same live write every view switch makes (see setColumnView).
      setColumnView('flow', COLUMN_VIEWS_RUN);
      setCanvasHolding(true);
      // THE FRESH MOUNT TAKES THE LOCK, TOO — this drawing was built while the run already was, so
      // its constructor default (`false`) is a moment out of date; the same re-assert `holding`
      // gets above, for the same reason.
      setCanvasRunning(true);

      // THE DRAWING, in the same breath: the graph is a function of the rows and the run's own
      // facts, and it is built here — the one writer of `/session/middle_column/flow`.
      publishRepairFlow();
      setCanvasHolding(false);
      // THE DRAWING IS TOLD WHAT IT CAN SEE, the moment both boxes exist: her column is a layer
      // over the canvas, and a view composed into the full box puts the brain on the seam
      // between them. (The observer above keeps it true as she narrows.)
      syncCanvasInset();
      requestAnimationFrame(() => requestAnimationFrame(() => {
        syncCanvasInset();
        // THE BAR THAT ARRIVES IS TOLD, NOT ASSUMED — and it is told to STOP. The column that took
        // the busy flag at the click is gone, and the one now on screen was created while the run
        // was already in flight; without this it keeps a spinner that belongs to a control the
        // person is no longer looking at. (This used to RE-ASSERT the spinner here, and a separate
        // 3200ms floor — MIN_RUN_BUSY_MS — was what turned it off. That floor is gone with the other
        // artificial waits: the drawing is on screen, so the work being waited for is presented.)
        setIsComposerRunning(false);
        window.dispatchEvent(new CustomEvent('flow-view-ready'));
      }));
    })().catch((err: unknown) => {
      /*
       * FAIL LOUD. The column could not be assembled or the canvas's code could not be fetched,
       * so there is no drawing — and the one thing that must not happen is the output column
       * sitting there as if the Run had worked. This was a logger line only, which is the silent
       * fallback READ-ME/THE_METHOD.md names as the enemy: the person sees nothing and only the
       * trace holds the reason. So the failure goes through the app's own channel — the banner
       * the assembly uses, whose Retry re-runs the Run — and NOTHING is substituted for the
       * canvas: the column keeps the output it had, and the person is told why there is no
       * picture.
       */
      const report = classifyFailure(err, { intent: 'render-run' });
      setAiAssemblyReport(report);
      setAiAssemblyMessage(report.headline);
      setIsFailureAcknowledged(false);
      setAiAssemblyFailed(true);
      // AND THE SPINNER STOPS, because the thing it was standing for is over. NOT a fallback and
      // nothing is substituted: the failure is a banner with a name and a reason, the column keeps
      // the output it had, and a control that went on spinning would be the one lie left — a Run
      // that is not running, shown as running.
      setIsComposerRunning(false);
      logger.error('the third column could not be assembled, so there is no drawing to show', {
        error: String((err as Error)?.message ?? err),
      });
    });
    // THE SPINNER RUNS FOR THE RUN, AND STOPS WHEN THE RUN'S OWN WORK IS PRESENTED. Nothing is held
    // for a floor: the frame above stops it the moment the drawing is on screen, and a Run that
    // ends some other way (a failure, a stop) clears it in its own handler. The 3200ms floor that
    // used to be here — "so the canvas is PRESENTED rather than watched arriving" — was written
    // against a canvas that appeared in a moment; with the model composing the column the wait is
    // seconds already, and the floor only ever extended a spinner past the thing it was waiting for.
    // (There is nothing to release here: the busy flag is set above and cleared by the signals.)

    // ── The Run URL is RELATIVE, like every other call in this app ────────────
    //
    // It used to be `${import.meta.env.VITE_API_URL || ''}/api/teacher/query`.
    // VITE_API_URL is set in `backend/.env` to the DOCKER SERVICE NAME —
    // `http://prompt-composer-console:5001` — and RESTART-LOCAL.sh exports that file
    // into the shell before starting Vite, so the dev server inlined it. Every Run
    // therefore went to a hostname that resolves only inside the container and died
    // before it left the browser: `TypeError: Failed to fetch`, with nothing in any
    // server log, because nothing arrived.
    //
    // Every other endpoint already used the relative `API_BASE` ("/api") — the
    // backend serves this app from the same origin in every environment, dev and
    // deployed (see shared/apiHelper.ts) — which is exactly why only Run broke, and
    // why the proxy, the tunnel and the endpoint all looked healthy.
    //
    // Declared outside the try so the failure message can name the REAL address
    // instead of a path it was never sent to.
    const runUrl = `${API_BASE}/teacher/query`;

    try {
      const { getApiKey } = await import('@/services/authService');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const apiKey = getApiKey();
      if (apiKey) headers['X-API-Key'] = apiKey;

      // Build the structured context the backend _assemble_prompt_output expects:
      // { core_roles: { "System Role": ... }, custom_roles: [...] }.
      // (Previously sent markdown, which json.loads() rejected, so the backend fell
      // back to a bare "Execute the prompt configuration." with no real prompt.)
      // Which sections the model receives as core roles, and which fall through to
      // custom_roles. Declared in @/shared/promptSections so a seat added to the
      // left column cannot be silently dropped from the model's view by a list
      // nobody remembered to update — the failure was one missing string away.
      const CORE_ROLES = CORE_ROLE_LABELS;
      const coreRoles: Record<string, string> = {};
      const customRoles: { name: string; content: string }[] = [];
      for (const s of sections || []) {
        const name = s.name || s.section || s.role || s.type || 'Section';
        const content = (s.content || '').trim();
        if (!content) continue;
        if (CORE_ROLES.includes(name)) {
          coreRoles[name] = content;
        } else {
          customRoles.push({ name, content });
        }
      }
      const promptContext = JSON.stringify({ core_roles: coreRoles, custom_roles: customRoles });

      // ── Tool calls: the prompt's declaration, made real ──────────────────
      // The Tool Call section names the tool and carries the address. This turns
      // that into an actual call the SERVER executes before the model runs, so the
      // design is in the prompt instead of something the model is asked to imagine.
      // Read from the sections the user can see and edit — change the node in the
      // column and the check follows, rather than a hidden copy of the finding.
      const toolNode = (sections || [])
        .map((s: any) => String(s?.content || ''))
        .join('\n')
        .match(/figma node\s+(\d+:\d+)/)?.[1];
      const toolCalls = toolNode
        ? [{ name: 'figma.get_design_context', nodeId: toolNode, fileKey: FIGMA_FILE_KEY }]
        : [];

      const resp = await fetch(runUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          question: 'Execute the prompt configuration.',
          context: promptContext,
          mode: 'prompt_output',
          // NO temperature here. It sent 0.45 while the mode decides: grace_gui.py pins
          // 0.0 for every mode that is not `chat` (and turns reasoning off with it), so
          // this number was read by nobody and claimed otherwise. The chat is the only
          // place with a temperature — CHAT_TEMPERATURE, 1.5 — and the run is not a chat.
          // Executed server-side before the model runs. Empty when the prompt
          // declares no tool, which is not an error and changes nothing.
          tool_calls: toolCalls,
          // The prompt package this run belongs to. The backend uses it to
          // attach/reuse the conversation row (conversations.session_id is NOT
          // NULL), so every chat turn actually persists.
          session_id: currentPromptSessionRef.current || undefined,
          // The package's title, so the fresh conversation the backend files the
          // run's results in can be named after it (see routes/teacher.py).
          run_title: surfaceTitle(),
          // No `model` — let the provider's configured default apply.
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        setCurrentPromptSession((prev: any) =>
          prev ? { ...prev, compiledOutput: `Error: ${resp.status} ${errText}` } : prev
        );
        setIsComposerRunning(false);
        return;
      }

      // The backend returns a single JSON object ({ content, error, conversation_id })
      // — not a Server-Sent Events stream. Parse it directly instead of expecting
      // `data: ` lines (which never arrive, so output stayed empty → "(No output returned.)").
      const data = await resp.json();
      const output = (data && (data.content || data.error || '')) || '';

      // A declared tool call that could not run is not a detail. The answer was
      // written WITHOUT the design, so the answer has to say so — otherwise a
      // design-blind reply arrives looking like a checked one. The ⚠️ prefix is
      // also what makes the middle column render its "could not be generated"
      // marker rather than passing this off as a finished result.
      const toolWarnings: string[] = Array.isArray(data?.tool_warnings) ? data.tool_warnings : [];
      if (toolWarnings.length) {
        console.warn('[run] tool warnings:', toolWarnings);
        window.dispatchEvent(new CustomEvent('a2ui:system-message', {
          detail: {
            role: 'assistant',
            content:
              '⚠️ **The tool call did not return what it was asked for.**\n\n'
              + toolWarnings.map((w) => `- ${w}`).join('\n')
              + '\n\nThis prompt was answered without it — treat the result as '
              + 'unverified, and press Run again once the tool can answer.',
          },
        }));
      }

      setCurrentPromptSession((prev: any) =>
        prev
          ? {
              ...prev,
              compiledOutput: toolWarnings.length
                ? `⚠️ ${toolWarnings.join('\n')}\n\n---\n\n${output || '(No output returned.)'}`
                : (output || '(No output returned.)'),
            }
          : prev
      );

      /*
       * THE RUN'S RESULTS LAND IN A FRESH CONVERSATION, WHICH THE SEAT ADOPTS.
       *
       * The owner, 2026-09-24: "the other conversation save it, and it automatically
       * creates a new conversation and loads the results." The backend filed the
       * findings and the answer in a new conversation and returned its id; the seat
       * moves to it and loads them, so the chat shows the results — headed "Your
       * Results", in rich text — while the conversation the person was in stays
       * saved in the list. The package is also repointed at the new conversation,
       * the same hop the seat's own "new conversation" makes, so a reload lands on
       * it rather than resurrecting the old thread.
       *
       * WITHOUT A PACKAGE (an unsaved prompt) there is no conversation to file into
       * — the backend returns none — so the results are said in the thread directly,
       * carrying the same marks (result turns), and a later Save persists them
       * through the seat's own pending path.
       */
      const runConvId = typeof data?.conversation_id === 'string' && data.conversation_id ? data.conversation_id : '';
      if (runConvId) {
        const panel = deepFind<HTMLElement & { adoptConversation?: (id: string) => void }>('composer-chat-panel');
        panel?.adoptConversation?.(runConvId);
        if (currentPromptSessionRef.current) {
          try {
            const res = await fetch(`${API_BASE}/prompt-sessions/${currentPromptSessionRef.current}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ conversation_id: runConvId }),
            });
            if (!res.ok) {
              logger.error('the run conversation could not be bound to the package', {
                sessionId: currentPromptSessionRef.current,
                status: res.status,
              });
            }
          } catch (e) {
            logger.error('the run conversation binding never reached the backend', {
              sessionId: currentPromptSessionRef.current,
              error: String(e),
            });
          }
        }
      } else if (!data?.error) {
        const toolResults: string[] = Array.isArray(data?.tool_results) ? data.tool_results : [];
        if (toolResults.length) {
          const joined = toolResults.join('\n\n');
          const shown = joined.length > 4000 ? `${joined.slice(0, 4000)}…` : joined;
          window.dispatchEvent(new CustomEvent('a2ui:system-message', {
            detail: {
              role: 'assistant',
              label: 'Tool answer',
              content: `**Your Results**\n\n${shown}`,
              result: true,
            },
          }));
        }
        if ((output || '').trim()) {
          window.dispatchEvent(new CustomEvent('a2ui:system-message', {
            detail: {
              role: 'assistant',
              label: 'Run result',
              content: toolResults.length ? output : `**Your Results**\n\n${output}`,
              result: true,
            },
          }));
        }
      }

      // The answer is a fact the canvas draws: the Answer node's news, and the tool
      // node's warning when the declared call did not return the design. No claim is
      // made about the file here — that is the write's to make, below.
      if (flowInputRef.current) {
        flowFactsRef.current = {
          ...flowFactsRef.current,
          running: false,
          answer: data?.error ? 'error' : 'received',
          answerLine: firstLineOf(output),
          toolWarning: toolWarnings[0],
        };
        publishRepairFlow();
      }

      // EVERY RUN IS JUDGED, and the Evals tab is where the verdicts collect — one row per
      // run, newest first, the same one-for-one list n8n's Evaluations view draws. The
      // backend asks Qwen to judge the answer (a repair's later check-verdict supersedes it,
      // written by settleRepair); this end only records and republishes what came back.
      if (!data?.error && (output || '').trim() && !repairingFinding) {
        const sessionId = currentPromptSessionRef.current;
        if (sessionId) {
          try {
            const res = await fetch(`${API_BASE}/prompt-sessions/${sessionId}/evaluations`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ output, ask: askOf(surfaceSections()), trigger: 'Run' }),
            });
            if (!res.ok) {
              logger.error('the run could not be recorded for evaluation', { sessionId, status: res.status });
            }
          } catch (e) {
            logger.error('the evaluation request never reached the backend', { sessionId, error: String(e) });
          }
        }
        void refreshEvaluations();
      }

      // ── THE RUN'S ANSWER IS NOT WRITTEN DOWN HERE ANY MORE ─────────────────
      //
      // It was: the output was saved through the same AI endpoint Save uses, because the
      // output column drew an answer the package kept nothing of (measured 2026-09-17: the
      // column held 279 characters while `compiled_output` was still 0, so a reload took it
      // off the screen). That fix was right about the SYMPTOM and wrong about the mechanism —
      // it made every Run call the model a second time, to save.
      //
      // The owner's rule (2026-09-18) is the one that holds: "people need to save manually
      // using the button, or get them an alert if they try to exit with unsaved changes."
      // Save does that job, and it is one click. A Run now runs and nothing else.
      //
      // THE COST, STATED: an answer that has not been saved is not on screen after a reload.
      // That is the same contract as every other edit in this column, and the person has a
      // button for it.

      // ── THE ANSWER BECOMES A FILE, AND ONLY THEN IS IT CHECKED ─────────────
      //
      // This is the step that was missing, and its absence is why the last run read
      // as a claim about a file: the answer was text, nothing put it anywhere, so
      // "Correction applied" could not have been true. The write comes FIRST and the
      // check comes after it, in that order, because the check has to read the new
      // file — and the chat says what the write returned, not what the model said.
      //
      // Two cases still do not settle anything, exactly as before: the run errored,
      // or the declared tool call did not return the design (in which case a change
      // was made without the thing it had to match — those lines are written down
      // here and go into the prompt, not into a file).
      if (repairingFinding && !data?.error && toolWarnings.length === 0) {
        const outcome = await writeAnswerBack(output || '', repairingFinding);
        // What the APP wrote, in the server's own numbers — the Data insert node's
        // only honest source. The model's claim about the file never was one.
        if (flowInputRef.current) {
          flowFactsRef.current = { ...flowFactsRef.current, write: outcome.report };
          publishRepairFlow();
        }
        // The repair is done being MADE. Whether it is done being REPAIRED is the
        // check's call, not this app's and not the model's: a fresh report settles it.
        //
        // Both halves have to be true for a verdict to exist at all — a file was
        // written, AND the checker was re-run against it. With nothing written there is
        // nothing to settle (the finding stays open, which is the truth, and the chat
        // above has just said why); with no re-run the only report available predates
        // the change, so reading it would be inventing a verdict.
        if (outcome.written && outcome.checked) {
          void settleRepair(repairingFinding);
        }
      } else if (repairingFinding) {
        // Nothing was written — and that is said here rather than left implied, because
        // a run that wrote nothing looks identical to a run that worked once the tab is
        // closed.
        speakRepairVerdict(
          "Nothing written — " +
          (data?.error
            ? "the run failed."
            : "the tool call returned no design, so the file was left alone."),
        );
      }

      /*
       * AND THE RUN'S STATE IS WRITTEN DOWN — HERE, WHERE EVERYTHING THE RUN MADE IS MADE
       * (owner, 2026-10-05: *"it has already RUN and that state should save on run"*).
       *
       * THIS IS THE SPOT THE OLD ANSWER-SAVE WAS DELETED FROM (see the note above): it used
       * to send the output through the full AI save — a second model call per Run — and the
       * cure for that cost was to save nothing automatic at all, which left the RUN's state
       * unwritten: the drawing, the folded prompt, the column it is made of. saveRunState
       * writes exactly that state and nothing else — no sections, no output, no model call —
       * so the rule that made the old save wrong ("people need to save manually") and the
       * rule this answers to ("that state should save on run") hold at the same time.
       *
       * A repair writes it once more when the check settles (settleRepair): the verdict is
       * the repair's last word, and the graph the card reopens on must carry it.
       */
      void saveRunState();
    } catch (err: any) {
      console.error('[WritingAreaIndex] Run execution failed', err);
      // Name the call. "Failed to fetch" on its own says nothing about WHICH
      // request died, and this path can fail before the request is even sent
      // (the dynamic import of authService) as well as during it.
      const why = err?.message || String(err);
      setCurrentPromptSession((prev: any) =>
        prev
          ? {
              ...prev,
              compiledOutput:
                `Error: ${why}\n\n` +
                // Name the address the request actually went to, resolved, plus the
                // page it was made from — the two facts that turn "Failed to fetch"
                // into something diagnosable. This message previously named a
                // RELATIVE path the browser had never been sent to, which sent the
                // reader looking at a proxy that was fine.
                `${runUrl}  (resolved: ${new URL(runUrl, location.origin).href}, from ${location.origin})\n\n` +
                `If this reads "Failed to fetch", the browser never got a response: the ` +
                `host is unreachable, the connection was dropped, or a module reloaded ` +
                `mid-flight. It is not a rejected prompt.`,
            }
          : prev
      );
      // And say it in the CHAT. Save failures already speak here
      // (a2ui:system-message); Run failures only wrote to the middle pane, so a
      // Run that died was silent everywhere a person actually looks.
      window.dispatchEvent(new CustomEvent('a2ui:system-message', {
        detail: {
          role: 'assistant',
          content:
            `⚠️ **Run failed.**\n\n\`POST /api/teacher/query\` did not complete: ${why}\n\n` +
            'The prompt itself was sent only if the request got that far. ' +
            '"Failed to fetch" means the browser got no response at all — the request was ' +
            'dropped or aborted, not rejected.',
        },
      }));
    } finally {
      setIsComposerRunning(false);
      // AND THE DRAWING IS UNLOCKED WITH THE SPINNER — the same fact, the same breath, every exit
      // from the run: success, a rejected request, or a thrown one all pass through here, so the
      // lock can never outlive the work it was protecting.
      setCanvasRunning(false);
      // Optional: give the layout a hint to equalize widths when middle appears
      window.dispatchEvent(new CustomEvent('reset-columns-to-equal-widths', { detail: { isThirdColumnOpening: true } }));
    }
  };

  // `save-requested` HAD NO SENDER, so this whole path was unreachable — the registry
  // declared it as the editor's event, but <prompt-section-editor> emits none of that kind
  // (its contract is section-update/add/remove/reorder), and the control bar's Save speaks
  // through `save-click` (below) into the same handler this used. Removed rather than kept:
  // a listener nobody can fire is a claim that something is wired.

  // Clear from the compiled-output-viewer "Clear" button → collapse middle column
  const handleClearOutput = () => {
    console.log('[WritingAreaIndex] clear-output — collapsing middle column');
    setCurrentPromptSession((prev: any) =>
      prev ? { ...prev, compiledOutput: '' } : prev
    );
    // The column's CLOSE was never implemented: the flag this used to write (`middleOpen`)
    // was read by nothing, and the middle column's presence is the model's. Clearing the
    // output empties the viewer; it does not take the column away.
  };

    console.log('✅ [WritingAreaIndex] Setting up event listeners');

    // Listen for save-template event. Sections come from the surface's data model — the
    // composer column's binding. No DOM read, no fallback.
    const handleSaveTemplateEvent = () => {
      const sections = surfaceSections();
      const compiledOutput = readLiveOutput();
      console.log('[save-template] Reading', sections.length, 'sections +', compiledOutput.length, 'chars of output from the surface');
      handleSavePromptRef.current?.(compiledOutput, sections);
    };
    window.addEventListener("save-template", handleSaveTemplateEvent);

    window.addEventListener("run-requested", handleRunRequested);

    /*
     * THE RUN SHE APPROVED IS THE RUN THAT GOES.
     *
     * The chat panel speaks this event when her reply carries `<run_ok/>`. It releases the
     * Run this file is holding, and it releases exactly that one: the sections kept in
     * `heldRunRef` are re-dispatched as the same `run-requested`, which now passes a gate
     * that has already been answered and clears both records on the way through.
     *
     * AN APPROVAL WITH NOTHING HELD IS IGNORED. She can emit `<run_ok/>` in a conversation
     * about something else, and a flag set then would silently wave through the NEXT run —
     * which is a person's prompt going out unreviewed because of a sentence she wrote
     * about a different one. With nothing held there is nothing to release.
     */
    const handleRunApproved = () => {
      const held = heldRunRef.current;
      if (!held) {
        console.log('[WritingAreaIndex] Run approval arrived with nothing held — ignored');
        return;
      }
      heldRunRef.current = null;
      runApprovedRef.current = true;
      console.log('[WritingAreaIndex] Run released by her review');
      window.dispatchEvent(new CustomEvent('run-requested', { detail: held }));
    };
    window.addEventListener('a2ui:run-approved', handleRunApproved);

    /*
     * AND SHE SAID NO. The run stays held and the button comes back out of its spin — the whole
     * of what this event does. Nothing here closes the panel, clears the column, or takes her
     * words off the screen: she has just told the person what to fix, and the next thing they
     * do is read it and fix it.
     */
    const handleRunBlocked = () => {
      if (!heldRunRef.current) return;
      setIsComposerRunning(false);
      /*
       * AND THE HELD RUN IS RELEASED — NOT KEPT. It used to stay in the ref, so the NEXT
       * `<run_ok/>` in ANY later reply — a `review-prompt` turn, an unrelated question —
       * released a Run she had already blocked, with a payload the person had since edited.
       * A block means this Run is over; pressing Run again is what starts the next review.
       */
      heldRunRef.current = null;
      runApprovedRef.current = false;
      console.log('[WritingAreaIndex] Run stays held — she blocked it');
    };
    window.addEventListener('a2ui:run-blocked', handleRunBlocked);

    /*
     * APPLY ALL — THE WHOLE LIST WORKED IN ONE PRESS, AND THEN THE RUN GOES.
     *
     * The owner, 2026-09-23: "she should automatically run it… we should just give a user the
     * ability to apply all. Previously she was handing those over one at a time, which we don't
     * want," and "expose the canvas layer as the third column, just like if she had to click the
     * button."
     *
     * WHAT THE APP MAY APPLY IS THE CHECKLIST'S OWN LINE (`repair.via`): `action` is the app's
     * business (move a tool into the Tool Call step, merge a row that stands twice), `ask` is
     * offered and never done uninvited (a save makes a package that did not exist), `words` is
     * the person's (a name, a description, a row's content) — never invented into somebody's
     * prompt by a button. So Fix all clears what holds the Run and STOPS, telling her the rest.
     *
     * AND IT RUNS BY THE BUTTON'S OWN PATH — `a2ui:run-approved` is what a person's Run press
     * ends in (see handleRunApproved), which re-enters `handleRunRequested` with the held payload
     * and this flag set. Not a shortcut around the gate: the gate has been passed, on the list
     * this shell computed, and the canvas arrives as the third column exactly as it would have.
     *
     * WHAT IS LEFT IS THE LIST MINUS WHAT WAS JUST APPLIED — computed here rather than re-read,
     * because the writes are still being committed by React and a second read would answer with
     * the prompt as it was a moment ago.
     */
    const onFixAll = async (): Promise<void> => {
      const unmet = reviewFlow({
        title: surfaceTitle(),
        description: surfaceDescription(),
        saved: Boolean(currentPromptSessionObjRef.current?.id),
        // THE ONE READER, the same one handleRunRequested reviews and the same one the run below
        // sends. It was `surfaceSections()` here and the event's payload there: the same list
        // twice, and only by the luck of who called it.
        sections: rowsForDecision() as FlowSeatInput[],
        register: await readToolRegister(),
      });
      // THE SAME PREDICATE THE OFFER USED — see runHoldingRepairs. One definition, so the button
      // that was drawn and the repairs this press makes cannot come apart.
      const applyable = runHoldingRepairs(unmet);
      const left = unmet.filter((u) => !applyable.includes(u));
      for (const u of applyable) {
        if (u.repair.kind === 'move-tool') {
          window.dispatchEvent(new CustomEvent('move-tool', {
            detail: { name: u.repair.tool, into: u.repair.into },
          }));
        } else if (u.repair.kind === 'merge-seat') {
          window.dispatchEvent(new CustomEvent('merge-seat', {
            detail: { from: u.repair.from, into: u.repair.into },
          }));
        }
      }
      /*
       * NOTHING HOLDS IT ANY MORE — SO IT RUNS, AND IT RUNS WHETHER OR NOT A RUN IS STILL HELD.
       *
       * The held Run used to be the only way this could go, and that is where the owner's flow
       * stopped: "when those blockers are satisfied, she should automatically run the prompt and
       * expose the canvas layer." A held Run is released through `a2ui:run-approved` — but Grace
       * BLOCKING a Run ENDS it (`handleRunBlocked` clears the held payload, deliberately: a block
       * means that Run is over). So by the time the person has worked the list and pressed Apply
       * all, there is usually nothing left to release, and the press cleared the blockers and then
       * asked her a question that could not run anything. Watched on the live package, 2026-09-23:
       * the list came back "nothing — every requirement is met" and no canvas appeared.
       *
       * SO THIS STARTS THE RUN ITSELF when nothing is held. It is not a shortcut around the gate:
       * the gate is this list, the shell has just computed it, and it is EMPTY — there is nothing
       * for her to hold it on. `runApprovedRef` is set for the same reason she sets it in
       * `handleAiRun`, so the released run passes the gate it has already cleared.
       *
       * THE ROWS COME FROM THE EDITOR, NOT THE SURFACE, and that is the whole of getting the run
       * right. The repairs above were DISPATCHED, not awaited: the editor applies them to its own
       * list synchronously, while the surface's copy is committed by React on the next render. Read
       * the surface here and the run would send the prompt as it was BEFORE the repairs — the
       * canvas would draw the old picture over a repaired prompt. The editor IS the source of truth
       * for the rows and it answers now.
       */
      if (!holdsRun(left)) {
        if (heldRunRef.current) {
          window.dispatchEvent(new CustomEvent('a2ui:run-approved'));
          return;
        }
        // THE ROWS COME FROM THE ONE READER, through the listener rather than by hand: the
        // repairs above were DISPATCHED, not awaited, and rowsForDecision reads the editor
        // first — so the run sends the prompt WITH the repairs, not the one from a moment ago.
        runApprovedRef.current = true;
        console.log('[WritingAreaIndex] Apply all cleared the list — starting the run');
        window.dispatchEvent(new CustomEvent('run-requested', { detail: { sections: rowsForDecision() } }));
        return;
      }
      window.dispatchEvent(new CustomEvent('a2ui:ask-grace', {
        detail: {
          review: 'run',
          request: [
            'A person pressed Apply all. The app has made every repair it can make on its own —',
            'the moves and the merges — and it may not do the rest: a save is theirs to agree to,',
            'and the words in a prompt are theirs to write.',
            left.length
              ? 'THIS IS THE WHOLE LIST OF WHAT IS STILL UNMET. Reply only to what is needed: say'
              : 'NOTHING IS UNMET any more. Reply only to what is needed: say',
            ...left.map((u) => `  · ${u.id}${u.level === 'advisory' ? ' (advisory — worth saying, does not hold the Run)' : ''} — ${u.why}`),
            left.length
              ? 'Offer each repair as a button the person can press and end with <run_blocked/>.'
              : 'Congratulate them in one short sentence starting with 🍾 and end with <run_ok/>.',
          ].join('\n'),
        },
      }));
    };
    window.addEventListener('a2ui:fix-all', onFixAll as EventListener);

    /*
     * SHE ASKS FOR THE RUN HERSELF — `<run_prompt/>` in a reply.
     *
     * The tag has been in her instructions since the retired React seat, and it has been
     * dispatching `ai-run-prompt` the whole time with NOTHING on the other end (the listener
     * that used to exist went with the seat). So a reply that said "I'll run it now" ran
     * nothing: the person read a promise and watched a screen that did not change. The owner,
     * 2026-09-23: "the AI can initiate the run again — I want to see the spinner."
     *
     * IT SKIPS THE REVIEW, AND MUST. The gate exists so that a prompt is checked before it
     * runs; she IS the check, and asking her to re-approve her own decision is a loop — she
     * would review it, answer `<run_ok/>`, and the released run would arrive at the same gate
     * again. `runApprovedRef` is set here for exactly that reason, and the released run clears
     * it on the way through like any other approval.
     *
     * THE SPINNER IS THE RUN'S OWN, from the same place the button's click gets it: the
     * controls are told the run is on, so a run she starts looks identical to one the person
     * pressed — which is the whole point of her being able to start one.
     */
    const handleAiRun = () => {
      if (runApprovedRef.current) return; // a run is already released and on its way
      const held = heldRunRef.current;
      heldRunRef.current = null;
      runApprovedRef.current = true;
      console.log('[WritingAreaIndex] Run asked for by Grace');
      if (!held) setIsComposerRunning(true);
      window.dispatchEvent(new CustomEvent('run-requested', { detail: held ?? { sections: surfaceSections() } }));
    };
    window.addEventListener('ai-run-prompt', handleAiRun);
    window.addEventListener("clear-output", handleClearOutput);

    /*
     * THE PROMPT'S TITLE, FROM WHICHEVER END WROTE IT.
     *
     * Two things can set it and they must land in the same place: the person typing in
     * <left-column-header> (`title-change`, composed out of the surface) and Grace
     * writing <set_title> in the chat (`set-prompt-title`, dispatched by the panel when
     * it strips the tag). Both go through the ONE rename path that already existed,
     * `handlePromptTitleChange`, so the database, the React copy and the console card are
     * updated by the same code whichever end started it. A second writer would have been
     * a second truth about what this package is called.
     */
    const handleTitleSet = (e: Event) => {
      const next = String(((e as CustomEvent).detail || {}).title ?? '').trim();
      if (next) void handlePromptTitleChange(next);
    };
    window.addEventListener("title-change", handleTitleSet);
    window.addEventListener("set-prompt-title", handleTitleSet);

    /*
     * THE DESCRIPTION, WHICH HAD NO WRITER.
     *
     * The package's one-line description is on the console card and is asked for by name in the
     * review before a Run — and nothing in the app could write it. Grace tried, with a tag she
     * invented, and the description stayed empty while her reply said it was added (measured
     * 2026-09-23).
     *
     * IT GOES THROUGH THE SAVE PATH, because the description lives on the session row and that
     * path is what knows how to reach it. Unsaved packages are not a special case: a name on a
     * draft lives on the surface until the first save, and the same is true of this.
     */
    const handleDescriptionSet = (e: Event) => {
      const description = String(((e as CustomEvent).detail || {}).description ?? '').trim();
      if (!description) return;
      void handlePromptDescriptionChange(description);
    };
    window.addEventListener("set-package-description", handleDescriptionSet);

    // Wire the bottom control bar (control-bar from Figma node 40000761:261) to the *existing* CRUD paths only.
    // No new save/run/version logic — re-uses handleSavePromptRef + run-requested dispatch exactly as the Lit editor does.
    // Control-bar save: sections from the surface's data model (same as save-template).
    const handleControlBarSave = () => {
      const sections = surfaceSections();
      const compiledOutput = readLiveOutput();
      console.log('[control-bar] save-click →', sections.length, 'sections +', compiledOutput.length, 'chars of output from the surface');
      handleSavePromptRef.current?.(compiledOutput, sections);
    };
    const handleControlBarRun = () => {
      const sections = surfaceSections();
      console.log('[control-bar] run-click → dispatching run-requested (existing path)');
      window.dispatchEvent(new CustomEvent('run-requested', { detail: { sections } }));
    };
    window.addEventListener('save-click', handleControlBarSave as EventListener);
    window.addEventListener('run-click', handleControlBarRun as EventListener);

    // Wire undo-click from control-bar (Figma node 40000761:271 "undo-last-state-milivis")
    // TODO: undo-last-state-milivis has no backend handler yet. Wire the event now,
    // implement the Milvus state rollback when the backend supports it.
    const handleControlBarUndo = () => {
      console.log('[control-bar] undo-click → undo-last-state-milivis (no backend handler yet)');
      // Future: dispatch undo to Milvus state manager
      // window.dispatchEvent(new CustomEvent('undo-last-state'));
    };
    window.addEventListener('undo-click', handleControlBarUndo as EventListener);

    // DELETED: prompt-session-loaded listener - was database fallback bypassing AI assembly
    // All session loads MUST go through AI assembly via handleOpenPromptFromConsole
    const handlePromptSessionLoaded = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      if (detail.sessionId) {
        handleOpenPromptFromConsole(detail.sessionId);
      }
    };
    window.addEventListener("prompt-session-loaded", handlePromptSessionLoaded);

    // Listen for prompt-session-deleted from LeftVerticalMenu
    // Uses ref to avoid stale closure (effect deps don't change on prompt load)
    const handlePromptSessionDeleted = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      if (detail.id && currentPromptSessionRef.current === detail.id) {
        setCurrentPromptSession(null);
      }
    };
    window.addEventListener("prompt-session-deleted", handlePromptSessionDeleted);

    // Listen for start-new-prompt from LeftVerticalMenu — clear workspace without DB save
    const handleStartNewPrompt = () => {
      setCurrentPromptSession(null);
      setPromptLoadKey(prev => prev + 1);
    };
    window.addEventListener("start-new-prompt", handleStartNewPrompt);
    console.log('✅ [WritingAreaIndex] Event listeners set up');

    return () => {
      window.removeEventListener("save-template", handleSaveTemplateEvent);
      window.removeEventListener("run-requested", handleRunRequested);
      window.removeEventListener('a2ui:run-approved', handleRunApproved);
      window.removeEventListener('a2ui:run-blocked', handleRunBlocked);
      window.removeEventListener('a2ui:fix-all', onFixAll as EventListener);
      window.removeEventListener('ai-run-prompt', handleAiRun);
      window.removeEventListener("clear-output", handleClearOutput);
      window.removeEventListener("title-change", handleTitleSet);
      window.removeEventListener("set-prompt-title", handleTitleSet);
      window.removeEventListener("set-package-description", handleDescriptionSet);
      window.removeEventListener('save-click', handleControlBarSave as EventListener);
      window.removeEventListener('run-click', handleControlBarRun as EventListener);
      window.removeEventListener('undo-click', handleControlBarUndo as EventListener);
      window.removeEventListener("prompt-session-loaded", handlePromptSessionLoaded);
      window.removeEventListener("prompt-session-deleted", handlePromptSessionDeleted);
      window.removeEventListener("start-new-prompt", handleStartNewPrompt);
    };
  }, []);
}
