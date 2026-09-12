/**
 * The Run stream — the frame reader, held down.
 *
 * This parsing exists because the output column went blank for ~28s while a Run
 * was in flight, and the fix only works if frames are read correctly as they
 * arrive. Nothing about a chunk boundary is guaranteed: a chunk can end
 * mid-frame, mid-JSON, even mid-character, and a frame that straddles two chunks
 * is dropped silently if the remainder is not carried over — which looks exactly
 * like the model having nothing to say.
 *
 * The last time this code assumed a stream shape it did not get, the column
 * stayed empty and reported "(No output returned.)" (WritingAreaIndex, the comment
 * above the run fetch). Hence the tests.
 */
import { describe, it, expect } from 'vitest';
import { parseSseBuffer, consumeRunStream } from '@/shared/runStream';

describe('parseSseBuffer', () => {
  it('reads one whole frame', () => {
    const { events, rest } = parseSseBuffer('data: {"type":"reasoning","delta":"hi"}\n\n');
    expect(events).toEqual([{ type: 'reasoning', delta: 'hi' }]);
    expect(rest).toBe('');
  });

  it('reads several frames and keeps the incomplete tail', () => {
    const { events, rest } = parseSseBuffer(
      'data: {"type":"reasoning","delta":"a"}\n\n' +
      'data: {"type":"content","delta":"b"}\n\n' +
      'data: {"type":"cont'
    );
    expect(events.map((e) => e.type)).toEqual(['reasoning', 'content']);
    expect(rest).toBe('data: {"type":"cont');
  });

  it('carries a remainder into the next chunk so a split frame is not lost', () => {
    // The exact failure this guards: the chunk boundary lands in the middle of the
    // JSON. Without the carried remainder, `done` never arrives and the run looks
    // like it produced nothing.
    const first = parseSseBuffer('data: {"type":"done","content":"hal');
    expect(first.events).toEqual([]);
    const second = parseSseBuffer(first.rest + 'f"}\n\n');
    expect(second.events).toEqual([{ type: 'done', content: 'half' }]);
  });

  it('joins multi-line data and ignores frames with no data', () => {
    const { events } = parseSseBuffer(': keep-alive\n\n' + 'data: {"type":"status",\n\n');
    // A malformed frame is dropped, not guessed at — and it must not throw.
    expect(events).toEqual([]);
  });

  it('drops an unparseable frame without throwing', () => {
    const { events } = parseSseBuffer('data: {not json}\n\ndata: {"type":"content","delta":"ok"}\n\n');
    expect(events).toEqual([{ type: 'content', delta: 'ok' }]);
  });
});

describe('consumeRunStream', () => {
  const streamOf = (chunks: string[]) =>
    new Response(
      new ReadableStream({
        start(controller) {
          for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
          controller.close();
        },
      }),
    );

  it('routes each frame to its handler and reports completion', async () => {
    const seen: string[] = [];
    const outcome = await consumeRunStream(
      streamOf([
        'data: {"type":"status","stage":"tools","message":"Reading the design — node 40000746:6"}\n\n'
        + 'data: {"type":"reasoning","delta":"The',
        ' frame "}\n\n',
        'data: {"type":"content","delta":"## Heading"}\n\n'
        + 'data: {"type":"done","content":"## Heading","tool_warnings":[]}\n\n',
      ]),
      {
        onStatus: (message, stage) => seen.push(`status:${stage}:${message}`),
        onReasoning: (delta) => seen.push(`reasoning:${delta}`),
        onContent: (delta) => seen.push(`content:${delta}`),
        onDone: (event) => seen.push(`done:${event.content}`),
      },
    );

    expect(outcome).toBe('done');
    expect(seen).toEqual([
      'status:tools:Reading the design — node 40000746:6',
      // One frame, even though the network split it in the middle of its JSON:
      // the carried remainder reassembles it, so no delta is lost and none is
      // duplicated.
      'reasoning:The frame ',
      'content:## Heading',
      'done:## Heading',
    ]);
  });

  it('reports an error frame and does NOT claim a finished run', async () => {
    const errors: string[] = [];
    const outcome = await consumeRunStream(
      streamOf(['data: {"type":"error","message":"No providers configured."}\n\n']),
      { onError: (m) => errors.push(m) },
    );
    // 'error', not 'incomplete': the endpoint spoke. The caller reports it rather
    // than falling back, which would spend a second call to hit the same failure.
    expect(outcome).toBe('error');
    expect(errors).toEqual(['No providers configured.']);
  });

  it('reports an incomplete stream when no ending frame arrives', async () => {
    const outcome = await consumeRunStream(
      streamOf(['data: {"type":"reasoning","delta":"thinking…"}\n\n']),
      {},
    );
    expect(outcome).toBe('incomplete');
  });

  it('reports an incomplete stream when there is no body at all', async () => {
    const outcome = await consumeRunStream(new Response(null), {});
    expect(outcome).toBe('incomplete');
  });
});
