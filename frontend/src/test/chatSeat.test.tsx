/**
 * Grace's seat survives the layout swap.
 *
 * This is a test for a measured failure, not for a data structure. A repair is launched from
 * the console's catalog list; the surface assembly fails; the fallback posts the ask as a
 * synthetic message. The next assembly succeeds and sets `headerTab` to 'composer', which
 * unmounts the console's chat instance. While the conversation lived in that instance's
 * `useState`, the ask went with it — the log said it had been posted, and a search of the
 * DOM for its text found nothing. "Silent when I load a repair" is that sentence.
 *
 * So these hold the three properties that make her audible at all:
 *
 *   1. a message posted while NO seat is mounted is still there for the next seat that is;
 *   2. it is still there after the seat that heard it is unmounted — the swap;
 *   3. it is appended ONCE, however many seats are mounted, because the listener belongs to
 *      the seat and not to the view.
 *
 * A fourth holds the shape: `set` still takes a value or an updater, which is why the
 * component's twenty call sites did not have to change to become correct.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import {
  useChatSeat,
  readChatSeat,
  setChatSeatMessages,
  clearChatSeat,
  setChatSeatConversation,
  setChatSeatPersister,
} from '@/shared/chatSeat';

/** A mounted seat, doing the only thing a seat does with the list: reading it. */
function Seat({ label }: { label: string }) {
  const [messages] = useChatSeat();
  return (
    <ul data-testid={label}>
      {messages.map((m, i) => (
        <li key={i}>{`${m.role}:${m.content}`}</li>
      ))}
    </ul>
  );
}

/** Speak the way the app speaks — through the window event, not through a prop. */
function speak(content: string, role = 'assistant') {
  act(() => {
    window.dispatchEvent(
      new CustomEvent('a2ui:system-message', { detail: { role, content } }),
    );
  });
}

beforeEach(() => {
  clearChatSeat();
  setChatSeatConversation(null);
  setChatSeatPersister(null);
});

describe('the seat writes its messages into the package', () => {
  // `conversations.session_id` is NOT NULL: a conversation belongs to a prompt PACKAGE and
  // its messages cascade from it. So everything she says about that package belongs in that
  // conversation. It did not work that way — only the person's typed turn and her LLM reply
  // were persisted, so every surface greeting and the repair guidance lived in React state
  // and died on reload. These hold the write.
  it("writes a greeting down, against the package's conversation", () => {
    const written: Array<[string, string]> = [];
    setChatSeatConversation('conv-1730');
    setChatSeatPersister((id, content) => written.push([id, content]));

    speak('Composer ready. Select a role and enter your prompt.');

    expect(written).toEqual([
      ['conv-1730', 'Composer ready. Select a role and enter your prompt.'],
    ]);
  });

  it('writes nothing while no conversation exists for the package', () => {
    const written: Array<[string, string]> = [];
    setChatSeatPersister((id, content) => written.push([id, content]));
    // No conversation set — a package that has never been saved has none yet. The message
    // still lands in the seat; it simply has nothing to be written to.
    speak('spoken before the package exists');
    expect(written).toEqual([]);
    expect(readChatSeat()).toHaveLength(1);
  });

  it("does not write a person's own words, which are persisted on their own path", () => {
    const written: Array<[string, string]> = [];
    setChatSeatConversation('conv-1730');
    setChatSeatPersister((id, content) => written.push([id, content]));

    speak('what the person typed', 'user');

    // Written once already, by handleSend. Routing it through the seat as well would put
    // every question in the package's history twice.
    expect(written).toEqual([]);
  });
});

describe("Grace's seat survives the layout swap", () => {
  it('holds a message posted while NO seat was mounted', () => {
    speak('4 lines in that section are yours to write.');
    expect(readChatSeat().map((m) => m.content)).toEqual([
      '4 lines in that section are yours to write.',
    ]);
  });

  it('shows that message to the seat that mounts afterwards', () => {
    speak('the ask, spoken before any seat existed');
    render(<Seat label="console" />);
    expect(screen.getByTestId('console').textContent).toContain(
      'the ask, spoken before any seat existed',
    );
  });

  it('is still there after the seat that heard it is unmounted', () => {
    const consoleSeat = render(<Seat label="console" />);
    speak('repair ask');
    expect(screen.getByTestId('console').textContent).toContain('repair ask');

    // The tab changes: the console's instance unmounts, the composer's mounts. Before this,
    // that is the exact moment the message was destroyed.
    consoleSeat.unmount();
    render(<Seat label="composer" />);
    expect(screen.getByTestId('composer').textContent).toContain('repair ask');
  });

  it('appends ONCE, with two seats mounted', () => {
    render(<Seat label="console" />);
    render(<Seat label="composer" />);
    speak('said once');

    // The listener is the seat's, installed once — not one per instance. Two instances
    // would otherwise each append the same message, and a doubled ask is its own defect.
    expect(readChatSeat().filter((m) => m.content === 'said once')).toHaveLength(1);
    expect(screen.getByTestId('console').textContent).toContain('said once');
    expect(screen.getByTestId('composer').textContent).toContain('said once');
  });

  it('drops an empty message instead of drawing a blank bubble', () => {
    speak('');
    expect(readChatSeat()).toHaveLength(0);
  });

  it("keeps useState's contract, so the component's call sites did not change", () => {
    setChatSeatMessages([{ role: 'assistant', content: 'one' }]);
    setChatSeatMessages((prev) => [...prev, { role: 'user', content: 'two' }]);
    expect(readChatSeat().map((m) => m.content)).toEqual(['one', 'two']);

    setChatSeatMessages([]);
    expect(readChatSeat()).toHaveLength(0);
  });
});
