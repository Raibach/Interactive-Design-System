/**
 * THE ASSEMBLY'S TWO CONSTANTS — shared by every surface host.
 *
 * They lived inside `WritingAreaIndex.tsx` while the shell was the only host. The Console now
 * assembles its own surface, and the Composer will too, so the two numbers have one home here
 * rather than three copies that can drift.
 */
export const AI_STANDBY_MESSAGE = 'Standby — AI is building this interface…';

/**
 * The outer bound on one assembly request, in milliseconds. The real budget is the server's.
 *
 * This has been wrong in both directions, so record the measurements:
 *   - 10s  → too short. It was set on the reasoning "warm assemblies run 1.5-2.7s", which is only
 *            true when this is the ONLY model call in flight. The catalog check measures 28.5s and
 *            the backend runs `query_llm` synchronously inside an async handler, so it blocks the
 *            event loop and this request queues behind it. Every load aborted at 10s and the
 *            console never assembled.
 *   - 30s  → also too short for the same reason once the queue is involved.
 *
 * Long enough that a real call is never killed mid-flight. Aborting is only correct for a request
 * that is genuinely dead, and a model call is not dead just because it is slow. The catalog check
 * does NOT come through here — it has its own fetch with no client cap.
 */
export const ASSEMBLY_TIMEOUT_MS = 120000;
